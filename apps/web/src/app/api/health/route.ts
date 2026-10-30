import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { getReadyRedis } from '@/server/redis';

const TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);
}

async function check(fn: () => Promise<unknown>): Promise<'ok' | 'error'> {
  try {
    await withTimeout(fn());
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * Liveness and dependency check for load balancers and Docker
 */
export async function GET() {
  const [database, redis] = await Promise.all([
    check(() => db.execute(sql`select 1`)),
    check(async () => (await getReadyRedis(TIMEOUT_MS)).ping()),
  ]);
  const ok = database === 'ok' && redis === 'ok';
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', checks: { database, redis } },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
