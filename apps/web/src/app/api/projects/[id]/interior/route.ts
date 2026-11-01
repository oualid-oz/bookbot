import { NextRequest, NextResponse } from 'next/server';
import { interiorSettingsSchema } from '@bookbot/shared';
import { getReadyAssets, serializeAsset } from '@/server/assets';
import { errorResponse, readJson } from '@/server/org-access';
import { getInteriorSettings, requireProjectAccess, saveInteriorSettings } from '@/server/projects';

/** How the interior PDF is laid out */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/interior'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  const settings = await getInteriorSettings(result.value.project.id);
  // Size and URL of the decoration image, for the preview and resolution check
  const images = settings.decor.imageId ? await getReadyAssets(result.value.project.orgId, [settings.decor.imageId]) : [];
  return NextResponse.json({ settings, image: images[0] ? serializeAsset(images[0]) : null });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/projects/[id]/interior'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = interiorSettingsSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid settings', { fields: parsed.error.flatten().fieldErrors });
  }
  // Images must be finished uploads from the same organization
  const { imageId } = parsed.data.decor;
  if (imageId && (await getReadyAssets(result.value.project.orgId, [imageId])).length === 0) {
    return errorResponse(400, 'Invalid settings', { fields: { decor: ['Image not found'] } });
  }
  await saveInteriorSettings(result.value.project.id, parsed.data);
  return NextResponse.json({ settings: parsed.data });
}
