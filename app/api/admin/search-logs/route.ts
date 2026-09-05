import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/models/User';
import connectToDatabase from '@/lib/db';
import { SearchLog } from '@/models/SearchLog';

async function verifyAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).id) {
    return null;
  }
  await connectToDatabase();
  const user = await User.findById((session.user as any).id);
  if (!user || !user.isAdmin) {
    return null;
  }
  return user;
}

export async function GET(req: Request) {
  try {
    const internalAdmin = req.headers.get('x-internal-admin-id');
    let admin: any = null;
    if (internalAdmin && process.env.NODE_ENV !== 'production') {
      await connectToDatabase();
      const user = await User.findById(internalAdmin);
      if (user && user.isAdmin) {
        admin = user;
      }
    } else {
      admin = await verifyAdmin();
    }
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10', 10));

    await connectToDatabase();
    const logs = await SearchLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Failed to fetch search logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
