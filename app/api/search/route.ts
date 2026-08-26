import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { targetAudience } = await req.json();
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!targetAudience) {
      return NextResponse.json({ error: 'Target audience is required' }, { status: 400 });
    }

    if (!SERPER_API_KEY) {
      return NextResponse.json({ error: 'Search API key is not configured' }, { status: 500 });
    }

    // Google Dorking to find targeted profiles
    // We remove exact-match quotes around targetAudience so a search like "Software Engineer in Tokyo"
    // matches "Software Engineer | Tokyo" without requiring the exact phrase "in Tokyo" in the title.
    const query = `(site:linkedin.com/in/ OR site:twitter.com/) ${targetAudience} ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")`;

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Serper API error: ${response.statusText}. Details: ${errorBody}`);
    }

    const data = await response.json();
    const leads: { name: string; email: string; profileUrl: string; source: string }[] = [];

    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;

    if (Array.isArray(data.organic)) {
      data.organic.forEach((result: any) => {
        const url = result.link || '';
        
        // STRICT FILTER: Only allow LinkedIn or Twitter profiles. Completely block YouTube, articles, etc.
        if (!url.includes('linkedin.com/in/') && !url.includes('twitter.com/')) {
          return; // Skip this result
        }

        const snippet = result.snippet || '';
        const title = result.title || '';
        
        // Extract email from snippet
        const emailMatch = snippet.match(emailRegex);
        if (emailMatch && emailMatch.length > 0) {
          const email = emailMatch[0];
          
          // Clean name extraction from LinkedIn/Twitter titles
          let name = title.split('-')[0].trim();
          if (name.includes('|')) name = name.split('|')[0].trim();
          if (name.includes('...')) name = name.split('...')[0].trim(); // Remove truncation artifacts
          if (!name || name.length > 40) name = 'Unknown';
          
          // Determine source
          const source = url.includes('linkedin.com') ? 'LinkedIn' : 'Twitter';

          // Prevent duplicates
          if (!leads.some((l) => l.email === email)) {
            leads.push({
              name,
              email: email.toLowerCase(),
              profileUrl: result.link,
              source,
            });
          }
        }
      });
    }

    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to search for leads' }, { status: 500 });
  }
}
