import { PDFDocument, PDFFont, StandardFonts, degrees, rgb } from 'pdf-lib';
import { LINE_HEIGHT, layoutCover, type CoverLayoutInput } from '@bookbot/core';
import { fitFontSize, inches, safeText } from './text';

/**
 * Render a full wrap-around paperback cover from the same layout the editor
 * previews, at KDP's exact size including bleed.
 */
export async function renderCover(input: CoverLayoutInput): Promise<Uint8Array> {
  const layout = layoutCover(input);
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.title || 'Untitled'} (cover)`);
  doc.setCreator('Bookbot');

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const pageHeight = inches(layout.height);
  const page = doc.addPage([inches(layout.width), pageHeight]);

  for (const el of layout.elements) {
    if (el.kind === 'rect') {
      // PDF origin is bottom-left; layout origin is top-left
      page.drawRectangle({
        x: inches(el.x),
        y: pageHeight - inches(el.y + el.height),
        width: inches(el.width),
        height: inches(el.height),
        color: hexToRgb(el.color),
      });
    } else if (el.kind === 'text') {
      const font = el.bold ? fonts.bold : fonts.regular;
      const boxWidth = inches(el.width);
      const lineHeight = el.size * LINE_HEIGHT;
      // Split lines before filtering characters, so newlines aren't replaced
      wrapText(font, el.text, el.size, boxWidth).forEach((rawLine, i) => {
        const line = safeText(font, rawLine);
        const lineWidth = font.widthOfTextAtSize(line, el.size);
        page.drawText(line, {
          x: inches(el.x) + (el.align === 'center' ? (boxWidth - lineWidth) / 2 : 0),
          // Baseline: top of the line box, minus half the leading, minus the ascent
          y: pageHeight - inches(el.y) - i * lineHeight - (lineHeight - el.size) / 2 - el.size * 0.8,
          size: el.size,
          font,
          color: hexToRgb(el.color),
        });
      });
    } else {
      const text = safeText(fonts.bold, el.text);
      const size = fitFontSize(fonts.bold, text, el.size, inches(el.maxLength), 4);
      const length = fonts.bold.widthOfTextAtSize(text, size);
      page.drawText(text, {
        // Rotated -90°: glyphs extend to the right of x, text runs downward from y
        x: inches(el.centerX) - size * 0.35,
        y: pageHeight - inches(el.centerY) + length / 2,
        size,
        font: fonts.bold,
        rotate: degrees(-90),
        color: hexToRgb(el.color),
      });
    }
  }

  return doc.save();
}

/**
 * Greedy word wrap using the font's real metrics; honors explicit line breaks
 */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(safeText(font, candidate), size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
