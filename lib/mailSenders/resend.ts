import { Resend } from 'resend';

export async function sendResendEmail(
  toEmail: string,
  subject: string,
  htmlContent: string
) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(RESEND_API_KEY);
  
  // Note: For now using the Resend sandbox domain as fallback.
  const { data, error } = await resend.emails.send({
    from: 'SayMe Outreach <onboarding@resend.dev>',
    to: toEmail,
    subject: subject,
    html: htmlContent,
  });

  if (error) {
    return { success: false, provider: 'resend' as const, error: error.message };
  }

  return { success: true, messageId: data?.id, provider: 'resend' as const };
}
