import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';

export async function GET() {
  try {
    await connectToDatabase();
    
    // Fetch all campaigns sorted by newest first
    const campaigns = await Campaign.find({}).sort({ createdAt: -1 }).lean();
    
    // Batch fetch all leads to avoid N+1 query problem
    const campaignIds = campaigns.map(c => c._id);
    const allLeads = await Lead.find({ campaignId: { $in: campaignIds } }).lean();

    // Map leads to their campaigns in memory
    const history = campaigns.map(campaign => ({
      ...campaign,
      leads: allLeads.filter(l => l.campaignId.toString() === campaign._id.toString()),
    }));

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('Fetch History Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
  }
}
