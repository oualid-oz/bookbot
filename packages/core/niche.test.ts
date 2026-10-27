import { describe, it, expect } from 'vitest';
import {
  calculateNicheScore,
  getScoreRating,
  calculateMetricsFromResults,
  DEFAULT_WEIGHTS,
} from './niche';

describe('Niche Scoring', () => {
  describe('calculateNicheScore', () => {
    it('should calculate score with default weights', () => {
      const metrics = {
        keywordVolume: 5000,
        avgSales: 50,
        avgReviews: 100,
        avgBSR: 50000,
        avgPrice: 12,
      };
      const score = calculateNicheScore(metrics);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher score for high demand', () => {
      const highDemand = {
        keywordVolume: 8000,
        avgSales: 80,
        avgReviews: 100,
        avgBSR: 50000,
        avgPrice: 12,
      };
      const lowDemand = {
        keywordVolume: 1000,
        avgSales: 10,
        avgReviews: 100,
        avgBSR: 50000,
        avgPrice: 12,
      };
      expect(calculateNicheScore(highDemand)).toBeGreaterThan(
        calculateNicheScore(lowDemand)
      );
    });

    it('should give higher score for low competition', () => {
      const lowCompetition = {
        keywordVolume: 5000,
        avgSales: 50,
        avgReviews: 50,
        avgBSR: 80000,
        avgPrice: 12,
      };
      const highCompetition = {
        keywordVolume: 5000,
        avgSales: 50,
        avgReviews: 400,
        avgBSR: 10000,
        avgPrice: 12,
      };
      expect(calculateNicheScore(lowCompetition)).toBeGreaterThan(
        calculateNicheScore(highCompetition)
      );
    });

    it('should respect custom weights', () => {
      const metrics = {
        keywordVolume: 5000,
        avgSales: 50,
        avgReviews: 100,
        avgBSR: 50000,
        avgPrice: 12,
      };
      const demandWeighted = calculateNicheScore(metrics, {
        demand: 0.8,
        competition: 0.1,
        price: 0.1,
      });
      const balanced = calculateNicheScore(metrics, DEFAULT_WEIGHTS);
      expect(demandWeighted).not.toBe(balanced);
    });
  });

  describe('getScoreRating', () => {
    it('should return Excellent for high scores', () => {
      expect(getScoreRating(90)).toBe('Excellent');
      expect(getScoreRating(80)).toBe('Excellent');
    });

    it('should return Good for medium-high scores', () => {
      expect(getScoreRating(70)).toBe('Good');
      expect(getScoreRating(60)).toBe('Good');
    });

    it('should return Fair for medium scores', () => {
      expect(getScoreRating(50)).toBe('Fair');
      expect(getScoreRating(40)).toBe('Fair');
    });

    it('should return Poor for low scores', () => {
      expect(getScoreRating(30)).toBe('Poor');
      expect(getScoreRating(20)).toBe('Poor');
    });

    it('should return Very Poor for very low scores', () => {
      expect(getScoreRating(10)).toBe('Very Poor');
      expect(getScoreRating(0)).toBe('Very Poor');
    });
  });

  describe('calculateMetricsFromResults', () => {
    it('should calculate averages from results', () => {
      const results = [
        { sales: 100, reviews: 200, bsr: 10000, price: 10 },
        { sales: 200, reviews: 300, bsr: 20000, price: 15 },
      ];
      const metrics = calculateMetricsFromResults(results);
      expect(metrics.avgSales).toBe(150);
      expect(metrics.avgReviews).toBe(250);
      expect(metrics.avgBSR).toBe(15000);
      expect(metrics.avgPrice).toBe(12.5);
    });

    it('should return zeros for empty results', () => {
      const metrics = calculateMetricsFromResults([]);
      expect(metrics.avgSales).toBe(0);
      expect(metrics.avgReviews).toBe(0);
      expect(metrics.avgBSR).toBe(0);
      expect(metrics.avgPrice).toBe(0);
    });
  });
});
