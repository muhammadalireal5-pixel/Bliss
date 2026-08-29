import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserMailAccount } from '@/models/UserMailAccount';
import connectToDatabase from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.redirect(new URL('/settings?error=Unauthorized', baseUrl));
  }
  const userId = (session.user as any).id;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(new URL(`/settings?error=${errorParam}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=MissingCode', baseUrl));
  }
  if (state !== userId) {
    return NextResponse.redirect(new URL('/settings?error=InvalidState', baseUrl));
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const redirectUri = `${baseUrl}/api/oauth/microsoft/callback`;

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokens = await tokenRes.json();

    let email = '';
    if (tokens.id_token) {
        const parts = tokens.id_token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            email = payload.email || payload.preferred_username || '';
        }
    }

    if (!email) {
      const userInfoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      email = userInfo.mail || userInfo.userPrincipalName;
    }

    if (!email) throw new Error('Could not fetch user email');

    await connectToDatabase();

    await UserMailAccount.updateMany({ userId, active: true }, { active: false, disconnectedAt: new Date() });

    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-secret-key-32-chars-long!';
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received from Microsoft');
    }

    const encryptedAccess = await encrypt(tokens.access_token, encryptionKey);
    const encryptedRefresh = await encrypt(tokens.refresh_token, encryptionKey);

    await UserMailAccount.create({
      userId,
      provider: 'microsoft',
      email: email,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      active: true,
    });

    return NextResponse.redirect(new URL('/settings', baseUrl));
  } catch (error) {
    console.error('Microsoft OAuth Error:', error);
    return NextResponse.redirect(new URL('/settings?error=OAuthFailed', baseUrl));
  }
}
