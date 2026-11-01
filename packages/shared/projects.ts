import { z } from 'zod';
import { TRIM_SIZES } from '@bookbot/core';

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

export const PUZZLE_TYPES = ['word_search', 'sudoku', 'maze'] as const;
export type PuzzleType = (typeof PUZZLE_TYPES)[number];

export const SUDOKU_LEVELS = ['easy', 'medium', 'hard'] as const;

/** Grid sizes are capped so a puzzle still fits on the smallest trim size */
const wordSearchSchema = z.object({
  type: z.literal('word_search'),
  words: z.array(z.string().max(30)).min(1, 'Add at least one word').max(40),
  width: z.number().int().min(6).max(20).default(12),
  height: z.number().int().min(6).max(20).default(12),
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
  z.discriminatedUnion('type', [wordSearchSchema, sudokuSchema, mazeSchema])
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
