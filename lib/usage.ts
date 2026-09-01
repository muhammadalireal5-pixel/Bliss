import connectToDatabase from './db';
import { User } from '@/models/User';
import { Types } from 'mongoose';

export const TIER_LIMITS: Record<string, number> = {
  Free: 5,
  Basic: 150,
  Pro: 500
};

export async function checkAndIncrementUsage(userId: string, count: number): Promise<{ allowed: boolean; remaining: number; reserved: number }> {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Invalid count');
  }

  await connectToDatabase();
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // 1. Reset month if needed
  await User.updateOne(
    { _id: userId, lastResetDate: { $lt: startOfMonth } },
    { $set: { leadsUsedThisMonth: 0, lastResetDate: now } }
  );

  // 2. Snapshot to get tier
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const limit = TIER_LIMITS[user.tier] || TIER_LIMITS.Free;

  // 3. Atomic check-and-reserve using aggregation pipeline (requires MongoDB 4.2+)
  // We want to add up to `count` leads, but not exceeding `limit`.
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, leadsUsedThisMonth: { $lt: limit } },
    [
      {
        $set: {
          leadsUsedThisMonth: { $min: [ limit, { $add: ["$leadsUsedThisMonth", count] } ] }
        }
      }
    ],
    { returnDocument: 'before', updatePipeline: true } // return the OLD document to know how many were reserved
  );

  if (!updatedUser) {
    // No match means leadsUsedThisMonth was already >= limit
    return { allowed: false, remaining: 0, reserved: 0 };
  }

  const oldUsed = updatedUser.leadsUsedThisMonth;
  const newUsed = Math.min(limit, oldUsed + count);
  const reserved = newUsed - oldUsed;
  const remaining = limit - newUsed;

  return { 
    allowed: count > 0 ? reserved > 0 : remaining > 0, 
    remaining, 
    reserved 
  };
}

export async function refundUsage(userId: string, count: number): Promise<void> {
  if (!Number.isSafeInteger(count) || count <= 0) return;
  await connectToDatabase();
  await User.updateOne(
    { _id: userId },
    [
      {
        $set: {
          leadsUsedThisMonth: { $max: [0, { $subtract: ["$leadsUsedThisMonth", count] }] }
        }
      }
    ],
    { updatePipeline: true }
  );
}

export async function getUserUsage(userId: string): Promise<{ used: number; limit: number; tier: string; isAdmin: boolean }> {
  await connectToDatabase();
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();
  let used = user.leadsUsedThisMonth || 0;
  
  if (user.lastResetDate && (user.lastResetDate.getMonth() !== now.getMonth() || user.lastResetDate.getFullYear() !== now.getFullYear())) {
    used = 0;
  }

  const limit = TIER_LIMITS[user.tier] || TIER_LIMITS.Free;

  return {
    used,
    limit,
    tier: user.tier || 'Free',
    isAdmin: user.isAdmin || false
  };
}
