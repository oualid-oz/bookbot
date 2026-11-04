import { NextRequest, NextResponse } from 'next/server';
import { assetUploadSchema } from '@bookbot/shared';
import { createPendingAsset, serializeAsset } from '@/server/assets';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

/**
 * Start an image upload: returns how to send the file, then call
 * POST /api/assets/:id/complete
 */
export async function POST(req: NextRequest) {
  const parsed = assetUploadSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;

  const { asset, upload } = await createPendingAsset(access.value.orgId, parsed.data);
  return NextResponse.json({ asset: serializeAsset(asset), upload }, { status: 201 });
}
