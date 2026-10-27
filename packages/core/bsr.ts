/**
 * BSR to Sales Estimator
 * 
 * Uses a power law model: sales = a * BSR^(-b)
 * Parameters (a, b) are fitted per category and marketplace
 */

export interface BSRParams {
  a: number;
  b: number;
}

export interface BSRCurve {
  category: string;
  marketplace: string;
  params: BSRParams;
}

/**
 * Estimate daily sales from BSR
 */
export function estimateSalesFromBSR(bsr: number, params: BSRParams): number {
  if (bsr <= 0) return 0;
  return params.a * Math.pow(bsr, -params.b);
}

/**
 * Default BSR curves for common categories
 * These are approximate and should be refined with real data
 */
export const DEFAULT_BSR_CURVES: BSRCurve[] = [
  {
    category: 'Books',
    marketplace: 'US',
    params: { a: 100000, b: 0.9 },
  },
  {
    category: 'Kindle Store',
    marketplace: 'US',
    params: { a: 150000, b: 0.85 },
  },
  {
    category: 'Books',
    marketplace: 'UK',
    params: { a: 50000, b: 0.9 },
  },
  {
    category: 'Books',
    marketplace: 'DE',
    params: { a: 40000, b: 0.9 },
  },
];

/**
 * Get BSR curve for category and marketplace
 */
export function getBSRCurve(
  category: string,
  marketplace: string,
  customCurves?: BSRCurve[]
): BSRCurve | null {
  const curves = customCurves || DEFAULT_BSR_CURVES;
  return (
    curves.find(
      (c) => c.category === category && c.marketplace === marketplace
    ) || null
  );
}

/**
 * Estimate monthly sales from BSR
 */
export function estimateMonthlySalesFromBSR(
  bsr: number,
  params: BSRParams
): number {
  const dailySales = estimateSalesFromBSR(bsr, params);
  return dailySales * 30;
}

/**
 * Get BSR from estimated sales (inverse function)
 */
export function estimateBSRFromSales(sales: number, params: BSRParams): number {
  if (sales <= 0) return Infinity;
  return Math.pow(params.a / sales, 1 / params.b);
}
