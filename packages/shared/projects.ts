import { z } from 'zod';
import { BACKGROUND_INTENSITIES, BACKGROUND_PATTERNS, BORDER_STYLES, TRIM_SIZES } from '@bookbot/core';
import { BODY_FONT_IDS, FONT_IDS } from '@bookbot/fonts';

export const PROJECT_TYPES = ['book', 'puzzle_book', 'journal'] as const;
export const PAPER_TYPES = ['white', 'cream', 'color'] as const;

/** KDP paperback page count limits */
export const MIN_PAGE_COUNT = 24;
export const MAX_PAGE_COUNT = 828;

const trimSizeSchema = z.string().refine((value) => value in TRIM_SIZES, 'Unsupported trim size');

export const projectCreateSchema = z.object({
  orgId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Title is required').max(255),
  subtitle: z.string().trim().max(255).optional(),
  type: z.enum(PROJECT_TYPES),
  trimSize: trimSizeSchema,
  pageCount: z.number().int().min(MIN_PAGE_COUNT).max(MAX_PAGE_COUNT),
  paper: z.enum(PAPER_TYPES).default('white'),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.omit({ orgId: true, type: true }).partial();

export const PUZZLE_TYPES = ['word_search', 'sudoku', 'maze', 'crossword'] as const;
export type PuzzleType = (typeof PUZZLE_TYPES)[number];

export const SUDOKU_LEVELS = ['easy', 'medium', 'hard'] as const;

/** Grid sizes are capped so a puzzle still fits on the smallest trim size */
const wordSearchSchema = z.object({
  type: z.literal('word_search'),
  words: z.array(z.string().max(30)).min(1, 'Add at least one word').max(40),
  width: z.number().int().min(6).max(20).default(12),
  height: z.number().int().min(6).max(20).default(12),
});

/** Many word searches from a built-in theme; stored as word_search puzzles */
const themedWordSearchSchema = z.object({
  type: z.literal('word_search_theme'),
  theme: z.string().max(50),
  size: z.number().int().min(10).max(20).default(15),
  count: z.number().int().min(1).max(50).default(10),
});

const crosswordSchema = z.object({
  type: z.literal('crossword'),
  entries: z
    .array(z.object({ answer: z.string().trim().min(2).max(17), clue: z.string().trim().min(1, 'Every word needs a clue').max(150) }))
    .min(4, 'Add at least 4 words')
    .max(40, 'Use at most 40 words'),
});

const sudokuSchema = z.object({
  type: z.literal('sudoku'),
  difficulty: z.enum(SUDOKU_LEVELS).default('medium'),
  /** Several puzzles at once, since sudoku books hold dozens */
  count: z.number().int().min(1).max(50).default(1),
});

const mazeSchema = z.object({
  type: z.literal('maze'),
  width: z.number().int().min(5).max(40).default(15),
  height: z.number().int().min(5).max(50).default(20),
  count: z.number().int().min(1).max(50).default(1),
});

export const puzzleCreateSchema = z.preprocess(
  // Requests without a type are word searches (the original API)
  (value) => (value && typeof value === 'object' && !('type' in value) ? { ...value, type: 'word_search' } : value),
  z.discriminatedUnion('type', [wordSearchSchema, themedWordSearchSchema, crosswordSchema, sudokuSchema, mazeSchema])
);

export type PuzzleCreateInput = z.infer<typeof puzzleCreateSchema>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb color');

export const coverDesignSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().max(200).default(''),
  subtitle: z.string().max(300).default(''),
  author: z.string().max(200).default(''),
  backText: z.string().max(1500).default(''),
  backgroundColor: hexColor.default('#1e3a5f'),
  spineColor: hexColor.default('#15294a'),
  textColor: hexColor.default('#ffffff'),
  titleSize: z.number().min(16).max(72).default(40),
  /** Optional background images (asset IDs), cropped to fill their panel */
  frontImageId: z.string().uuid().nullable().default(null),
  backImageId: z.string().uuid().nullable().default(null),
});

export type CoverDesign = z.infer<typeof coverDesignSchema>;

/** Pages that fill a book after its puzzles (all of a journal) */
export const PAGE_TEMPLATES = ['blank', 'lined', 'dotted', 'grid', 'gratitude', 'daily_planner'] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

/** How the interior PDF is laid out, saved per project */
export const interiorSettingsSchema = z.object({
  version: z.literal(1).default(1),
  /** Solutions at the back of the book, or none */
  solutions: z.enum(['back', 'none']).default('back'),
  /** A rules page before the first puzzle of each type */
  howToPlay: z.boolean().default(true),
  /** Open with a page showing the title and subtitle (and a blank page behind it) */
  titlePage: z.boolean().default(true),
  /** Bigger text and bolder lines, for readers with low vision */
  largePrint: z.boolean().default(false),
  /** Unset: lined for journals, blank otherwise */
  pageTemplate: z.enum(PAGE_TEMPLATES).optional(),
  lineSpacing: z.enum(['college', 'wide']).default('wide'),
  /** Fonts and colors of the text */
  typography: z
    .object({
      /** Title page and page headings */
      headingFont: z.enum(FONT_IDS).default('helvetica'),
      bodyFont: z.enum(FONT_IDS).refine((id) => BODY_FONT_IDS.includes(id), 'Pick a font made for longer text').default('helvetica'),
      /** Letters in word search and crossword grids */
      puzzleFont: z.enum(FONT_IDS).refine((id) => BODY_FONT_IDS.includes(id), 'Pick a font made for longer text').default('courier'),
      headingColor: hexColor.default('#000000'),
      textColor: hexColor.default('#000000'),
    })
    .default({}),
  /** Border, background pattern and image on every page with content */
  decor: z
    .object({
      border: z.enum(BORDER_STYLES).default('none'),
      borderColor: hexColor.default('#333333'),
      background: z.enum(BACKGROUND_PATTERNS).default('none'),
      backgroundColor: hexColor.default('#888888'),
      intensity: z.enum(BACKGROUND_INTENSITIES).default('light'),
      /** An uploaded PNG/JPEG: a full-page frame, or a faded picture behind the content */
      imageId: z.string().uuid().nullable().default(null),
      imageMode: z.enum(['frame', 'watermark']).default('frame'),
      imageOpacity: z.number().min(0.05).max(1).default(0.2),
      /** Room between a border or frame image and the page content */
      framePadding: z.enum(['small', 'medium', 'large']).default('small'),
    })
    .default({}),
});

export type InteriorSettings = z.infer<typeof interiorSettingsSchema>;

export function resolvePageTemplate(settings: InteriorSettings, projectType: (typeof PROJECT_TYPES)[number]): PageTemplate {
  return settings.pageTemplate ?? (projectType === 'journal' ? 'lined' : 'blank');
}

/**
 * A listing as saved. Limits are loose so drafts always save; checkListing
 * (in @bookbot/core) reports what KDP would reject.
 */
export const listingUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  subtitle: z.string().trim().max(255).default(''),
  author: z.string().trim().max(255).default(''),
  description: z.string().max(10_000).default(''),
  keywords: z.array(z.string().trim().max(100)).max(7).default([]),
  categories: z.array(z.string().trim().max(200)).max(3).default([]),
});

export type ListingUpdate = z.infer<typeof listingUpdateSchema>;
