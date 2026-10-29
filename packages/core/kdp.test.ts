import { describe, it, expect } from 'vitest';
import {
  calculateSpineWidth,
  calculateCoverDimensions,
  calculateInteriorDimensions,
  getMinimumInsideMargin,
  canHaveSpineText,
} from './kdp';

describe('KDP Calculators', () => {
  describe('calculateSpineWidth', () => {
    it('should calculate spine width for white paper', () => {
      const spine = calculateSpineWidth(100, 'white');
      expect(spine).toBeCloseTo(0.22, 2);
    });

    it('should calculate spine width for cream paper', () => {
      const spine = calculateSpineWidth(100, 'cream');
      expect(spine).toBeCloseTo(0.25, 2);
    });

    it('should return thicker spine for more pages', () => {
      const spine100 = calculateSpineWidth(100, 'white');
      const spine200 = calculateSpineWidth(200, 'white');
      expect(spine200).toBeGreaterThan(spine100);
    });
  });

  describe('calculateCoverDimensions', () => {
    it('should calculate cover dimensions', () => {
      const dims = calculateCoverDimensions('6x9', 100, 'white');
      expect(dims.width).toBe(6);
      expect(dims.height).toBe(9);
      expect(dims.spineWidth).toBeCloseTo(0.22, 2);
      expect(dims.bleed).toBe(0.125);
      // 0.125 bleed + 6 back + 0.22 spine + 6 front + 0.125 bleed
      expect(dims.totalWidth).toBeCloseTo(12.47, 2);
      expect(dims.totalHeight).toBe(9.25);
    });

    it('should handle unknown trim size', () => {
      const dims = calculateCoverDimensions('unknown', 100, 'white');
      expect(dims.width).toBe(6); // defaults to 6x9
    });
  });

  describe('calculateInteriorDimensions', () => {
    it('should calculate interior dimensions with bleed', () => {
      const dims = calculateInteriorDimensions('6x9');
      expect(dims.width).toBe(6);
      expect(dims.height).toBe(9);
      expect(dims.bleed).toBe(0.125);
      expect(dims.totalWidth).toBe(6.25);
      expect(dims.totalHeight).toBe(9.25);
    });
  });

  describe('getMinimumInsideMargin', () => {
    it('should grow with page count', () => {
      expect(getMinimumInsideMargin(24)).toBe(0.375);
      expect(getMinimumInsideMargin(150)).toBe(0.375);
      expect(getMinimumInsideMargin(151)).toBe(0.5);
      expect(getMinimumInsideMargin(500)).toBe(0.625);
      expect(getMinimumInsideMargin(828)).toBe(0.875);
    });
  });

  describe('canHaveSpineText', () => {
    it('should require more than 79 pages', () => {
      expect(canHaveSpineText(79)).toBe(false);
      expect(canHaveSpineText(80)).toBe(true);
    });
  });
});
