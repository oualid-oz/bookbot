import { describe, it, expect } from 'vitest';
import { normalizeWords } from './word-search';
import { generateThemedWordSearches, WORD_THEMES } from './themes';

describe('WORD_THEMES', () => {
  const topics = Object.values(WORD_THEMES).flatMap((theme) => theme.topics);

  it.each(topics.map((t) => [t.title, t.words] as const))('%s has enough clean, distinct words', (_title, words) => {
    expect(words.length).toBeGreaterThanOrEqual(15);
    expect(words.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    expect(normalizeWords(words)).toHaveLength(words.length);
    // A word inside another (ROSE in ROSES) makes the puzzle ambiguous
    const nested = words.filter((a) => words.some((b) => a !== b && b.includes(a)));
    expect(nested).toEqual([]);
  });
});

describe('generateThemedWordSearches', () => {
  it('makes one puzzle per topic, in a repeatable order, with words that fit', () => {
    const a = generateThemedWordSearches('animals', 9, 'seed', 12);
    expect(generateThemedWordSearches('animals', 9, 'seed', 12)).toEqual(a);
    expect(a).toHaveLength(9);
    // The first 7 are the 7 different topics; then they repeat
    expect(new Set(a.slice(0, 7).map((p) => p.title)).size).toBe(7);
    for (const puzzle of a) {
      expect(puzzle.solution.length).toBeGreaterThanOrEqual(12);
      expect(puzzle.solution.every((s) => s.word.length <= 12)).toBe(true);
    }
  });

  it('places almost every word, even on small grids', () => {
    const unplaced = generateThemedWordSearches('kids', 6, 'small', 10).flatMap((p) => p.unplaced);
    expect(unplaced.length).toBeLessThanOrEqual(2);
  });
});
