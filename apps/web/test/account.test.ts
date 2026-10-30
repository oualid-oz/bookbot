import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, users, verificationTokens } from '@bookbot/db';
import { POST as signup } from '@/app/api/signup/route';
import { POST as verifyEmail } from '@/app/api/account/verify-email/route';
import { POST as resendVerification } from '@/app/api/account/verify-email/resend/route';
import { POST as requestReset } from '@/app/api/account/password-reset/route';
import { POST as confirmReset } from '@/app/api/account/password-reset/confirm/route';
import { GET as account } from '@/app/api/account/route';
import { verifyPassword } from '@/lib/password';
import { authOptions } from '@/server/auth';
import { sentEmails } from '@/server/email';
import { getRedis } from '@/server/redis';
import { json, request, resetDatabase, signInAs } from './helpers';
import { testRedisUrl } from './test-env';

beforeAll(async () => {
  await resetDatabase();
  const redis = new Redis(testRedisUrl());
  await redis.flushdb();
  redis.disconnect();
});

beforeEach(() => {
  sentEmails.length = 0;
});

afterAll(() => getRedis().disconnect());

let ip = 0;
async function createAccount(email: string) {
  const res = await signup(
    request('/api/signup', { method: 'POST', body: { name: 'Reader', email, password: 'original password' }, headers: { 'x-real-ip': `192.0.2.${++ip}` } })
  );
  expect(res.status).toBe(201);
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

/** The token from the link in the most recent email to `to` */
function linkToken(to: string, path: string) {
  const email = sentEmails.filter((e) => e.to === to).at(-1);
  expect(email, `no email sent to ${to}`).toBeDefined();
  const match = email!.text.match(new RegExp(`http://localhost:3000${path}\\?token=([\\w-]+)`));
  expect(match, 'email has no link').not.toBeNull();
  return match![1];
}

const verify = (token: string) => verifyEmail(request('/x', { method: 'POST', body: { token } }));
const reset = (email: string, ipAddress = '198.51.100.1') =>
  requestReset(request('/x', { method: 'POST', body: { email }, headers: { 'x-real-ip': ipAddress } }));
const confirm = (token: string, password: string) => confirmReset(request('/x', { method: 'POST', body: { token, password } }));

describe('email verification', () => {
  it('sends a link at sign-up that verifies the email once', async () => {
    const user = await createAccount('verify-me@example.com');
    expect(user.emailVerified).toBeNull();
    const token = linkToken('verify-me@example.com', '/verify-email');

    expect((await verify(token)).status).toBe(200);
    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after.emailVerified).not.toBeNull();

    expect((await verify(token)).status).toBe(400);
    expect((await verify('made-up-token')).status).toBe(400);
  });

  it('stores only token hashes', async () => {
    await createAccount('hash-check@example.com');
    const token = linkToken('hash-check@example.com', '/verify-email');
    const rows = await db.select().from(verificationTokens);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('lets signed-in users resend the link, and replaces the old one', async () => {
    const user = await createAccount('resend@example.com');
    const first = linkToken('resend@example.com', '/verify-email');
    signInAs({ id: user.id, email: user.email, name: 'Reader', orgId: '' });

    expect((await json(await account())).emailVerified).toBe(false);
    expect((await resendVerification()).status).toBe(200);
    const second = linkToken('resend@example.com', '/verify-email');
    expect(second).not.toBe(first);
    expect((await verify(first)).status).toBe(400);
    expect((await verify(second)).status).toBe(200);

    expect(await json(await resendVerification())).toEqual({ alreadyVerified: true });
    expect((await json(await account())).emailVerified).toBe(true);
  });
});

describe('password reset', () => {
  it('answers the same for unknown emails, without sending anything', async () => {
    const res = await reset('nobody@example.com');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ sent: true });
    expect(sentEmails).toHaveLength(0);
  });

  it('sets a new password and verifies the email', async () => {
    const user = await createAccount('forgetful@example.com');
    expect((await reset('Forgetful@Example.com')).status).toBe(200);
    const token = linkToken('forgetful@example.com', '/reset-password');

    expect((await confirm(token, 'short')).status).toBe(400);
    expect((await confirm(token, 'brand new password')).status).toBe(200);

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword('brand new password', after.passwordHash!)).toBe(true);
    expect(await verifyPassword('original password', after.passwordHash!)).toBe(false);
    expect(after.emailVerified).not.toBeNull();

    expect((await confirm(token, 'another new password')).status).toBe(400);
  });

  it('rejects expired links', async () => {
    await createAccount('slow@example.com');
    await reset('slow@example.com');
    const token = linkToken('slow@example.com', '/reset-password');
    await db.update(verificationTokens).set({ expires: new Date(Date.now() - 1000) }).where(eq(verificationTokens.identifier, 'reset:slow@example.com'));
    expect((await confirm(token, 'brand new password')).status).toBe(400);
  });

  it("doesn't accept a verification link as a reset link", async () => {
    await createAccount('mixup@example.com');
    const verifyToken = linkToken('mixup@example.com', '/verify-email');
    expect((await confirm(verifyToken, 'brand new password')).status).toBe(400);
  });

  it('limits reset emails per address without changing the answer', async () => {
    await createAccount('spammed@example.com');
    sentEmails.length = 0;
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await reset('spammed@example.com', `198.51.100.${50 + i}`)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect(sentEmails).toHaveLength(3);
  });
});

describe('sessions after a password reset', () => {
  // The callback NextAuth runs on every session check
  const checkSession = (token: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    authOptions.callbacks!.jwt!({ token, ...extra } as never);

  it('signs out sessions created before the reset', async () => {
    const user = await createAccount('signed-in-elsewhere@example.com');
    const oldSession = { id: user.id, sv: 0 };
    await expect(checkSession(oldSession)).resolves.toMatchObject({ id: user.id });

    await reset('signed-in-elsewhere@example.com');
    await confirm(linkToken('signed-in-elsewhere@example.com', '/reset-password'), 'brand new password');

    await expect(checkSession(oldSession)).rejects.toThrow('Session revoked');

    // Signing in again issues a session for the new version
    const fresh = await checkSession({}, { user: { id: user.id }, account: { provider: 'password' } });
    expect(fresh.sv).toBe(1);
    await expect(checkSession(fresh)).resolves.toMatchObject({ id: user.id, sv: 1 });
  });

  it('keeps sessions from before session versions existed', async () => {
    const user = await createAccount('legacy-session@example.com');
    await expect(checkSession({ id: user.id })).resolves.toMatchObject({ id: user.id });
  });

  it('rejects sessions of deleted users', async () => {
    const user = await createAccount('deleted@example.com');
    await db.delete(users).where(eq(users.id, user.id));
    await expect(checkSession({ id: user.id, sv: 0 })).rejects.toThrow('Session revoked');
  });
});
