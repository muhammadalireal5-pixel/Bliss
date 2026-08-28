import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

function buildQuery(targetAudience: string) {
  const platforms = [
    { keywords: ['engineer', 'developer', 'programmer', 'software'], platform: 'site:github.com' },
    { keywords: ['writer', 'blogger', 'journalist', 'content'], platform: 'site:medium.com' },
    { keywords: ['designer', 'ux', 'ui', 'illustrator'], platform: 'site:dribbble.com' },
  ];

  const lowerAudience = targetAudience.toLowerCase();
  const activePlatforms = ['site:linkedin.com/in/', 'site:twitter.com/'];
  
  for (const { keywords, platform } of platforms) {
    if (keywords.some(kw => lowerAudience.includes(kw))) {
      activePlatforms.push(platform);
    }
  }

  const platformsString = activePlatforms.join(' OR ');
  return `(${platformsString}) ${targetAudience} ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")`;
}

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

    const query = buildQuery(targetAudience);

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
    let leads: { name: string; email: string; profileUrl: string; source: string; summary?: string }[] = [];

    if (Array.isArray(data.organic) && data.organic.length > 0) {
      try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
          throw new Error('GEMINI_API_KEY is not configured');
        }

        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const batch = data.organic.map((r: any) => ({
          title: r.title,
          snippet: r.snippet,
          link: r.link
        }));

        const prompt = `Extract name, email, platform, profileUrl, and a brief 1-2 sentence summary/bio of the person from these search results. Return null for name or email if not confidently found. Do not hallucinate.
${JSON.stringify(batch)}`;

        const geminiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
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
                  platform: { 
                    type: Type.STRING, 
                    enum: ["linkedin", "twitter", "github", "medium", "dribbble", "other"] 
                  },
                  profileUrl: { type: Type.STRING },
                  summary: { type: Type.STRING, nullable: true, description: "A brief 1-2 sentence bio or summary of who this person is based on the snippet." },
                },
                required: ["name", "email", "platform", "profileUrl"]
              }
            }
          }
        });

        const content = geminiResponse.text;
        if (!content) {
          throw new Error('No valid content returned from Gemini.');
        }

        const parsed = JSON.parse(content);
        
        const seenEmails = new Set();
        for (const l of parsed) {
          if (l.email) {
            const emailLower = l.email.toLowerCase();
            if (!seenEmails.has(emailLower)) {
              seenEmails.add(emailLower);
              
              let sourceName = 'Other';
              if (l.platform === 'linkedin') sourceName = 'LinkedIn';
              else if (l.platform !== 'other') sourceName = l.platform.charAt(0).toUpperCase() + l.platform.slice(1);
              
              leads.push({
                name: l.name || 'Unknown',
                email: emailLower,
                profileUrl: l.profileUrl,
                source: sourceName,
                summary: l.summary || undefined
              });
            }
          }
        }
      } catch (error) {
        console.error('Gemini extraction failed, falling back to regex:', error);
        
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        
        data.organic.forEach((result: any) => {
          const url = result.link || '';
          const snippet = result.snippet || '';
          const title = result.title || '';
          
          const emailMatch = snippet.match(emailRegex);
          if (emailMatch && emailMatch.length > 0) {
            const email = emailMatch[0].toLowerCase();
            
            let name = title.split('-')[0].trim();
            if (name.includes('|')) name = name.split('|')[0].trim();
            if (name.includes('...')) name = name.split('...')[0].trim();
            if (!name || name.length > 40) name = 'Unknown';
            
            let source = 'Other';
            if (url.includes('linkedin.com')) source = 'LinkedIn';
            else if (url.includes('twitter.com')) source = 'Twitter';
            else if (url.includes('github.com')) source = 'Github';
            else if (url.includes('medium.com')) source = 'Medium';
            else if (url.includes('dribbble.com')) source = 'Dribbble';

            if (!leads.some((l) => l.email === email)) {
              leads.push({
                name,
                email,
                profileUrl: url,
                source,
                summary: snippet.length > 150 ? snippet.slice(0, 150) + '...' : snippet
              });
            }
          }
        });
      }
    }

    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to search for leads' }, { status: 500 });
  }
}
