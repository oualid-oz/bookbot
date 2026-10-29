import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, accounts, memberships, users } from '@bookbot/db';
import { POST as signup } from '@/app/api/signup/route';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getRedis } from '@/server/redis';
import { provisionUser } from '@/server/users';
import { json, request, resetDatabase } from './helpers';
import { testRedisUrl } from './test-env';

beforeAll(async () => {
  await resetDatabase();
  const redis = new Redis(testRedisUrl());
  await redis.flushdb();
  redis.disconnect();
});

afterAll(() => getRedis().disconnect());

let ipCounter = 0;
const signupRequest = (body: unknown, ip = `192.0.2.${++ipCounter}`) =>
  signup(request('/api/signup', { method: 'POST', body, headers: { 'x-real-ip': ip } }));

describe('sign-up', () => {
  it('validates each field', async () => {
    const res = await signupRequest({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    const { fields } = await json<{ fields: Record<string, string[]> }>(res);
    expect(Object.keys(fields).sort()).toEqual(['email', 'name', 'password']);
  });

  it('creates the user, their org, and an owner membership', async () => {
    const res = await signupRequest({ name: 'Ada', email: 'Ada@Example.com', password: 'correct horse battery' });
    expect(res.status).toBe(201);
    const [user] = await db.select().from(users).where(eq(users.email, 'ada@example.com'));
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    const [membership] = await db.select().from(memberships).where(eq(memberships.userId, user.id));
    expect(membership.role).toBe('owner');
  });

  it('refuses a duplicate email in any letter case', async () => {
    const res = await signupRequest({ name: 'Ada 2', email: 'ADA@example.com', password: 'another password' });
    expect(res.status).toBe(409);
  });

  it('limits sign-ups per client IP', async () => {
    const body = { name: '', email: 'x', password: 'x' };
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await signupRequest(body, '198.51.100.7')).status);
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
  });
});

describe('account linking', () => {
  it("drops an unverified password when the email's real owner signs in with Google", async () => {
    await signupRequest({ name: 'Squatter', email: 'victim@example.com', password: 'squatter password' });
    const [before] = await db.select().from(users).where(eq(users.email, 'victim@example.com'));

    const userId = await provisionUser({
      email: 'victim@example.com',
      name: 'Victim',
      provider: 'google',
      providerAccountId: 'google-123',
      type: 'oauth',
      emailVerified: true,
    });

    const [after] = await db.select().from(users).where(eq(users.id, userId));
    expect(userId).toBe(before.id);
    expect(after.passwordHash).toBeNull();
    expect(after.emailVerified).not.toBeNull();
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(1);
    expect(await db.select().from(memberships).where(eq(memberships.userId, userId))).toHaveLength(1);
  });

  it("doesn't drop the password for providers that don't verify email", async () => {
    await signupRequest({ name: 'Dev', email: 'dev@example.com', password: 'dev password 123' });
    await provisionUser({
      email: 'dev@example.com',
      provider: 'dev-login',
      providerAccountId: 'dev@example.com',
      type: 'credentials',
      emailVerified: false,
    });
    const [user] = await db.select().from(users).where(eq(users.email, 'dev@example.com'));
    expect(user.passwordHash).not.toBeNull();
  });
});

describe('passwords', () => {
  it('verifies the right password only', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit within a window', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await checkRateLimit('test:limit', 3, 60_000)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it('is shared through Redis', async () => {
    await checkRateLimit('test:shared', 5, 60_000);
    const redis = new Redis(testRedisUrl());
    const keys = await redis.keys('ratelimit:test:shared:*');
    redis.disconnect();
    expect(keys).toHaveLength(1);
  });

  it("trusts the proxy's IP headers, not the client's", () => {
    const headers = (h: Record<string, string>) => new Headers(h);
    expect(getClientIp(headers({ 'x-real-ip': '203.0.113.1', 'x-forwarded-for': '10.0.0.1' }))).toBe('203.0.113.1');
    // The client controls everything except the entry our proxy appends last
    expect(getClientIp(headers({ 'x-forwarded-for': '10.0.0.1, 203.0.113.2' }))).toBe('203.0.113.2');
    expect(getClientIp(headers({}))).toBe('unknown');
  });
});
