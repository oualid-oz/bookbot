import { NextRequest, NextResponse } from 'next/server';
import { nicheAnalysisSchema, nicheQuerySchema } from '@bookbot/shared';
import { saveNicheSnapshot, getNicheSnapshot } from '@/lib/keywords';
import { calculateNicheScore, getScoreRating, calculateMetricsFromResults } from '@bookbot/core';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

export async function POST(req: NextRequest) {
  const parsed = nicheAnalysisSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  const { keyword, marketplace, topResults } = parsed.data;

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;

  // Calculate metrics
  const metrics = calculateMetricsFromResults(topResults);

  // Calculate score
  const score = calculateNicheScore(metrics);
  const rating = getScoreRating(score);

  // Save snapshot
  await saveNicheSnapshot(access.value.orgId, keyword, marketplace, topResults, score);

  return NextResponse.json({
    keyword,
    marketplace,
    metrics,
    score,
    rating,
  });
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const parsed = nicheQuerySchema.safeParse({
    keyword: searchParams.get('keyword') ?? undefined,
    marketplace: searchParams.get('marketplace') ?? undefined,
    orgId: searchParams.get('orgId') ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;

  const snapshot = await getNicheSnapshot(access.value.orgId, parsed.data.keyword, parsed.data.marketplace);

  if (!snapshot) {
    return errorResponse(404, 'Snapshot not found');
  }

  return NextResponse.json(snapshot);
}
