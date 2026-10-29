import { describe, it, expect } from 'vitest';
import {
  estimateSalesFromBSR,
  estimateMonthlySalesFromBSR,
  estimateBSRFromSales,
  getBSRCurve,
} from './bsr';

describe('BSR Estimator', () => {
  describe('estimateSalesFromBSR', () => {
    it('should estimate sales for BSR 1000', () => {
      const params = { a: 100000, b: 0.9 };
      const sales = estimateSalesFromBSR(1000, params);
      expect(sales).toBeGreaterThan(0);
      expect(sales).toBeLessThan(1000);
    });

    it('should estimate higher sales for lower BSR', () => {
      const params = { a: 100000, b: 0.9 };
      const sales100 = estimateSalesFromBSR(100, params);
      const sales1000 = estimateSalesFromBSR(1000, params);
      expect(sales100).toBeGreaterThan(sales1000);
    });

    it('should return 0 for invalid BSR', () => {
      const params = { a: 100000, b: 0.9 };
      expect(estimateSalesFromBSR(0, params)).toBe(0);
      expect(estimateSalesFromBSR(-1, params)).toBe(0);
    });
  });

  describe('estimateMonthlySalesFromBSR', () => {
    it('should be 30x daily sales', () => {
      const params = { a: 100000, b: 0.9 };
      const daily = estimateSalesFromBSR(1000, params);
      const monthly = estimateMonthlySalesFromBSR(1000, params);
      expect(monthly).toBeCloseTo(daily * 30, 5);
    });
  });

  describe('estimateBSRFromSales', () => {
    it('should invert the sales estimation', () => {
      const params = { a: 100000, b: 0.9 };
      const bsr = 1000;
      const sales = estimateSalesFromBSR(bsr, params);
      const estimatedBSR = estimateBSRFromSales(sales, params);
      expect(estimatedBSR).toBeCloseTo(bsr, 0);
    });

    it('should return Infinity for zero sales', () => {
      const params = { a: 100000, b: 0.9 };
      expect(estimateBSRFromSales(0, params)).toBe(Infinity);
    });
  });

  describe('getBSRCurve', () => {
    it('should find default curve for US Books', () => {
      const curve = getBSRCurve('Books', 'US');
      expect(curve).not.toBeNull();
      expect(curve?.category).toBe('Books');
      expect(curve?.marketplace).toBe('US');
    });

    it('should return null for unknown category', () => {
      const curve = getBSRCurve('Unknown', 'US');
      expect(curve).toBeNull();
    });

    it('should use custom curves if provided', () => {
      const customCurve = {
        category: 'Custom',
        marketplace: 'US',
        params: { a: 200000, b: 0.8 },
      };
      const curve = getBSRCurve('Custom', 'US', [customCurve]);
      expect(curve).toEqual(customCurve);
    });
  });
});
