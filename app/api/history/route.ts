import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (session.user as any).id;

    const rateLimit = await checkRateLimit(`history:${userId}`, { limit: 30, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const cacheKey = `history:${userId}`;
    const cachedHistory = await redis.get(cacheKey);
    if (cachedHistory) {
      return NextResponse.json({ history: cachedHistory });
    }

    await connectToDatabase();
    
    // Fetch all campaigns for THIS USER sorted by newest first
    const campaigns = await Campaign.find({ userId: (session.user as any).id }).sort({ createdAt: -1 }).lean();
    
    // Batch fetch all leads to avoid N+1 query problem
    const campaignIds = campaigns.map(c => c._id);
    const allLeads = await Lead.find({ campaignId: { $in: campaignIds } }).lean();

    // Map leads to their campaigns in memory
    const history = campaigns.map(campaign => ({
      ...campaign,
      leads: allLeads.filter(l => l.campaignId.toString() === campaign._id.toString()),
    }));

    await redis.set(cacheKey, history, { ex: 300 });

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('Fetch History Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
  }
}
