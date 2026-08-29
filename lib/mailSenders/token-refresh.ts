import { UserMailAccount, IUserMailAccount } from '@/models/UserMailAccount';
import { encrypt, decrypt } from '@/lib/crypto';

export async function refreshGmailToken(account: IUserMailAccount, encryptionKey: string): Promise<string> {
  const refreshToken = await decrypt(account.refreshToken, encryptionKey);
  
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const newAccessToken = await encrypt(data.access_token, encryptionKey);
  
  account.accessToken = newAccessToken;
  account.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  await account.save();

  return data.access_token;
}

export async function refreshMicrosoftToken(account: IUserMailAccount, encryptionKey: string): Promise<string> {
  const refreshToken = await decrypt(account.refreshToken, encryptionKey);
  
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const newAccessToken = await encrypt(data.access_token, encryptionKey);
  const newRefreshToken = await encrypt(data.refresh_token, encryptionKey); // MS sometimes rotates RT
  
  account.accessToken = newAccessToken;
  account.refreshToken = newRefreshToken;
  account.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  await account.save();

  return data.access_token;
}
