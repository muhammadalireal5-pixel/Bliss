import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { getNextJobs, removeJob, enqueueJob } from '@/lib/queue';
import { Lead } from '@/models/Lead';
import { sendEmail } from '@/lib/mailSenders';
import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  // Validate CRON_SECRET for security using custom header
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await connectToDatabase();
    
    // Process up to 10 jobs per invocation to fit within Worker time limits
    const jobs = await getNextJobs(10);
    
    if (jobs.length === 0) {
      return NextResponse.json({ status: 'idle', message: 'No jobs in queue' });
    }

    let processedCount = 0;

    for (const job of jobs) {
      try {
        const lead = await Lead.findById(job.leadId);
        
        // Remove job from queue immediately so it's not double-processed if we crash
        await removeJob(job);
        
        if (!lead || !['queued', 'sent'].includes(lead.status)) {
          // If lead was deleted or stopped/replied, just drop the job
          continue;
        }

        let subject = lead.subject;
        let body = lead.draftEmail;

        if (job.step > 1) {
          // Generate follow-up using Gemini
          const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
          if (GEMINI_API_KEY) {
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const prompt = `Write a short, polite 2-sentence follow-up email to a lead who hasn't responded to the first email. 
Previous subject: "${subject}"
Previous email: "${body}"
Make it sound natural, casual, and brief. Return JSON with { "subject": string, "body": string }. For subject, use "Re: [Previous Subject]" or a short new one.`;
            
            try {
              const geminiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                  temperature: 0.7,
                  responseMimeType: 'application/json'
                }
              });
              const parsed = JSON.parse(geminiResponse.text || '{}');
              if (parsed.subject && parsed.body) {
                subject = parsed.subject;
                body = parsed.body;
              }
            } catch(e) {
              console.error('Follow-up generation failed:', e);
              continue; // Drop job, let it die
            }
          }
        }

        const result = await sendEmail(job.userId, lead.email, subject, body, lead.trackingId);
        
        if (result.success) {
          lead.status = 'sent';
          lead.step = job.step;
          
          const campaign = await mongoose.model('Campaign').findById(lead.campaignId);
          if (campaign && campaign.followUpEnabled) {
            if (job.step < (campaign.maxFollowUps + 1)) {
               const delayMs = campaign.followUpDelayDays * 24 * 60 * 60 * 1000;
               const nextSendAt = new Date(Date.now() + delayMs);
               lead.sendAt = nextSendAt;
               await enqueueJob({
                 leadId: job.leadId,
                 type: 'send_email',
                 userId: job.userId,
                 step: job.step + 1
               }, nextSendAt.getTime());
            }
          }
          
          await lead.save();
          processedCount++;
        }
      } catch (err) {
        console.error(`Error processing job for lead ${job.leadId}:`, err);
        // Could re-queue here if desired, but we'll drop it to avoid poison messages for now
      }
    }

    return NextResponse.json({ status: 'success', processed: processedCount });
  } catch (error: any) {
    console.error('Process Queue Cron Error:', error);
    return NextResponse.json({ error: 'Failed to process queue' }, { status: 500 });
  }
}
