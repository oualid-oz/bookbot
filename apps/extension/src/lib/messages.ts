import type { Marketplace } from './parse';

/** Messages from the content script and popup to the background worker */
export type Request =
  | {
      type: 'estimate';
      payload: { asin?: string; bsr: number; category: string; marketplace: Marketplace; price?: number; reviews?: number };
    }
  | { type: 'whoami' };

export type Response<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export interface Estimate {
  estimatedDailySales: number;
  estimatedMonthlySales: number;
}

export const API_URL = (import.meta.env.WXT_API_URL as string | undefined) ?? 'http://localhost:3000';
