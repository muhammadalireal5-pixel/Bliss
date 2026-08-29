import { redis } from '@/lib/redis';

export interface QueueJob {
  leadId: string;
  type: 'send_email';
  userId: string;
  step: number;
}

const QUEUE_KEY = 'email_queue';

export async function enqueueJob(job: QueueJob, executeAt: number = Date.now()) {
  await redis.zadd(QUEUE_KEY, { score: executeAt, member: JSON.stringify(job) });
}

export async function getNextJobs(limit: number = 10): Promise<QueueJob[]> {
  const now = Date.now();
  // Using an older signature of zrange
  const jobsData = await redis.zrange(QUEUE_KEY, 0, now, { byScore: true, offset: 0, count: limit } as any);
  
  if (!jobsData || jobsData.length === 0) return [];
  
  return jobsData.map((j: any) => typeof j === 'string' ? JSON.parse(j) : j);
}

export async function removeJob(job: QueueJob) {
  await redis.zrem(QUEUE_KEY, JSON.stringify(job));
}
