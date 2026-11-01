import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_PATTERNS,
  BORDER_STYLES,
  decorationFrame,
  pageDecorations,
  printColor,
  type DecorationInput,
} from './decorations';

const page = { width: 432, height: 648 }; // 6" x 9"

const input = (changes: Partial<DecorationInput> = {}): DecorationInput => ({
  ...page,
  frame: decorationFrame(page.width, page.height, 0.375, true),
  border: 'none',
  borderColor: '#333333',
  background: 'none',
  backgroundColor: '#888888',
  intensity: 'light',
  seed: 1,
  ...changes,
});

/** Every coordinate in a path */
function coordinates(d: string): [number, number][] {
  const numbers = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  // H and V carry one number; skip them by only checking paths without H/V
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) pairs.push([numbers[i], numbers[i + 1]]);
  return pairs;
}

describe('decorationFrame', () => {
  it('keeps the gutter margin on the binding side and 0.3" elsewhere', () => {
    const right = decorationFrame(432, 648, 0.5, true);
    expect(right.x).toBe(36);
    expect(right.y).toBeCloseTo(21.6);
    expect(right.x + right.width).toBeCloseTo(432 - 21.6);
    expect(right.y + right.height).toBeCloseTo(648 - 21.6);
    const left = decorationFrame(432, 648, 0.5, false);
    expect(left.x).toBeCloseTo(21.6);
    expect(left.x + left.width).toBeCloseTo(432 - 36);
  });
});

describe('pageDecorations', () => {
  it('draws nothing by default', () => {
    expect(pageDecorations(input())).toEqual([]);
  });

  it.each(BORDER_STYLES.filter((s) => s !== 'none'))('draws the %s border', (border) => {
    const shapes = pageDecorations(input({ border }));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.every((s) => s.d.startsWith('M') && (s.fill || s.stroke))).toBe(true);
  });

  it.each(BACKGROUND_PATTERNS.filter((p) => p !== 'none'))('keeps the %s background inside the frame and faint', (background) => {
    const frame = input().frame;
    const shapes = pageDecorations(input({ background }));
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.opacity).toBeLessThanOrEqual(0.5);
      if (/[HV]/.test(shape.d)) continue;
      for (const [x, y] of coordinates(shape.d)) {
        expect(x).toBeGreaterThanOrEqual(frame.x - 0.5);
        expect(x).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
        expect(y).toBeGreaterThanOrEqual(frame.y - 0.5);
        expect(y).toBeLessThanOrEqual(frame.y + frame.height + 0.5);
      }
    }
  });

  it('is the same for the same seed and varies scattered patterns by seed', () => {
    expect(pageDecorations(input({ background: 'confetti' }))).toEqual(pageDecorations(input({ background: 'confetti' })));
    expect(pageDecorations(input({ background: 'stars', seed: 1 }))).not.toEqual(pageDecorations(input({ background: 'stars', seed: 2 })));
  });

  it('makes medium backgrounds stronger than light ones', () => {
    const light = pageDecorations(input({ background: 'polka', intensity: 'light' }))[0].opacity!;
    const medium = pageDecorations(input({ background: 'polka', intensity: 'medium' }))[0].opacity!;
    expect(medium).toBeGreaterThan(light);
  });
});

describe('printColor', () => {
  it('turns colors grey for black-and-white interiors', () => {
    expect(printColor('#ff0000', true)).toBe('#ff0000');
    expect(printColor('#ff0000', false)).toBe('#4c4c4c');
    expect(printColor('#ffffff', false)).toBe('#ffffff');
  });
});
