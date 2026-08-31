import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';
import crypto from 'crypto';
import { sendEmail } from '@/lib/mailSenders';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const rateLimit = await checkRateLimit(`send:${userId}`, { limit: 10, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields (to, subject, html)' }, { status: 400 });
    }

    const dedupKey = `sent:${crypto.createHash('sha256').update(to + subject + html).digest('hex')}`;
    const isDuplicate = await redis.get(dedupKey);
    if (isDuplicate) {
      return NextResponse.json({ success: true, data: { message: "Duplicate suppressed" }, duplicate: true });
    }

    const htmlFormatted = html.replace(/\n/g, '<br>');
    const result = await sendEmail(userId, to, subject, htmlFormatted);

    if (!result.success) {
      console.error(`Send Email failed [${result.provider}]:`, result.error);
      
      let cleanError = 'Failed to send email. Please check your connected inbox configuration or server logs.';
      if (result.error?.includes('suppressed')) {
        cleanError = result.error;
      } else if (result.error?.includes('disabled') || result.error?.includes('API has not been used')) {
        cleanError = 'Gmail API is disabled. Please enable the Gmail API in your Google Cloud Console for this project.';
      } else if (result.error?.includes('403') || result.error?.includes('access_denied')) {
        cleanError = 'Access denied. Please check your Google Cloud Console OAuth consent screen test users or API scopes.';
      }

      return NextResponse.json({ error: cleanError }, { status: 400 });
    }

    await redis.set(dedupKey, 1, { nx: true, ex: 300 });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Send Email Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please check server logs.' }, { status: 500 });
  }
}
