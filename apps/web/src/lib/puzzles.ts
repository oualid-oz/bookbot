import { eq } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { puzzleSets } from '@bookbot/db/schema';
import { generateWordSearch } from '@bookbot/puzzles';

export async function savePuzzleSet(
  projectId: string,
  type: 'word_search' | 'sudoku' | 'maze' | 'crossword',
  seed: string,
  params: any
) {
  let content: any;

  if (type === 'word_search') {
    const { grid, solution } = generateWordSearch(
      params.words,
      seed,
      params.width || 10,
      params.height || 10
    );
    content = { grid, solution };
  }

  await db.insert(puzzleSets).values({
    projectId,
    type,
    seed,
    params,
    content,
  });
}

export async function getPuzzleSets(projectId: string) {
  return db
    .select()
    .from(puzzleSets)
    .where(eq(puzzleSets.projectId, projectId));
}
