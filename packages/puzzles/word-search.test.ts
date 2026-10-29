import { describe, it, expect } from 'vitest';
import { generateWordSearch } from './word-search';

describe('generateWordSearch', () => {
  const words = ['CAT', 'DOG', 'BIRD', 'FISH'];

  it('should produce the same puzzle for the same seed', () => {
    const a = generateWordSearch(words, 'seed-1');
    const b = generateWordSearch(words, 'seed-1');
    expect(a).toEqual(b);
  });

  it('should produce a different puzzle for a different seed', () => {
    const a = generateWordSearch(words, 'seed-1');
    const b = generateWordSearch(words, 'seed-2');
    expect(a.grid).not.toEqual(b.grid);
  });

  it('should fill every cell with a letter', () => {
    const { grid } = generateWordSearch(words, 'seed-1', 12, 8);
    expect(grid).toHaveLength(8);
    for (const row of grid) {
      expect(row).toHaveLength(12);
      for (const cell of row) {
        expect(cell).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('should place each solved word at its reported position', () => {
    const { grid, solution } = generateWordSearch(words, 'seed-1');
    expect(solution.length).toBeGreaterThan(0);

    for (const { word, start, end } of solution) {
      const dr = Math.sign(end[0] - start[0]);
      const dc = Math.sign(end[1] - start[1]);
      const letters = [...word].map((_, i) => grid[start[0] + dr * i][start[1] + dc * i]);
      expect(letters.join('')).toBe(word);
    }
  });
});
