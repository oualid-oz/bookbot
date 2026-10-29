import { NextRequest, NextResponse } from 'next/server';
import { completeAsset, requireAssetAccess, serializeAsset } from '@/server/assets';
import { errorResponse } from '@/server/org-access';

/**
 * Verify the uploaded file and make the asset usable
 */
export async function POST(_req: NextRequest, ctx: RouteContext<'/api/assets/[id]/complete'>) {
  const result = await requireAssetAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const completed = await completeAsset(result.value);
  if (!completed.ok) return errorResponse(completed.status, completed.error);
  return NextResponse.json({ asset: serializeAsset(completed.asset) });
}
