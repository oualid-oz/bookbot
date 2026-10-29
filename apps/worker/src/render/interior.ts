import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { TRIM_SIZES, getMinimumInsideMargin } from '@bookbot/core';
import { fitFontSize, inches, safeText } from './text';

export interface WordSearchContent {
  grid: string[][];
  solution: { word: string; start: [number, number]; end: [number, number] }[];
}

export interface InteriorInput {
  title: string;
  subtitle?: string | null;
  projectType: 'book' | 'puzzle_book' | 'journal';
  trimSize: string;
  pageCount: number;
  puzzles: WordSearchContent[];
}

const OUTSIDE_MARGIN = 0.5; // comfortably above KDP's 0.25" minimum
const TOP_MARGIN = 0.75;
const BOTTOM_MARGIN = 0.75;
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.45, 0.45, 0.45);

interface Layout {
  doc: PDFDocument;
  width: number;
  height: number;
  inside: number;
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

/**
 * Render a KDP no-bleed interior: title page, puzzles, solutions, then filler
 * pages (lined for journals) up to the project's page count.
 */
export async function renderInterior(input: InteriorInput): Promise<Uint8Array> {
  const trim = TRIM_SIZES[input.trimSize] ?? TRIM_SIZES['6x9'];
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setCreator('Bookbot');

  const layout: Layout = {
    doc,
    width: inches(trim.width),
    height: inches(trim.height),
    inside: inches(getMinimumInsideMargin(input.pageCount)),
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.CourierBold),
  };

  drawTitlePage(layout, input);
  addPage(layout); // blank verso so content starts on a right-hand page

  input.puzzles.forEach((puzzle, i) => drawWordSearch(layout, puzzle, `Puzzle ${i + 1}`, false));
  input.puzzles.forEach((puzzle, i) => drawWordSearch(layout, puzzle, `Solution ${i + 1}`, true));

  // Fill to the project's page count, and always to an even number of pages
  const target = Math.max(input.pageCount, doc.getPageCount());
  while (doc.getPageCount() < target || doc.getPageCount() % 2 !== 0) {
    const page = addPage(layout);
    if (input.projectType === 'journal') drawLines(layout, page);
  }

  // Page numbers on everything after the title spread
  doc.getPages().forEach((page, index) => {
    if (index < 2) return;
    const label = String(index + 1);
    const size = 9;
    page.drawText(label, {
      x: (layout.width - layout.regular.widthOfTextAtSize(label, size)) / 2,
      y: inches(BOTTOM_MARGIN) / 2,
      size,
      font: layout.regular,
      color: GREY,
    });
  });

  return doc.save();
}

function addPage(layout: Layout): PDFPage {
  return layout.doc.addPage([layout.width, layout.height]);
}

/** Content box for a page; the gutter is on the left of odd (right-hand) pages */
function contentBox(layout: Layout, pageIndex: number) {
  const isRightHand = pageIndex % 2 === 0;
  const left = isRightHand ? layout.inside : inches(OUTSIDE_MARGIN);
  const right = isRightHand ? inches(OUTSIDE_MARGIN) : layout.inside;
  return {
    x: left,
    width: layout.width - left - right,
    top: layout.height - inches(TOP_MARGIN),
    bottom: inches(BOTTOM_MARGIN),
  };
}

function drawCentered(page: PDFPage, layout: Layout, text: string, y: number, font: PDFFont, maxSize: number, box: { x: number; width: number }) {
  const safe = safeText(font, text);
  const size = fitFontSize(font, safe, maxSize, box.width);
  page.drawText(safe, { x: box.x + (box.width - font.widthOfTextAtSize(safe, size)) / 2, y, size, font, color: BLACK });
}

function drawTitlePage(layout: Layout, input: InteriorInput) {
  const page = addPage(layout);
  const box = contentBox(layout, 0);
  const middle = layout.height * 0.6;
  drawCentered(page, layout, input.title, middle, layout.bold, 28, box);
  if (input.subtitle) {
    drawCentered(page, layout, input.subtitle, middle - 32, layout.regular, 14, box);
  }
}

function drawWordSearch(layout: Layout, puzzle: WordSearchContent, heading: string, showSolution: boolean) {
  const pageIndex = layout.doc.getPageCount();
  const page = addPage(layout);
  const box = contentBox(layout, pageIndex);
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  if (!rows || !cols) return;

  drawCentered(page, layout, heading, box.top - 18, layout.bold, 18, box);

  // Square cells sized to fit the width and leave room for the word list
  const cell = Math.min(box.width / cols, (box.top - box.bottom - 40 - 90) / rows);
  const gridWidth = cell * cols;
  const gridLeft = box.x + (box.width - gridWidth) / 2;
  const gridTop = box.top - 40;
  const letterSize = cell * 0.55;
  const cellCenter = (r: number, c: number) => ({
    x: gridLeft + c * cell + cell / 2,
    y: gridTop - r * cell - cell / 2,
  });

  if (showSolution) {
    for (const { start, end } of puzzle.solution) {
      const a = cellCenter(start[0], start[1]);
      const b = cellCenter(end[0], end[1]);
      page.drawLine({ start: a, end: b, thickness: cell * 0.7, color: rgb(0.85, 0.85, 0.85), lineCap: 1 });
    }
  }

  puzzle.grid.forEach((row, r) =>
    row.forEach((letter, c) => {
      const ch = safeText(layout.mono, letter.toUpperCase());
      const { x, y } = cellCenter(r, c);
      page.drawText(ch, {
        x: x - layout.mono.widthOfTextAtSize(ch, letterSize) / 2,
        y: y - letterSize * 0.35,
        size: letterSize,
        font: layout.mono,
        color: BLACK,
      });
    })
  );

  if (showSolution) return;

  // Word list in up to three columns under the grid
  const words = puzzle.solution.map((s) => s.word.toUpperCase()).sort();
  const columns = 3;
  const colWidth = box.width / columns;
  const listTop = gridTop - rows * cell - 24;
  const perColumn = Math.ceil(words.length / columns);
  words.forEach((word, i) => {
    const text = safeText(layout.regular, word);
    const size = fitFontSize(layout.regular, text, 10, colWidth - 6);
    page.drawText(text, {
      x: box.x + Math.floor(i / perColumn) * colWidth,
      y: listTop - (i % perColumn) * 14,
      size,
      font: layout.regular,
      color: BLACK,
    });
  });
}

function drawLines(layout: Layout, page: PDFPage) {
  const box = contentBox(layout, layout.doc.getPageCount() - 1);
  for (let y = box.top - 24; y > box.bottom; y -= 24) {
    page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  }
}
