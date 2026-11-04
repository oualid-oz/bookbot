import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { assets, db } from '@bookbot/db';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

/**
 * Upload tokens for the Vercel Blob browser client. A token is only issued for
 * an image the signed-in user just started uploading (POST /api/assets), with
 * exactly the type and size they declared; the client then sends the file
 * straight to Blob, skipping Vercel's 4.5 MB request limit.
 */
export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as HandleUploadBody | null;
  if (!body) return errorResponse(400, 'Invalid input');

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const access = await requireOrgAccess();
        if (!access.ok) throw new Error('Unauthorized');
        const [asset] = await db
          .select({ mimeType: assets.mimeType, size: assets.size })
          .from(assets)
          .where(and(eq(assets.r2Key, pathname), eq(assets.orgId, access.value.orgId), eq(assets.status, 'pending')));
        if (!asset?.mimeType || !asset.size) throw new Error('Upload not found');
        return {
          allowedContentTypes: [asset.mimeType],
          maximumSizeInBytes: asset.size,
          addRandomSuffix: false,
          allowOverwrite: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload not allowed';
    return errorResponse(message === 'Unauthorized' ? 401 : 400, message);
  }
}
