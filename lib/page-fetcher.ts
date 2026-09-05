import { isPlatformDomain } from './email-validator';

export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function checkRobotsTxt(domainUrl: string, path: string): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', domainUrl).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return true; // Default to allow if robots.txt fails or 404
    
    const text = await res.text();
    // Very basic robots.txt check for Disallow: /path or Disallow: /
    const lines = text.split('\n').map(l => l.trim().toLowerCase());
    let userAgentMatched = false;
    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        userAgentMatched = line.includes('*') || line.includes('googlebot') || line.includes('chrome');
      } else if (userAgentMatched && line.startsWith('disallow:')) {
        const disallowPath = line.substring(9).trim();
        if (disallowPath === '/' || path.startsWith(disallowPath)) {
          return false; // Disallowed
        }
      }
    }
    return true; // Allowed
  } catch (e) {
    return true; // Best effort, don't block
  }
}

export function extractEmailsFromText(text: string): string[] {
  // Regex requiring an alphabetic TLD of at least 2 characters (rejects npm packages like lodash@4.17.23)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = text.match(emailRegex);
  if (!matches) return [];
  const junkDomains = ['sentry', 'wixpress', 'example.com', 'domain.com', 'mysite.com', 'schema.org', 'w3.org'];
  return [...new Set(matches.map(m => m.toLowerCase()))].filter(email => {
    return !junkDomains.some(j => email.includes(j));
  });
}

export interface FetchPageResult {
  text: string | null;
  emails: string[];
  rawHtml?: string;
  status?: number;
  statusText?: string;
  robotsAllowed: boolean;
  error?: string;
  durationMs?: number;
}

export const NON_PERSONAL_HOSTS = new Set([
  'amazon.com',
  'barnesandnoble.com',
  'bookshop.org',
  'enable-javascript.com',
  'substackcdn.com',
  'w3.org',
  'google.com',
  'googleapis.com',
  'apple.com',
  'spotify.com',
  'cloudflare.com',
  'stripe.com',
  'paypal.com',
  'patreon.com',
  'buymeacoffee.com',
  'kofi.com',
  'ko-fi.com',
  'kickstarter.com',
  'gofundme.com',
  'shopify.com',
  'etsy.com',
  'goodreads.com',
  'audible.com',
  'forms.gle',
  'docs.google.com',
  'drive.google.com',
  'notion.site',
  'notion.so'
]);

export function extractBioAndPersonalLinks(html: string, pageUrl: string): { bioLinksFound: string[]; personalDomainLinks: string[] } {
  const bioLinksFound: string[] = [];
  const personalDomainLinks: string[] = [];
  if (!html) return { bioLinksFound, personalDomainLinks };

  let currentHost = '';
  try {
    currentHost = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return { bioLinksFound, personalDomainLinks };
  }

  const bioSectionRegex = /<[^>]+class=[\"'][^\"']*(?:author|byline|bio|profile|creator|contributor|about|card)[^\"']*[\"'][^>]*>([\s\S]*?)<\/(?:div|section|aside|header|footer|p|span)>/gi;
  const linkRegex = /<a\b[^>]*href=[\"'](https?:\/\/[^\"']+)[\"'][^>]*>(.*?)<\/a>/gi;
  const seenLinks = new Set<string>();

  const processLink = (href: string, isFromBioSection: boolean) => {
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase();

      if (host === currentHost) return;
      if (seenLinks.has(href)) return;
      seenLinks.add(href);

      if (isFromBioSection) {
        bioLinksFound.push(href);
      }

      if (isPlatformDomain(host)) return;

      for (const nonPersonal of NON_PERSONAL_HOSTS) {
        if (host === nonPersonal || host.endsWith(`.${nonPersonal}`)) return;
      }

      if (/\.(png|jpe?g|gif|webp|svg|css|js|pdf|mp4)$/i.test(u.pathname)) return;

      personalDomainLinks.push(u.origin);
    } catch {}
  };

  let sectionMatch;
  while ((sectionMatch = bioSectionRegex.exec(html)) !== null) {
    const sectionHtml = sectionMatch[1];
    let match;
    const innerLinkRegex = /<a\b[^>]*href=[\"'](https?:\/\/[^\"']+)[\"'][^>]*>(.*?)<\/a>/gi;
    while ((match = innerLinkRegex.exec(sectionHtml)) !== null) {
      processLink(match[1], true);
    }
  }

  let pageMatch;
  while ((pageMatch = linkRegex.exec(html)) !== null) {
    processLink(pageMatch[1], false);
  }

  return {
    bioLinksFound: [...new Set(bioLinksFound)],
    personalDomainLinks: [...new Set(personalDomainLinks)]
  };
}

export async function fetchPageContent(url: string, timeoutMs = 3000, charCap = 1000): Promise<FetchPageResult> {
  const startTime = Date.now();
  if (url.includes('linkedin.com') || url.includes('twitter.com') || url.includes('x.com')) {
    return { text: null, emails: [], robotsAllowed: false, error: 'Social platform domain skipped' };
  }

  try {
    const urlObj = new URL(url);
    const isAllowed = await checkRobotsTxt(urlObj.origin, urlObj.pathname);
    if (!isAllowed) {
      return { 
        text: null, 
        emails: [], 
        robotsAllowed: false, 
        durationMs: Date.now() - startTime,
        error: 'Disallowed by robots.txt' 
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT }
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === 'AbortError';
      return {
        text: null,
        emails: [],
        robotsAllowed: true,
        durationMs: Date.now() - startTime,
        error: isTimeout ? `Timeout after ${timeoutMs}ms` : fetchErr.message
      };
    }

    clearTimeout(timeoutId);

    if (response.status === 403 || response.status === 429 || !response.ok) {
      return { 
        text: null, 
        emails: [], 
        robotsAllowed: true, 
        status: response.status, 
        statusText: response.statusText,
        durationMs: Date.now() - startTime,
        error: `HTTP ${response.status} ${response.statusText}` 
      };
    }

    const html = await response.text();
    
    // Check for captcha in title or body
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('<title>captcha') || lowerHtml.includes('captcha')) {
       const titleMatch = lowerHtml.match(/<title[^>]*>([^<]+)<\/title>/);
       if (titleMatch && titleMatch[1].includes('captcha')) {
         return { 
           text: null, 
           emails: [], 
           robotsAllowed: true, 
           status: response.status, 
           durationMs: Date.now() - startTime,
           error: 'Bot Captcha detected' 
         };
       }
    }

    const emails = extractEmailsFromText(html);

    // Naive HTML stripping
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { 
      text: textContent.slice(0, charCap),
      emails,
      rawHtml: html,
      robotsAllowed: true,
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startTime
    };
  } catch (error: any) {
    return { 
      text: null, 
      emails: [], 
      robotsAllowed: true, 
      durationMs: Date.now() - startTime,
      error: error?.message || 'Unknown fetch error' 
    };
  }
}
