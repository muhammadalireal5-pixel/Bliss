const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-user-id': 'test-user-id',
    'x-test-force-cache': 'true' // Let's pretend we can force it, actually I can just seed redis
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response:', data));
});

req.write(JSON.stringify({ targetAudience: 'writers', offering: 'we will publish and market your book for free, we only take 50% of gross incomme', bypassCache: false }));
req.end();
