import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { calculateCoverDimensions, planCoverConversion, type CoverSpec } from '@bookbot/core';
import { buildCoverPdf } from '@/app/(app)/cover-converter/convert';

const RED = { r: 200, g: 0, b: 0 };
const GREEN = { r: 0, g: 180, b: 0 };
const BLUE = { r: 0, g: 0, b: 200 };

/** A wrap with a solid back (red), spine (green) and front (blue) */
async function wrap(spec: CoverSpec, dpi: number) {
  const d = calculateCoverDimensions(spec.trimSize, spec.pageCount, spec.paper);
  const width = Math.round(d.totalWidth * dpi);
  const height = Math.round(d.totalHeight * dpi);
  const spineLeft = Math.round((d.bleed + d.width) * dpi);
  const spineWidth = Math.round(d.spineWidth * dpi);
  const block = (w: number, background: object) => sharp({ create: { width: w, height, channels: 3, background: background as never } }).png().toBuffer();
  return {
    width,
    height,
    png: await sharp({ create: { width, height, channels: 3, background: RED } })
      .composite([
        { input: await block(spineWidth, GREEN), left: spineLeft, top: 0 },
        { input: await block(width - spineLeft - spineWidth, BLUE), left: spineLeft + spineWidth, top: 0 },
      ])
      .png()
      .toBuffer(),
  };
}

/** Apply a plan with sharp, the way the browser does with a canvas */
async function apply(png: Buffer, plan: ReturnType<typeof planCoverConversion>, dpi: number) {
  const layers = await Promise.all(
    plan.panels.map(async ({ source, dest }) => ({
      input: await sharp(png)
        .extract({ left: Math.round(source.x), top: Math.round(source.y), width: Math.round(source.width), height: Math.round(source.height) })
        .resize(Math.round(dest.width * dpi), Math.round(dest.height * dpi), { fit: 'fill' })
        .png()
        .toBuffer(),
      left: Math.round(dest.x * dpi),
      top: Math.round(dest.y * dpi),
    }))
  );
  const canvas = { width: Math.round(plan.width * dpi), height: Math.round(plan.height * dpi), channels: 3 as const, background: '#ffffff' };
  return sharp({ create: canvas }).composite(layers).raw().toBuffer({ resolveWithObject: true });
}

describe('cover conversion', () => {
  it('puts each panel in its new place when the page count and trim change', async () => {
    const dpi = 100;
    const source = { trimSize: '6x9', pageCount: 200, paper: 'white' };
    const target = { trimSize: '7x10', pageCount: 500, paper: 'white' };
    const { width, height, png } = await wrap(source, dpi);
    const plan = planCoverConversion(width, height, source, target);
    const { data, info } = await apply(png, plan, dpi);

    const pixel = (inchesX: number) => {
      const i = (Math.round(info.height / 2) * info.width + Math.round(inchesX * dpi)) * info.channels;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };
    const { spineLeft, spineRight } = plan.guides;
    expect(pixel(spineLeft - 0.3)).toEqual(RED);
    expect(pixel((spineLeft + spineRight) / 2)).toEqual(GREEN);
    expect(pixel(spineRight + 0.3)).toEqual(BLUE);
    expect(pixel(plan.width - 0.05)).toEqual(BLUE);
  });

  it('makes a one-page PDF at exactly the KDP size', async () => {
    const target = { trimSize: '8.5x11', pageCount: 120, paper: 'cream' };
    const d = calculateCoverDimensions(target.trimSize, target.pageCount, target.paper);
    for (const [mimeType, bytes] of [
      ['image/png', await sharp({ create: { width: 40, height: 30, channels: 3, background: RED } }).png().toBuffer()],
      ['image/jpeg', await sharp({ create: { width: 40, height: 30, channels: 3, background: RED } }).jpeg().toBuffer()],
    ] as const) {
      const doc = await PDFDocument.load(await buildCoverPdf(new Uint8Array(bytes), mimeType, d.totalWidth, d.totalHeight));
      expect(doc.getPageCount()).toBe(1);
      const size = doc.getPage(0).getSize();
      expect(size.width).toBeCloseTo(d.totalWidth * 72);
      expect(size.height).toBeCloseTo(d.totalHeight * 72);
    }
  });
});
