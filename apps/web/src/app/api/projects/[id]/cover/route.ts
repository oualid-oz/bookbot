import { NextRequest, NextResponse } from 'next/server';
import { coverDesignSchema } from '@bookbot/shared';
import { errorResponse, readJson } from '@/server/org-access';
import { getCoverDesign, requireProjectAccess, saveCoverDesign } from '@/server/projects';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/cover'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  return NextResponse.json(await getCoverDesign(result.value));
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/projects/[id]/cover'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = coverDesignSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid design', { fields: parsed.error.flatten().fieldErrors });
  }

  return NextResponse.json(await saveCoverDesign(result.value.project.id, parsed.data));
}
