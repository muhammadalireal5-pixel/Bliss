import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redis } from '@/lib/redis';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await req.json();
    let { campaignId, targetAudience, reasonForOutreach, offering, lead } = body;
    const userId = (session.user as any).id;

    if (!lead || !lead.email) {
      return NextResponse.json({ error: 'Missing lead data' }, { status: 400 });
    }

    // If there is no campaignId, we must create a campaign first to attach this lead to
    if (!campaignId) {
      const newCampaign = await Campaign.create({
        targetAudience: targetAudience || 'Manual Lead',
        reasonForOutreach: reasonForOutreach || 'Direct Outreach',
        offering: offering || 'Custom',
        userId,
        followUpEnabled: false, // Default for manual one-offs if no campaign exists
      });
      campaignId = newCampaign._id.toString();
    }

    // Check if lead email already exists for this user to prevent duplicates
    const existingLead = await Lead.findOne({ userId, email: lead.email.toLowerCase() });
    if (existingLead) {
      return NextResponse.json({ error: 'Lead with this email already exists' }, { status: 400 });
    }

    const newLead = await Lead.create({
      campaignId,
      userId,
      name: lead.name,
      email: lead.email.toLowerCase(),
      confidence: lead.confidence || 'verified',
      profileUrl: lead.profileUrl || '',
      source: lead.source || 'Manual',
      summary: lead.summary || '',
      subject: lead.subject || '',
      draftEmail: lead.draftEmail || '',
      status: 'draft',
    });

    await redis.del(`history:${userId}`);

    return NextResponse.json({ success: true, lead: newLead, campaignId });
  } catch (error: any) {
    console.error('Save Lead Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save lead' }, { status: 500 });
  }
}
