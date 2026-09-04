import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';
import crypto from 'crypto';
import { fetchPageContent, extractBioAndPersonalLinks, NON_PERSONAL_HOSTS } from '@/lib/page-fetcher';
import { findValidEmail, isPlatformDomain } from '@/lib/email-validator';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { checkAndIncrementUsage, getUserUsage, refundUsage } from '@/lib/usage';
import { persistSearchLog } from '@/lib/search-logger';

// Helper to get root domain
function getRootDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const parts = url.hostname.split('.');
    if (parts.length > 2) {
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

const SUBDOMAIN_PLATFORMS = [
  'substack.com',
  'tumblr.com',
  'wordpress.com',
  'blogspot.com',
  'ghost.io',
  'hashnode.dev',
];

const PATH_OR_POST_PLATFORMS = [
  'reddit.com',
  'quora.com',
  'medium.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'facebook.com',
  'pinterest.com',
  'instagram.com',
];

function getEntityDomainAndKey(urlStr: string): { 
  rootDomain: string; 
  effectiveDomain: string; 
  dedupKey: string; 
  isSubdomainPlatform: boolean;
  isPostPlatform: boolean; 
} {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    const rootDomain = getRootDomain(urlStr);

    // 1. Subdomain platforms (e.g. author.substack.com, creator.tumblr.com)
    for (const plat of SUBDOMAIN_PLATFORMS) {
      if (hostname === plat || hostname.endsWith(`.${plat}`)) {
        if (hostname !== plat && hostname !== `www.${plat}`) {
          return {
            rootDomain,
            effectiveDomain: hostname,
            dedupKey: hostname,
            isSubdomainPlatform: true,
            isPostPlatform: false,
          };
        }
        // Bare platform domain (e.g. substack.com/@author)
        const authorMatch = url.pathname.match(/^(\/@[^\/]+)/);
        const pathKey = authorMatch ? authorMatch[1] : url.pathname;
        return {
          rootDomain,
          effectiveDomain: hostname,
          dedupKey: `${hostname}${pathKey}`,
          isSubdomainPlatform: true,
          isPostPlatform: false,
        };
      }
    }

    // 2. Post / Path based platforms (Reddit, Quora, Medium, Twitter, LinkedIn)
    for (const plat of PATH_OR_POST_PLATFORMS) {
      if (hostname === plat || hostname.endsWith(`.${plat}`)) {
        return {
          rootDomain,
          effectiveDomain: rootDomain,
          dedupKey: url.origin + url.pathname.replace(/\/$/, ''),
          isSubdomainPlatform: false,
          isPostPlatform: true,
        };
      }
    }

    // 3. Custom / independent personal or company domains
    return {
      rootDomain,
      effectiveDomain: rootDomain,
      dedupKey: rootDomain,
      isSubdomainPlatform: false,
      isPostPlatform: false,
    };
  } catch (e) {
    return {
      rootDomain: '',
      effectiveDomain: '',
      dedupKey: urlStr,
      isSubdomainPlatform: false,
      isPostPlatform: false,
    };
  }
}

