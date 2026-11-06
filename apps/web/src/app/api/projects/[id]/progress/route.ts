import { NextRequest, NextResponse } from 'next/server';
import { getProjectProgress } from '@/server/progress';
import { requireProjectAccess } from '@/server/projects';

/** What's done in each step of the project wizard */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/progress'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  return NextResponse.json(await getProjectProgress(result.value.project.id, result.value.listing));
}
