const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-user-id': 'test-user-id'
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.leads) {
         parsed.leads.forEach(l => {
           console.log(`- ${l.name} | ${l.email || 'No Email'} | ${l.contactMethod} | ${l.audienceMatch} | [Reason: ${l.audienceReasoning}] | ${l.profileUrl}`);
         });
      } else {
         console.log(parsed);
      }
    } catch(e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', console.error);
const bypassCache = process.argv.includes('--bypass-cache');

req.write(JSON.stringify({
  targetAudience: 'writers',
  offering: 'we will publish and market your book for free, we only take 50% of gross incomme',
  bypassCache
}));
req.end();
