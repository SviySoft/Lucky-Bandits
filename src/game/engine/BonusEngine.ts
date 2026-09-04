import type { FreeSpinsState, SpinOutcome, WildCell } from '../types';
import type { GameConfig } from '../config/game-config';
import { money } from '../config/game-config';

/**
 * Bonus Engine — owns the free spins round: counters, sticky wilds and completion.
 * Pure state transitions so the same code can run server side.
 */
export class BonusEngine {
  constructor(private readonly config: GameConfig) {}

  createState(freeSpins: number, triggerBet: number): FreeSpinsState {
    return {
      active: true,
      spinsTotal: freeSpins,
      spinsUsed: 0,
      totalWin: 0,
      stickyWilds: [],
      triggerBet,
    };
  }

  idle(): FreeSpinsState {
    return { active: false, spinsTotal: 0, spinsUsed: 0, totalWin: 0, stickyWilds: [], triggerBet: 0 };
  }

  /** Applies the outcome of one free spin: sticky wild collection + counters. */
  consumeSpin(state: FreeSpinsState, outcome: SpinOutcome): FreeSpinsState {
    const stickyWilds: WildCell[] = [...state.stickyWilds];
    if (this.config.freeSpins.stickyWilds) {
      for (const wild of outcome.wilds) {
        if (!this.config.freeSpins.stickyReels.includes(wild.reel)) continue;
        const exists = stickyWilds.some((w) => w.reel === wild.reel && w.row === wild.row);
        if (!exists) stickyWilds.push({ ...wild, sticky: true });
      }
    }

    let spinsTotal = state.spinsTotal;
    if (this.config.scatter.retrigger && outcome.scatter.freeSpinsAwarded > 0) {
      spinsTotal += outcome.scatter.freeSpinsAwarded;
    }

    const spinsUsed = state.spinsUsed + 1;
    return {
      ...state,
      spinsTotal,
      spinsUsed,
      totalWin: money(state.totalWin + outcome.totalWin),
      stickyWilds,
      active: spinsUsed < spinsTotal,
    };
  }

  isComplete(state: FreeSpinsState): boolean {
    return state.spinsUsed >= state.spinsTotal;
  }

  spinsLeft(state: FreeSpinsState): number {
    return Math.max(0, state.spinsTotal - state.spinsUsed);
  }
}
