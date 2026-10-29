import { describe, it, expect } from 'vitest';
import { coverFit, layoutCover, COVER_SAFE_MARGIN, type CoverLayoutInput } from './cover';

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

  it('should place background images on their panels, bleed included', () => {
    const { elements, width, guides } = layoutCover({
      ...input,
      backImage: { assetId: 'back', width: 1950, height: 2775 },
      frontImage: { assetId: 'front', width: 3000, height: 3000 },
    });
    const images = elements.filter((e) => e.kind === 'image');
    // Drawn after the background colors and before any text
    expect(elements.slice(2, 4).map((e) => e.kind)).toEqual(['image', 'image']);
    const [back, front] = images;
    expect(back).toMatchObject({ panel: 'back', x: 0, y: 0, width: guides.spineLeft });
    expect(front).toMatchObject({ panel: 'front', x: guides.spineRight, y: 0 });
    expect(front.kind === 'image' && front.x + front.width).toBeCloseTo(width, 9);
  });
});

describe('coverFit', () => {
  it('should crop the overflowing side evenly', () => {
    // Square image into a 1:2 box: full height, middle half of the width
    const { crop } = coverFit(1000, 1000, 2, 4);
    expect(crop).toEqual({ x: 250, y: 0, width: 500, height: 1000 });
  });

  it('should report the resolution at print size', () => {
    // 1950 x 2775 px filling a 6.25 x 9.25 in panel
    expect(coverFit(1950, 2775, 6.25, 9.25).effectiveDpi).toBe(300);
    expect(coverFit(975, 1388, 6.25, 9.25).effectiveDpi).toBe(150);
  });
});
