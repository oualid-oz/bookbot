import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { TRIM_SIZES, getMinimumInsideMargin } from '@bookbot/core';
import { interiorSettingsSchema, resolvePageTemplate, type InteriorSettings, type PageTemplate } from '@bookbot/shared';
import { wrapText } from './cover';
import { fitFontSize, inches, safeText } from './text';

export interface WordSearchContent {
  /** Topic of a themed puzzle, shown in its heading */
  title?: string;
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

export interface CrosswordContent {
  width: number;
  height: number;
  grid: (string | null)[][];
  entries: { number: number; direction: 'across' | 'down'; row: number; col: number; answer: string; clue: string }[];
}

/** A stored puzzle, as saved in puzzle_sets */
export type PuzzleContent =
  | { type: 'word_search'; content: WordSearchContent }
  | { type: 'sudoku'; content: SudokuContent }
  | { type: 'maze'; content: MazeContent }
  | { type: 'crossword'; content: CrosswordContent };

const PUZZLE_NAMES: Record<PuzzleContent['type'], string> = { word_search: 'Word Search', sudoku: 'Sudoku', maze: 'Maze', crossword: 'Crossword' };

export interface InteriorInput {
  title: string;
  subtitle?: string | null;
  projectType: 'book' | 'puzzle_book' | 'journal';
  trimSize: string;
  pageCount: number;
  puzzles: PuzzleContent[];
  settings?: Partial<InteriorSettings>;
}

const HOW_TO_PLAY: Record<PuzzleContent['type'], string[]> = {
  word_search: [
    'Find every word from the list hidden in the grid.',
    'Words run left to right, top to bottom, or diagonally, and they can share letters.',
    'Circle each word as you find it and cross it off the list.',
  ],
  sudoku: [
    'Fill every empty square with a number from 1 to 9.',
    'Each row, each column and each of the nine 3 × 3 boxes must contain every number from 1 to 9 exactly once.',
    'Every puzzle has exactly one solution, and you never need to guess.',
  ],
  maze: [
    'Draw a path from Start to Finish without crossing any walls.',
    'There is exactly one way through each maze.',
  ],
  crossword: [
    'Read each clue and write the answer in the squares, one letter per square.',
    'Across answers run left to right from their numbered square; Down answers run top to bottom.',
    'Where words cross they share a letter, so each answer you find helps with the others.',
  ],
};

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
  /** Text and line size multiplier (large print) */
  scale: number;
}

