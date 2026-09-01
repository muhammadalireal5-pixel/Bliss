import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserMailAccount } from '@/models/UserMailAccount';
import connectToDatabase from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    await connectToDatabase();
    await UserMailAccount.updateMany({ userId, active: true }, { active: false, disconnectedAt: new Date() });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Disconnect API Error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
