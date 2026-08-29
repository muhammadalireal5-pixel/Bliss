import { UserMailAccount } from '@/models/UserMailAccount';
import { Suppression } from '@/models/Suppression';
import { sendGmailMessage } from './gmail';
import { sendMicrosoftMail } from './microsoft';
import { sendResendEmail } from './resend';
import { decrypt } from '@/lib/crypto';
import { refreshGmailToken, refreshMicrosoftToken } from './token-refresh';
import { wrapEmailHtml } from '@/lib/tracking';

export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  provider: 'gmail' | 'microsoft' | 'resend';
  error?: string;
}

export async function sendEmail(
  userId: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  trackingId?: string
): Promise<SendResult> {
  // Check suppression
  const isSuppressed = await Suppression.findOne({ userId, email: toEmail }).lean();
  if (isSuppressed) {
    return { success: false, provider: 'resend', error: `Email is suppressed (${isSuppressed.reason})` };
  }

  const account = await UserMailAccount.findOne({ userId, active: true }).lean();
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const senderAddress = process.env.PHYSICAL_ADDRESS || '123 Main St, City, State, ZIP';

  let finalHtml = htmlContent;
  let unsubscribeHeader = '';
  if (trackingId) {
    const wrapped = wrapEmailHtml(htmlContent, trackingId, baseUrl, senderAddress);
    finalHtml = wrapped.wrappedHtml;
    unsubscribeHeader = wrapped.listUnsubscribeHeader;
  }

  if (!account) {
    return sendResendEmail(toEmail, subject, finalHtml);
  }

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-secret-key-32-chars-long!';
  
  let accessToken = await decrypt(account.accessToken, encryptionKey);
  
  // Refresh buffer: 5 mins
  if (account.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const accDoc = await UserMailAccount.findById(account._id);
    if (accDoc) {
      if (account.provider === 'gmail') {
        accessToken = await refreshGmailToken(accDoc, encryptionKey);
      } else if (account.provider === 'microsoft') {
        accessToken = await refreshMicrosoftToken(accDoc, encryptionKey);
      }
    }
  }

  if (account.provider === 'gmail') {
    try {
      const res = await sendGmailMessage({
        accessToken,
        fromEmail: account.email,
        toEmail,
        subject,
        htmlContent: finalHtml
      });
      return { success: true, messageId: res.id, threadId: res.threadId, provider: 'gmail' };
    } catch (e: any) {
      if (e.message.includes('401')) {
         const accDoc = await UserMailAccount.findById(account._id);
         if (accDoc) {
           const newAccessToken = await refreshGmailToken(accDoc, encryptionKey);
           const res = await sendGmailMessage({
             accessToken: newAccessToken,
             fromEmail: account.email,
             toEmail,
             subject,
             htmlContent: finalHtml
           });
           return { success: true, messageId: res.id, threadId: res.threadId, provider: 'gmail' };
         }
      }
      return { success: false, provider: 'gmail', error: e.message };
    }
  } else if (account.provider === 'microsoft') {
    try {
      await sendMicrosoftMail({
        accessToken,
        toEmail,
        subject,
        htmlContent: finalHtml
      });
      return { success: true, provider: 'microsoft' };
    } catch (e: any) {
       if (e.message.includes('401')) {
         const accDoc = await UserMailAccount.findById(account._id);
         if (accDoc) {
           const newAccessToken = await refreshMicrosoftToken(accDoc, encryptionKey);
           await sendMicrosoftMail({
             accessToken: newAccessToken,
             toEmail,
             subject,
             htmlContent: finalHtml
           });
           return { success: true, provider: 'microsoft' };
         }
      }
      return { success: false, provider: 'microsoft', error: e.message };
    }
  }
  
  return { success: false, provider: account.provider as any, error: 'Unknown provider' };
}
