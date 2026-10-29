import { NextRequest, NextResponse } from 'next/server';
import { puzzleCreateSchema } from '@bookbot/shared';
import { normalizeWords } from '@bookbot/puzzles';
import { errorResponse, readJson } from '@/server/org-access';
import { addWordSearch, listPuzzles, requireProjectAccess } from '@/server/projects';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/puzzles'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  return NextResponse.json({ puzzles: await listPuzzles(result.value.project.id) });
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/projects/[id]/puzzles'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = puzzleCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  if (normalizeWords(parsed.data.words).length === 0) {
    return errorResponse(400, 'Invalid input', { fields: { words: ['Words must contain letters A-Z'] } });
  }

  return NextResponse.json({ puzzle: await addWordSearch(result.value.project.id, parsed.data) }, { status: 201 });
}
