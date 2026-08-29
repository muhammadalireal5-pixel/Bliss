import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateEmailMx } from '@/lib/email-validator';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const rateLimit = await checkRateLimit(`import:${userId}`, { limit: 10, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { leads } = await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    await connectToDatabase();

    const emails = leads.map(l => l.email.toLowerCase());
    const existingLeads = await Lead.find({ userId, email: { $in: emails } }).select('email').lean();
    const existingEmailSet = new Set(existingLeads.map(l => l.email));

    // Limit to 50 per import to avoid worker timeout on MX checks
    const leadsToProcess = leads.slice(0, 50);

    const processedLeads = await Promise.all(
      leadsToProcess.map(async (l) => {
        const email = l.email.toLowerCase();
        
        let confidence = 'guessed';
        // Check MX
        const isValid = await validateEmailMx(email);
        if (isValid) confidence = 'verified';

        return {
          name: l.name || 'Unknown',
          email,
          confidence,
          profileUrl: l.profileUrl || '',
          source: 'CSV Import',
          summary: l.summary || '',
          alreadyContacted: existingEmailSet.has(email)
        };
      })
    );

    return NextResponse.json({ leads: processedLeads });
  } catch (error: any) {
    console.error('Import API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import leads' }, { status: 500 });
  }
}
