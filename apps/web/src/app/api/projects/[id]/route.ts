import { NextRequest, NextResponse } from 'next/server';
import { projectUpdateSchema } from '@bookbot/shared';
import { errorResponse, readJson } from '@/server/org-access';
import { deleteProject, requireProjectAccess, serializeProject, updateProject } from '@/server/projects';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  return NextResponse.json({ project: serializeProject(result.value.project, result.value.listing) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = projectUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  return NextResponse.json({ project: await updateProject(result.value, parsed.data) });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  await deleteProject(result.value.project.id);
  return new NextResponse(null, { status: 204 });
}
