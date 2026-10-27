import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCachedKeyword, cacheKeyword } from '@/lib/keywords';
import { checkEntitlement, incrementUsage } from '@/lib/entitlements';
import { calculateNicheScore, getScoreRating } from '@bookbot/core';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { keyword, marketplace = 'US', orgId } = body;

  if (!keyword || !orgId) {
    return NextResponse.json({ error: 'Missing keyword or orgId' }, { status: 400 });
  }

  // Check entitlement
  const entitlement = await checkEntitlement(orgId, 'keywordLookupsPerDay');
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: 'Keyword lookup limit exceeded', limit: entitlement.limit, used: entitlement.used },
      { status: 429 }
    );
  }

  // Check cache
  const cached = await getCachedKeyword(orgId, keyword, marketplace);
  if (cached) {
    return NextResponse.json({
      keyword,
      marketplace,
      volume: cached.volume,
      competition: cached.competition,
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
