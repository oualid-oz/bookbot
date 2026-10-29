import { NextRequest, NextResponse } from 'next/server';
import { verifyExtensionToken } from '@/lib/tokens';
import { checkRateLimit } from '@/lib/rate-limit';
import { estimateSalesFromBSR, getBSRCurve } from '@bookbot/core';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const decoded = verifyExtensionToken(token);
  if (!decoded) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Rate limit: 100 requests per minute per org
  const rateLimit = await checkRateLimit(`ext:${decoded.orgId}`, 100, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetTime: rateLimit.resetTime },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }

  const body = await req.json();
  const { asin, bsr, price, reviews, category = 'Books', marketplace = 'US' } = body;

  if (!bsr) {
    return NextResponse.json({ error: 'Missing BSR' }, { status: 400 });
  }

  // Get BSR curve
  const curve = getBSRCurve(category, marketplace);
  if (!curve) {
    return NextResponse.json({ error: 'Category not supported' }, { status: 400 });
  }

  // Estimate sales
  const dailySales = estimateSalesFromBSR(bsr, curve.params);
  const monthlySales = dailySales * 30;

  return NextResponse.json({
    asin,
    bsr,
    price,
    reviews,
    category,
    marketplace,
    estimatedDailySales: Math.round(dailySales),
    estimatedMonthlySales: Math.round(monthlySales),
  }, {
    headers: {
      'X-RateLimit-Limit': rateLimit.limit.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimit.resetTime.toString(),
    }
  });
}
