import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const targetAudience = "Software Engineers in Tokyo";
  const query = `(site:linkedin.com/in/ OR site:twitter.com/) ${targetAudience} ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")`;

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY || '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query })
  });
  const data = await res.json();
  console.log("Total organic:", data.organic?.length);
  
  const filtered = data.organic?.filter((r: any) => r.link.includes('linkedin.com/in/') || r.link.includes('twitter.com/'));
  console.log("Filtered organic:", filtered?.length);
  
  if (filtered && filtered.length > 0) {
    console.log("First result:", filtered[0].title, filtered[0].link);
  }
}
run();