export async function POST(req: Request) {
  const searchStartTime = Date.now();
  const searchId = crypto.randomUUID();
  let reservedQuota = 0;
  let sessionUserId = '';

  const searchLog: any = {
    searchId,
    userId: '',
    targetAudience: '',
    offering: '',
    durationMs: 0,
    cacheHit: false,
    cacheKey: '',
    gemini: {
      prompt: '',
      rawOutput: '',
      generatedQueries: [],
      finalQueries: [],
      error: ''
    },
    serper: {
      queryCalls: [],
      totalRawCount: 0,
      totalUniqueCount: 0,
      rawResults: []
    },
    bucketing: {
      totalEvaluatedDomains: 0,
      bucketACount: 0,
      bucketBCount: 0,
      bucketA: [],
      bucketB: []
    },
    scraping: [],
    extraction: {
      bucketARaw: [],
      bucketBTriggered: false,
      bucketBCount: 0,
      bucketBRaw: []
    },
    enrichment: {
      bucketAGuessedCount: 0,
      bucketBGuessedCount: 0,
      leads: []
    },
    bioLinkEnrichment: [],
    secondaryEnrichmentSearch: [],
    finalLeadsCount: 0,
    finalLeads: [],
    error: ''
  };

  try {
    const body = await req.json().catch(() => ({}));
    const { targetAudience, offering = '', bypassCache = false } = body;
    searchLog.targetAudience = targetAudience || '';
    searchLog.offering = offering || '';

    // PHASE 0: Pre-Flight Checks
    const internalUserId = req.headers.get('x-internal-user-id');
    let session: any = null;
    if (internalUserId && process.env.NODE_ENV !== 'production') {
      session = { user: { id: internalUserId } };
    } else {
      session = await getServerSession(authOptions);
    }
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;
    sessionUserId = userId;
    searchLog.userId = userId;

    const rateLimit = await checkRateLimit(`search:${userId}`, { limit: 30, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const usage = await getUserUsage(userId);
    const remaining = Math.max(0, usage.limit - usage.used);
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
    }

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
    searchLog.cacheKey = cacheKey;

    const cachedLeadsStr = bypassCache ? null : await redis.get(cacheKey);
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

        // Annotate cached leads with live cross-campaign contact status
        if (finalCached.length > 0) {
          await connectToDatabase();
          const extractedEmails = finalCached.map((l: any) => l.email).filter(Boolean);
          const extractedSources = finalCached.map((l: any) => l.contactSource || l.profileUrl).filter(Boolean);

          const existingLeads = await Lead.find({
            userId,
            $or: [
              ...(extractedEmails.length > 0 ? [{ email: { $in: extractedEmails } }] : []),
              ...(extractedSources.length > 0 ? [
                { contactSource: { $in: extractedSources } },
                { profileUrl: { $in: extractedSources } }
              ] : [])
            ]
          }).select('email contactSource profileUrl').lean();

          const existingEmailSet = new Set(existingLeads.map((l: any) => l.email).filter(Boolean));
          const existingSourceSet = new Set(existingLeads.flatMap((l: any) => [l.contactSource, l.profileUrl]).filter(Boolean));

          finalCached = finalCached.map((l: any) => {
            const isEmailContacted = l.email && existingEmailSet.has(l.email);
            const isSourceContacted = (l.contactSource && existingSourceSet.has(l.contactSource)) || (l.profileUrl && existingSourceSet.has(l.profileUrl));
            return {
              ...l,
              alreadyContacted: Boolean(isEmailContacted || isSourceContacted)
            };
          });
        }

        searchLog.cacheHit = true;
        searchLog.finalLeadsCount = finalCached.length;
        searchLog.finalLeads = finalCached;
        searchLog.durationMs = Date.now() - searchStartTime;
        console.log(`[SearchAPI][Cache HIT] Cache key: ${cacheKey}, returned ${finalCached.length} leads`);
        await persistSearchLog(searchLog);

        const res = NextResponse.json({ leads: finalCached });
        reservedQuota = 0;
        return res;
      } catch (e) {
        console.error('Failed to parse cached leads', e);
      }
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // PHASE 2: AI Query Expansion (3-Way Comparison: pain-point, contact-invite, broad-identity)
    const expansionPrompt = `Generate exactly 9 distinct Google search queries to find creators/individuals in this target audience: "${targetAudience}" and offering: "${offering}".

You MUST generate exactly 3 queries for EACH of the following 3 strategies:
1. "pain-point" (3 queries): Target creators expressing frustration, struggling, asking for help, or seeking feedback (e.g. "struggling", "frustrated", "newbie", "just finished", "looking for help"). Target community posts, Reddit, Substack, Medium, forums.
2. "contact-invite" (3 queries): Target creators who have explicitly self-selected into reachability by publishing contact/collaboration invitations. Use keywords like "work with me", "hire me", "media kit", "press kit", "collab", "sponsor", or "brand partnerships" combined with the niche.
3. "broad-identity" (3 queries): Target creators by their core identity, personal blogs, Substacks, or portfolios without pain or contact qualifiers (e.g. "indie writer blog", "fiction author newsletter", "freelance writer website").

Avoid celebrity/authority framing (no "famous author" or "NYT bestselling"). Target independent or emerging individuals.
Return a JSON array of 9 objects with fields "query" (string) and "queryType" ("pain-point" | "contact-invite" | "broad-identity").`;

    searchLog.gemini.prompt = expansionPrompt;

    let generatedQueries: Array<{ query: string; queryType: 'pain-point' | 'contact-invite' | 'broad-identity' }> = [];
    try {
      const queryRes = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: expansionPrompt,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING },
                queryType: { type: Type.STRING, enum: ['pain-point', 'contact-invite', 'broad-identity'] }
              },
              required: ['query', 'queryType']
            }
          }
        }
      });
      searchLog.gemini.rawOutput = queryRes.text || '';
      generatedQueries = JSON.parse(queryRes.text || '[]');
    } catch (e: any) {
      console.error('Failed to generate queries', e);
      searchLog.gemini.error = e?.message || String(e);
      // Fallback
      generatedQueries = [
        { query: `"${targetAudience}" struggling help`, queryType: 'pain-point' },
        { query: `"${targetAudience}" newbie forum`, queryType: 'pain-point' },
        { query: `"${targetAudience}" just finished blog`, queryType: 'pain-point' },
        { query: `"${targetAudience}" "work with me"`, queryType: 'contact-invite' },
        { query: `"${targetAudience}" "hire me"`, queryType: 'contact-invite' },
        { query: `"${targetAudience}" "media kit"`, queryType: 'contact-invite' },
        { query: `"${targetAudience}" blog`, queryType: 'broad-identity' },
        { query: `"${targetAudience}" newsletter`, queryType: 'broad-identity' },
        { query: `"${targetAudience}" personal website`, queryType: 'broad-identity' },
      ];
    }
    
    searchLog.gemini.generatedQueries = generatedQueries.map(q => q.query);

    const negativeKeywords = '-wikipedia -NYT -Forbes -bestseller -"award winning" -"book deal" -TED -"literary agent"';
    const spamGuard = /facebook\.com\/groups|instagram\.com/i;

    const finalQueries = generatedQueries
      .map(item => ({
        query: `${item.query} ${negativeKeywords}`,
        queryType: item.queryType
      }))
      .filter(item => !spamGuard.test(item.query));

    searchLog.gemini.finalQueries = finalQueries.map(q => q.query);

    console.log(`[SearchAPI][Gemini] Generated ${generatedQueries.length} queries -> ${finalQueries.length} after filter:`, finalQueries.map(q => `[${q.queryType}] ${q.query}`));
    
    if (finalQueries.length === 0) {
      searchLog.durationMs = Date.now() - searchStartTime;
      await persistSearchLog(searchLog);
      return NextResponse.json({ leads: [] });
    }

    // PHASE 3: Serper Search (concurrent)
    let allOrganicResults: any[] = [];
    const seenUrls = new Set<string>();

    const serperCalls = finalQueries.map((item, index) => {
      const payload: any = { q: item.query };

      return fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).then(async r => {
        let resultCount = 0;
        let serperError: string | undefined;
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data.organic)) {
            resultCount = data.organic.length;
            const top20 = data.organic.slice(0, 20);
            for (const result of top20) {
              searchLog.serper.rawResults.push({
                queryIndex: index + 1,
                queryType: item.queryType,
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                date: result.date,
                position: result.position
              });

              if (result.link && !seenUrls.has(result.link)) {
                seenUrls.add(result.link);
                allOrganicResults.push({
                  ...result,
                  queryType: item.queryType
                });
              }
            }
          }
        } else {
          serperError = `HTTP ${r.status} ${r.statusText}`;
        }

        searchLog.serper.queryCalls.push({
          query: item.query,
          queryType: item.queryType,
          page: payload.page,
          tbs: payload.tbs,
          resultCount,
          status: r.status,
          error: serperError
        });
      }).catch(e => {
        console.error(`Serper query failed: ${item.query}`, e);
        searchLog.serper.queryCalls.push({
          query: item.query,
          queryType: item.queryType,
          page: payload.page,
          tbs: payload.tbs,
          resultCount: 0,
          error: e?.message || String(e)
        });
      });
    });

    await Promise.all(serperCalls);

    searchLog.serper.totalRawCount = searchLog.serper.rawResults.length;
    searchLog.serper.totalUniqueCount = allOrganicResults.length;
    console.log(`[SearchAPI][Serper] Fetched ${searchLog.serper.totalRawCount} raw items (${allOrganicResults.length} unique URLs) across ${finalQueries.length} queries`);

    if (allOrganicResults.length === 0) {
      searchLog.durationMs = Date.now() - searchStartTime;
      await persistSearchLog(searchLog);
      return NextResponse.json({ leads: [] });
    }

    // PHASE 4: URL Filtering & Bucket Prioritization
    const FORUM_UGC_DOMAINS = ['reddit.com', 'quora.com', 'tumblr.com', 'medium.com'];
    const SOCIAL_DOMAINS = ['linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'facebook.com', 'pinterest.com', 'instagram.com'];
    const isBucketBType = (d: string) => {
      const lower = d.toLowerCase();
      return [...FORUM_UGC_DOMAINS, ...SOCIAL_DOMAINS].some(site => lower === site || lower.endsWith(`.${site}`));
    };

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
      const entity = getEntityDomainAndKey(res.link);
      if (!entity.dedupKey) continue;
      
      const score = getPathScore(res.link);
      const existing = domainMap.get(entity.dedupKey);
      
      if (!existing || score > getPathScore(existing.link)) {
        domainMap.set(entity.dedupKey, { 
          ...res, 
          domain: entity.effectiveDomain,
          rootDomain: entity.rootDomain,
          isSubdomainPlatform: entity.isSubdomainPlatform,
          isPostPlatform: entity.isPostPlatform,
          queryType: res.queryType || 'pain-point'
        });
      }
    }

    const bucketA: any[] = [];
    const bucketB: any[] = [];

    for (const res of Array.from(domainMap.values())) {
      const lowerUrl = res.link.toLowerCase();
      const domain = (res.domain || '').toLowerCase();
      const rootDomain = (res.rootDomain || '').toLowerCase();
      
      const toBucketB = isBucketBType(domain) || isBucketBType(rootDomain);
      
      let isBucketA = false;
      if (!toBucketB) {
        if (lowerUrl.includes('/contact') || lowerUrl.includes('/about') || lowerUrl.includes('/team') || lowerUrl.includes('/hire-me') || lowerUrl.includes('/work-with-me')) {
          isBucketA = true;
        } else if (res.isSubdomainPlatform && domain.endsWith('.substack.com')) {
          isBucketA = true; // Creator publication Substack
        } else if (!res.isSubdomainPlatform && !res.isPostPlatform && rootDomain.split('.').length === 2) {
          isBucketA = true; // Independent custom domain
        }
      }

      // Explicitly route UGC / forum / social to Bucket B; only qualify true independent/creator sites for Bucket A
      if (toBucketB || !isBucketA) {
        bucketB.push(res);
      } else {
        bucketA.push(res);
      }
    }

    searchLog.bucketing = {
      totalEvaluatedDomains: domainMap.size,
      bucketACount: bucketA.length,
      bucketBCount: bucketB.length,
      bucketA: bucketA.map(b => ({ link: b.link, domain: b.domain, title: b.title, queryType: b.queryType })),
      bucketB: bucketB.map(b => ({ link: b.link, domain: b.domain, title: b.title, queryType: b.queryType }))
    };
    console.log(`[SearchAPI][Bucketing] Evaluated ${domainMap.size} unique domains -> Bucket A: ${bucketA.length}, Bucket B: ${bucketB.length}`);

    // PHASE 5: Deep Scraping (Bucket A only)
    let processedBucketA: any[] = [];
    let validEmailsCount = 0;
    
    const enrichBucketA = await Promise.all(
      bucketA.map(async (r) => {
        // Fetch primary URL
        const primaryRes = await fetchPageContent(r.link, 3000, 1000);
        let scrapedText = primaryRes.text;
        let foundEmails = primaryRes.emails;

        const scrapingItemLog: any = {
          url: r.link,
          domain: r.domain,
          isRobotsAllowed: primaryRes.robotsAllowed,
          httpStatus: primaryRes.status,
          statusText: primaryRes.statusText,
          durationMs: primaryRes.durationMs,
          hasText: !!primaryRes.text,
          textLength: primaryRes.text ? primaryRes.text.length : 0,
          emailsFound: primaryRes.emails,
          error: primaryRes.error,
          fallbacks: []
        };

        if (foundEmails.length === 0 && r.domain) {
          // Fallbacks in parallel
          const fallbacks = ['/contact', '/about', '/hire-me', '/work-with-me'].map(async (path) => {
            const fallbackUrl = `https://${r.domain}${path}`;
            const fbRes = await fetchPageContent(fallbackUrl, 3000, 800);
            return { path, fallbackUrl, fbRes };
          });
          
          const results = await Promise.allSettled(fallbacks);
          for (const res of results) {
            if (res.status === 'fulfilled') {
              const { path, fallbackUrl, fbRes } = res.value;
              scrapingItemLog.fallbacks.push({
                url: fallbackUrl,
                path,
                isRobotsAllowed: fbRes.robotsAllowed,
                httpStatus: fbRes.status,
                durationMs: fbRes.durationMs,
                hasText: !!fbRes.text,
                emailsFound: fbRes.emails,
                rawHtml: fbRes.rawHtml,
                error: fbRes.error
              });

              if (fbRes.emails.length > 0 && foundEmails.length === 0) {
                foundEmails = fbRes.emails;
                if (fbRes.text) {
                  scrapedText = (scrapedText || '') + ' ' + fbRes.text;
                }
              }
            }
          }
        }
        
        searchLog.scraping.push(scrapingItemLog);

        let targetPersonalUrl: string | null = null;

        // FIX 1: Bio-Link Scraping
        // If still no email, inspect outbound links in author bio/byline markup and across the page
        if (foundEmails.length === 0) {
          const allHtmlSnippets = [primaryRes.rawHtml || ''];
          for (const fb of scrapingItemLog.fallbacks) {
            if (fb.rawHtml) allHtmlSnippets.push(fb.rawHtml);
          }
          const combinedHtml = allHtmlSnippets.join(' ');
          const { bioLinksFound, personalDomainLinks } = extractBioAndPersonalLinks(combinedHtml, r.link);

          let bioScrapeSuccess = false;

          if (personalDomainLinks.length > 0) {
            targetPersonalUrl = personalDomainLinks[0];
            const pRes = await fetchPageContent(targetPersonalUrl, 3000, 1500);
            if (pRes.status === 200 || pRes.robotsAllowed) {
              bioScrapeSuccess = true;
              if (pRes.emails.length > 0 && foundEmails.length === 0) {
                foundEmails = pRes.emails;
              }
              if (pRes.text) {
                scrapedText = (scrapedText || '') + ' ' + pRes.text;
              }
            }

            // If still no emails from homepage, try personal site /contact and /about
            if (foundEmails.length === 0 && bioScrapeSuccess) {
              const pFallbacks = ['/contact', '/about'].map(async (p) => {
                const fbUrl = `${targetPersonalUrl}${p}`;
                return fetchPageContent(fbUrl, 3000, 1000);
              });
              const pfResults = await Promise.allSettled(pFallbacks);
              for (const pf of pfResults) {
                if (pf.status === 'fulfilled' && (pf.value.status === 200 || pf.value.robotsAllowed)) {
                  if (pf.value.emails.length > 0 && foundEmails.length === 0) {
                    foundEmails = pf.value.emails;
                  }
                  if (pf.value.text) {
                    scrapedText = (scrapedText || '') + ' ' + pf.value.text;
                  }
                }
              }
            }
          }

          searchLog.bioLinkEnrichment.push({
            leadUrl: r.link,
            leadDomain: r.domain,
            bioLinkFound: bioLinksFound.length > 0 ? 'Y' : 'N',
            bioLinksFound: bioLinksFound.length > 0 ? 'Y' : 'N',
            personalDomainFound: personalDomainLinks.length > 0 ? 'Y' : 'N',
            personalDomains: personalDomainLinks,
            targetPersonalUrl,
            scrapeSuccess: bioScrapeSuccess ? 'Y' : 'N',
            emailFound: foundEmails.length > 0 ? 'Y' : 'N',
            emailsFound: foundEmails
          });
        }

        return {
          ...r,
          pageContent: scrapedText ? scrapedText.slice(0, 2000) : undefined,
          scrapedEmails: foundEmails,
          bioPersonalUrl: targetPersonalUrl || undefined
        };
      })
    );

    processedBucketA = enrichBucketA;
    console.log(`[SearchAPI][Scraping] Processed ${bucketA.length} Bucket A URLs. Discovered direct emails on ${enrichBucketA.filter(b => b.scrapedEmails?.length > 0).length} sites.`);

    // PHASE 6: AI Extraction Helper (Gemini)
    const extractLeadsWithGemini = async (items: any[]) => {
       if (items.length === 0) return [];
       
       const uniqueDomains = new Set(items.map(i => i.domain)).size;
       const reservation = await checkAndIncrementUsage(userId, uniqueDomains);
       if (!reservation.allowed) {
          throw new Error('QUOTA_EXCEEDED');
       }
       reservedQuota += reservation.reserved;

       const prompt = `Extract name, email, company domain, platform, profileUrl, and a brief 1-2 sentence summary/bio of the person from these search results. You MUST return an object for EVERY item provided in the Results, even if they are service-providers or you cannot find an email. Do not skip items.
Instruct:
1. Prefer personal-looking emails (Gmail, Yahoo, Outlook, ProtonMail, or firstname@personaldomain.com) over generic info@/support@ on large corporate sites. Return null for Email in the generic/large-corporate case rather than guessing.
2. For "domain": Extract the person's own personal or company website domain (e.g. "authorname.com" or "janedoe.org") if mentioned in the page text, snippet, bio, or links. Do NOT use shared hosting or platform domains (like "substack.com", "medium.com", "reddit.com", "quora.com", "tumblr.com", "twitter.com", "linkedin.com") as their personal domain; return null for domain instead if no independent domain exists.
3. Determine the "audienceMatch": "member", "service-provider", or "unclear". Based on how this person describes themselves and their work, are they a "${targetAudience}" themselves, or do they provide services/products to "${targetAudience}"? Someone who edits, coaches, consults for, or sells services to this audience is NOT a member of it, even if their content is about the same topic. Use "unclear" for genuinely ambiguous cases rather than forcing a guess.
4. Provide "audienceReasoning": A brief sentence explaining why you chose "member", "service-provider", or "unclear".
Also include:
- itemIndex: integer 0-based index matching which item this lead came from
- emailType: "personal" | "generic" | "guessed" | null
- confidence: "high" | "medium" | "low"

Results:
${JSON.stringify(items.map((i, idx) => ({itemIndex: idx, title: i.title, snippet: i.snippet, link: i.link, pageContent: i.pageContent, scrapedEmails: i.scrapedEmails})))}`;

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
                    itemIndex: { type: Type.INTEGER, nullable: true },
                    name: { type: Type.STRING, nullable: true },
                    email: { type: Type.STRING, nullable: true },
                    domain: { type: Type.STRING, nullable: true },
                    platform: { type: Type.STRING, enum: ["linkedin", "twitter", "github", "producthunt", "medium", "dribbble", "other"] },
                    profileUrl: { type: Type.STRING },
                    summary: { type: Type.STRING, nullable: true },
                    emailType: { type: Type.STRING, enum: ["personal", "generic", "guessed", null], nullable: true },
                    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    audienceMatch: { type: Type.STRING, enum: ["member", "service-provider", "unclear"] },
                    audienceReasoning: { type: Type.STRING }
                  },
                  required: ["name", "platform", "profileUrl", "confidence", "audienceMatch", "audienceReasoning"]
                }
              }
            }
          });
          const rawLeads = JSON.parse(geminiResponse.text || "[]");
          return rawLeads.map((l: any) => {
            const matchedItem = (l.itemIndex !== undefined && items[l.itemIndex])
              ? items[l.itemIndex]
              : items.find(i => i.link === l.profileUrl);
              
            let resolvedEmail = l.email;
            if (!resolvedEmail && matchedItem?.scrapedEmails && matchedItem.scrapedEmails.length > 0) {
              resolvedEmail = matchedItem.scrapedEmails[0];
            }
              
            return {
              ...l,
              email: resolvedEmail,
              profileUrl: matchedItem?.link || l.profileUrl,
              queryType: matchedItem?.queryType || 'pain-point',
              bioPersonalUrl: matchedItem?.bioPersonalUrl,
              audienceMatch: l.audienceMatch || 'unclear',
              audienceReasoning: l.audienceReasoning || ''
            };
          });
       } catch (e) {
          console.error('Gemini extraction failed', e);
          return [];
       }
    };

    let extractedA: any[] = [];
    try {
      const rawExtractedA = await extractLeadsWithGemini(processedBucketA);
      searchLog.extraction.bucketARaw = rawExtractedA;
      extractedA = rawExtractedA.filter((l: any) => l.audienceMatch === 'member');
    } catch (e: any) {
      if (e.message === 'QUOTA_EXCEEDED') {
        searchLog.error = 'QUOTA_EXCEEDED';
        searchLog.durationMs = Date.now() - searchStartTime;
        await persistSearchLog(searchLog);
        return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
      }
    }

    // PHASE 7: Email Enrichment for Bucket A
    let bucketAGuesses = 0;
    for (const l of extractedA) {
       if (!l.email && l.name && l.domain && l.domain.includes('.')) {
         const guess = await findValidEmail(l.name, l.domain);
         if (guess) {
           l.email = guess.email;
           l.emailType = guess.emailType;
           l.confidence = guess.confidence;
           bucketAGuesses++;
         }
       }
       if (l.email) validEmailsCount++;
    }
    searchLog.enrichment.bucketAGuessedCount = bucketAGuesses;

    let extractedB: any[] = [];
    searchLog.extraction.bucketBTriggered = validEmailsCount < 15;
    searchLog.extraction.bucketBCount = bucketB.length;

    if (validEmailsCount < 15) {
      console.log(`[SearchAPI][Fallback] Bucket A yielded ${validEmailsCount} valid emails (<15). Triggering Bucket B fallback on ${bucketB.length} items...`);
      try {
        const bucketBToExtract = bucketB.map(b => ({title: b.title, snippet: b.snippet, link: b.link, domain: b.domain, queryType: b.queryType}));
        const rawExtractedB = await extractLeadsWithGemini(bucketBToExtract);
        searchLog.extraction.bucketBRaw = rawExtractedB;
        
        let bucketBGuesses = 0;
        for (const l of rawExtractedB) {
           if (!l.email && l.name && l.domain && l.domain.includes('.')) {
             const guess = await findValidEmail(l.name, l.domain);
             if (guess) {
               l.email = guess.email;
               l.emailType = guess.emailType;
               l.confidence = guess.confidence;
               bucketBGuesses++;
             }
           }
           if (l.audienceMatch === 'member' && (l.email || (l.name && l.name.trim() !== 'Unknown'))) {
             extractedB.push(l);
           }
        }
        searchLog.enrichment.bucketBGuessedCount = bucketBGuesses;
      } catch (e: any) {
        if (e.message === 'QUOTA_EXCEEDED') {
           // Ignore, we just stop processing Bucket B.
        }
      }
    } else {
      console.log(`[SearchAPI][Fallback] Bucket A yielded ${validEmailsCount} valid emails (>=15). Skipping Bucket B.`);
    }

    // PHASE 7.5: Secondary Enrichment Search (Fallback for unresolved leads)
    // For any lead where Gemini extracted a name but bio-link scraping found no personal domain or no email,
    // fire one additional Serper query: "[Name]" personal website OR portfolio OR contact
    const allCandidates = [...extractedA, ...extractedB];
    const unresolvedLeads = allCandidates.filter(l => !l.email && l.name && l.name.trim() !== '' && l.name !== 'Unknown');

    if (unresolvedLeads.length > 0) {
      console.log(`[SearchAPI][SecondaryEnrichment] Found ${unresolvedLeads.length} unresolved leads with names. Firing targeted Serper searches...`);

      for (const l of unresolvedLeads) {
        const enrichmentQuery = `"${l.name}" personal website OR portfolio OR contact`;
        let resultsConsidered: any[] = [];
        let targetPersonalUrl: string | null = null;
        let scrapeSuccess = false;

        try {
          const sRes = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: enrichmentQuery, num: 5 })
          });

          if (sRes.ok) {
            const sData = await sRes.json();
            const topResults = (sData.organic || []).slice(0, 3);
            resultsConsidered = topResults.map((r: any) => ({
              title: r.title,
              link: r.link,
              domain: getRootDomain(r.link)
            }));

            // Filter out platform and non-personal domains
            for (const item of topResults) {
              try {
                const u = new URL(item.link);
                const host = u.hostname.toLowerCase();
                const rootDom = getRootDomain(item.link);
                if (!isPlatformDomain(host) && !isPlatformDomain(rootDom)) {
                  const isRetailer = Array.from(NON_PERSONAL_HOSTS).some(np => host === np || host.endsWith(`.${np}`));
                  if (!isRetailer) {
                    targetPersonalUrl = u.origin;
                    break;
                  }
                }
              } catch {}
            }

            if (targetPersonalUrl) {
              // Scrape target personal domain
              const pRes = await fetchPageContent(targetPersonalUrl, 3000, 1500);
              let candidateEmails = pRes.emails || [];
              let candidateText = pRes.text || '';

              if (pRes.status === 200 || pRes.robotsAllowed) {
                scrapeSuccess = true;
              }

              // Fallbacks: /contact and /about on the personal domain
              if (candidateEmails.length === 0 && scrapeSuccess) {
                const pFallbacks = ['/contact', '/about'].map(async (path) => {
                  const fbUrl = `${targetPersonalUrl}${path}`;
                  return fetchPageContent(fbUrl, 3000, 1000);
                });
                const pfResults = await Promise.allSettled(pFallbacks);
                for (const pf of pfResults) {
                  if (pf.status === 'fulfilled' && (pf.value.status === 200 || pf.value.robotsAllowed)) {
                    if (pf.value.emails.length > 0 && candidateEmails.length === 0) {
                      candidateEmails = pf.value.emails;
                    }
                    if (pf.value.text) {
                      candidateText = (candidateText || '') + ' ' + pf.value.text;
                    }
                  }
                }
              }

              // Direct email discovered on personal site
              if (candidateEmails.length > 0) {
                l.email = candidateEmails[0];
                l.emailType = 'personal';
                l.confidence = 'high';
              } else if (candidateText && candidateText.length > 50) {
                // If text exists, use quick Gemini extraction to locate contact email
                try {
                  const quickGemini = await ai.models.generateContent({
                    model: 'gemini-3.5-flash-lite',
                    contents: `From the following webpage text of ${l.name}'s website, extract their personal contact email address (or their agent/representative contact email). If none is found, return null. Return only JSON: { "email": string | null }\n\nWebpage text:\n${candidateText.slice(0, 2500)}`,
                    config: {
                      temperature: 0.1,
                      responseMimeType: 'application/json',
                      responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                          email: { type: Type.STRING, nullable: true }
                        }
                      }
                    }
                  });
                  const parsed = JSON.parse(quickGemini.text || '{}');
                  if (parsed.email && !isPlatformDomain(parsed.email.split('@')[1] || '')) {
                    l.email = parsed.email.toLowerCase().trim();
                    l.emailType = 'personal';
                    l.confidence = 'high';
                  }
                } catch (gErr) {
                  // Fall through
                }
              }
            }
          }
        } catch (sErr) {
          console.error(`Secondary enrichment error for ${l.name}:`, sErr);
        }

        if (targetPersonalUrl) {
          l.secondaryPersonalUrl = targetPersonalUrl;
        }

        searchLog.secondaryEnrichmentSearch.push({
          leadName: l.name,
          query: enrichmentQuery,
          resultsConsidered,
          targetPersonalUrl,
          scrapeSuccess: scrapeSuccess ? 'Y' : 'N',
          emailFound: !!l.email ? 'Y' : 'N',
          resolvedEmail: l.email || null
        });
      }
    }

    // PHASE 8: Final Leads Assembly & Hybrid Deduplication (Email Ready + Source-Only)
    const batchSeenEmails = new Set<string>();
    const batchSeenUrls = new Set<string>();
    let finalDedupedLeads: any[] = [];

    const getCleanSource = (url?: string) => {
      if (!url) return '';
      try {
        const parsed = new URL(url);
        return (parsed.hostname + parsed.pathname).toLowerCase().replace(/\/$/, '');
      } catch {
        return url.toLowerCase().trim();
      }
    };

    for (const l of allCandidates) {
      const rawEmail = (l.email || '').toLowerCase().trim();
      const hasValidEmail = Boolean(rawEmail && rawEmail.includes('@') && rawEmail.includes('.') && !isPlatformDomain(rawEmail.split('@')[1] || ''));
      const email = hasValidEmail ? rawEmail : '';

      const contactSource = (hasValidEmail ? email : (l.secondaryPersonalUrl || l.bioPersonalUrl || l.profileUrl || l.domain || '')).trim();
      const cleanSource = getCleanSource(contactSource || l.profileUrl);

      // In-batch deduplication
      if (hasValidEmail) {
        if (batchSeenEmails.has(email)) continue;
        batchSeenEmails.add(email);
        if (cleanSource) batchSeenUrls.add(cleanSource);
      } else {
        // Source-only lead
        if (!cleanSource || batchSeenUrls.has(cleanSource)) continue;
        batchSeenUrls.add(cleanSource);
      }

      let sourceName = l.platform ? (l.platform.charAt(0).toUpperCase() + l.platform.slice(1)) : 'Web';
      if (sourceName === 'Other' && l.profileUrl?.includes('linkedin.com')) sourceName = 'LinkedIn';

      let resolvedName = (l.name || '').trim();
      if (!resolvedName || resolvedName === 'Unknown') {
        resolvedName = l.title ? l.title.split(/[-|–:]/)[0].trim() : (l.domain || 'Creator');
      }

      finalDedupedLeads.push({
        name: resolvedName,
        email: hasValidEmail ? email : undefined,
        contactMethod: hasValidEmail ? ('email' as const) : ('source-only' as const),
        contactSource: contactSource || l.profileUrl || '',
        confidence: l.confidence || (hasValidEmail ? 'high' : 'medium'),
        emailType: hasValidEmail ? (l.emailType || 'personal') : null,
        queryType: l.queryType || 'pain-point',
        profileUrl: l.profileUrl || l.link || '',
        source: sourceName,
        summary: l.summary || undefined,
        audienceMatch: l.audienceMatch,
        audienceReasoning: l.audienceReasoning
      });
    }

    // Extended Cross-Campaign Deduplication (checks both email and contactSource)
    if (finalDedupedLeads.length > 0) {
      await connectToDatabase();
      const extractedEmails = finalDedupedLeads.map(l => l.email).filter(Boolean);
      const extractedSources = finalDedupedLeads.map(l => l.contactSource || l.profileUrl).filter(Boolean);

      const existingLeads = await Lead.find({
        userId,
        $or: [
          ...(extractedEmails.length > 0 ? [{ email: { $in: extractedEmails } }] : []),
          ...(extractedSources.length > 0 ? [
            { contactSource: { $in: extractedSources } },
            { profileUrl: { $in: extractedSources } }
          ] : [])
        ]
      }).select('email contactSource profileUrl').lean();

      const existingEmailSet = new Set(existingLeads.map(l => l.email).filter(Boolean));
      const existingSourceSet = new Set(existingLeads.flatMap(l => [l.contactSource, l.profileUrl]).filter(Boolean));

      finalDedupedLeads = finalDedupedLeads.map(l => {
        const isEmailContacted = l.email && existingEmailSet.has(l.email);
        const isSourceContacted = (l.contactSource && existingSourceSet.has(l.contactSource)) || (l.profileUrl && existingSourceSet.has(l.profileUrl));
        return {
          ...l,
          alreadyContacted: Boolean(isEmailContacted || isSourceContacted)
        };
      });
    }

    // Sort: Email-ready leads first (high confidence), then source-only leads
    finalDedupedLeads.sort((a, b) => {
      if (a.contactMethod === 'email' && b.contactMethod !== 'email') return -1;
      if (a.contactMethod !== 'email' && b.contactMethod === 'email') return 1;
      if (a.confidence === 'high' && b.confidence !== 'high') return -1;
      if (a.confidence !== 'high' && b.confidence === 'high') return 1;
      return 0;
    });

    let leads = finalDedupedLeads;

    // PHASE 9: Cleanup, Quota Accounting & Cache
    if (leads.length > 0) {
      // Cache for 6 hours
      await redis.set(cacheKey, JSON.stringify(leads), { ex: 21600 });
    }

    // Refund unused reserved quota based ONLY on confirmed email leads
    const validEmailsProduced = leads.filter(l => l.contactMethod === 'email').length;
    if (validEmailsProduced < reservedQuota) {
      await refundUsage(userId, reservedQuota - validEmailsProduced);
    }
    
    reservedQuota = 0;

    searchLog.finalLeadsCount = leads.length;
    searchLog.finalLeads = leads;
    searchLog.durationMs = Date.now() - searchStartTime;

    console.log(`[SearchAPI][Complete] Returned ${leads.length} leads in ${searchLog.durationMs}ms`);
    await persistSearchLog(searchLog);

    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Search API Error:', error);
    searchLog.error = error?.message || String(error);
    searchLog.durationMs = Date.now() - searchStartTime;
    await persistSearchLog(searchLog);

    if (reservedQuota > 0 && sessionUserId) {
      try { await refundUsage(sessionUserId, reservedQuota); } catch (e) { console.error('Refund failed on error', e); }
    }
    return NextResponse.json({ error: 'Failed to search for leads' }, { status: 500 });
  }
}
