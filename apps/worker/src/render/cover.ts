import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { calculateCoverDimensions, canHaveSpineText } from '@bookbot/core';
import { fitFontSize, inches, safeText } from './text';

export interface CoverInput {
  title: string;
  subtitle?: string | null;
  trimSize: string;
  pageCount: number;
  paper: string;
}

/**
 * Render a full wrap-around paperback cover (back, spine, front) at KDP's
 * exact size including bleed. Titles go on the front, and on the spine when
 * the book is thick enough for spine text.
 */
export async function renderCover(input: CoverInput): Promise<Uint8Array> {
  const dims = calculateCoverDimensions(input.trimSize, input.pageCount, input.paper);
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.title} (cover)`);
  doc.setCreator('Bookbot');

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([inches(dims.totalWidth), inches(dims.totalHeight)]);

  const bleed = inches(dims.bleed);
  const trimWidth = inches(dims.width);
  const spine = inches(dims.spineWidth);
  const frontLeft = bleed + trimWidth + spine;
  const safeInset = inches(0.25); // keep text away from the trim edge
  const textWidth = trimWidth - safeInset * 2;
  const centerY = inches(dims.totalHeight) * 0.6;

  page.drawRectangle({ x: 0, y: 0, width: inches(dims.totalWidth), height: inches(dims.totalHeight), color: rgb(0.97, 0.97, 0.97) });
  page.drawRectangle({ x: bleed + trimWidth, y: 0, width: spine, height: inches(dims.totalHeight), color: rgb(0.88, 0.88, 0.88) });

  const title = safeText(bold, input.title);
  const titleSize = fitFontSize(bold, title, 32, textWidth);
  page.drawText(title, {
    x: frontLeft + (trimWidth - bold.widthOfTextAtSize(title, titleSize)) / 2,
    y: centerY,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0),
  });

  if (input.subtitle) {
    const subtitle = safeText(regular, input.subtitle);
    const size = fitFontSize(regular, subtitle, 16, textWidth);
    page.drawText(subtitle, {
      x: frontLeft + (trimWidth - regular.widthOfTextAtSize(subtitle, size)) / 2,
      y: centerY - titleSize - 8,
      size,
      font: regular,
      color: rgb(0.25, 0.25, 0.25),
    });
  }

  if (canHaveSpineText(input.pageCount)) {
    // Spine text reads top to bottom, with 0.0625" clearance on each side
    const size = Math.min(spine - inches(0.125), 14);
    const spineTitle = safeText(bold, input.title);
    const fitted = fitFontSize(bold, spineTitle, size, inches(dims.totalHeight) - inches(1));
    const textLength = bold.widthOfTextAtSize(spineTitle, fitted);
    page.drawText(spineTitle, {
      x: bleed + trimWidth + spine / 2 - fitted * 0.35,
      y: (inches(dims.totalHeight) + textLength) / 2,
      size: fitted,
      font: bold,
      rotate: degrees(-90),
      color: rgb(0, 0, 0),
    });
  }

  return doc.save();
}
