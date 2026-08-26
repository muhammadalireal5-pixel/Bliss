import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields (to, subject, html)' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key is not configured' }, { status: 500 });
    }

    // Initialize inside handler to ensure env vars are available at runtime
    const resend = new Resend(RESEND_API_KEY);

    // Usually you need a verified domain in Resend to send from. 
    // For testing, Resend allows sending to the verified email address from onboarding@resend.dev
    const { data, error } = await resend.emails.send({
      from: 'SayMe Outreach <onboarding@resend.dev>', // Change to your verified domain in production
      to: [to],
      subject: subject,
      html: html.replace(/\n/g, '<br>'), // Convert newlines to HTML breaks
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Send Email Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
