import { NextRequest, NextResponse } from 'next/server';
import { coverDesignSchema } from '@bookbot/shared';
import { getReadyAssets, serializeAsset } from '@/server/assets';
import { errorResponse, readJson } from '@/server/org-access';
import { getCoverDesign, requireProjectAccess, saveCoverDesign } from '@/server/projects';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/cover'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const { design, version } = await getCoverDesign(result.value);
  // Image sizes for the editor's layout and DPI checks
  const images = await getReadyAssets(result.value.project.orgId, imageIds(design));
  return NextResponse.json({ design, version, images: images.map(serializeAsset) });
}

function imageIds(design: { frontImageId: string | null; backImageId: string | null }) {
  return [design.frontImageId, design.backImageId].filter((id): id is string => !!id);
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/projects/[id]/cover'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = coverDesignSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid design', { fields: parsed.error.flatten().fieldErrors });
  }

  // Images must be finished uploads from the same organization
  const ids = imageIds(parsed.data);
  const found = await getReadyAssets(result.value.project.orgId, ids);
  if (found.length !== new Set(ids).size) {
    return errorResponse(400, 'Invalid design', { fields: { frontImageId: ['Image not found'] } });
  }

  return NextResponse.json(await saveCoverDesign(result.value.project.id, parsed.data));
}
