import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const { targetAudience, reasonForOutreach, offering, leads } = await req.json();

    if (!targetAudience || !reasonForOutreach || !offering) {
      return NextResponse.json({ error: 'Missing required campaign fields' }, { status: 400 });
    }

    // 1. Create the Campaign
    const newCampaign = await Campaign.create({
      targetAudience,
      reasonForOutreach,
      offering,
      userId: (session.user as any).id,
    });

    // 2. Create Leads associated with the Campaign
    if (leads && Array.isArray(leads) && leads.length > 0) {
      const leadsToInsert = leads.map(lead => ({
        campaignId: newCampaign._id,
        name: lead.name,
        email: lead.email,
        profileUrl: lead.profileUrl,
        source: lead.source,
        summary: lead.summary,
        draftEmail: lead.draftEmail,
        status: 'draft',
      }));

      await Lead.insertMany(leadsToInsert);
    }

    return NextResponse.json({ success: true, campaignId: newCampaign._id });
  } catch (error: any) {
    console.error('Save Campaign Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save campaign' }, { status: 500 });
  }
}
