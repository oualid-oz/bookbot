import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db, extensionTokens, memberships } from '@bookbot/db';
import { GET as listTokens, POST as createToken } from '@/app/api/extension/tokens/route';
import { DELETE as revokeToken } from '@/app/api/extension/tokens/[id]/route';
import { POST as estimate } from '@/app/api/ext/estimate/route';
import { GET as whoami } from '@/app/api/ext/me/route';
import { getRedis } from '@/server/redis';
import { createUser, json, params, request, resetDatabase, signInAs, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser('Alice');
  bob = await createUser('Bob');
});

afterAll(() => getRedis().disconnect());

async function newToken(user: TestUser, body: Record<string, unknown> = {}) {
  signInAs(user);
  const res = await createToken(request('/api/extension/tokens', { method: 'POST', body }));
  expect(res.status).toBe(201);
  return json<{ token: string; record: { id: string } }>(res);
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const callEstimate = (token: string, body: unknown) =>
  estimate(request('/api/ext/estimate', { method: 'POST', body, headers: bearer(token) }));
const callWhoami = (token: string) => whoami(request('/api/ext/me', { headers: bearer(token) }));

describe('extension tokens', () => {
  it('are shown once and stored only as a hash', async () => {
    const { token, record } = await newToken(alice, { name: 'Laptop' });
    expect(token).toMatch(/^bbx_[\w-]{43}$/);
    const [row] = await db.select().from(extensionTokens).where(eq(extensionTokens.id, record.id));
    expect(row.tokenHash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(token);

    const { tokens } = await json<{ tokens: { name: string }[] }>(await listTokens(request('/api/extension/tokens')));
    expect(tokens.map((t) => t.name)).toContain('Laptop');
    expect(JSON.stringify(tokens)).not.toContain(token);
  });

  it('identify the org and estimate sales', async () => {
    const { token } = await newToken(alice);
    expect(await json(await callWhoami(token))).toEqual({ org: "Alice's workspace", user: alice.email });

    const res = await callEstimate(token, { bsr: 1000, category: 'Books', marketplace: 'US' });
    expect(res.status).toBe(200);
    expect((await json<{ estimatedDailySales: number }>(res)).estimatedDailySales).toBeGreaterThan(0);
    expect(res.headers.get('x-ratelimit-limit')).toBe('100');
  });

  it('validate estimate input', async () => {
    const { token } = await newToken(alice);
    expect((await callEstimate(token, { category: 'Books' })).status).toBe(400);
    expect((await callEstimate(token, { bsr: -5 })).status).toBe(400);
    const unsupported = await callEstimate(token, { bsr: 10, category: 'Toys & Games' });
    expect(unsupported.status).toBe(400);
    expect((await json(unsupported)).error).toMatch(/No sales model/);
  });

  it('stop working when revoked', async () => {
    const { token, record } = await newToken(alice);
    expect((await callWhoami(token)).status).toBe(200);

    signInAs(bob);
    expect((await revokeToken(request('/x', { method: 'DELETE' }), params({ id: record.id }))).status).toBe(404);
    expect((await callWhoami(token)).status).toBe(200);

    signInAs(alice);
    expect((await revokeToken(request('/x', { method: 'DELETE' }), params({ id: record.id }))).status).toBe(204);
    expect((await callWhoami(token)).status).toBe(401);
  });

  it('stop working when expired', async () => {
    const { token, record } = await newToken(alice, { expiresInDays: 30 });
    await db.update(extensionTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(extensionTokens.id, record.id));
    expect((await callWhoami(token)).status).toBe(401);
  });

  it('stop working when the user leaves the org', async () => {
    const { token } = await newToken(alice);
    await db.delete(memberships).where(and(eq(memberships.userId, alice.id), eq(memberships.orgId, alice.orgId)));
    expect((await callWhoami(token)).status).toBe(401);
  });

  it('reject missing, malformed, and unknown tokens', async () => {
    expect((await whoami(request('/api/ext/me'))).status).toBe(401);
    expect((await callWhoami('not-a-token')).status).toBe(401);
    expect((await callWhoami('bbx_' + 'a'.repeat(43))).status).toBe(401);
  });
});
