export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SayMeBot/1.0';

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
        userAgentMatched = line.includes('*') || line.includes('saymebot');
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
  // also look for mailto links using regex
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const matches = text.match(emailRegex);
  const emails = matches ? [...new Set(matches.map(m => m.toLowerCase()))] : [];
  return emails;
}

export async function fetchPageContent(url: string, timeoutMs = 3000, charCap = 1000): Promise<{text: string | null, emails: string[]}> {
  if (url.includes('linkedin.com') || url.includes('twitter.com') || url.includes('x.com')) {
    return { text: null, emails: [] };
  }

  try {
    const urlObj = new URL(url);
    const isAllowed = await checkRobotsTxt(urlObj.origin, urlObj.pathname);
    if (!isAllowed) {
      return { text: null, emails: [] };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT }
    });

    clearTimeout(timeoutId);

    if (response.status === 403 || response.status === 429 || !response.ok) {
      return { text: null, emails: [] };
    }

    const html = await response.text();
    
    // Check for captcha in title or body
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('<title>captcha') || lowerHtml.includes('captcha')) {
       // verify it's a real captcha indicator, maybe just check title
       const titleMatch = lowerHtml.match(/<title[^>]*>([^<]+)<\/title>/);
       if (titleMatch && titleMatch[1].includes('captcha')) {
         return { text: null, emails: [] };
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
      emails
    };
  } catch (error) {
    return { text: null, emails: [] };
  }
}
