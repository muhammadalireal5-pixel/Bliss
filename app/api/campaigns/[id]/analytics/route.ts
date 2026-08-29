import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import { Campaign } from '@/models/Campaign';
import { Lead } from '@/models/Lead';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;
    const { id } = await params;

    await connectToDatabase();
    
    const campaign = await Campaign.findOne({ _id: id, userId }).lean();
    if (!campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const leads = await Lead.find({ campaignId: id }).lean();
    
    const analytics = {
      total: leads.length,
      sent: leads.filter(l => ['sent', 'replied', 'stopped', 'bounced', 'unsubscribed'].includes(l.status)).length,
      opened: leads.filter(l => (l.opens || 0) > 0).length,
      clicked: leads.filter(l => (l.clicks || 0) > 0).length,
      replied: leads.filter(l => (l.replies || 0) > 0).length,
      unsubscribed: leads.filter(l => l.status === 'unsubscribed').length,
    };

    return NextResponse.json({ analytics, leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
