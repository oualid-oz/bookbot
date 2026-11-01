import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { assets, db, exports, extensionTokens, memberships, organizations, projects, subscriptions, users } from '@bookbot/db';
import { getStorage } from '@bookbot/storage';
import { encode, decode, type JWT } from 'next-auth/jwt';
import { DELETE as deleteAccount, GET as getAccount, PATCH as updateAccount } from '@/app/api/account/route';
import { POST as changePassword } from '@/app/api/account/password/route';
import { DELETE as signOutOthers } from '@/app/api/account/sessions/route';
import { DELETE as deleteProject } from '@/app/api/projects/[id]/route';
import { PATCH as updateOrg } from '@/app/api/orgs/[id]/route';
import { hashPassword, verifyPassword } from '@/lib/password';
import { authOptions } from '@/server/auth';
import { sentEmails } from '@/server/email';
import { getRedis } from '@/server/redis';
import { createUser, json, params, request, resetDatabase, signInAs, type TestUser } from './helpers';
import { testRedisUrl } from './test-env';

const SECRET = 'test-secret-for-session-cookies-0123456789';
const COOKIE = 'next-auth.session-token';
let storageDir: string;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), 'bookbot-test-account-'));
  process.env.STORAGE_LOCAL_DIR = storageDir;
  process.env.NEXTAUTH_SECRET = SECRET;
  await resetDatabase();
  const redis = new Redis(testRedisUrl());
  await redis.flushdb();
  redis.disconnect();
});

afterAll(async () => {
  delete process.env.NEXTAUTH_SECRET;
  getRedis().disconnect();
  await rm(storageDir, { recursive: true, force: true });
});

beforeEach(() => {
  sentEmails.length = 0;
});

/** A test user whose password is `password` */
async function userWithPassword(password = 'old password 1') {
  const user = await createUser('Reader');
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  signInAs(user);
  return user;
}

/** A test user who signs in with Google only (no password, verified email) */
async function googleUser() {
  const user = await createUser('Googler');
  await db.update(users).set({ passwordHash: null, emailVerified: new Date() }).where(eq(users.id, user.id));
  signInAs(user);
  return user;
}

async function sessionCookie(user: TestUser, sv = 0) {
  return `${COOKIE}=${await encode({ token: { id: user.id, name: user.name, email: user.email, sv }, secret: SECRET })}`;
}

/** The session the response's Set-Cookie would give the browser */
async function reissuedToken(res: Response): Promise<JWT | null> {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  return decode({ token: cookie.slice(COOKIE.length + 1).split(';')[0], secret: SECRET });
}

/** Run the real NextAuth check that every request goes through */
const checkSession = (token: JWT) =>
  authOptions.callbacks!.jwt!({ token, user: undefined as never, account: null, trigger: undefined });

const sessionVersion = async (userId: string) =>
  (await db.select({ sv: users.sessionVersion }).from(users).where(eq(users.id, userId)))[0].sv;

describe('profile', () => {
  it('returns the account and updates the name in the database and the session', async () => {
    const user = await userWithPassword();
    const res = await updateAccount(
      request('/api/account', { method: 'PATCH', body: { name: '  New Name ' }, headers: { cookie: await sessionCookie(user) } })
    );
    expect(res.status).toBe(200);
    expect((await reissuedToken(res))?.name).toBe('New Name');

    const account = await json(await getAccount());
    expect(account).toMatchObject({ name: 'New Name', email: user.email, hasPassword: true });
  });

  it('rejects an empty name and signed-out requests', async () => {
    await userWithPassword();
    expect((await updateAccount(request('/x', { method: 'PATCH', body: { name: ' ' } }))).status).toBe(400);
    signInAs(null);
    expect((await updateAccount(request('/x', { method: 'PATCH', body: { name: 'X' } }))).status).toBe(401);
  });

  it("does not rewrite another user's session cookie", async () => {
    const other = await createUser('Other');
    await userWithPassword();
    const res = await updateAccount(
      request('/x', { method: 'PATCH', body: { name: 'Mine' }, headers: { cookie: await sessionCookie(other) } })
    );
    expect(res.status).toBe(200);
    expect(await reissuedToken(res)).toBeNull();
  });
});

