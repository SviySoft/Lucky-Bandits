/**
 * LUCKY BANDITS — shared domain types.
 * Everything below is transport-safe (plain JSON) so the very same shapes can be
 * produced by a remote Casino RNG / Game Server without touching the client.
 */

export type SymbolId =
  | 'BOSS'
  | 'HACKER'
  | 'DRIVER'
  | 'LADY'
  | 'DIAMOND'
  | 'CASH'
  | 'WATCH'
  | 'CHIPS'
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | 'TEN'
  | 'WILD'
  | 'SCATTER';

export type SpinMode = 'BASE' | 'FREE';

/** grid[reel][row] — 5 reels x 3 rows */
export type Grid = SymbolId[][];

export interface Cell {
  reel: number;
  row: number;
}

export interface WildCell extends Cell {
  /** 1 = plain wild, 2 / 3 = multiplier wild */
  multiplier: number;
  sticky: boolean;
}

export interface LineWin {
  lineIndex: number;
  symbol: SymbolId;
  count: number;
  positions: Cell[];
  /** payout before wild multipliers, in currency */
  baseWin: number;
  /** product of every wild multiplier taking part in the combination */
  multiplier: number;
  /** baseWin * multiplier */
  win: number;
}

export interface ScatterResult {
  count: number;
  positions: Cell[];
  win: number;
  freeSpinsAwarded: number;
}

export interface SpinOutcome {
  mode: SpinMode;
  /** reel strip stop index for every reel */
  stops: number[];
  grid: Grid;
  /** wilds present on screen with their multipliers (incl. sticky ones) */
  wilds: WildCell[];
  lineWins: LineWin[];
  scatter: ScatterResult;
  lineWin: number;
  totalWin: number;
  /** anticipation flag per reel — drives the suspense animation */
  anticipation: boolean[];
}

export interface FreeSpinsState {
  active: boolean;
  spinsTotal: number;
  spinsUsed: number;
  totalWin: number;
  stickyWilds: WildCell[];
  triggerBet: number;
}

export type WinTier = 'NONE' | 'NORMAL' | 'BIG' | 'MEGA' | 'EPIC';

export interface SpinRecord {
  spinId: string;
  sessionId: string;
  timestamp: number;
  mode: SpinMode;
  bet: number;
  totalWin: number;
  balanceBefore: number;
  balanceAfter: number;
  freeSpin: boolean;
  freeSpinIndex?: number;
  multipliers: number[];
  scatterCount: number;
  tier: WinTier;
  outcome: SpinOutcome;
  transactionIds: string[];
}

export interface Transaction {
  id: string;
  type: 'DEBIT' | 'CREDIT' | 'ROLLBACK';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: number;
  reference: string;
}

export type GameStateName =
  | 'LOADING'
  | 'READY'
  | 'SPINNING'
  | 'EVALUATING'
  | 'WIN'
  | 'BONUS_TRIGGER'
  | 'FREE_SPINS'
  | 'BIG_WIN'
  | 'ERROR';

/** Development-only forcing hooks, stripped from production builds. */
export type ForceMode =
  | 'NONE'
  | 'SCATTER_3'
  | 'SCATTER_4'
  | 'SCATTER_5'
  | 'WILD'
  | 'BIG_WIN'
  | 'FREE_SPINS';
