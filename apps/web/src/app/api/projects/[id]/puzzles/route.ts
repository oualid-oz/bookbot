import { NextRequest, NextResponse } from 'next/server';
import { puzzleCreateSchema } from '@bookbot/shared';
import { normalizeWords, WORD_THEMES } from '@bookbot/puzzles';
import { errorResponse, readJson } from '@/server/org-access';
import { addPuzzles, countPuzzles, listPuzzles, MAX_PUZZLES_PER_PROJECT, requireProjectAccess } from '@/server/projects';

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
  const input = parsed.data;
  if (input.type === 'word_search' && normalizeWords(input.words).length === 0) {
    return errorResponse(400, 'Invalid input', { fields: { words: ['Words must contain letters A-Z'] } });
  }

  if (input.type === 'crossword') {
    const answers = normalizeWords(input.entries.map((e) => e.answer));
    if (answers.length < 4) {
      return errorResponse(400, 'Invalid input', { fields: { entries: ['Add at least 4 different words (letters A-Z)'] } });
    }
  }
  if (input.type === 'word_search_theme' && !(input.theme in WORD_THEMES)) {
    return errorResponse(400, 'Invalid input', { fields: { theme: ['Unknown theme'] } });
  }

  const projectId = result.value.project.id;
  const adding = input.type === 'word_search' || input.type === 'crossword' ? 1 : input.count;
  if ((await countPuzzles(projectId)) + adding > MAX_PUZZLES_PER_PROJECT) {
    return errorResponse(400, `A project can hold at most ${MAX_PUZZLES_PER_PROJECT} puzzles`);
  }

  const puzzles = await addPuzzles(projectId, input);
  return NextResponse.json({ puzzle: puzzles[0], puzzles }, { status: 201 });
}
