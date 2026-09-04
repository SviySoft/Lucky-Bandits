import type { SymbolId } from '../types';

/**
 * Reel strips.
 *
 * Strips are *generated deterministically* from a symbol distribution table so the
 * maths can be re-tuned by editing numbers only — the Game Engine never changes.
 * A repair pass enforces spacing rules (scatters never clump, wilds never stack,
 * no more than two identical symbols in a row) which keeps the volatility honest.
 */

export type SymbolCounts = Partial<Record<SymbolId, number>>;

export interface StripOptions {
  seed: number;
  scatterGap: number;
  wildGap: number;
  maxRun: number;
}

const DEFAULT_OPTIONS: StripOptions = { seed: 1, scatterGap: 6, wildGap: 4, maxRun: 2 };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circularDistance(i: number, j: number, len: number): number {
  const d = Math.abs(i - j);
  return Math.min(d, len - d);
}

function isViolating(strip: SymbolId[], i: number, opt: StripOptions): boolean {
  const len = strip.length;
  const sym = strip[i];
  if (sym === 'SCATTER' || sym === 'WILD') {
    const gap = sym === 'SCATTER' ? opt.scatterGap : opt.wildGap;
    for (let j = 0; j < len; j++) {
      if (j !== i && strip[j] === sym && circularDistance(i, j, len) < gap) return true;
    }
  }
  // run length check (window that starts at i)
  let run = 1;
  for (let k = 1; k <= opt.maxRun; k++) {
    if (strip[(i + k) % len] === sym) run++;
    else break;
  }
  return run > opt.maxRun;
}

export function buildStrip(counts: SymbolCounts, options: Partial<StripOptions> = {}): SymbolId[] {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const rnd = mulberry32(opt.seed);
  const strip: SymbolId[] = [];
  (Object.keys(counts) as SymbolId[]).forEach((sym) => {
    const n = counts[sym] ?? 0;
    for (let i = 0; i < n; i++) strip.push(sym);
  });

  // Fisher-Yates with the seeded PRNG => same strips on every machine & every build.
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }

  // Repair pass: swap offending symbols until the spacing rules hold.
  const maxIterations = strip.length * 400;
  for (let iter = 0; iter < maxIterations; iter++) {
    let bad = -1;
    for (let i = 0; i < strip.length; i++) {
      if (isViolating(strip, i, opt)) {
        bad = i;
        break;
      }
    }
    if (bad === -1) break;
    const swapWith = Math.floor(rnd() * strip.length);
    [strip[bad], strip[swapWith]] = [strip[swapWith], strip[bad]];
  }

  return strip;
}

/* ------------------------------------------------------------------ *
 *  Symbol distributions — this is where the RTP is tuned.
 * ------------------------------------------------------------------ */

/** Outer reels (1 and 5) — no wilds here, exactly like the reference mechanic. */
const BASE_OUTER: SymbolCounts = {
  SCATTER: 2,
  BOSS: 1,
  HACKER: 2,
  DRIVER: 2,
  LADY: 3,
  DIAMOND: 3,
  CASH: 4,
  WATCH: 4,
  CHIPS: 4,
  A: 9,
  K: 10,
  Q: 10,
  J: 10,
  TEN: 11,
};

/** Middle reels (2, 3, 4) — wild capable. */
const BASE_MIDDLE: SymbolCounts = {
  WILD: 5,
  SCATTER: 2,
  BOSS: 1,
  HACKER: 2,
  DRIVER: 2,
  LADY: 3,
  DIAMOND: 3,
  CASH: 4,
  WATCH: 4,
  CHIPS: 4,
  A: 8,
  K: 9,
  Q: 9,
  J: 9,
  TEN: 10,
};

/** Free spin outer reels — scatters removed (the bonus does not retrigger). */
const FREE_OUTER: SymbolCounts = {
  BOSS: 1,
  HACKER: 2,
  DRIVER: 2,
  LADY: 3,
  DIAMOND: 3,
  CASH: 4,
  WATCH: 4,
  CHIPS: 4,
  A: 9,
  K: 10,
  Q: 11,
  J: 11,
  TEN: 11,
};

/** Free spin middle reels — richer in wilds, which then lock in place. */
const FREE_MIDDLE: SymbolCounts = {
  WILD: 5,
  BOSS: 1,
  HACKER: 2,
  DRIVER: 2,
  LADY: 3,
  DIAMOND: 3,
  CASH: 4,
  WATCH: 4,
  CHIPS: 4,
  A: 8,
  K: 9,
  Q: 10,
  J: 10,
  TEN: 10,
};

export const BASE_REELS: SymbolId[][] = [
  buildStrip(BASE_OUTER, { seed: 101 }),
  buildStrip(BASE_MIDDLE, { seed: 202 }),
  buildStrip(BASE_MIDDLE, { seed: 303 }),
  buildStrip(BASE_MIDDLE, { seed: 404 }),
  buildStrip(BASE_OUTER, { seed: 505 }),
];

export const FREE_REELS: SymbolId[][] = [
  buildStrip(FREE_OUTER, { seed: 606 }),
  buildStrip(FREE_MIDDLE, { seed: 707 }),
  buildStrip(FREE_MIDDLE, { seed: 808 }),
  buildStrip(FREE_MIDDLE, { seed: 909 }),
  buildStrip(FREE_OUTER, { seed: 1010 }),
];

export const REEL_DISTRIBUTIONS = { BASE_OUTER, BASE_MIDDLE, FREE_OUTER, FREE_MIDDLE };