describe('password change', () => {
  const change = async (user: TestUser, body: unknown) =>
    changePassword(request('/x', { method: 'POST', body, headers: { cookie: await sessionCookie(user) } }));

  it('requires the current password', async () => {
    const user = await userWithPassword();
    const missing = await change(user, { newPassword: 'brand new password' });
    expect(missing.status).toBe(400);
    const wrong = await change(user, { currentPassword: 'nope', newPassword: 'brand new password' });
    expect(wrong.status).toBe(400);
    expect((await json<{ fields: Record<string, string[]> }>(wrong)).fields.currentPassword).toBeDefined();
    expect(await sessionVersion(user.id)).toBe(0);
  });

  it('changes it, signs out other sessions, keeps this one and sends a notice', async () => {
    const user = await userWithPassword('old password 1');
    const res = await change(user, { currentPassword: 'old password 1', newPassword: 'brand new password' });
    expect(res.status).toBe(200);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword('brand new password', row.passwordHash!)).toBe(true);
    expect(row.sessionVersion).toBe(1);

    // Another device's session is rejected; this browser's new cookie works
    await expect(checkSession({ id: user.id, sv: 0 })).rejects.toThrow('Session revoked');
    const mine = await reissuedToken(res);
    expect(mine?.sv).toBe(1);
    await expect(checkSession(mine!)).resolves.toMatchObject({ id: user.id });

    expect(sentEmails.map((e) => [e.to, e.subject])).toEqual([[user.email, 'Your Bookbot password was changed']]);
  });

  it('enforces the password rules', async () => {
    const user = await userWithPassword('old password 1');
    const res = await change(user, { currentPassword: 'old password 1', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect((await json<{ fields: Record<string, string[]> }>(res)).fields.newPassword).toBeDefined();
  });

  it('lets a Google user set a first password without a current one', async () => {
    const user = await googleUser();
    const res = await change(user, { newPassword: 'first password here' });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword('first password here', row.passwordHash!)).toBe(true);
  });

  it('refuses to set a password on an unverified account without one', async () => {
    const user = await createUser('Unverified');
    await db.update(users).set({ passwordHash: null }).where(eq(users.id, user.id));
    signInAs(user);
    expect((await change(user, { newPassword: 'first password here' })).status).toBe(403);
  });
});

describe('sign out other devices', () => {
  it('revokes other sessions and reissues this one', async () => {
    const user = await userWithPassword();
    const res = await signOutOthers(request('/x', { method: 'DELETE', headers: { cookie: await sessionCookie(user) } }));
    expect(res.status).toBe(200);
    expect(await sessionVersion(user.id)).toBe(1);
    await expect(checkSession({ id: user.id, sv: 0 })).rejects.toThrow('Session revoked');
    await expect(checkSession((await reissuedToken(res))!)).resolves.toMatchObject({ id: user.id });
  });
});

describe('workspace rename', () => {
  const rename = (orgId: string, name: unknown) =>
    updateOrg(request('/x', { method: 'PATCH', body: { name } }), params({ id: orgId }));

  it('lets the owner rename their workspace', async () => {
    const user = await userWithPassword();
    const res = await rename(user.orgId, 'Moonlight Press');
    expect(res.status).toBe(200);
    expect((await json<{ org: { name: string } }>(res)).org.name).toBe('Moonlight Press');
  });

  it('refuses members and hides other workspaces', async () => {
    const owner = await createUser('Owner');
    const member = await userWithPassword();
    await db.insert(memberships).values({ userId: member.id, orgId: owner.orgId, role: 'member' });
    expect((await rename(owner.orgId, 'Taken over')).status).toBe(403);

    const stranger = await createUser('Stranger');
    expect((await rename(stranger.orgId, 'Taken over')).status).toBe(404);
    expect((await rename(member.orgId, '')).status).toBe(400);
  });
});

