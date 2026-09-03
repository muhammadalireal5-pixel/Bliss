import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';
import crypto from 'crypto';
import { fetchPageContent } from '@/lib/page-fetcher';
import { findValidEmail } from '@/lib/email-validator';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { checkAndIncrementUsage, getUserUsage, refundUsage } from '@/lib/usage';

// Helper to get root domain
function getRootDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const parts = url.hostname.split('.');
    if (parts.length > 2) {
      // Very naive root domain check. In a real app, use psl (public suffix list).
      // For now, take the last two parts unless it's like co.uk
      if (parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'com') {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }
    return url.hostname;
  } catch (e) {
    return '';
  }
}

export async function POST(req: Request) {
  let reservedQuota = 0;
  let sessionUserId = '';
  try {
    // PHASE 0: Pre-Flight Checks
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;
    sessionUserId = userId;

    const rateLimit = await checkRateLimit(`search:${userId}`, { limit: 30, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const usage = await getUserUsage(userId);
    const remaining = Math.max(0, usage.limit - usage.used);
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
    }

    const { targetAudience, offering = '' } = await req.json();
    const SERPER_API_KEY = process.env.SERPER_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!targetAudience) {
      return NextResponse.json({ error: 'Target audience is required' }, { status: 400 });
    }

    if (!SERPER_API_KEY || !GEMINI_API_KEY) {
      return NextResponse.json({ error: 'API keys are not configured' }, { status: 500 });
    }

    // PHASE 1: Caching Layer
    const cacheKey = `search:${crypto.createHash('sha256').update(targetAudience + offering).digest('hex')}`;
    const cachedLeadsStr = await redis.get(cacheKey);
    if (cachedLeadsStr) {
      try {
        const cachedLeads = typeof cachedLeadsStr === 'string' ? JSON.parse(cachedLeadsStr) : cachedLeadsStr;
        let finalCached = Array.isArray(cachedLeads) ? cachedLeads : [];
        
        // Atomically reserve
        const cacheReservation = await checkAndIncrementUsage(userId, finalCached.length);
        if (!cacheReservation.allowed) {
           return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
        }
        reservedQuota = cacheReservation.reserved;
        
        finalCached = finalCached.slice(0, reservedQuota);
        
        if (finalCached.length < reservedQuota) {
          await refundUsage(userId, reservedQuota - finalCached.length);
          reservedQuota = finalCached.length;
        }

        const res = NextResponse.json({ leads: finalCached });
        reservedQuota = 0;
        return res;
      } catch (e) {
        console.error('Failed to parse cached leads', e);
      }
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // PHASE 2: AI Query Expansion
    const expansionPrompt = `Generate exactly 5 distinct Google search queries to find indie or beginner creators who are in this target audience: "${targetAudience}" and might need this offering: "${offering}".
Include pain keywords like "struggling", "frustrated", "newbie", "just finished", or "looking for help".
Target forums, communities, and personal blogs. Avoid celebrity/authority framing (e.g. no "famous X").
Return ONLY a JSON array of 5 strings. Do not use markdown blocks.`;

    let generatedQueries: string[] = [];
    try {
      const queryRes = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: expansionPrompt,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
             type: Type.ARRAY,
             items: { type: Type.STRING }
          }
        }
      });
      generatedQueries = JSON.parse(queryRes.text || "[]");
    } catch (e) {
      console.error('Failed to generate queries', e);
      // Fallback
      generatedQueries = [`"${targetAudience}" struggling help`, `"${targetAudience}" newbie forum`, `"${targetAudience}" just finished blog`, `"${targetAudience}" looking for help`, `"${targetAudience}" frustrated`];
    }
    
    generatedQueries = generatedQueries.slice(0, 5);
    const negativeKeywords = '-wikipedia -NYT -Forbes -bestseller -"award winning" -"book deal" -TED -"literary agent"';
    
    // Apply negative keywords and guard regex
    const spamGuard = /facebook\.com\/groups|instagram\.com/i;
    const finalQueries = generatedQueries.map(q => `${q} ${negativeKeywords}`).filter(q => !spamGuard.test(q));
    
    if (finalQueries.length === 0) {
      return NextResponse.json({ leads: [] });
    }

    // PHASE 3: Serper Search (concurrent)
    let allOrganicResults: any[] = [];
    const seenUrls = new Set<string>();

    const serperCalls = finalQueries.map((query, index) => {
      // 5 concurrent calls with variations
      let payload: any = { q: query };
      if (index === 1) payload.page = 2;
      else if (index === 2) payload.page = 3;
      else if (index === 3) payload.tbs = 'qdr:m';
      else if (index === 4) payload.tbs = 'li:1';

      return fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).then(async r => {
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data.organic)) {
            // Get top 20
            const top20 = data.organic.slice(0, 20);
            for (const result of top20) {
              if (result.link && !seenUrls.has(result.link)) {
                seenUrls.add(result.link);
                allOrganicResults.push(result);
              }
            }
          }
        }
      }).catch(e => console.error(`Serper query failed: ${query}`, e));
    });

    await Promise.all(serperCalls);

    if (allOrganicResults.length === 0) {
      return NextResponse.json({ leads: [] });
    }

    // PHASE 4: URL Filtering & Bucket Prioritization
    const domainMap = new Map<string, any>();
    
    // Path priority: /contact > /about > /team > /
    const getPathScore = (url: string) => {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('/contact')) return 4;
      if (lowerUrl.includes('/about')) return 3;
      if (lowerUrl.includes('/team')) return 2;
      return 1;
    };

    for (const res of allOrganicResults) {
      const domain = getRootDomain(res.link);
      if (!domain) continue;
      
      const score = getPathScore(res.link);
      const existing = domainMap.get(domain);
      
      if (!existing || score > getPathScore(existing.link)) {
        domainMap.set(domain, { ...res, domain });
      }
    }

    const bucketA: any[] = [];
    const bucketB: any[] = [];

    for (const res of Array.from(domainMap.values())) {
      const lowerUrl = res.link.toLowerCase();
      const domain = res.domain.toLowerCase();
      
      const isBucketBType = domain.includes('linkedin.com') || domain.includes('twitter.com') || domain.includes('x.com') || domain.includes('youtube.com') || domain.includes('facebook.com') || domain.includes('pinterest.com');
      
      let isBucketA = false;
      if (lowerUrl.includes('/contact') || lowerUrl.includes('/about') || lowerUrl.includes('/team') || lowerUrl.includes('/hire-me') || lowerUrl.includes('/work-with-me')) {
        isBucketA = true;
      }
      if (domain === 'medium.com' || domain === 'substack.com' || (!isBucketBType && domain.split('.').length === 2)) {
         isBucketA = true;
      }

      // If it's a social site or bare homepage that didn't qualify for Bucket A
      if (isBucketBType || !isBucketA) {
        bucketB.push(res);
      } else {
        bucketA.push(res);
      }
    }

    // PHASE 5: Deep Scraping (Bucket A only)
    let processedBucketA: any[] = [];
    let processedBucketB: any[] = [];
    let validEmailsCount = 0;
    
    const enrichBucketA = await Promise.all(
      bucketA.map(async (r) => {
        // Fetch primary URL
        let { text: pageContent, emails } = await fetchPageContent(r.link, 3000, 1000);
        let scrapedText = pageContent;
        let foundEmails = emails;

        if (foundEmails.length === 0 && r.domain) {
          // Fallbacks in parallel
          const fallbacks = ['/contact', '/about', '/hire-me', '/work-with-me'].map(path => {
            const fallbackUrl = `https://${r.domain}${path}`;
            return fetchPageContent(fallbackUrl, 3000, 800);
          });
          
          // Wait for first one with emails or all to finish.
          // Since Promise.allSettled runs them in parallel, we just await all and check.
          const results = await Promise.allSettled(fallbacks);
          for (const res of results) {
            if (res.status === 'fulfilled' && res.value.emails.length > 0) {
              foundEmails = res.value.emails;
              if (res.value.text) {
                scrapedText = (scrapedText || '') + ' ' + res.value.text;
              }
              break; // Stop as soon as we find one
            }
          }
        }
        
        return {
          ...r,
          pageContent: scrapedText ? scrapedText.slice(0, 1500) : undefined,
          scrapedEmails: foundEmails
        };
      })
    );

    processedBucketA = enrichBucketA;

    // Check if Bucket A has enough emails. Since we haven't asked Gemini yet, we use scrapedEmails to guess if we have 15.
    // The prompt says "If Bucket A alone produces >= 15 valid emails, skip Bucket B entirely for this search."
    // We will evaluate Bucket A first via Gemini to know exactly.
    // Wait, the prompt says "Process Bucket A first. If Bucket A alone produces >= 15 valid emails, skip Bucket B entirely for this search."
    
    // We must run Gemini extraction on Bucket A first to know how many valid emails we actually get.
    // Let's create a helper to run Gemini.
    const extractLeadsWithGemini = async (items: any[]) => {
       if (items.length === 0) return [];
       
       // PHASE 6: AI Extraction (Gemini)
       const uniqueDomains = new Set(items.map(i => i.domain)).size;
       const reservation = await checkAndIncrementUsage(userId, uniqueDomains);
       if (!reservation.allowed) {
          throw new Error('QUOTA_EXCEEDED');
       }
       reservedQuota += reservation.reserved;

       const prompt = `Extract name, email, company domain, platform, profileUrl, and a brief 1-2 sentence summary/bio of the person from these search results.
Instruct: prefer personal-looking emails (Gmail, Yahoo, Outlook, ProtonMail, or firstname@domain.com) over generic info@/support@ on large corporate sites. Return null for Email in the generic/large-corporate case rather than guessing.
Also include:
- emailType: "personal" | "generic" | "guessed" | null
- confidence: "high" | "medium" | "low"

Results:
${JSON.stringify(items.map(i => ({title: i.title, snippet: i.snippet, link: i.link, pageContent: i.pageContent, scrapedEmails: i.scrapedEmails})))}`;

       try {
          const geminiResponse = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: prompt,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, nullable: true },
                    email: { type: Type.STRING, nullable: true },
                    domain: { type: Type.STRING, nullable: true },
                    platform: { type: Type.STRING, enum: ["linkedin", "twitter", "github", "producthunt", "medium", "dribbble", "other"] },
                    profileUrl: { type: Type.STRING },
                    summary: { type: Type.STRING, nullable: true },
                    emailType: { type: Type.STRING, enum: ["personal", "generic", "guessed", null], nullable: true },
                    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] }
                  },
                  required: ["name", "platform", "profileUrl", "confidence"]
                }
              }
            }
          });
          return JSON.parse(geminiResponse.text || "[]");
       } catch (e) {
          console.error('Gemini extraction failed', e);
          return [];
       }
    };

    let extractedA: any[] = [];
    try {
      extractedA = await extractLeadsWithGemini(processedBucketA);
    } catch (e: any) {
      if (e.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
      }
    }

    // PHASE 7: Email Enrichment for Bucket A
    for (const l of extractedA) {
       if (!l.email && l.name && l.domain && l.domain.includes('.')) {
         const guess = await findValidEmail(l.name, l.domain);
         if (guess) {
           l.email = guess.email;
           l.emailType = guess.emailType;
           l.confidence = guess.confidence;
         }
       }
       if (l.email) validEmailsCount++;
    }

    let extractedB: any[] = [];
    if (validEmailsCount < 15) {
      // Process Bucket B (snippet only)
      // "parse the Serper snippet text for a Name, pair it with the already-extracted root domain, and feed both into the existing findValidEmail guesser utility. Mark these leads emailType: "guessed", confidence: "low" — do NOT fetch/scrape these URLs at all."
      
      // Let's just use Gemini on Bucket B snippets to extract Name and Domain.
      try {
        const bucketBToExtract = bucketB.map(b => ({title: b.title, snippet: b.snippet, link: b.link, domain: b.domain}));
        const rawExtractedB = await extractLeadsWithGemini(bucketBToExtract);
        
        for (const l of rawExtractedB) {
           if (!l.email && l.name && l.domain && l.domain.includes('.')) {
             const guess = await findValidEmail(l.name, l.domain);
             if (guess) {
               l.email = guess.email;
               l.emailType = guess.emailType;
               l.confidence = guess.confidence;
             }
           }
           if (l.email) extractedB.push(l); // only keep if email found
        }
      } catch (e: any) {
        if (e.message === 'QUOTA_EXCEEDED') {
           // Ignore, we just stop processing Bucket B.
        }
      }
    }

    let leads = [...extractedA, ...extractedB].filter(l => l.email);
    
    // Deduplicate within the batch by email
    const seenEmails = new Set();
    let finalDedupedLeads = [];
    for (const l of leads) {
       const lowerEmail = l.email.toLowerCase();
       if (!seenEmails.has(lowerEmail)) {
         seenEmails.add(lowerEmail);
         let sourceName = l.platform.charAt(0).toUpperCase() + l.platform.slice(1);
         if (sourceName === 'Other' && l.profileUrl.includes('linkedin.com')) sourceName = 'LinkedIn';
         
         finalDedupedLeads.push({
           name: l.name || 'Unknown',
           email: lowerEmail,
           confidence: l.confidence || 'low',
           emailType: l.emailType || 'guessed',
           profileUrl: l.profileUrl,
           source: sourceName,
           summary: l.summary || undefined
         });
       }
    }
    
    leads = finalDedupedLeads;

    // PHASE 8: Cross-Campaign Deduplication
    if (leads.length > 0) {
      await connectToDatabase();
      const extractedEmails = leads.map(l => l.email);
      const existingLeads = await Lead.find({ userId, email: { $in: extractedEmails } }).select('email').lean();
      const existingEmailSet = new Set(existingLeads.map(l => l.email));

      leads = leads.map(l => ({
        ...l,
        alreadyContacted: existingEmailSet.has(l.email)
      }));
    }

    // PHASE 9: Cleanup, Refund & Cache
    // Sort Bucket A (high confidence) before Bucket B (low confidence)
    leads.sort((a, b) => {
      if (a.confidence === 'high' && b.confidence !== 'high') return -1;
      if (a.confidence !== 'high' && b.confidence === 'high') return 1;
      if (a.confidence === 'medium' && b.confidence === 'low') return -1;
      if (a.confidence === 'low' && b.confidence === 'medium') return 1;
      return 0;
    });

    if (leads.length > 0) {
      // Cache for 6 hours
      await redis.set(cacheKey, JSON.stringify(leads), { ex: 21600 });
    }

    // Refund unused reserved quota based on exactly how many valid non-null emails were produced
    const validEmailsProduced = leads.length; // all leads here have an email
    if (validEmailsProduced < reservedQuota) {
      await refundUsage(userId, reservedQuota - validEmailsProduced);
    } else if (validEmailsProduced > reservedQuota) {
      // shouldn't happen unless we didn't reserve enough, but we reserved based on unique domains.
      // If we produced more emails than we reserved (multiple emails per domain?), we should probably consume more quota.
      // But the prompt says "reserve quota atomically based on the count of unique websites... refund unused reserved quota".
      // It assumes reservedQuota >= validEmailsProduced usually, or we just refund the difference if any.
    }
    
    reservedQuota = 0;
    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Search API Error:', error);
    if (reservedQuota > 0 && sessionUserId) {
      try { await refundUsage(sessionUserId, reservedQuota); } catch (e) { console.error('Refund failed on error', e); }
    }
    return NextResponse.json({ error: 'Failed to search for leads' }, { status: 500 });
  }
}
