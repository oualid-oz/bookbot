import { getReadyRedis } from '@/server/redis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Fixed-window rate limit shared by all app instances via Redis. Falls back
 * to a per-process limiter if Redis is unavailable, so an outage doesn't
 * block sign-ins.
 *
 * @param identifier - Unique identifier (e.g., `login:${email}`)
 * @param limit - Max requests per window
 * @param windowMs - Window size in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const resetTime = windowStart + windowMs;
  const key = `ratelimit:${identifier}:${windowStart}`;

  let count: number;
  try {
    const redis = await getReadyRedis();
    const results = await redis.multi().incr(key).pexpireat(key, resetTime).exec();
    const [incrError, value] = results?.[0] ?? [];
    if (incrError || typeof value !== 'number') throw incrError ?? new Error('Unexpected Redis reply');
    count = value;
  } catch {
    count = incrementInMemory(key, resetTime);
  }

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetTime,
  };
}

/**
 * Client IP for rate limiting. X-Forwarded-For is client-controlled except
 * for the entry our own reverse proxy appends, which is the last one; a proxy
 * that sets X-Real-IP is used first. Without a proxy these headers can be
 * forged, so deploy behind one.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get('x-forwarded-for')?.split(',').map((ip) => ip.trim()).filter(Boolean);
  return forwarded?.at(-1) || 'unknown';
}

// ---- In-memory fallback ----

const memoryStore = new Map<string, { count: number; resetTime: number }>();

function incrementInMemory(key: string, resetTime: number): number {
  const now = Date.now();
  // Drop expired windows so the map can't grow without bound
  if (memoryStore.size > 10_000) {
    for (const [k, v] of memoryStore) if (v.resetTime <= now) memoryStore.delete(k);
  }
  const entry = memoryStore.get(key);
  if (entry && entry.resetTime > now) {
    entry.count++;
    return entry.count;
  }
  memoryStore.set(key, { count: 1, resetTime });
  return 1;
}
