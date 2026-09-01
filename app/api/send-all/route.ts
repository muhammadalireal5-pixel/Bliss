import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Campaign } from '@/models/Campaign';
import { enqueueJob } from '@/lib/queue';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const rateLimit = await checkRateLimit(`send_all:${userId}`, { limit: 5, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
    }

    await connectToDatabase();

    const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Find all leads in this campaign that are in draft state and have a draftEmail
    const leadsToSend = await Lead.find({ 
      campaignId, 
      status: 'draft',
      draftEmail: { $ne: '' }
    }).select('_id').lean();

    if (leadsToSend.length === 0) {
      return NextResponse.json({ success: true, message: 'No valid draft leads to send' });
    }

    // Update their status to queued
    await Lead.updateMany(
      { _id: { $in: leadsToSend.map(l => l._id) } },
      { $set: { status: 'queued', step: 1 } }
    );

    // Enqueue jobs with a slight stagger to avoid bursting
    let executeAt = Date.now();
    for (const lead of leadsToSend) {
      await enqueueJob({
        leadId: lead._id.toString(),
        type: 'send_email',
        userId,
        step: 1
      }, executeAt);
      executeAt += 2000; // stagger 2 seconds apart
    }

    return NextResponse.json({ success: true, queuedCount: leadsToSend.length });
  } catch (error: any) {
    console.error('Send All Error:', error);
    return NextResponse.json({ error: 'Failed to queue emails' }, { status: 500 });
  }
}
