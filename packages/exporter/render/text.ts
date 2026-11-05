import type { PDFFont } from 'pdf-lib';

export const POINTS_PER_INCH = 72;

export const inches = (value: number) => value * POINTS_PER_INCH;

/**
 * Standard PDF fonts only cover WinAnsi; replace anything else so user text
 * (titles, puzzle words) can never make rendering throw
 */
export function safeText(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  return [...text.normalize('NFC')]
    .map((char) => (supported.has(char.codePointAt(0)!) ? char : '?'))
    .join('');
}

/**
 * Largest font size (down to minSize) at which text fits within maxWidth
 */
export function fitFontSize(font: PDFFont, text: string, maxSize: number, maxWidth: number, minSize = 6): number {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}
