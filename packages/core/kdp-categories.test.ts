import { describe, expect, it } from 'vitest';
import { KDP_CATEGORIES, searchKdpCategories } from './kdp-categories';

describe('searchKdpCategories', () => {
  it('has no duplicates', () => {
    expect(new Set(KDP_CATEGORIES).size).toBe(KDP_CATEGORIES.length);
  });

  it('matches every word in any order, ignoring case', () => {
    expect(searchKdpCategories('SEARCH word')).toEqual(['Books › Humor & Entertainment › Puzzles & Games › Word Search']);
    expect(searchKdpCategories('journal')[0]).toContain('Journal Writing');
    expect(searchKdpCategories('no such category')).toEqual([]);
  });

  it('starts with puzzles, respects the limit, and hides chosen categories', () => {
    const first = searchKdpCategories('', [], 3);
    expect(first).toHaveLength(3);
    expect(first[0]).toContain('Word Search');
    expect(searchKdpCategories('', [first[0].toUpperCase()], 1)[0]).toBe(first[1]);
  });
});
