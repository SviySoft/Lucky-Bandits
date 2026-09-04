import type { Grid, SpinMode, SymbolId } from '../types';
import type { GameConfig } from '../config/game-config';
import type { RandomSource } from './RNGEngine';

/**
 * Reel Engine — turns RNG output into reel stop positions and the visible window.
 * A "stop" is the strip index displayed in the TOP row of that reel.
 */
export class ReelEngine {
  constructor(private readonly config: GameConfig) {}

  strip(mode: SpinMode, reel: number): SymbolId[] {
    const set = mode === 'FREE' ? this.config.reelSets.FREE : this.config.reelSets.BASE;
    return set[reel];
  }

  spinStops(rng: RandomSource, mode: SpinMode): number[] {
    const stops: number[] = [];
    for (let reel = 0; reel < this.config.reels; reel++) {
      stops.push(rng.randomInt(this.strip(mode, reel).length));
    }
    return stops;
  }

  symbolAt(mode: SpinMode, reel: number, stop: number, row: number): SymbolId {
    const strip = this.strip(mode, reel);
    return strip[(stop + row) % strip.length];
  }

  gridFromStops(stops: number[], mode: SpinMode): Grid {
    const grid: Grid = [];
    for (let reel = 0; reel < this.config.reels; reel++) {
      const column: SymbolId[] = [];
      for (let row = 0; row < this.config.rows; row++) {
        column.push(this.symbolAt(mode, reel, stops[reel], row));
      }
      grid.push(column);
    }
    return grid;
  }
}