describe('account deletion', () => {
  const remove = (body: unknown) => deleteAccount(request('/x', { method: 'DELETE', body }));

  /** A project with a stored export and an image asset in the user's workspace */
  async function addFiles(user: TestUser) {
    const storage = getStorage();
    const [project] = await db
      .insert(projects)
      .values({ orgId: user.orgId, title: 'Book', type: 'journal', trimSize: '6x9', pageCount: 24 })
      .returning();
    const exportKey = `exports/${project.id}/test.pdf`;
    const assetKey = `assets/${user.orgId}/test.png`;
    await storage.put(exportKey, new Uint8Array([1]), 'application/pdf');
    await storage.put(assetKey, new Uint8Array([2]), 'image/png');
    await db.insert(exports).values({ projectId: project.id, status: 'completed', r2Key: exportKey, spec: {} });
    await db.insert(assets).values({ orgId: user.orgId, r2Key: assetKey, kind: 'image', status: 'ready' });
    return { project, exportKey, assetKey };
  }

  const stored = async (key: string) => (await getStorage().get(key)) !== null;

  it('requires the password', async () => {
    const user = await userWithPassword('my password 1');
    expect((await remove({})).status).toBe(400);
    expect((await remove({ password: 'wrong' })).status).toBe(400);
    expect(await db.query.users.findFirst({ where: eq(users.id, user.id) })).toBeDefined();
  });

  it('deletes the user, their workspace, its data and stored files', async () => {
    const user = await userWithPassword('my password 1');
    const { exportKey, assetKey } = await addFiles(user);
    await db.insert(extensionTokens).values({ orgId: user.orgId, userId: user.id, name: 'ext', tokenHash: `hash-${user.id}` });

    const res = await remove({ password: 'my password 1' });
    expect(res.status).toBe(200);

    expect(await db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await db.select().from(organizations).where(eq(organizations.id, user.orgId))).toEqual([]);
    expect(await db.select().from(projects).where(eq(projects.orgId, user.orgId))).toEqual([]);
    expect(await db.select().from(extensionTokens).where(eq(extensionTokens.userId, user.id))).toEqual([]);
    expect(await stored(exportKey)).toBe(false);
    expect(await stored(assetKey)).toBe(false);

    // Any session left over is rejected
    await expect(checkSession({ id: user.id, sv: 0 })).rejects.toThrow('Session revoked');
  });

  it('keeps workspaces that have other members', async () => {
    const owner = await createUser('Owner');
    const user = await userWithPassword('my password 1');
    await db.insert(memberships).values({ userId: user.id, orgId: owner.orgId, role: 'member' });

    expect((await remove({ password: 'my password 1' })).status).toBe(200);
    expect(await db.select().from(organizations).where(eq(organizations.id, owner.orgId))).toHaveLength(1);
    expect(await db.select().from(organizations).where(eq(organizations.id, user.orgId))).toEqual([]);
  });

  it('is refused while a subscription will renew, and allowed once it is canceled', async () => {
    const user = await userWithPassword('my password 1');
    const [sub] = await db
      .insert(subscriptions)
      .values({ orgId: user.orgId, stripeSubscriptionId: `sub_${user.id}`, status: 'active' })
      .returning();

    const refused = await remove({ password: 'my password 1' });
    expect(refused.status).toBe(409);
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);

    await db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.id, sub.id));
    expect((await remove({ password: 'my password 1' })).status).toBe(200);
  });

  it('asks Google users to type their email instead', async () => {
    const user = await googleUser();
    expect((await remove({ email: 'someone@else.com' })).status).toBe(400);
    expect((await remove({ email: user.email.toUpperCase() })).status).toBe(200);
  });
});

describe('project deletion', () => {
  it('deletes the stored export files too', async () => {
    const user = await userWithPassword();
    const storage = getStorage();
    const [project] = await db
      .insert(projects)
      .values({ orgId: user.orgId, title: 'Book', type: 'journal', trimSize: '6x9', pageCount: 24 })
      .returning();
    const key = `exports/${project.id}/x.pdf`;
    await storage.put(key, new Uint8Array([1]), 'application/pdf');
    await db.insert(exports).values({ projectId: project.id, status: 'completed', r2Key: key, spec: {} });

    expect((await deleteProject(request('/x', { method: 'DELETE' }), params({ id: project.id }))).status).toBe(204);
    expect(await storage.get(key)).toBeNull();
  });
});
