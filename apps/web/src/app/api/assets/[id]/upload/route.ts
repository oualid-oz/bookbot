import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@bookbot/storage';
import { readBodyWithLimit, requireAssetAccess } from '@/server/assets';
import { errorResponse } from '@/server/org-access';

/**
 * Upload target for storage drivers that can't presign (local disk).
 * With R2/S3 the browser uploads straight to the bucket instead.
 */
export async function PUT(req: NextRequest, ctx: RouteContext<'/api/assets/[id]/upload'>) {
  const result = await requireAssetAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  const asset = result.value;

  if (asset.status !== 'pending') {
    return errorResponse(409, 'Asset was already uploaded');
  }
  if (!asset.mimeType || req.headers.get('content-type') !== asset.mimeType) {
    return errorResponse(400, `Content-Type must be ${asset.mimeType}`);
  }

  // Never accept more than was declared when the upload started
  const body = await readBodyWithLimit(req, asset.size ?? 0);
  if (!body) {
    return errorResponse(413, 'File is larger than declared');
  }

  await getStorage().put(asset.r2Key, body, asset.mimeType);
  return new NextResponse(null, { status: 204 });
}
