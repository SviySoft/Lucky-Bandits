import type { SymbolId } from '../types';
import { PAYTABLE, SCATTER_PAYS, type PayRow } from './paytable';
import { PAYLINES } from './paylines';
import { BASE_REELS, FREE_REELS } from './reels';

export interface WeightedMultiplier {
  multiplier: number;
  weight: number;
}

export interface Timings {
  reelSpinUp: number;
  reelSpinMin: number;
  reelStopStagger: number;
  reelBounce: number;
  anticipationExtra: number;
  winCycle: number;
  countUp: number;
  bigWinIntro: number;
}

export interface JackpotTier {
  id: string;
  label: string;
  /** demo value — a real deployment feeds these from the jackpot service */
  value: number;
  color: string;
}

export interface GameConfig {
  id: string;
  name: string;
  version: string;
  reels: number;
  rows: number;
  lines: number;
  currency: string;
  betLevels: number[];
  defaultBetIndex: number;
  startingBalance: number;
  paytable: Partial<Record<SymbolId, PayRow>>;
  scatterPays: PayRow;
  paylines: number[][];
  reelSets: { BASE: SymbolId[][]; FREE: SymbolId[][] };
  wild: {
    symbol: SymbolId;
    /** 0-based reel indexes a wild may land on */
    reels: number[];
    /** wild multiplier distribution in the base game */
    baseMultipliers: WeightedMultiplier[];
    /** wild multiplier distribution during free spins */
    freeMultipliers: WeightedMultiplier[];
    /** how several wilds inside one combination combine */
    combine: 'MULTIPLY' | 'HIGHEST';
  };
  scatter: {
    symbol: SymbolId;
    minCount: number;
    /** scatter count -> free spins awarded */
    freeSpins: Record<number, number>;
    retrigger: boolean;
  };
  freeSpins: {
    stickyWilds: boolean;
    /** 0-based reels on which wilds stick for the rest of the bonus */
    stickyReels: number[];
  };
  bigWin: { big: number; mega: number; epic: number };
  jackpots: JackpotTier[];
  /** hard ceiling on a single round, expressed in total bets */
  maxWinMultiplier: number;
  timings: { normal: Timings; turbo: Timings };
  autoSpinOptions: number[];
}

export const GAME_CONFIG: GameConfig = {
  id: 'lucky-bandits',
  name: 'LUCKY BANDITS',
  version: '2.0.0',
  reels: 5,
  rows: 3,
  lines: 20,
  currency: '$',
  betLevels: [0.2, 0.4, 0.6, 1, 2, 5, 10, 20, 50, 100],
  defaultBetIndex: 3,
  startingBalance: 1000,
  paytable: PAYTABLE,
  scatterPays: SCATTER_PAYS,
  paylines: PAYLINES,
  reelSets: { BASE: BASE_REELS, FREE: FREE_REELS },
  wild: {
    symbol: 'WILD',
    reels: [1, 2, 3],
    baseMultipliers: [
      { multiplier: 1, weight: 57 },
      { multiplier: 2, weight: 26 },
      { multiplier: 3, weight: 17 },
    ],
    freeMultipliers: [
      { multiplier: 1, weight: 61 },
      { multiplier: 2, weight: 25 },
      { multiplier: 3, weight: 14 },
    ],
    combine: 'MULTIPLY',
  },
  scatter: {
    symbol: 'SCATTER',
    minCount: 3,
    freeSpins: { 3: 8, 4: 12, 5: 15 },
    retrigger: false,
  },
  freeSpins: {
    stickyWilds: true,
    stickyReels: [1, 2, 3],
  },
  bigWin: { big: 10, mega: 25, epic: 50 },
  // demo configuration — never hard-coded in the renderer (§16)
  jackpots: [
    { id: 'mega', label: 'MEGA', value: 25000, color: '#ff5ad1' },
    { id: 'major', label: 'MAJOR', value: 5000, color: '#4fa8ff' },
    { id: 'minor', label: 'MINOR', value: 1000, color: '#5ddb7a' },
    { id: 'mini', label: 'MINI', value: 500, color: '#ffd257' },
  ],
  maxWinMultiplier: 5000,
  timings: {
    normal: {
      reelSpinUp: 220,
      reelSpinMin: 700,
      reelStopStagger: 190,
      reelBounce: 240,
      anticipationExtra: 1150,
      winCycle: 1400,
      countUp: 900,
      bigWinIntro: 900,
    },
    turbo: {
      reelSpinUp: 90,
      reelSpinMin: 180,
      reelStopStagger: 55,
      reelBounce: 120,
      anticipationExtra: 320,
      winCycle: 550,
      countUp: 320,
      bigWinIntro: 400,
    },
  },
  autoSpinOptions: [10, 25, 50, 100, -1],
};

/** Money helper — all balances are kept in 2-decimal currency units. */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number, currency = GAME_CONFIG.currency): string {
  return `${currency}${money(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
