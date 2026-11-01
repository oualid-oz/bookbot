import { NextRequest, NextResponse } from 'next/server';
import { interiorSettingsSchema } from '@bookbot/shared';
import { errorResponse, readJson } from '@/server/org-access';
import { getInteriorSettings, requireProjectAccess, saveInteriorSettings } from '@/server/projects';

/** How the interior PDF is laid out */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/interior'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  return NextResponse.json({ settings: await getInteriorSettings(result.value.project.id) });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/projects/[id]/interior'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = interiorSettingsSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid settings', { fields: parsed.error.flatten().fieldErrors });
  }
  await saveInteriorSettings(result.value.project.id, parsed.data);
  return NextResponse.json({ settings: parsed.data });
}
