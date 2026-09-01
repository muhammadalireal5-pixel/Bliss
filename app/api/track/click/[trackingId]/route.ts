import { NextResponse } from 'next/server';
import { TrackingEvent } from '@/models/TrackingEvent';
import { Lead } from '@/models/Lead';
import connectToDatabase from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    const url = new URL(req.url).searchParams.get('url');
    
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return new Response('Invalid URL', { status: 400 });
    }
    
    await connectToDatabase();
    
    const lead = await Lead.findOne({ trackingId }).lean();
    if (lead) {
      const event = await TrackingEvent.findOneAndUpdate(
        { trackingId, type: 'click', url },
        { 
          $inc: { count: 1 },
          $setOnInsert: { 
            leadId: lead._id, 
            campaignId: lead.campaignId, 
            userId: lead.userId, 
            firstAt: new Date() 
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      if (event.count === 1) {
        await Lead.findByIdAndUpdate(lead._id, { $inc: { clicks: 1 } });
      }
    }

    return NextResponse.redirect(url);
  } catch (error) {
    const url = new URL(req.url).searchParams.get('url');
    return url ? NextResponse.redirect(url) : new Response('Error', { status: 500 });
  }
}
