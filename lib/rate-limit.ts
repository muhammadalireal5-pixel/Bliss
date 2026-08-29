import { redis } from './redis'

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // Unix timestamp
}

export async function checkRateLimit(
  identifier: string,   // e.g. "search:user_abc123"
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  // Atomic pipeline: remove expired entries, add current, count total
  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, 0, windowStart)
  pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` })
  pipeline.zcard(key)
  pipeline.expire(key, config.windowSeconds)

  const results = await pipeline.exec()
  const requestCount = results[2] as number

  return {
    allowed: requestCount <= config.limit,
    remaining: Math.max(0, config.limit - requestCount),
    resetAt: Math.ceil((now + config.windowSeconds * 1000) / 1000),
  }
}
