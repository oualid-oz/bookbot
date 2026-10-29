import { NextRequest } from 'next/server';
import { getStorage } from '@bookbot/storage';
import { requireAssetAccess } from '@/server/assets';
import { errorResponse } from '@/server/org-access';

/**
 * Serve an image to members of its org (editor previews)
 */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/assets/[id]/content'>) {
  const result = await requireAssetAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  const asset = result.value;

  if (asset.status !== 'ready') return errorResponse(409, 'Asset is not ready');
  const bytes = await getStorage().get(asset.r2Key);
  if (!bytes) return errorResponse(404, 'Asset file is missing');

  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': asset.mimeType ?? 'application/octet-stream',
      'Content-Length': String(bytes.length),
      // An asset's bytes never change; only its org's members can fetch it
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
