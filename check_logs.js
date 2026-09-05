const fs = require('fs');
const mongoose = require('mongoose');

const env = fs.readFileSync('.env.local', 'utf8');
const uriMatch = env.match(/MONGODB_URI=(.*)/);
let uri = uriMatch ? uriMatch[1] : null;
if (uri.startsWith('"')) uri = JSON.parse(uri);

async function run() {
  await mongoose.connect(uri);
  const SearchLog = mongoose.connection.collection('searchlogs');
  
  // Find the logs
  const logs = await SearchLog.find({}).sort({ _id: -1 }).limit(10).toArray();
  logs.forEach((log, i) => {
    const rawCount = (log.extraction?.bucketARaw || []).length;
    console.log(`Log ${i}: count=${rawCount} time=${log.createdAt}`);
    if (rawCount > 3) {
      console.log("Bucket A Raw Leads:");
      (log.extraction.bucketARaw || []).forEach(l => {
        console.log(`- ${l.name} | ${l.email || 'null'} | Match: ${l.audienceMatch || l.entityType} | Reason: ${l.audienceReasoning || l.entityReasoning} | URL: ${l.profileUrl}`);
      });
    }
  });
  process.exit(0);
}
run().catch(console.error);
