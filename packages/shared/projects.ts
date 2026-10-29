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

/** Grid sizes are capped so a puzzle still fits on the smallest trim size */
export const puzzleCreateSchema = z.object({
  words: z.array(z.string().max(30)).min(1, 'Add at least one word').max(40),
  width: z.number().int().min(6).max(20).default(12),
  height: z.number().int().min(6).max(20).default(12),
});

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
});

export type CoverDesign = z.infer<typeof coverDesignSchema>;
