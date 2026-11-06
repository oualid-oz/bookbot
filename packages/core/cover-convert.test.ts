import { describe, expect, it } from 'vitest';
import { guessPageCount, planCoverConversion, type CoverSpec } from './cover-convert';
import { calculateCoverDimensions } from './kdp';

const spec = (trimSize: string, pageCount: number, paper = 'white'): CoverSpec => ({ trimSize, pageCount, paper });

/** Pixel size of an exactly sized wrap at a resolution */
function imageFor(s: CoverSpec, dpi = 300) {
  const d = calculateCoverDimensions(s.trimSize, s.pageCount, s.paper);
  return [Math.round(d.totalWidth * dpi), Math.round(d.totalHeight * dpi)] as const;
}

describe('planCoverConversion', () => {
  it('fills the new wrap edge to edge, back then spine then front', () => {
    const source = spec('6x9', 100);
    const target = spec('6x9', 300);
    const plan = planCoverConversion(...imageFor(source), source, target);
    const d = calculateCoverDimensions('6x9', 300, 'white');
    expect(plan.width).toBeCloseTo(d.totalWidth);
    const [back, spine, front] = plan.panels;
    expect(back.dest.x).toBe(0);
    expect(spine.dest.x).toBeCloseTo(back.dest.width);
    expect(spine.dest.width).toBeCloseTo(d.spineWidth);
    expect(front.dest.x + front.dest.width).toBeCloseTo(d.totalWidth);
    for (const panel of plan.panels) expect(panel.dest.height).toBeCloseTo(d.totalHeight);
  });

  it('cuts the source at its real spine, and only changing the page count crops nothing', () => {
    const source = spec('6x9', 200);
    const [w, h] = imageFor(source);
    const d = calculateCoverDimensions('6x9', 200, 'white');
    const [back, spine, front] = planCoverConversion(w, h, source, spec('6x9', 400)).panels;
    expect(spine.source.x).toBeCloseTo(((d.bleed + d.width) / d.totalWidth) * w);
    expect(spine.source.width).toBeCloseTo((d.spineWidth / d.totalWidth) * w);
    expect(back.source.width).toBeCloseTo(((d.bleed + d.width) / d.totalWidth) * w);
    expect(front.source.x + front.source.width).toBeCloseTo(w);
    expect(front.source.height).toBeCloseTo(h);
  });

  it('keeps the shape of the front when the trim changes, instead of squashing it', () => {
    const source = spec('6x9', 100);
    const plan = planCoverConversion(...imageFor(source), source, spec('8.5x8.5', 100));
    const front = plan.panels[2];
    expect(front.source.width / front.source.height).toBeCloseTo(front.dest.width / front.dest.height);
    expect(plan.warnings.some((w) => w.includes('cut from the top and bottom'))).toBe(true);
  });

  it('reports no warnings for a sharp, correctly sized image with a similar spine', () => {
    const source = spec('6x9', 100);
    expect(planCoverConversion(...imageFor(source), source, spec('6x9', 110)).warnings).toEqual([]);
  });

  it('warns when the image is not the size chosen for it, and suggests the page count', () => {
    const [w, h] = imageFor(spec('6x9', 400));
    const { warnings } = planCoverConversion(w, h, spec('6x9', 100), spec('6x9', 100));
    expect(warnings.some((m) => /fits about 40\d pages|fits about 39\d pages/.test(m))).toBe(true);
  });

  it('warns about low resolution, stretched spines and banned spine text', () => {
    const source = spec('6x9', 100);
    expect(planCoverConversion(...imageFor(source, 150), source, spec('6x9', 100)).warnings.join()).toContain('DPI');
    expect(planCoverConversion(...imageFor(source), source, spec('6x9', 300)).warnings.join()).toContain('wider');
    expect(planCoverConversion(...imageFor(source), source, spec('6x9', 50)).warnings.join()).toContain("doesn't allow spine text");
  });
});

describe('guessPageCount', () => {
  it('recovers the page count from the shape of a wrap', () => {
    const [w, h] = imageFor(spec('6x9', 200), 600);
    expect(guessPageCount(w, h, '6x9', 'white')).toBeGreaterThanOrEqual(198);
    expect(guessPageCount(w, h, '6x9', 'white')).toBeLessThanOrEqual(202);
  });

  it('returns null for images that cannot be a wrap', () => {
    expect(guessPageCount(1000, 1000, '6x9', 'white')).toBeNull();
    expect(guessPageCount(1000, 1000, 'nope', 'white')).toBeNull();
  });
});
