import type { Timings } from '../game/config/game-config';

export type ReelPhase = 'IDLE' | 'ACCEL' | 'SPIN' | 'LANDING' | 'BOUNCE';

export interface ReelMotion {
  /** pixels per second at full speed, expressed in cell heights */
  maxSpeedCells: number;
  /** cells injected while the reel decelerates into its final position */
  landingCells: number;
  /** overshoot of the bounce in pixels */
  bouncePixels: number;
}

export const REEL_MOTION: ReelMotion = {
  maxSpeedCells: 22,
  landingCells: 4,
  bouncePixels: 22,
};

export const TURBO_MOTION: ReelMotion = {
  maxSpeedCells: 34,
  landingCells: 3,
  bouncePixels: 12,
};

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t: number): number {
  return t * t;
}

/** stop delay for reel `index`, taking the suspense mode into account */
export function reelStopDelay(index: number, timings: Timings, anticipation: boolean[]): number {
  let delay = timings.reelSpinMin + index * timings.reelStopStagger;
  for (let i = 1; i <= index; i++) {
    if (anticipation[i]) delay += timings.anticipationExtra;
  }
  return delay;
}
