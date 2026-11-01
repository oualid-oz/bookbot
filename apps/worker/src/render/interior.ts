import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { TRIM_SIZES, getMinimumInsideMargin } from '@bookbot/core';
import { fitFontSize, inches, safeText } from './text';

export interface WordSearchContent {
  grid: string[][];
  solution: { word: string; start: [number, number]; end: [number, number] }[];
}

export interface SudokuContent {
  puzzle: number[][];
  solution: number[][];
  difficulty: string;
}

export interface MazeContent {
  width: number;
  height: number;
  walls: number[][];
  solution: [number, number][];
}

/** A stored puzzle, as saved in puzzle_sets */
export type PuzzleContent =
  | { type: 'word_search'; content: WordSearchContent }
  | { type: 'sudoku'; content: SudokuContent }
  | { type: 'maze'; content: MazeContent };

const PUZZLE_NAMES: Record<PuzzleContent['type'], string> = { word_search: 'Word Search', sudoku: 'Sudoku', maze: 'Maze' };

export interface InteriorInput {
  title: string;
  subtitle?: string | null;
  projectType: 'book' | 'puzzle_book' | 'journal';
  trimSize: string;
  pageCount: number;
  puzzles: PuzzleContent[];
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

  // Headings name the type only when the book mixes puzzle types
  const mixed = new Set(input.puzzles.map((p) => p.type)).size > 1;
  const heading = (puzzle: PuzzleContent, i: number, label: string) =>
    `${label} ${i + 1}${mixed ? ` · ${PUZZLE_NAMES[puzzle.type]}` : ''}`;
  input.puzzles.forEach((puzzle, i) => drawPuzzle(layout, puzzle, heading(puzzle, i, 'Puzzle'), false));
  input.puzzles.forEach((puzzle, i) => drawPuzzle(layout, puzzle, heading(puzzle, i, 'Solution'), true));

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

function drawPuzzle(layout: Layout, puzzle: PuzzleContent, heading: string, showSolution: boolean) {
  switch (puzzle.type) {
    case 'word_search':
      return drawWordSearch(layout, puzzle.content, heading, showSolution);
    case 'sudoku':
      return drawSudoku(layout, puzzle.content, heading, showSolution);
    case 'maze':
      return drawMaze(layout, puzzle.content, heading, showSolution);
  }
}

/** A new page with its heading; returns the page and the space under the heading */
function puzzlePage(layout: Layout, heading: string) {
  const pageIndex = layout.doc.getPageCount();
  const page = addPage(layout);
  const box = contentBox(layout, pageIndex);
  drawCentered(page, layout, heading, box.top - 18, layout.bold, 18, box);
  return { page, box: { ...box, top: box.top - 40 } };
}

function drawSudoku(layout: Layout, puzzle: SudokuContent, heading: string, showSolution: boolean) {
  const { page, box } = puzzlePage(layout, heading);
  const size = Math.min(box.width, box.top - box.bottom - 30);
  const cell = size / 9;
  const left = box.x + (box.width - size) / 2;
  const top = box.top;

  for (let i = 0; i <= 9; i++) {
    const thickness = i % 3 === 0 ? 2 : 0.5;
    page.drawLine({ start: { x: left, y: top - i * cell }, end: { x: left + size, y: top - i * cell }, thickness, color: BLACK });
    page.drawLine({ start: { x: left + i * cell, y: top }, end: { x: left + i * cell, y: top - size }, thickness, color: BLACK });
  }

  const digitSize = cell * 0.55;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const given = puzzle.puzzle[r][c];
      const value = given || (showSolution ? puzzle.solution[r][c] : 0);
      if (!value) continue;
      // Clues in bold; filled-in answers lighter so the clues stand out
      const font = given ? layout.bold : layout.regular;
      const text = String(value);
      page.drawText(text, {
        x: left + c * cell + (cell - font.widthOfTextAtSize(text, digitSize)) / 2,
        y: top - r * cell - cell / 2 - digitSize * 0.35,
        size: digitSize,
        font,
        color: given ? BLACK : GREY,
      });
    }
  }

  if (!showSolution) {
    const label = `Difficulty: ${puzzle.difficulty[0].toUpperCase()}${puzzle.difficulty.slice(1)}`;
    drawCentered(page, layout, label, top - size - 22, layout.regular, 10, box);
  }
}

// Same bits as @bookbot/puzzles WALL
const N = 1, E = 2, S = 4, W = 8;

function drawMaze(layout: Layout, maze: MazeContent, heading: string, showSolution: boolean) {
  const { page, box } = puzzlePage(layout, heading);
  const cell = Math.min(box.width / maze.width, (box.top - box.bottom - 30) / maze.height);
  const left = box.x + (box.width - cell * maze.width) / 2;
  const top = box.top - 12; // room for the "Start" label
  const corner = (r: number, c: number) => ({ x: left + c * cell, y: top - r * cell });
  const thickness = Math.max(0.75, Math.min(2, cell * 0.12));

  if (showSolution && maze.solution.length) {
    const center = ([r, c]: [number, number]) => ({ x: left + c * cell + cell / 2, y: top - r * cell - cell / 2 });
    const path = maze.solution;
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      page.drawLine({ start: a, end: b, thickness: Math.max(1, cell * 0.3), color: rgb(0.6, 0.6, 0.6), lineCap: 1 });
    line({ x: center(path[0]).x, y: top }, center(path[0]));
    for (let i = 1; i < path.length; i++) line(center(path[i - 1]), center(path[i]));
    const last = center(path[path.length - 1]);
    line(last, { x: last.x, y: top - maze.height * cell });
  }

  maze.walls.forEach((row, r) =>
    row.forEach((walls, c) => {
      const tl = corner(r, c), tr = corner(r, c + 1), bl = corner(r + 1, c), br = corner(r + 1, c + 1);
      const wall = (a: typeof tl, b: typeof tl) => page.drawLine({ start: a, end: b, thickness, color: BLACK, lineCap: 2 });
      // Neighbours share walls, so each cell draws its top and left; the last row and column close the border
      if (walls & N) wall(tl, tr);
      if (walls & W) wall(tl, bl);
      if (walls & S && r === maze.height - 1) wall(bl, br);
      if (walls & E && c === maze.width - 1) wall(tr, br);
    })
  );

  const labelSize = 9;
  const startX = left + cell / 2;
  const endX = left + (maze.width - 0.5) * cell;
  page.drawText('Start', { x: startX - layout.bold.widthOfTextAtSize('Start', labelSize) / 2, y: top + 4, size: labelSize, font: layout.bold, color: BLACK });
  page.drawText('Finish', {
    x: endX - layout.bold.widthOfTextAtSize('Finish', labelSize) / 2,
    y: top - maze.height * cell - labelSize - 4,
    size: labelSize,
    font: layout.bold,
    color: BLACK,
  });
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
