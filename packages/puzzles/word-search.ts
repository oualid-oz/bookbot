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

/**
 * Word search puzzle generator
 */
export function generateWordSearch(
  words: string[],
  seed: string,
  width: number = 10,
  height: number = 10
): { grid: string[][], solution: { word: string; start: [number, number]; end: [number, number] }[] } {
  const rng = new SeededRandom(seed);
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(''));
  const solution: { word: string; start: [number, number]; end: [number, number] }[] = [];

  const directions: [number, number][] = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal down-right
    [1, -1], // diagonal down-left
  ];

  for (const word of words) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 100) {
      const dir = directions[rng.nextInt(0, directions.length - 1)];
      const startRow = rng.nextInt(0, height - 1);
      const startCol = rng.nextInt(0, width - 1);

      if (canPlaceWord(grid, word, startRow, startCol, dir, width, height)) {
        placeWord(grid, word, startRow, startCol, dir);
        solution.push({
          word,
          start: [startRow, startCol],
          end: [startRow + dir[0] * (word.length - 1), startCol + dir[1] * (word.length - 1)],
        });
        placed = true;
      }
      attempts++;
    }
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

  return { grid, solution };
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
