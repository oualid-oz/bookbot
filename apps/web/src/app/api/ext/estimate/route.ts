import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { estimateSalesFromBSR, getBSRCurve } from '@bookbot/core';
import { marketplaceSchema } from '@bookbot/shared';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireExtensionToken } from '@/server/extension-tokens';
import { errorResponse, readJson } from '@/server/org-access';

const estimateSchema = z.object({
  asin: z.string().max(20).optional(),
  bsr: z.number().int().positive(),
  price: z.number().nonnegative().optional(),
  reviews: z.number().int().nonnegative().optional(),
  category: z.string().trim().min(1).max(100).default('Books'),
  marketplace: marketplaceSchema.default('US'),
});

export async function POST(req: NextRequest) {
  const auth = await requireExtensionToken(req);
  if (!auth.ok) return auth.response;

  // Rate limit: 100 requests per minute per org
  const rateLimit = await checkRateLimit(`ext:${auth.value.orgId}`, 100, 60000);
  const rateHeaders = {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': rateLimit.resetTime.toString(),
  };
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', resetTime: rateLimit.resetTime }, { status: 429, headers: rateHeaders });
  }

  const parsed = estimateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  const { asin, bsr, price, reviews, category, marketplace } = parsed.data;

  const curve = getBSRCurve(category, marketplace);
  if (!curve) {
    return errorResponse(400, `No sales model for ${category} in ${marketplace} yet`);
  }

  const dailySales = estimateSalesFromBSR(bsr, curve.params);
  return NextResponse.json(
    {
      asin,
      bsr,
      price,
      reviews,
      category,
      marketplace,
      estimatedDailySales: Math.round(dailySales),
      estimatedMonthlySales: Math.round(dailySales * 30),
    },
    { headers: rateHeaders }
  );
}
