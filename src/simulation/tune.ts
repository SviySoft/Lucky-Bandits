/* eslint-disable no-console */
/**
 * Maths tuning tool: sweeps free-spin wild density / multiplier weights and reports
 * the paytable scale factor required to land on the target RTP.
 *   npx tsx src/simulation/tune.ts
 */
import { GAME_CONFIG, type GameConfig } from '../game/config/game-config';
import { buildStrip, REEL_DISTRIBUTIONS, type SymbolCounts } from '../game/config/reels';
import { runSimulation } from './Simulator';

const SPINS = Number(process.argv[2] ?? 400_000);
const TARGET = 0.96;

const clone = (cfg: GameConfig): GameConfig => JSON.parse(JSON.stringify(cfg)) as GameConfig;

function variant(wilds: number, weights: [number, number, number]): GameConfig {
  const c = clone(GAME_CONFIG);
  const outer: SymbolCounts = { ...REEL_DISTRIBUTIONS.FREE_OUTER };
  const middle: SymbolCounts = { ...REEL_DISTRIBUTIONS.FREE_MIDDLE, WILD: wilds };
  const len = Object.values(middle).reduce<number>((a, b) => a + (b ?? 0), 0);
  middle.TEN = (middle.TEN ?? 0) + (75 - len);
  c.reelSets.FREE = [
    buildStrip(outer, { seed: 606 }),
    buildStrip(middle, { seed: 707 }),
    buildStrip(middle, { seed: 808 }),
    buildStrip(middle, { seed: 909 }),
    buildStrip(outer, { seed: 1010 }),
  ];
  c.wild.freeMultipliers = [
    { multiplier: 1, weight: weights[0] },
    { multiplier: 2, weight: weights[1] },
    { multiplier: 3, weight: weights[2] },
  ];
  return c;
}

const variants: { label: string; cfg: GameConfig }[] = [];
for (const w of [2, 3, 4, 5, 6]) {
  variants.push({ label: `FSwild=${w} mult 60/25/15`, cfg: variant(w, [60, 25, 15]) });
}
variants.push({ label: 'FSwild=3 mult 70/20/10', cfg: variant(3, [70, 20, 10]) });
variants.push({ label: 'FSwild=4 mult 70/20/10', cfg: variant(4, [70, 20, 10]) });

console.log(
  ['variant'.padEnd(26), 'RTP'.padStart(7), 'base'.padStart(7), 'FS'.padStart(7), 'hit'.padStart(7), 'maxX'.padStart(7), 'sigma'.padStart(7), 'scale'].join(' '),
);
for (const v of variants) {
  const r = runSimulation({ spins: SPINS, bet: 1, seed: 777, config: v.cfg });
  console.log(
    [
      v.label.padEnd(26),
      `${(r.rtp * 100).toFixed(1)}%`.padStart(7),
      `${(r.baseRtp * 100).toFixed(1)}%`.padStart(7),
      `${(r.bonusRtp * 100).toFixed(1)}%`.padStart(7),
      `${(r.hitFrequency * 100).toFixed(1)}%`.padStart(7),
      r.maxWinX.toFixed(0).padStart(7),
      r.volatilityIndex.toFixed(1).padStart(7),
      (TARGET / r.rtp).toFixed(4),
    ].join(' '),
  );
}
