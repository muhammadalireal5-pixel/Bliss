import { NextResponse } from 'next/server';
import { generateEmailTemplate, regenerateLeadEmail, populateEmailTemplate, generateBatchEmails } from '@/lib/gemini';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkAndIncrementUsage } from '@/lib/usage';

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
      const { name, targetAudience, reasonForOutreach, offering, leads, campaignId } = body;
      
      // If leads array is passed without action (e.g. from CSV import)
      if (leads && Array.isArray(leads)) {
         // Enforce limit atomically
         const reservation = await checkAndIncrementUsage(userId, leads.length);
         if (!reservation.allowed) {
            return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
         }
         
         const allowedLeads = leads.slice(0, reservation.reserved);
         if (allowedLeads.length < reservation.reserved) {
            const { refundUsage } = await import('@/lib/usage');
            await refundUsage(userId, reservation.reserved - allowedLeads.length);
         }
         
         try {
           const emails = await generateBatchEmails({
             targetAudience: targetAudience || 'Custom Target',
             reasonForOutreach: reasonForOutreach || 'Direct Outreach',
             offering: offering || 'Collaboration Proposal',
             tone: 'professional',
             leads: allowedLeads,
           });
           
           // Persist leads to database
           let savedLeads: any[] = [];
           if (campaignId) {
              const { Lead } = await import('@/models/Lead');
              const connectToDatabase = (await import('@/lib/db')).default;
              await connectToDatabase();
              
              const docsToInsert = allowedLeads.map((l, i) => ({
                campaignId,
                userId,
                name: l.name || 'Unknown',
                email: l.email,
                source: l.source || 'CSV Import',
                subject: emails[i].subject,
                draftEmail: emails[i].draftEmail,
                status: 'draft',
                confidence: 'verified',
              }));
              
              savedLeads = await Lead.insertMany(docsToInsert);
           }
           
           const results = allowedLeads.map((l, i) => ({
              email: l.email,
              emailDraft: emails[i].draftEmail,
              subject: emails[i].subject,
              success: true,
              _id: savedLeads[i]?._id
           }));
           return NextResponse.json({ results });
         } catch (err) {
           const { refundUsage } = await import('@/lib/usage');
           await refundUsage(userId, allowedLeads.length);
           throw err;
         }
      }

      if (name && targetAudience && reasonForOutreach && offering) {
        // Enforce limit for manual leads atomically
        const reservation = await checkAndIncrementUsage(userId, 1);
        if (!reservation.allowed) {
          return NextResponse.json({ error: 'Monthly lead generation limit reached. Please upgrade to continue.' }, { status: 403 });
        }
        
        try {
          const { subject, draftEmail } = await generateEmailTemplate({
            targetAudience,
            reasonForOutreach,
            offering,
            tone: 'professional', // Default tone
          });
          
          const populated = populateEmailTemplate(draftEmail, { name });
          return NextResponse.json({ subject, draftEmail: populated.draftEmail });
        } catch (err) {
          // Refund usage if generation fails
          const { refundUsage } = await import('@/lib/usage');
          await refundUsage(userId, 1);
          throw err;
        }
      }
    }

    return NextResponse.json({ error: 'Invalid or missing action flag' }, { status: 400 });
  } catch (error: any) {
    console.error('Email Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate email' },
      { status: 500 }
    );
  }
}
