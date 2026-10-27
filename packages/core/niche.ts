/**
 * Niche Scoring Algorithm
 * 
 * Score = weighted blend of:
 * - Demand (search volume, estimated sales)
 * - Competition (review counts, BSR of top results)
 * - Price (average price of top results)
 */

export interface NicheMetrics {
  keywordVolume: number;
  avgSales: number;
  avgReviews: number;
  avgBSR: number;
  avgPrice: number;
}

export interface NicheScoreWeights {
  demand: number;
  competition: number;
  price: number;
}

export const DEFAULT_WEIGHTS: NicheScoreWeights = {
  demand: 0.5,
  competition: 0.3,
  price: 0.2,
};

/**
 * Calculate niche score (0-100)
 */
export function calculateNicheScore(
  metrics: NicheMetrics,
  weights: NicheScoreWeights = DEFAULT_WEIGHTS
): number {
  // Normalize each factor to 0-1 range
  
  // Demand: higher volume and sales is better
  const demandScore = normalizeDemand(metrics.keywordVolume, metrics.avgSales);
  
  // Competition: lower reviews and higher BSR (less competitive) is better
  const competitionScore = normalizeCompetition(metrics.avgReviews, metrics.avgBSR);
  
  // Price: moderate price range is typically better
  const priceScore = normalizePrice(metrics.avgPrice);
  
  // Weighted sum
  const score = 
    demandScore * weights.demand +
    competitionScore * weights.competition +
    priceScore * weights.price;
  
  return Math.round(score * 100);
}

/**
 * Normalize demand metrics (0-1)
 */
function normalizeDemand(volume: number, avgSales: number): number {
  // Volume: 0-10000 scale
  const volumeScore = Math.min(volume / 10000, 1);
  
  // Sales: 0-100 daily sales scale
  const salesScore = Math.min(avgSales / 100, 1);
  
  // Average both
  return (volumeScore + salesScore) / 2;
}

/**
 * Normalize competition metrics (0-1)
 * Lower competition = higher score
 */
function normalizeCompetition(avgReviews: number, avgBSR: number): number {
  // Reviews: fewer reviews is better (0-500 scale)
  const reviewScore = 1 - Math.min(avgReviews / 500, 1);
  
  // BSR: higher BSR (worse rank) is less competitive (0-100000 scale)
  const bsrScore = Math.min(avgBSR / 100000, 1);
  
  // Average both
  return (reviewScore + bsrScore) / 2;
}

/**
 * Normalize price (0-1)
 * Moderate prices ($5-$20) score highest
 */
function normalizePrice(avgPrice: number): number {
  if (avgPrice < 5) return avgPrice / 5; // Low prices
  if (avgPrice > 20) return Math.max(0, 1 - (avgPrice - 20) / 30); // High prices
  return 1; // Sweet spot
}

/**
 * Get score rating label
 */
export function getScoreRating(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Very Poor';
}

/**
 * Calculate metrics from top results
 */
export function calculateMetricsFromResults(results: any[]): NicheMetrics {
  if (results.length === 0) {
    return {
      keywordVolume: 0,
      avgSales: 0,
      avgReviews: 0,
      avgBSR: 0,
      avgPrice: 0,
    };
  }

  const totalSales = results.reduce((sum, r) => sum + (r.sales || 0), 0);
  const totalReviews = results.reduce((sum, r) => sum + (r.reviews || 0), 0);
  const totalBSR = results.reduce((sum, r) => sum + (r.bsr || 0), 0);
  const totalPrice = results.reduce((sum, r) => sum + (r.price || 0), 0);

  return {
    keywordVolume: results[0].keywordVolume || 0,
    avgSales: totalSales / results.length,
    avgReviews: totalReviews / results.length,
    avgBSR: totalBSR / results.length,
    avgPrice: totalPrice / results.length,
  };
}