/**
 * Render a KDP no-bleed interior: title page, rules, puzzles, solutions, then
 * template pages (lined, dotted, planner, ...) up to the project's page count.
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
    scale: 1,
  };
  const settings = interiorSettingsSchema.parse(input.settings ?? {});
  if (settings.largePrint) layout.scale = 1.4;

  drawTitlePage(layout, input);
  addPage(layout); // blank verso so content starts on a right-hand page

  // Headings name the type only when the book mixes puzzle types
  const mixed = new Set(input.puzzles.map((p) => p.type)).size > 1;
  const heading = (puzzle: PuzzleContent, i: number, label: string) => {
    const name = puzzle.type === 'word_search' && puzzle.content.title ? puzzle.content.title : mixed ? PUZZLE_NAMES[puzzle.type] : '';
    return `${label} ${i + 1}${name ? ` · ${name}` : ''}`;
  };
  if (settings.howToPlay) {
    for (const type of new Set(input.puzzles.map((p) => p.type))) drawHowToPlay(layout, type);
  }
  input.puzzles.forEach((puzzle, i) => drawPuzzle(layout, puzzle, heading(puzzle, i, 'Puzzle'), false));
  if (settings.solutions === 'back' && input.puzzles.length) {
    drawSectionPage(layout, 'Solutions');
    input.puzzles.forEach((puzzle, i) => drawPuzzle(layout, puzzle, heading(puzzle, i, 'Solution'), true));
  }

  // Fill to the project's page count, and always to an even number of pages
  const template = resolvePageTemplate(settings, input.projectType);
  const target = Math.max(input.pageCount, doc.getPageCount());
  while (doc.getPageCount() < target || doc.getPageCount() % 2 !== 0) {
    const pageIndex = doc.getPageCount();
    drawTemplatePage(layout, addPage(layout), contentBox(layout, pageIndex), template, settings.lineSpacing);
  }

  // Page numbers on everything after the title spread
  doc.getPages().forEach((page, index) => {
    if (index < 2) return;
    const label = String(index + 1);
    const size = 9 * layout.scale;
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
    case 'crossword':
      return drawCrossword(layout, puzzle.content, heading, showSolution);
  }
}

/** A new page with its heading; returns the page and the space under the heading */
function puzzlePage(layout: Layout, heading: string) {
  const pageIndex = layout.doc.getPageCount();
  const page = addPage(layout);
  const box = contentBox(layout, pageIndex);
  drawCentered(page, layout, heading, box.top - 18 * layout.scale, layout.bold, 18 * layout.scale, box);
  return { page, box: { ...box, top: box.top - 40 * layout.scale } };
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

  const digitSize = cell * (layout.scale > 1 ? 0.65 : 0.55);
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
    drawCentered(page, layout, label, top - size - 22 * layout.scale, layout.regular, 10 * layout.scale, box);
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
  const thickness = Math.max(0.75, Math.min(2, cell * 0.12)) * layout.scale;

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

  const labelSize = 9 * layout.scale;
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
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const { page, box } = puzzlePage(layout, heading);
  if (!rows || !cols) return;

  // The word list goes under the grid; reserve its height on both pages so
  // the puzzle and its solution have the same grid
  const words = puzzle.solution.map((s) => s.word.toUpperCase()).sort();
  const columns = box.width > inches(5.5) ? 4 : 3;
  const perColumn = Math.ceil(words.length / columns);
  const lineHeight = 14 * layout.scale;
  const listHeight = 24 + perColumn * lineHeight;

  // Square cells sized to fit the width and leave room for the word list
  const cell = Math.min(box.width / cols, (box.top - box.bottom - listHeight) / rows);
  const gridLeft = box.x + (box.width - cell * cols) / 2;
  const gridTop = box.top;
  const letterSize = cell * (layout.scale > 1 ? 0.62 : 0.55);
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

  const colWidth = box.width / columns;
  const listTop = gridTop - rows * cell - 24;
  words.forEach((word, i) => {
    const text = safeText(layout.regular, word);
    const size = fitFontSize(layout.regular, text, 10 * layout.scale, colWidth - 6);
    page.drawText(text, {
      x: box.x + Math.floor(i / perColumn) * colWidth,
      y: listTop - (i % perColumn) * lineHeight,
      size,
      font: layout.regular,
      color: BLACK,
    });
  });
}

/** Wrapped paragraphs from `top` down; returns the y below the last line */
function drawParagraphs(page: PDFPage, layout: Layout, paragraphs: string[], box: { x: number; width: number }, top: number) {
  const size = 11 * layout.scale;
  const lineHeight = size * 1.45;
  let y = top;
  for (const paragraph of paragraphs) {
    for (const line of wrapText(layout.regular, safeText(layout.regular, paragraph), size, box.width)) {
      page.drawText(line, { x: box.x, y, size, font: layout.regular, color: BLACK });
      y -= lineHeight;
    }
    y -= lineHeight * 0.6;
  }
  return y;
}

function drawHowToPlay(layout: Layout, type: PuzzleContent['type']) {
  const { page, box } = puzzlePage(layout, `How to Play: ${PUZZLE_NAMES[type]}`);
  drawParagraphs(page, layout, HOW_TO_PLAY[type], box, box.top);
}

/** A page with a single centered title, e.g. before the solutions */
function drawSectionPage(layout: Layout, title: string) {
  const pageIndex = layout.doc.getPageCount();
  const page = addPage(layout);
  drawCentered(page, layout, title, layout.height * 0.55, layout.bold, 24 * layout.scale, contentBox(layout, pageIndex));
}

const LIGHT = rgb(0.7, 0.7, 0.7);

type Box = ReturnType<typeof contentBox>;

/** Ruled lines between two heights */
function drawRules(page: PDFPage, box: Pick<Box, 'x' | 'width'>, from: number, to: number, spacing: number) {
  for (let y = from - spacing; y >= to; y -= spacing) {
    page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 0.5, color: LIGHT });
  }
}

function drawLabel(page: PDFPage, layout: Layout, text: string, x: number, y: number) {
  page.drawText(text, { x, y, size: 11 * layout.scale, font: layout.bold, color: BLACK });
}

/** "Date: ______" across the top; returns the y below it */
function drawDateLine(page: PDFPage, layout: Layout, box: Box) {
  const y = box.top - 14 * layout.scale;
  drawLabel(page, layout, 'Date:', box.x, y);
  const lineStart = box.x + layout.bold.widthOfTextAtSize('Date:', 11 * layout.scale) + 6;
  page.drawLine({ start: { x: lineStart, y: y - 2 }, end: { x: box.x + box.width * 0.6, y: y - 2 }, thickness: 0.5, color: LIGHT });
  return y - 28 * layout.scale;
}

