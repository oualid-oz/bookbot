import { describe, it, expect } from 'vitest';
import { generateCrossword, type CrosswordResult } from './crossword';

const items = [
  ['elephant', 'Largest land animal'],
  ['giraffe', 'Tallest animal'],
  ['penguin', 'Bird that cannot fly but swims'],
  ['dolphin', 'Smart sea mammal'],
  ['kangaroo', 'Hops and has a pouch'],
  ['tiger', 'Striped big cat'],
  ['zebra', 'Striped horse'],
  ['owl', 'Bird awake at night'],
  ['rabbit', 'Long-eared hopper'],
  ['turtle', 'Carries its home on its back'],
  ['monkey', 'Loves bananas'],
  ['parrot', 'Bird that can talk'],
].map(([answer, clue]) => ({ answer, clue }));

/** Read each entry back from the grid and check the layout rules */
function checkLayout({ grid, entries, width, height }: CrosswordResult) {
  const at = (r: number, c: number) => (r >= 0 && r < height && c >= 0 && c < width ? grid[r][c] : null);
  for (const e of entries) {
    const [dr, dc] = e.direction === 'across' ? [0, 1] : [1, 0];
    const read = [...e.answer].map((_, i) => at(e.row + dr * i, e.col + dc * i)).join('');
    expect(read).toBe(e.answer);
    // Squares before and after are empty, so words never run together
    expect(at(e.row - dr, e.col - dc)).toBeNull();
    expect(at(e.row + dr * e.answer.length, e.col + dc * e.answer.length)).toBeNull();
  }
  // Every letter belongs to a word
  const squares = (direction: string) =>
    new Set(entries.filter((e) => e.direction === direction).flatMap((e) =>
      [...e.answer].map((_, i) => (direction === 'across' ? `${e.row},${e.col + i}` : `${e.row + i},${e.col}`))));
  const across = squares('across');
  const down = squares('down');
  grid.forEach((row, r) => row.forEach((cell, c) => expect(!!cell).toBe(across.has(`${r},${c}`) || down.has(`${r},${c}`))));
  // Letters side by side are always part of one across word (and stacked ones of one down word),
  // so no unintended words appear
  const sameWord = (direction: 'across' | 'down', r: number, c: number) => {
    const [dr, dc] = direction === 'across' ? [0, 1] : [1, 0];
    return entries.some((e) => e.direction === direction &&
      (direction === 'across' ? e.row === r && e.col <= c && c + dc < e.col + e.answer.length : e.col === c && e.row <= r && r + dr < e.row + e.answer.length));
  };
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell && at(r, c + 1)) expect(sameWord('across', r, c), `across ${r},${c}`).toBe(true);
    if (cell && at(r + 1, c)) expect(sameWord('down', r, c), `down ${r},${c}`).toBe(true);
  }));
}

describe('generateCrossword', () => {
  it('is repeatable for a seed', () => {
    expect(generateCrossword(items, 'a')).toEqual(generateCrossword(items, 'a'));
  });

  it('places most words in a valid, connected layout', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const result = generateCrossword(items, seed);
      expect(result.entries.length).toBeGreaterThanOrEqual(10);
      expect(result.width).toBeLessThanOrEqual(17);
      expect(result.height).toBeLessThanOrEqual(17);
      checkLayout(result);
      expect(result.entries.length + result.unplaced.length).toBe(items.length);
    }
  });

  it('numbers squares in reading order and lists across before down', () => {
    const { entries } = generateCrossword(items, 'numbers');
    const firstDown = entries.findIndex((e) => e.direction === 'down');
    expect(entries.slice(0, firstDown).every((e) => e.direction === 'across')).toBe(true);
    const byNumber = [...entries].sort((a, b) => a.number - b.number);
    for (let i = 1; i < byNumber.length; i++) {
      const [p, q] = [byNumber[i - 1], byNumber[i]];
      if (p.number !== q.number) expect(p.row < q.row || (p.row === q.row && p.col < q.col)).toBe(true);
    }
  });

  it('keeps clues with their answers and reports words that are too long', () => {
    const result = generateCrossword([...items, { answer: 'supercalifragilistic', clue: 'Too long' }], 'x', 15);
    expect(result.unplaced).toContain('SUPERCALIFRAGILISTIC');
    const elephant = result.entries.find((e) => e.answer === 'ELEPHANT');
    expect(elephant?.clue).toBe('Largest land animal');
  });
});
