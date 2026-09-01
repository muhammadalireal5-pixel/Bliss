import connectToDatabase from './db';
import { User } from '@/models/User';
import { Types } from 'mongoose';

export const TIER_LIMITS: Record<string, number> = {
  Free: 5,
  Basic: 150,
  Pro: 500
};

export function isUsageStale(lastResetDate: Date | undefined | null, now = new Date()): boolean {
  if (!lastResetDate) return true;
  return lastResetDate.getMonth() !== now.getMonth() || lastResetDate.getFullYear() !== now.getFullYear();
}

export async function checkAndIncrementUsage(userId: string, count: number): Promise<{ allowed: boolean; remaining: number; reserved: number }> {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Invalid count');
  }

  await connectToDatabase();
  
  // 1. Snapshot to get tier and check staleness
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();
  
  // 2. Reset month if needed
  if (isUsageStale(user.lastResetDate, now)) {
    await User.updateOne(
      { _id: userId, lastResetDate: user.lastResetDate },
      { $set: { leadsUsedThisMonth: 0, lastResetDate: now } }
    );
  }

  const limit = TIER_LIMITS[user.tier] || TIER_LIMITS.Free;

  // 3. Atomic check-and-reserve using aggregation pipeline (requires MongoDB 4.2+)
  // We want to add up to `count` leads, but not exceeding `limit`.
  const updatedUser = await User.findOneAndUpdate(
    { 
      _id: userId, 
      $or: [
        { leadsUsedThisMonth: { $lt: limit } },
        { leadsUsedThisMonth: { $exists: false } },
        { leadsUsedThisMonth: null }
      ] 
    },
    [
      {
        $set: {
          leadsUsedThisMonth: { 
            $min: [ 
              limit, 
              { $add: [{ $ifNull: ["$leadsUsedThisMonth", 0] }, count] } 
            ] 
          }
        }
      }
    ],
    { returnDocument: 'before', updatePipeline: true } // return the OLD document to know how many were reserved
  );

  if (!updatedUser) {
    // No match means leadsUsedThisMonth was already >= limit
    return { allowed: false, remaining: 0, reserved: 0 };
  }

  const oldUsed = updatedUser.leadsUsedThisMonth || 0;
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
          leadsUsedThisMonth: { $max: [0, { $subtract: [{ $ifNull: ["$leadsUsedThisMonth", 0] }, count] }] }
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
  
  if (isUsageStale(user.lastResetDate, now)) {
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
