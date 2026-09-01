import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserMailAccount } from '@/models/UserMailAccount';
import connectToDatabase from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    await connectToDatabase();
    const account = await UserMailAccount.findOne({ userId, active: true }).select('provider email connectedAt').lean();

    return NextResponse.json({ account: account || null });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