function drawCheckbox(page: PDFPage, x: number, y: number, size: number) {
  page.drawRectangle({ x, y, width: size, height: size, borderColor: GREY, borderWidth: 0.75 });
}

function drawTemplatePage(layout: Layout, page: PDFPage, box: Box, template: PageTemplate, lineSpacing: InteriorSettings['lineSpacing']) {
  // Wide ruled is 11/32", college ruled 9/32"
  const spacing = inches(lineSpacing === 'wide' ? 11 / 32 : 9 / 32) * Math.max(1, layout.scale * 0.85);
  const grid = inches(0.25);

  switch (template) {
    case 'blank':
      return;

    case 'lined':
      return drawRules(page, box, box.top, box.bottom, spacing);

    case 'dotted':
      for (let y = box.top; y >= box.bottom; y -= grid) {
        for (let x = box.x; x <= box.x + box.width + 0.01; x += grid) page.drawCircle({ x, y, size: 0.7, color: GREY });
      }
      return;

    case 'grid': {
      const cols = Math.floor(box.width / grid);
      const rows = Math.floor((box.top - box.bottom) / grid);
      const left = box.x + (box.width - cols * grid) / 2;
      for (let i = 0; i <= cols; i++) {
        page.drawLine({ start: { x: left + i * grid, y: box.top }, end: { x: left + i * grid, y: box.top - rows * grid }, thickness: 0.4, color: LIGHT });
      }
      for (let i = 0; i <= rows; i++) {
        page.drawLine({ start: { x: left, y: box.top - i * grid }, end: { x: left + cols * grid, y: box.top - i * grid }, thickness: 0.4, color: LIGHT });
      }
      return;
    }

    case 'gratitude': {
      let y = drawDateLine(page, layout, box);
      const section = (title: string, lines: number, numbered = false) => {
        drawLabel(page, layout, title, box.x, y);
        y -= 6;
        for (let i = 1; i <= lines; i++) {
          y -= spacing;
          if (numbered) page.drawText(`${i}.`, { x: box.x, y: y + 3, size: 10 * layout.scale, font: layout.regular, color: GREY });
          const indent = numbered ? 16 * layout.scale : 0;
          page.drawLine({ start: { x: box.x + indent, y }, end: { x: box.x + box.width, y }, thickness: 0.5, color: LIGHT });
        }
        y -= spacing * 1.2;
      };
      section('Today I am grateful for...', 3, true);
      section('What would make today great?', 3, true);
      section('Highlight of the day', 2);
      drawLabel(page, layout, 'Notes', box.x, y);
      drawRules(page, box, y - 6, box.bottom, spacing);
      return;
    }

    case 'daily_planner': {
      let y = drawDateLine(page, layout, box);
      const gap = 12;
      const left = { x: box.x, width: box.width * 0.55 - gap / 2 };
      const right = { x: box.x + box.width * 0.55 + gap / 2, width: box.width * 0.45 - gap / 2 };

      // Schedule: one line per hour, 6 am to 9 pm, as space allows
      drawLabel(page, layout, 'Schedule', left.x, y);
      const hours = Array.from({ length: 16 }, (_, i) => i + 6);
      const rowHeight = Math.max(spacing, (y - 6 - box.bottom) / hours.length);
      hours.forEach((hour, i) => {
        const rowY = y - 6 - (i + 1) * rowHeight;
        if (rowY < box.bottom) return;
        const label = `${((hour + 11) % 12) + 1}${hour < 12 ? 'am' : 'pm'}`;
        page.drawText(label, { x: left.x, y: rowY + 3, size: 8 * layout.scale, font: layout.regular, color: GREY });
        page.drawLine({ start: { x: left.x + 26 * layout.scale, y: rowY }, end: { x: left.x + left.width, y: rowY }, thickness: 0.5, color: LIGHT });
      });

      // Priorities and to-dos with checkboxes, notes below
      drawLabel(page, layout, 'Top priorities', right.x, y);
      const box3 = 8 * layout.scale;
      const checklist = (from: number, count: number) => {
        let rowY = from;
        for (let i = 0; i < count; i++) {
          rowY -= spacing;
          drawCheckbox(page, right.x, rowY, box3);
          page.drawLine({ start: { x: right.x + box3 + 4, y: rowY }, end: { x: right.x + right.width, y: rowY }, thickness: 0.5, color: LIGHT });
        }
        return rowY;
      };
      y = checklist(y - 6, 3) - spacing * 1.2;
      drawLabel(page, layout, 'To do', right.x, y);
      y = checklist(y - 6, 6) - spacing * 1.2;
      drawLabel(page, layout, 'Notes', right.x, y);
      drawRules(page, right, y - 6, box.bottom, spacing);
      return;
    }
  }
}

