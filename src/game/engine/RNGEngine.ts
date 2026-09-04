/**
 * RNG Engine.
 *
 * Completely decoupled from the UI: it only produces numbers. The whole game talks
 * to the `RandomSource` interface, so swapping the local CSPRNG for a remote
 * Casino RNG service later is a one line change (see api/GameAPI.ts).
 */

export interface RandomSource {
  /** uniform float in [0, 1) */
  random(): number;
  /** uniform integer in [0, maxExclusive) */
  randomInt(maxExclusive: number): number;
  /** picks an index according to the supplied weights */
  weightedIndex(weights: number[]): number;
}

/** Cryptographically strong RNG used by the running game. */
export class CryptoRNG implements RandomSource {
  private pool = new Uint32Array(512);
  private cursor = this.pool.length;

  private refill(): void {
    const c: Crypto | undefined =
      typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(this.pool);
    } else {
      // Node fallback (simulator / unit runs) — never used in the browser.
      for (let i = 0; i < this.pool.length; i++) {
        this.pool[i] = (Math.random() * 0x100000000) >>> 0;
      }
    }
    this.cursor = 0;
  }

  random(): number {
    if (this.cursor >= this.pool.length) this.refill();
    return this.pool[this.cursor++] / 0x100000000;
  }

  randomInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.random() * maxExclusive) % maxExclusive;
  }

  weightedIndex(weights: number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }
}

/**
 * Deterministic RNG — used by the maths simulator and by "replay this spin"
 * debugging. Same seed ⇒ same reel stops ⇒ reproducible RTP runs.
 */
export class SeededRNG implements RandomSource {
  private state: number;

  constructor(seed = 0xc0ffee) {
    this.state = seed >>> 0 || 1;
  }

  random(): number {
    // xorshift128-ish (mulberry32) — fast enough for millions of spins.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randomInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.random() * maxExclusive) % maxExclusive;
  }

  weightedIndex(weights: number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }
}

/** The single RNG instance the running game uses. */
export const gameRNG: RandomSource = new CryptoRNG();
