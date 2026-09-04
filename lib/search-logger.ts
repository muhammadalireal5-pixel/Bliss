import fs from 'fs';
import path from 'path';
import connectToDatabase from './db';
import { SearchLog } from '@/models/SearchLog';

export async function persistSearchLog(logData: any) {
  try {
    // 1. Persist to MongoDB
    await connectToDatabase();
    await SearchLog.create(logData);
  } catch (mongoErr: any) {
    console.error('[SearchLogger] Failed to save search log to MongoDB:', mongoErr?.message);
  }

  try {
    // 2. Persist to local disk logs/search.log (if environment allows)
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFilePath = path.join(logsDir, 'search.log');
    const logLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...logData
    }) + '\n';
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (fsErr: any) {
    // In serverless environments (e.g. Vercel read-only filesystem), ignore fs error
  }
}
