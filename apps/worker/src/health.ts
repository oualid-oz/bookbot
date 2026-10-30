import { createServer } from 'node:http';
import { sql } from 'drizzle-orm';
import { db } from '@bookbot/db';
import type { Worker } from 'bullmq';
import type Redis from 'ioredis';

/**
 * Small HTTP health endpoint for Docker/orchestrators: 200 when the queue
 * worker is running and Postgres and Redis respond, 503 otherwise.
 */
export function startHealthServer(port: number, worker: Worker, redis: Redis) {
  const server = createServer(async (req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const checks = {
      worker: worker.isRunning() ? 'ok' : 'error',
      database: await db.execute(sql`select 1`).then(() => 'ok', () => 'error'),
      redis: await redis.ping().then(() => 'ok', () => 'error'),
    };
    const ok = Object.values(checks).every((v) => v === 'ok');
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', checks }));
  });
  server.listen(port, () => console.log(`Health check on :${port}/health`));
  return server;
}
