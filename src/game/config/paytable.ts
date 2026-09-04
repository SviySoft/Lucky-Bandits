import type { SymbolId } from '../types';

/**
 * Payouts expressed as a multiple of the LINE BET (total bet / 20).
 * Index 0 => 3 of a kind, index 1 => 4 of a kind, index 2 => 5 of a kind.
 */
export type PayRow = [number, number, number];

export const PAYTABLE: Partial<Record<SymbolId, PayRow>> = {
  BOSS: [200, 1000, 1500],
  HACKER: [75, 300, 1000],
  DRIVER: [60, 225, 750],
  LADY: [30, 150, 600],
  DIAMOND: [30, 120, 450],
  CASH: [25, 75, 300],
  WATCH: [20, 60, 225],
  CHIPS: [15, 45, 180],
  A: [5, 20, 60],
  K: [4, 15, 45],
  Q: [3, 12, 40],
  J: [3, 12, 35],
  TEN: [2.5, 10, 30],
};

/**
 * Scatter pays are a multiple of the TOTAL BET (scatter pays any position).
 * Index 0 => 3 scatters, 1 => 4, 2 => 5.
 */
export const SCATTER_PAYS: PayRow = [0.5, 2, 5];
