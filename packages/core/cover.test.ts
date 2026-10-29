import { describe, it, expect } from 'vitest';
import { layoutCover, COVER_SAFE_MARGIN, type CoverLayoutInput } from './cover';

const input: CoverLayoutInput = {
  trimSize: '6x9',
  pageCount: 100,
  paper: 'white',
  title: 'Animal Word Search',
  subtitle: 'Easy puzzles',
  author: 'Jane Doe',
  backText: 'A fun book.',
  backgroundColor: '#1e3a5f',
  spineColor: '#15294a',
  textColor: '#ffffff',
  titleSize: 40,
};

describe('layoutCover', () => {
  it('should match the KDP full cover size', () => {
    const layout = layoutCover(input);
    expect(layout.width).toBeCloseTo(12.47, 2);
    expect(layout.height).toBe(9.25);
  });

  it('should keep text inside the safe area of its panel', () => {
    const { elements, guides } = layoutCover(input);
    for (const el of elements) {
      if (el.kind !== 'text') continue;
      const inBack = el.x >= guides.trimLeft + COVER_SAFE_MARGIN - 1e-9 && el.x + el.width <= guides.spineLeft - COVER_SAFE_MARGIN + 1e-9;
      const inFront = el.x >= guides.spineRight + COVER_SAFE_MARGIN - 1e-9 && el.x + el.width <= guides.trimRight - COVER_SAFE_MARGIN + 1e-9;
      expect(inBack || inFront).toBe(true);
      expect(el.y).toBeGreaterThanOrEqual(guides.trimTop);
      expect(el.y).toBeLessThan(guides.trimBottom);
    }
  });

  it('should skip empty text fields', () => {
    const { elements } = layoutCover({ ...input, subtitle: '', backText: '  ' });
    const texts = elements.filter((e) => e.kind === 'text').map((e) => (e.kind === 'text' ? e.text : ''));
    expect(texts).toEqual(['Animal Word Search', 'Jane Doe']);
  });

  it('should only add spine text above 79 pages', () => {
    expect(layoutCover({ ...input, pageCount: 79 }).elements.some((e) => e.kind === 'spineText')).toBe(false);
    const spine = layoutCover({ ...input, pageCount: 200 }).elements.find((e) => e.kind === 'spineText');
    expect(spine?.kind === 'spineText' && spine.text).toBe('Animal Word Search  ·  Jane Doe');
  });
});
