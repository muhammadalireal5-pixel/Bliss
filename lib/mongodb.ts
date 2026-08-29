import { MongoClient } from 'mongodb';

let cachedPromise: Promise<MongoClient> | null = null;

export async function connectToDatabase(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }

  const uri = process.env.MONGODB_URI;
  const options = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    maxPoolSize: 1,
    directConnection: false
  };

  // Disable caching in Cloudflare Workers to prevent socket reuse errors
  const client = new MongoClient(uri, options);
  return client.connect();
}
