const fs = require('fs');
const mongoose = require('mongoose');

const env = fs.readFileSync('.env.local', 'utf8');
let uri = env.match(/MONGODB_URI=(.*)/)[1];
if (uri.startsWith('"')) uri = JSON.parse(uri);

async function run() {
  await mongoose.connect(uri);
  const SearchLog = mongoose.connection.collection('searchlogs');
  const log = await SearchLog.findOne({}, { sort: { _id: -1 } }); // The last run
  
  if (log) {
    console.log(`Raw bucket A length: ${(log.extraction.bucketARaw || []).length}`);
    (log.extraction.bucketARaw || []).forEach(l => {
      console.log(`- ${l.name} | Match: ${l.audienceMatch} | Reason: ${l.audienceReasoning}`);
    });
  }
  process.exit(0);
}
run().catch(console.error);
