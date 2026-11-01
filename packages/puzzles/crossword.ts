import { SeededRandom, normalizeWords } from './word-search';

export interface CrosswordInput {
  answer: string;
  clue: string;
}

export interface CrosswordEntry {
  number: number;
  direction: 'across' | 'down';
  row: number;
  col: number;
  answer: string;
  clue: string;
}

export interface CrosswordResult {
  width: number;
  height: number;
  /** Solution letters; null where there is no square */
  grid: (string | null)[][];
  entries: CrosswordEntry[];
  /** Words that could not be crossed with the rest */
  unplaced: string[];
}

type Direction = CrosswordEntry['direction'];

interface Placement {
  answer: string;
  clue: string;
  row: number;
  col: number;
  direction: Direction;
}

const step = (direction: Direction) => (direction === 'across' ? [0, 1] : [1, 0]);

/** Grid built word by word on an unbounded board */
class Board {
  cells = new Map<string, { letter: string; across: boolean; down: boolean }>();
  placements: Placement[] = [];

  private key = (r: number, c: number) => `${r},${c}`;
  get = (r: number, c: number) => this.cells.get(this.key(r, c));

  bounds() {
    let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
    for (const k of this.cells.keys()) {
      const [r, c] = k.split(',').map(Number);
      top = Math.min(top, r); bottom = Math.max(bottom, r);
      left = Math.min(left, c); right = Math.max(right, c);
    }
    return { top, bottom, left, right };
  }

  /** Crossings made by placing the word here, or -1 if it can't go here */
  crossings(word: string, row: number, col: number, direction: Direction, maxSize: number): number {
    const [dr, dc] = step(direction);
    // The squares just before and after the word must be empty
    if (this.get(row - dr, col - dc) || this.get(row + dr * word.length, col + dc * word.length)) return -1;

    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = this.get(r, c);
      if (cell) {
        if (cell.letter !== word[i] || cell[direction]) return -1;
        crossings++;
      } else {
        // No side neighbours, so words never touch except where they cross
        if (this.get(r + dc, c + dr) || this.get(r - dc, c - dr)) return -1;
      }
    }

    if (this.cells.size) {
      const b = this.bounds();
      const height = Math.max(b.bottom, row + dr * (word.length - 1)) - Math.min(b.top, row) + 1;
      const width = Math.max(b.right, col + dc * (word.length - 1)) - Math.min(b.left, col) + 1;
      if (height > maxSize || width > maxSize) return -1;
    }
    return crossings;
  }

  place(p: Placement) {
    const [dr, dc] = step(p.direction);
    for (let i = 0; i < p.answer.length; i++) {
      const k = this.key(p.row + dr * i, p.col + dc * i);
      const cell = this.cells.get(k) ?? { letter: p.answer[i], across: false, down: false };
      cell[p.direction] = true;
      this.cells.set(k, cell);
    }
    this.placements.push(p);
  }

  /** Every legal spot for the word that crosses a placed word */
  candidates(word: string, maxSize: number) {
    const found: { row: number; col: number; direction: Direction; crossings: number }[] = [];
    for (const [k, cell] of this.cells) {
      const [r, c] = k.split(',').map(Number);
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== cell.letter) continue;
        for (const direction of ['across', 'down'] as const) {
          if (cell[direction]) continue;
          const [dr, dc] = step(direction);
          const row = r - dr * i;
          const col = c - dc * i;
          const crossings = this.crossings(word, row, col, direction, maxSize);
          if (crossings > 0) found.push({ row, col, direction, crossings });
        }
      }
    }
    return found;
  }
}

function build(items: CrosswordInput[], rng: SeededRandom, maxSize: number) {
  const board = new Board();
  const pending = [...items];
  const [first] = pending.splice(0, 1);
  board.place({ ...first, row: 0, col: 0, direction: rng.next() < 0.5 ? 'across' : 'down' });

  // Keep placing whichever remaining word has the best crossing, until none fit
  let progress = true;
  while (pending.length && progress) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const options = board.candidates(pending[i].answer, maxSize);
      if (!options.length) continue;
      const best = Math.max(...options.map((o) => o.crossings));
      const top = options.filter((o) => o.crossings === best);
      const pick = top[rng.nextInt(0, top.length - 1)];
      board.place({ ...pending[i], row: pick.row, col: pick.col, direction: pick.direction });
      pending.splice(i, 1);
      i--;
      progress = true;
    }
  }
  return { board, unplaced: pending.map((p) => p.answer) };
}

/**
 * Generate a free-form crossword from answers and clues. Several seeded
 * attempts are made; the one that places the most words in the smallest
 * area wins. The same seed always gives the same crossword.
 */
export function generateCrossword(items: CrosswordInput[], seed: string, maxSize = 17, attempts = 30): CrosswordResult {
  const rng = new SeededRandom(`crossword:${seed}`);
  const seen = new Set<string>();
  const words = items
    .map((item) => ({ answer: normalizeWords([item.answer])[0] ?? '', clue: item.clue.trim() }))
    .filter((item) => item.answer.length >= 2 && item.answer.length <= maxSize && !seen.has(item.answer) && seen.add(item.answer));

  let best: ReturnType<typeof build> | null = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < attempts && words.length; attempt++) {
    // Long words first gives more crossings; shuffle within that for variety
    const ordered = rng.shuffle(words).sort((a, b) => b.answer.length - a.answer.length + (rng.next() - 0.5) * 3);
    const result = build(ordered, rng, maxSize);
    const b = result.board.bounds();
    const area = (b.bottom - b.top + 1) * (b.right - b.left + 1);
    const score = result.board.placements.length * 10_000 - area;
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  }

  const tooLong = items.map((i) => normalizeWords([i.answer])[0] ?? '').filter((a) => a.length > maxSize);
  if (!best) return { width: 0, height: 0, grid: [], entries: [], unplaced: tooLong };

  const { board, unplaced } = best;
  const b = board.bounds();
  const width = b.right - b.left + 1;
  const height = b.bottom - b.top + 1;
  const grid: (string | null)[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => board.get(r + b.top, c + b.left)?.letter ?? null)
  );

  // Number squares in reading order; an across and a down word can share a number
  const starts = board.placements
    .map((p) => ({ ...p, row: p.row - b.top, col: p.col - b.left }))
    .sort((p, q) => p.row - q.row || p.col - q.col);
  const numbers = new Map<string, number>();
  const entries: CrosswordEntry[] = starts.map((p) => {
    const k = `${p.row},${p.col}`;
    if (!numbers.has(k)) numbers.set(k, numbers.size + 1);
    return { number: numbers.get(k)!, direction: p.direction, row: p.row, col: p.col, answer: p.answer, clue: p.clue };
  });
  entries.sort((p, q) => (p.direction === q.direction ? p.number - q.number : p.direction === 'across' ? -1 : 1));

  return { width, height, grid, entries, unplaced: [...unplaced, ...tooLong] };
}
