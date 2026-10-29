import { NextRequest, NextResponse } from 'next/server';
import { keywordLookupSchema } from '@bookbot/shared';
import { getCachedKeyword, cacheKeyword } from '@/lib/keywords';
import { checkEntitlement, incrementUsage } from '@/lib/entitlements';
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

  // Check entitlement
  const entitlement = await checkEntitlement(orgId, 'keywordLookupsPerDay');
  if (!entitlement.allowed) {
    return errorResponse(429, 'Keyword lookup limit exceeded', { limit: entitlement.limit, used: entitlement.used });
  }

  // Check cache
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

  // Simulate keyword research (in production, integrate with DataForSEO or similar)
  const volume = Math.floor(Math.random() * 10000);
  const competition = Math.random();

  // Cache the result
  await cacheKeyword(orgId, keyword, marketplace, { volume, competition });

  // Increment usage
  await incrementUsage(orgId, 'keywordLookupsPerDay');

  return NextResponse.json({
    keyword,
    marketplace,
    volume,
    competition,
    cached: false,
  });
}
