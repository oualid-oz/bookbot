import { once } from 'node:events';
import Redis from 'ioredis';

let client: Redis | undefined;
let lastErrorLog = 0;

/**
 * Shared Redis client for quick request-path commands (rate limits).
 * Fails fast: no offline queue and a short command timeout, so a Redis
 * outage degrades features instead of hanging requests.
 */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL!, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: 500,
    });
    client.on('error', (err) => {
      if (Date.now() - lastErrorLog > 60_000) {
        lastErrorLog = Date.now();
        console.error('Redis error:', err.message);
      }
    });
  }
  return client;
}

/**
 * The shared client once it's connected. Without the offline queue, commands
 * sent while the first connection is still being set up would fail, so wait
 * briefly for it; rejects if Redis isn't ready in time.
 */
export async function getReadyRedis(timeoutMs = 500): Promise<Redis> {
  const redis = getRedis();
  if (redis.status !== 'ready') {
    await once(redis, 'ready', { signal: AbortSignal.timeout(timeoutMs) });
  }
  return redis;
}
