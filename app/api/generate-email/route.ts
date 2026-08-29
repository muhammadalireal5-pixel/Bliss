import { NextResponse } from 'next/server';
import { generateEmailTemplate, regenerateLeadEmail, populateEmailTemplate, generateBatchEmails } from '@/lib/gemini';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const rateLimit = await checkRateLimit(`generate:${userId}`, { limit: 30, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'batch') {
      const { targetAudience, reasonForOutreach, offering, tone, leads } = body;
      if (!targetAudience || !reasonForOutreach || !offering || !leads) {
        return NextResponse.json({ error: 'Missing required fields for batch generation' }, { status: 400 });
      }

      const emails = await generateBatchEmails({
        targetAudience,
        reasonForOutreach,
        offering,
        tone: tone || 'professional',
        leads,
      });

      return NextResponse.json({ emails });
    }

    if (action === 'template') {
      const { targetAudience, reasonForOutreach, offering, tone } = body;
      if (!targetAudience || !reasonForOutreach || !offering || !tone) {
        return NextResponse.json({ error: 'Missing required fields for template generation' }, { status: 400 });
      }

      const { subject, draftEmail } = await generateEmailTemplate({
        targetAudience,
        reasonForOutreach,
        offering,
        tone,
      });

      return NextResponse.json({ subject, draftEmail });
    }

    if (action === 'regenerate') {
      const { baseTemplate, leadData } = body;
      if (!baseTemplate || !leadData) {
        return NextResponse.json({ error: 'Missing required fields for lead regeneration' }, { status: 400 });
      }

      const { subject, draftEmail } = await regenerateLeadEmail({
        baseTemplate,
        leadData,
      });

      return NextResponse.json({ subject, draftEmail });
    }

    if (action === 'populate') {
      const { template, leadData } = body;
      if (!template || !leadData) {
        return NextResponse.json({ error: 'Missing required fields for populate' }, { status: 400 });
      }

      const result = populateEmailTemplate(template, leadData);
      return NextResponse.json(result);
    }

    if (!action) {
      // Backwards compatibility for the old endpoint payload
      const { name, targetAudience, reasonForOutreach, offering } = body;
      if (name && targetAudience && reasonForOutreach && offering) {
        const { subject, draftEmail } = await generateEmailTemplate({
          targetAudience,
          reasonForOutreach,
          offering,
          tone: 'professional', // Default tone
        });
        
        const populated = populateEmailTemplate(draftEmail, { name });
        return NextResponse.json({ subject, draftEmail: populated.draftEmail });
      }
    }

    return NextResponse.json({ error: 'Invalid or missing action flag' }, { status: 400 });
  } catch (error: any) {
    console.error('Email Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate email' },
      { status: 500 }
    );
  }
}
