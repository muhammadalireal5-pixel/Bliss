import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserUsage } from '@/lib/usage';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const usage = await getUserUsage(userId);
    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('Usage API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
