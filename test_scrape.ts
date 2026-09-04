import { fetchPageContent } from './lib/page-fetcher';

async function run() {
  const res = await fetchPageContent('https://carrieblogger.com/amazon-listings');
  console.log('Status:', res.status);
  console.log('Robots Allowed:', res.robotsAllowed);
  console.log('Emails:', res.emails);
  console.log('Error:', res.error);
  if (res.text) console.log('Text length:', res.text.length);
  
  if (res.emails.length === 0 && res.rawHtml) {
    const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = res.rawHtml.match(regex);
    console.log('Matches in raw html:', matches);
  }
}
run().catch(console.error);
