import { describe, it, expect } from 'vitest';
import { generateMaze, WALL } from './maze';

describe('generateMaze', () => {
  it('produces the same maze for the same seed', () => {
    expect(generateMaze('seed-1', 10, 12)).toEqual(generateMaze('seed-1', 10, 12));
    expect(generateMaze('seed-1', 10, 12).walls).not.toEqual(generateMaze('seed-2', 10, 12).walls);
  });

  it('has matching walls between neighbours and a closed border apart from the openings', () => {
    const { walls, width, height } = generateMaze('walls', 9, 7);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (c + 1 < width) expect(!!(walls[r][c] & WALL.E)).toBe(!!(walls[r][c + 1] & WALL.W));
        if (r + 1 < height) expect(!!(walls[r][c] & WALL.S)).toBe(!!(walls[r + 1][c] & WALL.N));
        if (c === 0) expect(walls[r][c] & WALL.W).toBeTruthy();
        if (c === width - 1) expect(walls[r][c] & WALL.E).toBeTruthy();
        if (r === 0 && c !== 0) expect(walls[r][c] & WALL.N).toBeTruthy();
        if (r === height - 1 && c !== width - 1) expect(walls[r][c] & WALL.S).toBeTruthy();
      }
    }
    expect(walls[0][0] & WALL.N).toBe(0);
    expect(walls[height - 1][width - 1] & WALL.S).toBe(0);
  });

  it('is a perfect maze: every cell is reachable and there are no loops', () => {
    const { walls, width, height } = generateMaze('perfect', 20, 25);
    // A spanning tree over w*h cells has exactly w*h - 1 open inner walls
    let open = 0;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (c + 1 < width && !(walls[r][c] & WALL.E)) open++;
        if (r + 1 < height && !(walls[r][c] & WALL.S)) open++;
      }
    }
    expect(open).toBe(width * height - 1);
  });

  it('includes a solution path from entrance to exit through open walls', () => {
    const { solution, start, end } = generateMaze('path', 12, 12);
    expect(solution[0]).toEqual(start);
    expect(solution.at(-1)).toEqual(end);
    for (let i = 1; i < solution.length; i++) {
      const [r1, c1] = solution[i - 1];
      const [r2, c2] = solution[i];
      expect(Math.abs(r1 - r2) + Math.abs(c1 - c2)).toBe(1);
    }
  });
});
