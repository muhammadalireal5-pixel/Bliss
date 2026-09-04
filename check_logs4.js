const fs = require('fs');
const mongoose = require('mongoose');

const env = fs.readFileSync('.env.local', 'utf8');
let uri = env.match(/MONGODB_URI=(.*)/)[1];
if (uri.startsWith('"')) uri = JSON.parse(uri);

async function run() {
  await mongoose.connect(uri);
  const SearchLog = mongoose.connection.collection('searchlogs');
  const logs = await SearchLog.find({}, { sort: { _id: -1 } }).limit(5).toArray();
  
  logs.forEach((log, i) => {
    console.log(`\n--- LOG ${i} ---`);
    console.log(`Raw bucket A length: ${(log.extraction.bucketARaw || []).length}`);
    (log.extraction.bucketARaw || []).forEach(l => {
      console.log(`- ${l.name} | Match: ${l.audienceMatch} | Reason: ${l.audienceReasoning}`);
    });
  });
  process.exit(0);
}
run().catch(console.error);
