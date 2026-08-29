import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { UserMailAccount } from '@/models/UserMailAccount';
import { Lead } from '@/models/Lead';
import { decrypt } from '@/lib/crypto';
import { refreshMicrosoftToken } from '@/lib/mailSenders/token-refresh';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await connectToDatabase();
    
    const accounts = await UserMailAccount.find({ active: true, provider: 'microsoft' });
    
    if (accounts.length === 0) return NextResponse.json({ status: 'idle', message: 'No Microsoft accounts' });
    
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-secret-key-32-chars-long!';
    
    for (const account of accounts) {
      let accessToken = await decrypt(account.accessToken, encryptionKey);
      if (account.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
        accessToken = await refreshMicrosoftToken(account, encryptionKey);
      }
      
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${oneHourAgo}&$select=from,subject`;
      
      const res = await fetch(graphUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!res.ok) continue; 
      
      const data = await res.json();
      const messages = data.value || [];
      
      for (const msg of messages) {
        const fromEmail = msg.from?.emailAddress?.address;
        if (fromEmail) {
          const lead = await Lead.findOne({ userId: account.userId, email: fromEmail.toLowerCase(), status: 'sent' });
          if (lead) {
            lead.status = 'replied';
            lead.replies = (lead.replies || 0) + 1;
            await lead.save();
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Check Replies Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
