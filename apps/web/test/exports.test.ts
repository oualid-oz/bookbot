import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db, entitlementsUsage, exports, projects } from '@bookbot/db';
import { getStorage } from '@bookbot/storage';
import { GET as getExport, POST as createExport } from '@/app/api/export/route';
import { GET as download } from '@/app/api/export/[id]/download/route';
import { POST as keywordLookup } from '@/app/api/research/keyword/route';
import { addExportJob } from '@/server/queue';
import { createUser, json, params, queuedExports, request, resetDatabase, signInAs, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let projectId: string;
let storageDir: string;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), 'bookbot-test-storage-'));
  process.env.STORAGE_LOCAL_DIR = storageDir;
  await resetDatabase();
  alice = await createUser('Alice');
  bob = await createUser('Bob');
  const [project] = await db
    .insert(projects)
    .values({ orgId: alice.orgId, type: 'book', trimSize: '6x9', pageCount: 100 })
    .returning();
  projectId = project.id;
});

afterAll(() => rm(storageDir, { recursive: true, force: true }));

beforeEach(async () => {
  vi.mocked(addExportJob).mockReset();
  await db.delete(exports);
  await db.delete(entitlementsUsage);
});

const startExport = (body: unknown) => createExport(request('/api/export', { method: 'POST', body }));

async function usage(metric: string, orgId = alice.orgId) {
  const [row] = await db
    .select({ count: entitlementsUsage.count })
    .from(entitlementsUsage)
    .where(and(eq(entitlementsUsage.orgId, orgId), eq(entitlementsUsage.metric, metric)));
  return row?.count ?? 0;
}

describe('export limits', () => {
  it('never lets concurrent requests exceed the plan limit', async () => {
    signInAs(alice);
    const results = await Promise.all(Array.from({ length: 12 }, () => startExport({ projectId })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(7);
    expect(await usage('exportsPerMonth')).toBe(5);
    expect(queuedExports()).toHaveLength(5);
  });

  it('gives the export back when it cannot be queued', async () => {
    signInAs(alice);
    vi.mocked(addExportJob).mockRejectedValueOnce(new Error('Redis down'));
    const res = await startExport({ projectId });
    expect(res.status).toBe(503);
    expect(await usage('exportsPerMonth')).toBe(0);
    const [row] = await db.select().from(exports);
    expect(row).toMatchObject({ status: 'failed', errorMessage: 'Could not queue export' });
  });

  it("can't export another org's project, even naming that org", async () => {
    signInAs(bob);
    expect((await startExport({ projectId })).status).toBe(404);
    expect((await startExport({ projectId, orgId: alice.orgId })).status).toBe(404);
    expect(queuedExports()).toHaveLength(0);
  });
});

describe('export status and download', () => {
  it('is only visible inside the org', async () => {
    signInAs(alice);
    const { exportId } = await json<{ exportId: string }>(await startExport({ projectId }));
    const status = request(`/api/export?exportId=${exportId}`);

    expect((await json(await getExport(status))).downloadUrl).toBeNull();
    signInAs(bob);
    expect((await getExport(request(`/api/export?exportId=${exportId}`))).status).toBe(404);
    signInAs(null);
    expect((await getExport(request(`/api/export?exportId=${exportId}`))).status).toBe(401);
  });

  it('downloads completed exports for org members only', async () => {
    signInAs(alice);
    const { exportId } = await json<{ exportId: string }>(await startExport({ projectId }));
    const ctx = params({ id: exportId });
    expect((await download(request('/x'), ctx)).status).toBe(409);

    const key = `exports/${alice.orgId}/${exportId}.pdf`;
    await getStorage().put(key, new TextEncoder().encode('%PDF-test'), 'application/pdf');
    await db.update(exports).set({ status: 'completed', r2Key: key }).where(eq(exports.id, exportId));

    const res = await download(request('/x'), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(await res.text()).toBe('%PDF-test');

    signInAs(bob);
    expect((await download(request('/x'), ctx)).status).toBe(404);
  });
});

describe('keyword lookup limits', () => {
  it('caps concurrent lookups at the daily limit, but cached results stay free', async () => {
    signInAs(alice);
    const lookup = (keyword: string) => keywordLookup(request('/x', { method: 'POST', body: { keyword } }));
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => lookup(`keyword ${i}`)));
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(20);
    expect(await usage('keywordLookupsPerDay')).toBe(20);

    const cached = results.findIndex((r) => r.status === 200);
    const again = await lookup(`keyword ${cached}`);
    expect(again.status).toBe(200);
    expect((await json(again)).cached).toBe(true);

    const blocked = await lookup('brand new keyword');
    expect(blocked.status).toBe(429);
    expect(await json(blocked)).toMatchObject({ limit: 20, used: 20 });
  });
});
