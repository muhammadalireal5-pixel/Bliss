import { NextResponse } from 'next/server';
import { Lead } from '@/models/Lead';
import { Suppression } from '@/models/Suppression';
import connectToDatabase from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    
    await connectToDatabase();
    
    const lead = await Lead.findOne({ trackingId });
    if (!lead) {
      return new Response('Invalid or expired unsubscribe link.', { status: 404 });
    }

    await Suppression.findOneAndUpdate(
      { userId: lead.userId, email: lead.email },
      { $setOnInsert: { reason: 'unsubscribe' } },
      { upsert: true }
    );

    lead.status = 'unsubscribed';
    await lead.save();

    return new Response(
      '<html><head><title>Unsubscribed</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f9fafb;margin:0;}</style></head><body><div style="background:white;padding:2rem;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);text-align:center;"><h2>You have been unsubscribed</h2><p style="color:#6b7280;margin-top:1rem;">You will no longer receive emails from this sender.</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    return new Response('Error processing unsubscribe request.', { status: 500 });
  }
}
