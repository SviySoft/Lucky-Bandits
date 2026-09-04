import type { ForceMode, Grid, SpinMode, SpinOutcome, SymbolId, WildCell } from '../types';
import type { GameConfig } from '../config/game-config';
import { money } from '../config/game-config';
import type { RandomSource } from './RNGEngine';
import { ReelEngine } from './ReelEngine';
import { WinEvaluator } from './WinEvaluator';

/**
 * QA forcing is a development-only affordance. `__DEV_FORCING__` is replaced by `false`
 * at production build time, so the branch below — and `applyForce` with it — is removed
 * from the shipped bundle. The `typeof` guard keeps this valid under plain Node, where
 * the simulator runs without a bundler.
 */
const FORCING_ENABLED = typeof __DEV_FORCING__ !== 'undefined' && __DEV_FORCING__;

export interface ResolveParams {
  mode: SpinMode;
  bet: number;
  rng: RandomSource;
  /** sticky wilds carried over from previous free spins */
  stickyWilds?: WildCell[];
  /** development only — forces a specific situation for QA */
  force?: ForceMode;
}

/**
 * Math Engine — the single authority that turns RNG into a fully resolved spin.
 * The renderer only ever *replays* what this produced, exactly like it would replay
 * a server response in production.
 */
export class MathEngine {
  readonly reels: ReelEngine;
  readonly evaluator: WinEvaluator;

  constructor(private readonly config: GameConfig) {
    this.reels = new ReelEngine(config);
    this.evaluator = new WinEvaluator(config);
  }

  resolve({ mode, bet, rng, stickyWilds = [], force = 'NONE' }: ResolveParams): SpinOutcome {
    const stops = this.reels.spinStops(rng, mode);
    const grid = this.reels.gridFromStops(stops, mode);

    if (FORCING_ENABLED && force !== 'NONE') applyForce(grid, force, rng, this.config);

    // Sticky wilds from earlier free spins are stamped back onto the grid.
    const stickyMap = new Map<string, WildCell>();
    for (const w of stickyWilds) {
      stickyMap.set(`${w.reel}:${w.row}`, w);
      grid[w.reel][w.row] = this.config.wild.symbol;
    }

    const wilds = this.collectWilds(grid, mode, rng, stickyMap);
    const evaluation = this.evaluator.evaluate(grid, wilds, bet);

    const cap = this.config.maxWinMultiplier * bet;
    const totalWin = money(Math.min(evaluation.totalWin, cap));

    return {
      mode,
      stops,
      grid,
      wilds,
      lineWins: evaluation.lineWins,
      scatter: evaluation.scatter,
      lineWin: evaluation.lineWin,
      totalWin,
      anticipation: this.anticipation(grid),
    };
  }

  private collectWilds(
    grid: Grid,
    mode: SpinMode,
    rng: RandomSource,
    sticky: Map<string, WildCell>,
  ): WildCell[] {
    const wildId = this.config.wild.symbol;
    const table = mode === 'FREE' ? this.config.wild.freeMultipliers : this.config.wild.baseMultipliers;
    const weights = table.map((t) => t.weight);
    const wilds: WildCell[] = [];

    for (let reel = 0; reel < this.config.reels; reel++) {
      for (let row = 0; row < this.config.rows; row++) {
        if (grid[reel][row] !== wildId) continue;
        const key = `${reel}:${row}`;
        const existing = sticky.get(key);
        if (existing) {
          wilds.push({ ...existing, sticky: true });
          continue;
        }
        const canMultiply = this.config.wild.reels.includes(reel);
        const multiplier = canMultiply ? table[rng.weightedIndex(weights)].multiplier : 1;
        wilds.push({ reel, row, multiplier, sticky: false });
      }
    }
    return wilds;
  }

  /** Reels that should play the suspense animation (2+ scatters already visible). */
  private anticipation(grid: Grid): boolean[] {
    const scatterId = this.config.scatter.symbol;
    const flags: boolean[] = new Array(this.config.reels).fill(false);
    let seen = 0;
    for (let reel = 0; reel < this.config.reels; reel++) {
      if (reel >= 2 && seen >= 2) flags[reel] = true;
      if (grid[reel].includes(scatterId)) seen++;
    }
    return flags;
  }

}

/* ------------------------------------------------------------------ *
 *  Development-only forcing.
 *
 *  A module-level function referenced from a single branch that folds away in
 *  production, so the bundler removes it entirely — a shipped build contains no way
 *  to force scatters, wilds or wins.
 * ------------------------------------------------------------------ */
function applyForce(grid: Grid, force: ForceMode, rng: RandomSource, config: GameConfig): void {
  const place = (symbol: SymbolId, reel: number, row: number) => {
    grid[reel][row] = symbol;
  };

  const forceScatters = (count: number) => {
    const reels = [0, 1, 2, 3, 4].slice(0, count);
    for (let r = 0; r < grid.length; r++) {
      for (let row = 0; row < grid[r].length; row++) {
        if (grid[r][row] === config.scatter.symbol) grid[r][row] = 'K';
      }
    }
    reels.forEach((reel) => place('SCATTER', reel, rng.randomInt(config.rows)));
  };

  switch (force) {
    case 'SCATTER_3':
    case 'FREE_SPINS':
      forceScatters(3);
      break;
    case 'SCATTER_4':
      forceScatters(4);
      break;
    case 'SCATTER_5':
      forceScatters(5);
      break;
    case 'WILD':
      place('WILD', 1, 1);
      place('WILD', 2, 1);
      place('WILD', 3, 1);
      break;
    case 'BIG_WIN':
      place('BOSS', 0, 1);
      place('WILD', 1, 1);
      place('BOSS', 2, 1);
      place('WILD', 3, 1);
      place('BOSS', 4, 1);
      break;
    default:
      break;
  }
}
