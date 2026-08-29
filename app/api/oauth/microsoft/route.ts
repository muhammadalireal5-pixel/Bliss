import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/oauth/microsoft/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'Microsoft OAuth not configured' }, { status: 500 });
  }

  const state = (session.user as any).id;
  
  const scopes = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'User.Read',
    'Mail.Send',
    'Mail.Read',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes.join(' '),
    state: state,
    prompt: 'select_account',
  });

  return NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
}
