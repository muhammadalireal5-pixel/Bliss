const fs = require('fs');
const line = fs.readFileSync('carrie.json', 'utf8');
const log = JSON.parse(line.trim());

const scrapeItem = log.scraping.find(s => s.url.includes('carrie'));
console.log(JSON.stringify(scrapeItem, null, 2));

const bioItem = log.bioLinkEnrichment?.find(b => b.leadUrl.includes('carrie') || (b.personalDomains && b.personalDomains.some(d => d.includes('carrie'))));
console.log(JSON.stringify(bioItem, null, 2));

