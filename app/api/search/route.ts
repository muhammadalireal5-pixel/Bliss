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

function buildQueries(targetAudience: string, offering: string): string[] {
  const audience = targetAudience.replace(/"/g, '');
  const emails = '("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")';
  
  return [
    `site:linkedin.com/in/ "${audience}" ${emails}`,
    `site:twitter.com/ "${audience}" ${emails}`,
    `site:github.com "${audience}" ${emails}`,
    `site:producthunt.com "${audience}" ${emails}`,
    `"${audience}" contact email`,
  ];
}

import { checkAndIncrementUsage, getUserUsage } from '@/lib/usage';

export async function POST(req: Request) {
  let reservedQuota = 0;
  let sessionUserId = '';
  try {
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
        
        // Refund if we reserved more than we needed (shouldn't happen here, but safe)
        if (finalCached.length < reservedQuota) {
          const { refundUsage } = await import('@/lib/usage');
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

    const queries = buildQueries(targetAudience, offering);
    let allOrganicResults: any[] = [];
    const seenUrls = new Set<string>();

    await Promise.all(
      queries.map(async (query) => {
        try {
          const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: query }),
          });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.organic)) {
              for (const result of data.organic) {
                if (result.link && !seenUrls.has(result.link)) {
                  seenUrls.add(result.link);
                  allOrganicResults.push(result);
                }
              }
            }
          }
        } catch (e) {
          console.error(`Serper query failed: ${query}`, e);
        }
      })
    );

    if (allOrganicResults.length === 0) {
      return NextResponse.json({ leads: [] });
    }

    // Limit to top 20 to avoid slow page fetches
    allOrganicResults = allOrganicResults.slice(0, 20);

    const enrichedResults = await Promise.all(
      allOrganicResults.map(async (r) => {
        const pageContent = await fetchPageContent(r.link, 2000);
        return {
          title: r.title,
          snippet: r.snippet,
          link: r.link,
          pageContent: pageContent ? pageContent.slice(0, 1000) : undefined // limit to 1000 chars of page content to save tokens
        };
      })
    );

    let leads: any[] = [];
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = `Extract name, email, company domain, platform, profileUrl, and a brief 1-2 sentence summary/bio of the person from these search results. Return null for name or email if not confidently found. Do not hallucinate.
${JSON.stringify(enrichedResults)}`;

    // Fix: check and reserve atomic quota before generating
    const reservation = await checkAndIncrementUsage(userId, enrichedResults.length);
    if (!reservation.allowed) {
      return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
    }
    reservedQuota = reservation.reserved;

    try {
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, nullable: true },
                email: { type: Type.STRING, nullable: true },
                domain: { type: Type.STRING, nullable: true, description: "Company domain if found (e.g., acme.com), omit if generic like gmail.com" },
                platform: { type: Type.STRING, enum: ["linkedin", "twitter", "github", "producthunt", "medium", "dribbble", "other"] },
                profileUrl: { type: Type.STRING },
                summary: { type: Type.STRING, nullable: true },
              },
              required: ["name", "platform", "profileUrl"]
            }
          }
        }
      });

      const parsed = JSON.parse(geminiResponse.text || "[]");
      const seenEmails = new Set();
      
      for (const l of parsed) {
        let finalEmail = l.email ? l.email.toLowerCase() : null;
        let confidence: 'verified' | 'guessed' = 'verified';

        if (!finalEmail && l.name && l.domain && l.domain.includes('.')) {
          const guess = await findValidEmail(l.name, l.domain);
          if (guess) {
            finalEmail = guess.email;
            confidence = 'guessed';
          }
        }

        if (finalEmail && !seenEmails.has(finalEmail)) {
          seenEmails.add(finalEmail);
          
          let sourceName = l.platform.charAt(0).toUpperCase() + l.platform.slice(1);
          if (sourceName === 'Other' && l.profileUrl.includes('linkedin.com')) sourceName = 'LinkedIn';
          
          leads.push({
            name: l.name || 'Unknown',
            email: finalEmail,
            confidence,
            profileUrl: l.profileUrl,
            source: sourceName,
            summary: l.summary || undefined
          });
        }
      }
    } catch (error) {
      console.error('Gemini extraction failed:', error);
      // Fallback
    }

    // Cross-campaign dedup
    if (leads.length > 0) {
      await connectToDatabase();
      const extractedEmails = leads.map(l => l.email);
      const existingLeads = await Lead.find({ userId, email: { $in: extractedEmails } }).select('email').lean();
      const existingEmailSet = new Set(existingLeads.map(l => l.email));

      leads = leads.map(l => ({
        ...l,
        alreadyContacted: existingEmailSet.has(l.email)
      }));

      await redis.set(cacheKey, JSON.stringify(leads), { ex: 21600 });
    }

    // Limit to the reserved quota
    const finalLeads = leads.slice(0, reservedQuota);
    
    // Refund the difference if we extracted fewer leads than reserved
    if (finalLeads.length < reservedQuota) {
      const { refundUsage } = await import('@/lib/usage');
      await refundUsage(userId, reservedQuota - finalLeads.length);
    }

    reservedQuota = 0;
    return NextResponse.json({ leads: finalLeads });
  } catch (error: any) {
    console.error('Search API Error:', error);
    if (reservedQuota > 0 && sessionUserId) {
      const { refundUsage } = await import('@/lib/usage');
      try { await refundUsage(sessionUserId, reservedQuota); } catch (e) { console.error('Refund failed on error', e); }
    }
    return NextResponse.json({ error: 'Failed to search for leads' }, { status: 500 });
  }
}
