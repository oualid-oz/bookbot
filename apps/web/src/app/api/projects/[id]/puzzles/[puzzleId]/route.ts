import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, isUuid } from '@/server/org-access';
import { deletePuzzle, requireProjectAccess } from '@/server/projects';

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/puzzles/[puzzleId]'>) {
  const { id, puzzleId } = await ctx.params;
  const result = await requireProjectAccess(id);
  if (!result.ok) return result.response;

  if (!isUuid(puzzleId) || !(await deletePuzzle(result.value.project.id, puzzleId))) {
    return errorResponse(404, 'Puzzle not found');
  }
  return new NextResponse(null, { status: 204 });
}
