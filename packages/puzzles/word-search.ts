/**
 * Seed-based random number generator
 * Ensures reproducible puzzle generation
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export interface WordSearchPlacement {
  word: string;
  start: [number, number];
  end: [number, number];
}

export interface WordSearchResult {
  grid: string[][];
  solution: WordSearchPlacement[];
  /** Words that could not be placed (too long for the grid, or no room left) */
  unplaced: string[];
}

/**
 * Normalize puzzle words: uppercase A-Z only, no blanks or duplicates
 */
export function normalizeWords(words: string[]): string[] {
  const normalized = words
    .map((w) => w.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase())
    .filter(Boolean);
  return [...new Set(normalized)];
}

const DIRECTIONS: [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

/**
 * Word search puzzle generator
 */
export function generateWordSearch(
  words: string[],
  seed: string,
  width: number = 10,
  height: number = 10
): WordSearchResult {
  const rng = new SeededRandom(seed);
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(''));
  const solution: WordSearchPlacement[] = [];
  const unplaced: string[] = [];

  // Longest words first: they are the hardest to fit
  const ordered = normalizeWords(words).sort((a, b) => b.length - a.length);

  for (const word of ordered) {
    const place = (row: number, col: number, dir: [number, number]) => {
      if (!canPlaceWord(grid, word, row, col, dir, width, height)) return false;
      placeWord(grid, word, row, col, dir);
      solution.push({
        word,
        start: [row, col],
        end: [row + dir[0] * (word.length - 1), col + dir[1] * (word.length - 1)],
      });
      return true;
    };

    let placed = false;
    for (let attempt = 0; attempt < 100 && !placed; attempt++) {
      placed = place(
        rng.nextInt(0, height - 1),
        rng.nextInt(0, width - 1),
        DIRECTIONS[rng.nextInt(0, DIRECTIONS.length - 1)]
      );
    }

    // Random attempts failed: try every position, in a seeded order
    if (!placed) {
      const candidates: [number, number, [number, number]][] = [];
      for (let r = 0; r < height; r++)
        for (let c = 0; c < width; c++)
          for (const dir of DIRECTIONS) candidates.push([r, c, dir]);
      placed = rng.shuffle(candidates).some(([r, c, dir]) => place(r, c, dir));
    }

    if (!placed) unplaced.push(word);
  }

  // Fill empty cells with random letters
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = letters[rng.nextInt(0, letters.length - 1)];
      }
    }
  }

  return { grid, solution, unplaced };
}

function canPlaceWord(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  dir: [number, number],
  width: number,
  height: number
): boolean {
  for (let i = 0; i < word.length; i++) {
    const r = row + dir[0] * i;
    const c = col + dir[1] * i;

    if (r < 0 || r >= height || c < 0 || c >= width) return false;
    if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
  }
  return true;
}

function placeWord(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  dir: [number, number]
) {
  for (let i = 0; i < word.length; i++) {
    grid[row + dir[0] * i][col + dir[1] * i] = word[i];
  }
}
