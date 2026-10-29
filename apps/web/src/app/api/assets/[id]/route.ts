import { NextRequest, NextResponse } from 'next/server';
import { deleteAsset, requireAssetAccess, serializeAsset } from '@/server/assets';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/assets/[id]'>) {
  const result = await requireAssetAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  return NextResponse.json({ asset: serializeAsset(result.value) });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/assets/[id]'>) {
  const result = await requireAssetAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  await deleteAsset(result.value);
  return new NextResponse(null, { status: 204 });
}
