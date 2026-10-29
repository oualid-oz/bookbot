import { beforeAll, describe, expect, it } from 'vitest';
import { POST as keywordLookup } from '@/app/api/research/keyword/route';
import { GET as getNiche, POST as analyzeNiche } from '@/app/api/research/niche/route';
import { GET as listOrgs } from '@/app/api/orgs/route';
import { createUser, json, request, resetDatabase, signInAs, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser('Alice');
  bob = await createUser('Bob');
});

const lookup = (body: unknown) => keywordLookup(request('/api/research/keyword', { method: 'POST', body }));

describe('org access', () => {
  it('rejects signed-out requests', async () => {
    signInAs(null);
    expect((await lookup({ keyword: 'journals' })).status).toBe(401);
    expect((await listOrgs()).status).toBe(401);
  });

  it("uses the user's own org when no orgId is sent", async () => {
    signInAs(alice);
    const res = await lookup({ keyword: 'journals' });
    expect(res.status).toBe(200);
    expect((await json(res)).cached).toBe(false);
  });

  it("hides other orgs: 404, not 403", async () => {
    signInAs(alice);
    const res = await lookup({ keyword: 'journals', orgId: bob.orgId });
    expect(res.status).toBe(404);
  });

  it('rejects malformed input with 400 instead of a server error', async () => {
    signInAs(alice);
    expect((await lookup({ keyword: 'x', orgId: 'demo-org-id' })).status).toBe(400);
    expect((await lookup({ keyword: 'x', marketplace: 'XX' })).status).toBe(400);
    expect((await keywordLookup(request('/api/research/keyword', { method: 'POST', body: 'not json' }))).status).toBe(400);
  });

  it('keeps niche snapshots per org', async () => {
    signInAs(alice);
    const body = { keyword: 'mazes', topResults: [{ bsr: 5000, price: 9.99, reviews: 100, sales: 40 }] };
    expect((await analyzeNiche(request('/api/research/niche', { method: 'POST', body }))).status).toBe(200);
    expect((await getNiche(request('/api/research/niche?keyword=mazes'))).status).toBe(200);

    signInAs(bob);
    expect((await getNiche(request(`/api/research/niche?keyword=mazes&orgId=${alice.orgId}`))).status).toBe(404);
    expect((await getNiche(request('/api/research/niche?keyword=mazes'))).status).toBe(404);
  });

  it('returns the newest niche snapshot', async () => {
    signInAs(alice);
    const analyze = (price: number) =>
      analyzeNiche(request('/api/research/niche', { method: 'POST', body: { keyword: 'sudoku', topResults: [{ price }] } }));
    await analyze(5);
    await new Promise((r) => setTimeout(r, 10));
    await analyze(25);
    const snapshot = await json<{ topResults: { price: number }[] }>(await getNiche(request('/api/research/niche?keyword=sudoku')));
    expect(snapshot.topResults[0].price).toBe(25);
  });

  it('lists only orgs the user belongs to', async () => {
    signInAs(bob);
    const { orgs } = await json<{ orgs: { id: string }[] }>(await listOrgs());
    expect(orgs.map((o) => o.id)).toEqual([bob.orgId]);
  });
});
