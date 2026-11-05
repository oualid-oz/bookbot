import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { getStorage } from '@bookbot/storage';
import { requireAssetAccess } from '@/server/assets';
import { errorResponse } from '@/server/org-access';

/** Editor previews never need more; exports read the full file from storage */
const PREVIEW_SIDE = 2048;

/**
 * Serve an image to members of its org, for editor previews: a screen-sized
 * WebP copy (transparency kept) rather than the print original, which can be
 * 25 MB. Small images are sent as they are.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/assets/[id]/content'>) {
  const result = await requireAssetAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  const asset = result.value;

  if (asset.status !== 'ready') return errorResponse(409, 'Asset is not ready');
  const original = await getStorage().get(asset.r2Key);
  if (!original) return errorResponse(404, 'Asset file is missing');

  const small = Math.max(asset.width ?? 0, asset.height ?? 0) <= PREVIEW_SIDE;
  const [bytes, contentType] =
    small
      ? [original, asset.mimeType ?? 'application/octet-stream']
      : [
          await sharp(original)
            .resize({ width: PREVIEW_SIDE, height: PREVIEW_SIDE, fit: 'inside' })
            .webp({ quality: 85 })
            .toBuffer(),
          'image/webp',
        ];

  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      // An asset's bytes never change; only its org's members can fetch it
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
