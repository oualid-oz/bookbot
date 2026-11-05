import sharp, { type Metadata } from 'sharp';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, assets, projectDocs, projects } from '@bookbot/db';
import { MAX_IMAGE_BYTES } from '@bookbot/shared';
import { getStorage, storageDriver } from '@bookbot/storage';
import { errorResponse, isUuid, requireOrgAccess } from './org-access';

type Asset = typeof assets.$inferSelect;

/** Largest side we accept; far beyond any KDP cover at 300 DPI */
const MAX_IMAGE_SIDE = 12_000;

export function serializeAsset(asset: Asset) {
  return {
    id: asset.id,
    name: asset.name,
    status: asset.status,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    size: asset.size,
    url: asset.status === 'ready' ? `/api/assets/${asset.id}/content` : null,
    createdAt: asset.createdAt,
  };
}

/**
 * Load an asset the signed-in user can access. Other orgs' assets, and
 * missing ones, both return 404.
 */
export async function requireAssetAccess(assetId: string) {
  if (!isUuid(assetId)) {
    return { ok: false as const, response: errorResponse(400, 'Invalid asset id') };
  }
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  const access = await requireOrgAccess(asset?.orgId);
  if (!access.ok && access.response.status === 401) return access;
  if (!asset || !access.ok) {
    return { ok: false as const, response: errorResponse(404, 'Asset not found') };
  }
  return { ok: true as const, value: asset };
}

export async function createPendingAsset(orgId: string, input: { name: string; contentType: string; size: number }) {
  const id = crypto.randomUUID();
  // The key never contains user input
  const key = `assets/${orgId}/${id}`;
  const [asset] = await db
    .insert(assets)
    .values({ id, orgId, r2Key: key, kind: 'image', status: 'pending', name: input.name, mimeType: input.contentType, size: input.size })
    .returning();

  return { asset, upload: uploadInstructions(key, id, input.contentType) };
}

/**
 * How the browser sends the file: with the Vercel Blob client (which asks
 * /api/assets/blob-upload for a token), or a PUT through our API for local storage
 */
function uploadInstructions(key: string, id: string, contentType: string) {
  if (storageDriver() === 'vercel-blob') {
    return { kind: 'vercel-blob' as const, pathname: key, handleUploadUrl: '/api/assets/blob-upload' };
  }
  return { kind: 'put' as const, url: `/api/assets/${id}/upload`, method: 'PUT', headers: { 'Content-Type': contentType } };
}

/**
 * Check the uploaded bytes are really a PNG or JPEG of sane size, then mark
 * the asset ready. Invalid uploads are deleted.
 */
/** How much of an upload to read when checking it */
const HEADER_BYTES = 256 * 1024;

async function readMetadata(bytes: Uint8Array): Promise<Metadata | null> {
  try {
    const metadata = await sharp(bytes).metadata();
    return metadata.width && metadata.height ? metadata : null;
  } catch {
    return null;
  }
}

export async function completeAsset(asset: Asset): Promise<{ ok: true; asset: Asset } | { ok: false; status: number; error: string }> {
  if (asset.status === 'ready') return { ok: true, asset };

  const storage = getStorage();
  // An image's type and size are in its first bytes: read only those, not the
  // whole file (which could be 25 MB coming back from Vercel Blob)
  const start = await storage.readStart(asset.r2Key, HEADER_BYTES);
  if (!start) return { ok: false, status: 409, error: 'Upload not found; upload the file first' };

  const reject = async (error: string) => {
    await storage.delete(asset.r2Key);
    await db.delete(assets).where(eq(assets.id, asset.id));
    return { ok: false as const, status: 400, error };
  };

  if (start.size > MAX_IMAGE_BYTES) return reject('Images can be at most 25 MB');

  let metadata = await readMetadata(start.bytes);
  if (!metadata && start.size > start.bytes.length) {
    // Rare: the header is further in (e.g. a large embedded color profile)
    const bytes = await storage.get(asset.r2Key);
    metadata = bytes ? await readMetadata(bytes) : null;
  }
  if (!metadata) return reject('File is not a readable image');
  const mimeType = metadata.format === 'png' ? 'image/png' : metadata.format === 'jpeg' ? 'image/jpeg' : null;
  if (!mimeType) return reject('Use a PNG or JPEG image');
  if (!metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) > MAX_IMAGE_SIDE) {
    return reject(`Images can be at most ${MAX_IMAGE_SIDE} pixels on a side`);
  }

  const [ready] = await db
    .update(assets)
    .set({ status: 'ready', mimeType, width: metadata.width, height: metadata.height, size: start.size })
    .where(eq(assets.id, asset.id))
    .returning();
  return { ok: true, asset: ready };
}

/** Image IDs a saved cover design or interior settings document uses */
export function imageIdsInDoc(jsonState: unknown): string[] {
  const doc = (jsonState ?? {}) as { frontImageId?: unknown; backImageId?: unknown; decor?: { imageId?: unknown } };
  return [doc.frontImageId, doc.backImageId, doc.decor?.imageId].filter((id): id is string => typeof id === 'string');
}

/**
 * Delete images (database row and stored file) that no cover design or
 * interior in the organization uses any more. Call after a design stops using
 * them: removed, replaced, or its project deleted. Images still used
 * elsewhere are kept.
 */
export async function deleteUnusedImages(orgId: string, ids: string[]) {
  const candidates = [...new Set(ids)].filter(isUuid);
  if (!candidates.length) return;

  const docs = await db
    .select({ jsonState: projectDocs.jsonState })
    .from(projectDocs)
    .innerJoin(projects, eq(projects.id, projectDocs.projectId))
    .where(
      and(
        eq(projects.orgId, orgId),
        sql`(${projectDocs.jsonState}->>'frontImageId' in ${candidates}
          or ${projectDocs.jsonState}->>'backImageId' in ${candidates}
          or ${projectDocs.jsonState}->'decor'->>'imageId' in ${candidates})`
      )
    );
  const stillUsed = new Set(docs.flatMap((d) => imageIdsInDoc(d.jsonState)));
  const unused = candidates.filter((id) => !stillUsed.has(id));
  if (!unused.length) return;

  const removed = await db
    .delete(assets)
    .where(and(eq(assets.orgId, orgId), inArray(assets.id, unused)))
    .returning({ key: assets.r2Key });
  // Rows are gone first, so a failed file delete leaves no broken reference
  await Promise.allSettled(removed.map((r) => getStorage().delete(r.key)));
}

export async function deleteAsset(asset: Asset) {
  await db.delete(assets).where(eq(assets.id, asset.id));
  await getStorage().delete(asset.r2Key);
}

/** Ready image assets in an org, by ID (others are left out) */
export async function getReadyAssets(orgId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(assets)
    .where(and(eq(assets.orgId, orgId), inArray(assets.id, ids), eq(assets.status, 'ready')));
}

/**
 * Read a request body, refusing more than `maxBytes` without buffering it all
 */
export async function readBodyWithLimit(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}
