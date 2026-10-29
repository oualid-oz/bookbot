import { NextRequest, NextResponse } from 'next/server';
import { keywordLookupSchema } from '@bookbot/shared';
import { getCachedKeyword, cacheKeyword } from '@/lib/keywords';
import { consumeUsage, releaseUsage } from '@/lib/entitlements';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

export async function POST(req: NextRequest) {
  const parsed = keywordLookupSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  const { keyword, marketplace } = parsed.data;

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;
  const { orgId } = access.value;

  // Cached results are free, even past the daily limit
  const cached = await getCachedKeyword(orgId, keyword, marketplace);
  if (cached) {
    return NextResponse.json({
      keyword,
      marketplace,
      volume: cached.volume,
      competition: Number(cached.competition),
      cached: true,
    });
  }

  const usage = await consumeUsage(orgId, 'keywordLookupsPerDay');
  if (!usage.allowed) {
    return errorResponse(429, 'Keyword lookup limit exceeded', {
      limit: usage.limit,
      used: usage.used,
      resetsAt: usage.resetsAt,
    });
  }

  let volume: number;
  let competition: number;
  try {
    // Simulate keyword research (in production, integrate with DataForSEO or similar)
    volume = Math.floor(Math.random() * 10000);
    competition = Math.random();

    await cacheKeyword(orgId, keyword, marketplace, { volume, competition });
  } catch (err) {
    // Don't charge for a lookup that failed
    await releaseUsage(orgId, 'keywordLookupsPerDay');
    throw err;
  }

  return NextResponse.json({
    keyword,
    marketplace,
    volume,
    competition,
    cached: false,
  });
}
