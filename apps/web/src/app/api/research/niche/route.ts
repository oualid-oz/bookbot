import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveNicheSnapshot, getNicheSnapshot } from '@/lib/keywords';
import { calculateNicheScore, getScoreRating, calculateMetricsFromResults } from '@bookbot/core';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { keyword, marketplace = 'US', orgId, topResults } = body;

  if (!keyword || !orgId || !topResults) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Calculate metrics
  const metrics = calculateMetricsFromResults(topResults);

  // Calculate score
  const score = calculateNicheScore(metrics);
  const rating = getScoreRating(score);

  // Save snapshot
  await saveNicheSnapshot(orgId, keyword, marketplace, topResults, score);

  return NextResponse.json({
    keyword,
    marketplace,
    metrics,
    score,
    rating,
  });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const keyword = searchParams.get('keyword');
  const marketplace = searchParams.get('marketplace') || 'US';
  const orgId = searchParams.get('orgId');

  if (!keyword || !orgId) {
    return NextResponse.json({ error: 'Missing keyword or orgId' }, { status: 400 });
  }

  const snapshot = await getNicheSnapshot(orgId, keyword, marketplace);

  if (!snapshot) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
