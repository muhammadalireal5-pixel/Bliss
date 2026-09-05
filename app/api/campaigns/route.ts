import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redis } from '@/lib/redis';

export async function POST(req: Request) {
  try {
    let userId = 'anonymous';
    if (process.env.NODE_ENV !== 'production' && req.headers.get('x-internal-user-id')) {
      userId = req.headers.get('x-internal-user-id')!;
    } else {
      const session = await getServerSession(authOptions);
      if (!session || !session.user || !(session.user as any).id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = (session.user as any).id;
    }

    await connectToDatabase();
    
    const { targetAudience, reasonForOutreach, offering, leads, followUpEnabled, followUpDelayDays, maxFollowUps } = await req.json();

    if (!targetAudience || !reasonForOutreach || !offering) {
      return NextResponse.json({ error: 'Missing required campaign fields' }, { status: 400 });
    }

    // 1. Create the Campaign
    const newCampaign = await Campaign.create({
      userId,
      targetAudience,
      reasonForOutreach,
      offering,
      followUpEnabled: followUpEnabled || false,
      followUpDelayDays: followUpDelayDays || 3,
      maxFollowUps: maxFollowUps || 2,
    });

    // 2. Create Leads associated with the Campaign
    if (leads && Array.isArray(leads) && leads.length > 0) {
      // Find existing leads for this user to avoid cross-campaign duplicates
      const incomingEmails = leads.map(l => l.email).filter(Boolean);
      const incomingSources = leads.map(l => l.contactSource || l.profileUrl).filter(Boolean);

      const existingLeads = await Lead.find({
        userId,
        $or: [
          ...(incomingEmails.length > 0 ? [{ email: { $in: incomingEmails } }] : []),
          ...(incomingSources.length > 0 ? [
            { contactSource: { $in: incomingSources } },
            { profileUrl: { $in: incomingSources } }
          ] : [])
        ]
      }).select('email contactSource profileUrl').lean();

      const existingEmailSet = new Set(existingLeads.map(l => l.email).filter(Boolean));
      const existingSourceSet = new Set(existingLeads.flatMap(l => [l.contactSource, l.profileUrl]).filter(Boolean));

      const leadsToInsert = leads
        .filter(lead => {
          if (lead.email && existingEmailSet.has(lead.email)) return false;
          if (lead.contactSource && existingSourceSet.has(lead.contactSource)) return false;
          if (lead.profileUrl && existingSourceSet.has(lead.profileUrl)) return false;
          return true;
        })
        .map(lead => ({
          campaignId: newCampaign._id,
          userId,
          name: lead.name,
          email: lead.email || '',
          contactMethod: lead.contactMethod || (lead.email ? 'email' : 'source-only'),
          contactSource: lead.contactSource || lead.profileUrl || '',
          confidence: lead.confidence || 'verified',
          profileUrl: lead.profileUrl || '',
          source: lead.source || 'Web',
          summary: lead.summary || '',
          subject: lead.subject || '',
          draftEmail: lead.draftEmail || '',
          status: 'draft',
        }));

      if (leadsToInsert.length > 0) {
        await Lead.insertMany(leadsToInsert);
      }
    }

    await redis.del(`history:${userId}`);

    return NextResponse.json({ success: true, campaignId: newCampaign._id });
  } catch (error: any) {
    console.error('Save Campaign Error:', error);
    return NextResponse.json({ error: 'Failed to save campaign' }, { status: 500 });
  }
}
