import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/models/User';
import connectToDatabase from '@/lib/db';
import { TIER_LIMITS } from '@/lib/usage';

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
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    
    // Calculate total leads generated this month
    const totalLeadsThisMonth = users.reduce((acc, user) => acc + (user.leadsUsedThisMonth || 0), 0);
    
    return NextResponse.json({ 
      users,
      stats: {
        totalUsers: users.length,
        totalLeadsThisMonth
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, tier } = await req.json();
    if (!userId || typeof tier !== 'string' || !Object.hasOwn(TIER_LIMITS, tier)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(userId, { tier }, { new: true }).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
