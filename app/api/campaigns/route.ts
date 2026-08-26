import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';

export async function POST(req: Request) {
  try {
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
    });

    // 2. Create Leads associated with the Campaign
    if (leads && Array.isArray(leads) && leads.length > 0) {
      const leadsToInsert = leads.map(lead => ({
        campaignId: newCampaign._id,
        name: lead.name,
        email: lead.email,
        profileUrl: lead.profileUrl,
        source: lead.source,
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
