import { SeededRandom } from './word-search';

export const SUDOKU_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type SudokuDifficulty = (typeof SUDOKU_DIFFICULTIES)[number];

/** Clues left on the board; fewer clues is harder */
const TARGET_CLUES: Record<SudokuDifficulty, number> = { easy: 40, medium: 32, hard: 26 };

export interface SudokuResult {
  /** 9×9, 0 for an empty cell */
  puzzle: number[][];
  solution: number[][];
  difficulty: SudokuDifficulty;
  clues: number;
}

const ALL = 0x3fe; // bits 1-9

const box = (r: number, c: number) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

/** Row, column and box candidate masks for a flat 81-cell board */
function masks(board: number[]) {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (!v) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    rows[r] |= 1 << v;
    cols[c] |= 1 << v;
    boxes[box(r, c)] |= 1 << v;
  }
  return { rows, cols, boxes };
}

/**
 * Count solutions up to `limit`, filling `board` in place with the first one
 * found when `keep` is set. Picks the empty cell with the fewest candidates.
 */
function solve(board: number[], limit: number, order?: (digits: number[]) => number[], keep = false): number {
  const { rows, cols, boxes } = masks(board);
  let count = 0;

  const step = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const mask = ALL & ~(rows[r] | cols[c] | boxes[box(r, c)]);
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      return count >= limit || keep;
    }
    if (bestCount === 0) return false;

    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = box(r, c);
    let digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (order) digits = order(digits);

    for (const d of digits) {
      const bit = 1 << d;
      board[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (step()) return true;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
    }
    board[best] = 0;
    return false;
  };

  step();
  return count;
}

const toGrid = (flat: number[]) => Array.from({ length: 9 }, (_, r) => flat.slice(r * 9, r * 9 + 9));

/**
 * Generate a sudoku with exactly one solution. The same seed and difficulty
 * always give the same puzzle.
 */
export function generateSudoku(seed: string, difficulty: SudokuDifficulty = 'medium'): SudokuResult {
  const rng = new SeededRandom(`sudoku:${seed}`);

  const solution = new Array(81).fill(0);
  solve(solution, 1, (digits) => rng.shuffle(digits), true);

  // Remove clues in a seeded order, keeping only removals that leave one solution
  const puzzle = [...solution];
  let clues = 81;
  for (const i of rng.shuffle([...Array(81).keys()])) {
    if (clues <= TARGET_CLUES[difficulty]) break;
    const value = puzzle[i];
    puzzle[i] = 0;
    if (solve([...puzzle], 2) === 1) clues--;
    else puzzle[i] = value;
  }

  return { puzzle: toGrid(puzzle), solution: toGrid(solution), difficulty, clues };
}

/** Whether a completed 9×9 grid follows the sudoku rules */
export function isValidSudokuSolution(grid: number[][]): boolean {
  const flat = grid.flat();
  if (flat.length !== 81 || flat.some((v) => v < 1 || v > 9)) return false;
  const { rows, cols, boxes } = masks(flat);
  return [...rows, ...cols, ...boxes].every((m) => m === ALL);
}

/** Number of solutions of a puzzle, counting no further than `limit` */
export function countSudokuSolutions(puzzle: number[][], limit = 2): number {
  return solve(puzzle.flat(), limit);
}
