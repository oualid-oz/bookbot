import { z } from 'zod';

export const MARKETPLACES = ['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'JP'] as const;
export const marketplaceSchema = z.enum(MARKETPLACES);

/** Optional org to act on; the server falls back to the user's default org */
const orgIdSchema = z.string().uuid().optional();

export const keywordLookupSchema = z.object({
  keyword: z.string().trim().min(1).max(255),
  marketplace: marketplaceSchema.default('US'),
  orgId: orgIdSchema,
});

const nicheResultSchema = z
  .object({
    asin: z.string().max(20).optional(),
    bsr: z.number().nonnegative().optional(),
    price: z.number().nonnegative().optional(),
    reviews: z.number().int().nonnegative().optional(),
    sales: z.number().nonnegative().optional(),
    keywordVolume: z.number().nonnegative().optional(),
  })
  .passthrough();

export const nicheAnalysisSchema = z.object({
  keyword: z.string().trim().min(1).max(255),
  marketplace: marketplaceSchema.default('US'),
  orgId: orgIdSchema,
  topResults: z.array(nicheResultSchema).max(100),
});

export const nicheQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(255),
  marketplace: marketplaceSchema.default('US'),
  orgId: orgIdSchema,
});

export const EXPORT_KINDS = ['interior', 'cover'] as const;

export const exportSpecSchema = z.object({
  kind: z.enum(EXPORT_KINDS).default('interior'),
});

export type ExportSpec = z.infer<typeof exportSpecSchema>;

export const exportRequestSchema = z.object({
  projectId: z.string().uuid(),
  orgId: orgIdSchema,
  spec: exportSpecSchema.default({}),
});

export const ASSET_KINDS = ['image', 'font', 'other'] as const;
export const assetKindSchema = z.enum(ASSET_KINDS);
