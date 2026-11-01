import { describe, it, expect } from 'vitest';
import { checkListing, type ListingInput } from './listing';

const good: ListingInput = {
  title: 'Animal Word Search for Kids',
  subtitle: '50 Fun Puzzles About Pets, Farm and Ocean Animals, Ages 6-8',
  author: 'Maya Brooks',
  description:
    '<p>Keep curious kids busy with <b>50 animal word search puzzles</b>.</p><ul><li>Large, easy-to-read letters</li><li>Solutions at the back</li></ul><p>A great gift for birthdays, rainy days and long road trips, made for children who are just starting to read on their own.</p>',
  keywords: ['puzzle book for children', 'activity book ages 6', 'zoo learning games', 'road trip games', 'gift for kids', 'brain games', 'homeschool activities'],
  categories: ['Juvenile Nonfiction / Games & Activities / Word Games'],
};

const fields = (listing: Partial<ListingInput>, level?: 'error' | 'warning') =>
  checkListing({ ...good, ...listing })
    .filter((i) => !level || i.level === level)
    .map((i) => i.field);

describe('checkListing', () => {
  it('accepts a complete, clean listing', () => {
    expect(checkListing(good)).toEqual([]);
  });

  it('enforces length limits', () => {
    expect(fields({ subtitle: 'x'.repeat(190) }, 'error')).toContain('subtitle');
    expect(fields({ description: `<p>${'word '.repeat(900)}</p>` }, 'error')).toContain('description');
    expect(fields({ keywords: [...good.keywords.slice(0, 6), 'k'.repeat(51)] }, 'error')).toEqual(['keywords']);
  });

  it('rejects sales claims and Amazon terms, but not words that contain them', () => {
    expect(fields({ title: 'Bestseller Word Search' }, 'error')).toEqual(['title']);
    expect(fields({ subtitle: '#1 Puzzle Book' }, 'error')).toEqual(['subtitle']);
    expect(fields({ keywords: [...good.keywords.slice(0, 6), 'kindle unlimited puzzles'] }, 'error')).toEqual(['keywords']);
    // "freedom" and "salesman" are fine
    expect(fields({ title: 'Freedom Journal for a Salesman' }, 'error')).toEqual([]);
  });

  it('checks description HTML and links', () => {
    expect(fields({ description: `${good.description}<script>x</script>` }, 'error')).toEqual(['description']);
    expect(fields({ description: `${good.description}<p>Visit www.example.com</p>` }, 'error')).toEqual(['description']);
    expect(fields({ description: '<p>Short.</p>' }, 'warning')).toEqual(['description']);
  });

  it('warns about wasted keywords', () => {
    const issues = checkListing({ ...good, keywords: ['animal word search', 'animal puzzles', 'Animal Puzzles'] });
    const messages = issues.filter((i) => i.field === 'keywords').map((i) => i.message);
    expect(messages.some((m) => m.includes('Fill all 7'))).toBe(true);
    expect(messages.some((m) => m.startsWith('Keyword 1 only repeats words from the title'))).toBe(true);
    expect(messages.some((m) => m.startsWith('Keyword 3 repeats'))).toBe(true);
  });

  it('requires an author and limits categories', () => {
    expect(fields({ author: ' ' }, 'error')).toEqual(['author']);
    expect(fields({ categories: ['a', 'b', 'c', 'd'] }, 'error')).toEqual(['categories']);
    expect(fields({ categories: [] }, 'warning')).toEqual(['categories']);
  });
});
