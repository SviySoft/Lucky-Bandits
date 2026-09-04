import type { SpinOutcome, WildCell, WinTier } from '../game/types';

/**
 * Everything the engine needs from the visual layer. Implemented by the PixiJS
 * renderer — and trivially by a no-op stub for head-less runs and tests.
 */
export interface GamePresenter {
  setTurbo(turbo: boolean): void;
  setMode(mode: 'BASE' | 'FREE'): Promise<void>;
  setStickyWilds(wilds: WildCell[]): void;
  /** spins the reels and stops them on the outcome */
  spin(outcome: SpinOutcome): Promise<void>;
  /** highlights every winning line one after another */
  presentWins(outcome: SpinOutcome, bet: number): Promise<void>;
  presentBigWin(tier: WinTier, amount: number, bet: number): Promise<void>;
  presentBonusTrigger(scatterCount: number, freeSpins: number): Promise<void>;
  presentBonusSummary(totalWin: number, spins: number): Promise<void>;
  clearWins(): void;
  /** player pressed spin/stop during the animation */
  skip(): void;
}

export class NullPresenter implements GamePresenter {
  setTurbo(): void {}
  async setMode(): Promise<void> {}
  setStickyWilds(): void {}
  async spin(): Promise<void> {}
  async presentWins(): Promise<void> {}
  async presentBigWin(): Promise<void> {}
  async presentBonusTrigger(): Promise<void> {}
  async presentBonusSummary(): Promise<void> {}
  clearWins(): void {}
  skip(): void {}
}