/** Clue text for each column at a font size, wrapped to the column width */
function clueColumns(layout: Layout, puzzle: CrosswordContent, size: number, columnWidth: number) {
  return (['across', 'down'] as const).map((direction) => {
    const lines: { text: string; heading?: boolean; label?: string; indent?: number }[] = [
      { text: direction === 'across' ? 'Across' : 'Down', heading: true },
    ];
    for (const e of puzzle.entries.filter((x) => x.direction === direction)) {
      // Clue text lines up after the widest number
      const indent = layout.bold.widthOfTextAtSize('00. ', size);
      const wrapped = wrapText(layout.regular, safeText(layout.regular, e.clue), size, columnWidth - indent);
      wrapped.forEach((text, i) => lines.push({ text, indent, label: i === 0 ? `${e.number}.` : undefined }));
    }
    return lines;
  });
}

function drawClueColumns(page: PDFPage, layout: Layout, columns: ReturnType<typeof clueColumns>, size: number, box: { x: number; width: number }, top: number, gap: number) {
  const lineHeight = size * 1.35;
  const columnWidth = (box.width - gap) / 2;
  columns.forEach((lines, col) => {
    const x = box.x + col * (columnWidth + gap);
    lines.forEach((line, i) => {
      const y = top - i * lineHeight;
      if (line.heading) {
        page.drawText(line.text, { x, y, size: size * 1.1, font: layout.bold, color: BLACK });
        return;
      }
      if (line.label) page.drawText(line.label, { x, y, size, font: layout.bold, color: BLACK });
      page.drawText(line.text, { x: x + (line.indent ?? 0), y, size, font: layout.regular, color: BLACK });
    });
  });
}

function drawCrossword(layout: Layout, puzzle: CrosswordContent, heading: string, showSolution: boolean) {
  const { page, box } = puzzlePage(layout, heading);
  if (!puzzle.width || !puzzle.height) return;

  // The grid takes at most 55% of the page height, the same on both pages
  const cell = Math.min(box.width / puzzle.width, ((box.top - box.bottom) * 0.55) / puzzle.height, inches(0.45));
  const left = box.x + (box.width - cell * puzzle.width) / 2;
  const top = box.top;
  const numberAt = new Map(puzzle.entries.map((e) => [`${e.row},${e.col}`, e.number]));
  const numberSize = Math.max(4, cell * 0.28);
  const letterSize = cell * 0.55;

  puzzle.grid.forEach((row, r) =>
    row.forEach((letter, c) => {
      if (!letter) return;
      const x = left + c * cell;
      const y = top - (r + 1) * cell;
      page.drawRectangle({ x, y, width: cell, height: cell, borderColor: BLACK, borderWidth: 0.75 * layout.scale });
      const number = numberAt.get(`${r},${c}`);
      if (number) page.drawText(String(number), { x: x + 1.5, y: y + cell - numberSize - 1, size: numberSize, font: layout.regular, color: BLACK });
      if (showSolution) {
        page.drawText(letter, { x: x + (cell - layout.bold.widthOfTextAtSize(letter, letterSize)) / 2, y: y + cell * 0.22, size: letterSize, font: layout.bold, color: BLACK });
      }
    })
  );

  if (showSolution) return;

  // Clues under the grid; shrink them to fit, or continue on the next page
  const gap = 14;
  const columnWidth = (box.width - gap) / 2;
  const fits = (space: number, size: number) => Math.max(...clueColumns(layout, puzzle, size, columnWidth).map((l) => l.length)) * size * 1.35 <= space;
  const below = top - puzzle.height * cell - 24 * layout.scale;
  const sizes = [10, 9, 8, 7].map((size) => size * layout.scale);
  const size = sizes.find((sz) => fits(below - box.bottom, sz));
  if (size) {
    drawClueColumns(page, layout, clueColumns(layout, puzzle, size, columnWidth), size, box, below, gap);
    return;
  }
  const next = puzzlePage(layout, `${heading} · Clues`);
  const nextSize = sizes.find((sz) => fits(next.box.top - next.box.bottom, sz)) ?? sizes[sizes.length - 1];
  drawClueColumns(next.page, layout, clueColumns(layout, puzzle, nextSize, columnWidth), nextSize, next.box, next.box.top, gap);
}
