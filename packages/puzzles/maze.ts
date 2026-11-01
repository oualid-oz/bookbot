import { SeededRandom } from './word-search';

/** Wall bits for each cell */
export const WALL = { N: 1, E: 2, S: 4, W: 8 } as const;

export interface MazeResult {
  width: number;
  height: number;
  /** walls[row][col]: WALL bits still standing */
  walls: number[][];
  /** Entrance at the top-left, exit at the bottom-right */
  start: [number, number];
  end: [number, number];
  /** Cells from start to end, inclusive */
  solution: [number, number][];
}

const MOVES = [
  { dr: -1, dc: 0, wall: WALL.N, opposite: WALL.S },
  { dr: 0, dc: 1, wall: WALL.E, opposite: WALL.W },
  { dr: 1, dc: 0, wall: WALL.S, opposite: WALL.N },
  { dr: 0, dc: -1, wall: WALL.W, opposite: WALL.E },
];

/**
 * Generate a perfect maze (exactly one path between any two cells) with a
 * depth-first carve. The same seed and size always give the same maze.
 */
export function generateMaze(seed: string, width = 15, height = 20): MazeResult {
  const rng = new SeededRandom(`maze:${seed}`);
  const walls = Array.from({ length: height }, () => new Array(width).fill(WALL.N | WALL.E | WALL.S | WALL.W));
  const visited = Array.from({ length: height }, () => new Array(width).fill(false));

  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = MOVES.filter(({ dr, dc }) => {
      const nr = r + dr;
      const nc = c + dc;
      return nr >= 0 && nr < height && nc >= 0 && nc < width && !visited[nr][nc];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const move = options[rng.nextInt(0, options.length - 1)];
    const nr = r + move.dr;
    const nc = c + move.dc;
    walls[r][c] &= ~move.wall;
    walls[nr][nc] &= ~move.opposite;
    visited[nr][nc] = true;
    stack.push([nr, nc]);
  }

  const start: [number, number] = [0, 0];
  const end: [number, number] = [height - 1, width - 1];
  // Openings in the outer wall
  walls[0][0] &= ~WALL.N;
  walls[height - 1][width - 1] &= ~WALL.S;

  return { width, height, walls, start, end, solution: solveMaze(walls, start, end) };
}

/** Shortest path through open walls (the only path, in a perfect maze) */
export function solveMaze(walls: number[][], start: [number, number], end: [number, number]): [number, number][] {
  const height = walls.length;
  const width = walls[0]?.length ?? 0;
  const prev = new Map<number, number>();
  const key = (r: number, c: number) => r * width + c;
  const queue: [number, number][] = [start];
  prev.set(key(...start), -1);

  while (queue.length) {
    const [r, c] = queue.shift()!;
    if (r === end[0] && c === end[1]) break;
    for (const { dr, dc, wall } of MOVES) {
      const nr = r + dr;
      const nc = c + dc;
      if (walls[r][c] & wall || nr < 0 || nr >= height || nc < 0 || nc >= width || prev.has(key(nr, nc))) continue;
      prev.set(key(nr, nc), key(r, c));
      queue.push([nr, nc]);
    }
  }

  if (!prev.has(key(...end))) return [];
  const path: [number, number][] = [];
  for (let k = key(...end); k !== -1; k = prev.get(k)!) path.push([Math.floor(k / width), k % width]);
  return path.reverse();
}
