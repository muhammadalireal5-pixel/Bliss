const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-user-id': '64e8e192a4f4f72834b6b6d5' // some valid 24 hex string
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.leads) {
         parsed.leads.forEach(l => {
           console.log(`- ${l.name} | ${l.email || 'No Email'} | ${l.contactMethod} | ${l.entityType} | ${l.profileUrl}`);
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
req.write(JSON.stringify({ targetAudience: 'writers', bypassCache: true }));
req.end();
