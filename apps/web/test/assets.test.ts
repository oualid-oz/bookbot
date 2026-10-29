import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, assets, projects } from '@bookbot/db';
import { getStorage } from '@bookbot/storage';
import { POST as createAsset } from '@/app/api/assets/route';
import { DELETE as deleteAsset, GET as getAsset } from '@/app/api/assets/[id]/route';
import { PUT as uploadAsset } from '@/app/api/assets/[id]/upload/route';
import { POST as completeAsset } from '@/app/api/assets/[id]/complete/route';
import { GET as assetContent } from '@/app/api/assets/[id]/content/route';
import { GET as getCover, PUT as saveCover } from '@/app/api/projects/[id]/cover/route';
import { createUser, json, params, request, resetDatabase, signInAs, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let storageDir: string;
let png: Uint8Array;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), 'bookbot-test-assets-'));
  process.env.STORAGE_LOCAL_DIR = storageDir;
  await resetDatabase();
  alice = await createUser('Alice');
  bob = await createUser('Bob');
  png = new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 3, background: '#0f766e' } }).png().toBuffer());
});

afterAll(() => rm(storageDir, { recursive: true, force: true }));

async function start(body: Record<string, unknown>) {
  const res = await createAsset(request('/api/assets', { method: 'POST', body }));
  return { res, data: res.status === 201 ? await json<{ asset: { id: string }; upload: { url: string } }>(res) : null };
}

function put(id: string, bytes: Uint8Array, contentType = 'image/png') {
  return uploadAsset(
    new Request(`http://localhost/api/assets/${id}/upload`, { method: 'PUT', body: bytes, headers: { 'content-type': contentType } }) as never,
    params({ id })
  );
}

const complete = (id: string) => completeAsset(request(`/api/assets/${id}/complete`, { method: 'POST' }), params({ id }));

/** Upload `bytes` as an image for the signed-in user and return the response of the final step */
async function uploadImage(bytes: Uint8Array, contentType = 'image/png') {
  const { data } = await start({ name: 'cover.png', contentType, size: bytes.length });
  expect((await put(data!.asset.id, bytes, contentType)).status).toBe(204);
  return { id: data!.asset.id, res: await complete(data!.asset.id) };
}

describe('asset uploads', () => {
  it('reserve, upload, verify, then serve', async () => {
    signInAs(alice);
    const { res, data } = await start({ name: '../../My Cover!.png', contentType: 'image/png', size: png.length });
    expect(res.status).toBe(201);
    const id = data!.asset.id;
    // Local storage can't presign, so the upload goes through our API
    expect(data!.upload.url).toBe(`/api/assets/${id}/upload`);
    const [row] = await db.select().from(assets).where(eq(assets.id, id));
    expect(row.r2Key).toBe(`assets/${alice.orgId}/${id}`);

    expect((await put(id, png)).status).toBe(204);
    const done = await complete(id);
    expect(done.status).toBe(200);
    expect((await json<{ asset: object }>(done)).asset).toMatchObject({ status: 'ready', width: 64, height: 48, mimeType: 'image/png' });

    const content = await assetContent(request('/x'), params({ id }));
    expect(content.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(png);
  });

  it('only accepts PNG and JPEG up to 25 MB', async () => {
    signInAs(alice);
    expect((await start({ name: 'a.gif', contentType: 'image/gif', size: 10 })).res.status).toBe(400);
    expect((await start({ name: 'a.png', contentType: 'image/png', size: 26 * 1024 * 1024 })).res.status).toBe(400);
  });

  it('refuses uploads with the wrong type or more bytes than declared', async () => {
    signInAs(alice);
    const { data } = await start({ name: 'a.png', contentType: 'image/png', size: 10 });
    const id = data!.asset.id;
    expect((await put(id, new Uint8Array(5), 'image/jpeg')).status).toBe(400);
    expect((await put(id, new Uint8Array(11))).status).toBe(413);
  });

  it('rejects files that are not really images, and deletes them', async () => {
    signInAs(alice);
    const text = new TextEncoder().encode('definitely not a png');
    const { id, res } = await uploadImage(text);
    expect(res.status).toBe(400);
    expect(await db.select().from(assets).where(eq(assets.id, id))).toHaveLength(0);
    expect(await getStorage().get(`assets/${alice.orgId}/${id}`)).toBeNull();
  });

  it('detects the real format instead of trusting the declared one', async () => {
    signInAs(alice);
    const jpeg = new Uint8Array(await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).jpeg().toBuffer());
    const { res } = await uploadImage(jpeg, 'image/png');
    expect((await json<{ asset: { mimeType: string } }>(res)).asset.mimeType).toBe('image/jpeg');
  });

  it('needs the upload before completing', async () => {
    signInAs(alice);
    const { data } = await start({ name: 'a.png', contentType: 'image/png', size: 10 });
    expect((await complete(data!.asset.id)).status).toBe(409);
  });

  it('keeps assets inside their org', async () => {
    signInAs(alice);
    const { id } = await uploadImage(png);
    signInAs(bob);
    const ctx = params({ id });
    expect((await getAsset(request('/x'), ctx)).status).toBe(404);
    expect((await assetContent(request('/x'), ctx)).status).toBe(404);
    expect((await put(id, png)).status).toBe(404);
    expect((await deleteAsset(request('/x', { method: 'DELETE' }), ctx)).status).toBe(404);
    signInAs(null);
    expect((await assetContent(request('/x'), ctx)).status).toBe(401);
  });
});

describe('cover images', () => {
  it("can use the org's own ready images, but not another org's", async () => {
    signInAs(alice);
    const [project] = await db.insert(projects).values({ orgId: alice.orgId, type: 'book', trimSize: '6x9', pageCount: 100 }).returning();
    const { id: mine } = await uploadImage(png);
    signInAs(bob);
    const { id: bobs } = await uploadImage(png);

    signInAs(alice);
    const ctx = params({ id: project.id });
    const save = (design: Record<string, unknown>) => saveCover(request('/x', { method: 'PUT', body: design }), ctx);
    expect((await save({ frontImageId: bobs })).status).toBe(400);
    expect((await save({ frontImageId: crypto.randomUUID() })).status).toBe(400);
    expect((await save({ frontImageId: mine, backImageId: mine })).status).toBe(200);

    const cover = await json<{ design: { frontImageId: string }; images: { id: string; width: number }[] }>(await getCover(request('/x'), ctx));
    expect(cover.design.frontImageId).toBe(mine);
    expect(cover.images).toEqual([expect.objectContaining({ id: mine, width: 64 })]);
  });
});
