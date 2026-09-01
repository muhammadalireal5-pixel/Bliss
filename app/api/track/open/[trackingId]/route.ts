import { NextResponse } from 'next/server';
import { TrackingEvent } from '@/models/TrackingEvent';
import { Lead } from '@/models/Lead';
import connectToDatabase from '@/lib/db';

const PIXEL_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const pixelBuffer = Buffer.from(PIXEL_BASE64, 'base64');

export async function GET(req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    
    await connectToDatabase();
    
    const lead = await Lead.findOne({ trackingId }).lean();
    if (lead) {
      const event = await TrackingEvent.findOneAndUpdate(
        { trackingId, type: 'open' },
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
        await Lead.findByIdAndUpdate(lead._id, { $inc: { opens: 1 } });
      }
    }
    
    return new Response(pixelBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return new Response(pixelBuffer, { headers: { 'Content-Type': 'image/gif' } });
  }
}
