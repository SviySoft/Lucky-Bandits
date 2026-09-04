import { GAME_CONFIG, type GameConfig } from '../game/config/game-config';
import { MathEngine } from '../game/engine/MathEngine';
import { BonusEngine } from '../game/engine/BonusEngine';
import { SeededRNG, type RandomSource } from '../game/engine/RNGEngine';
import type { SymbolId } from '../game/types';

export interface SimulationOptions {
  spins: number;
  bet?: number;
  seed?: number;
  config?: GameConfig;
  onProgress?: (done: number, total: number) => void;
}

export interface SimulationResult {
  spins: number;
  bet: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
  baseRtp: number;
  bonusRtp: number;
  scatterRtp: number;
  hitCount: number;
  hitFrequency: number;
  freeSpinTriggers: number;
  freeSpinFrequency: number;
  freeSpinsPlayed: number;
  averageWin: number;
  averageWinningWin: number;
  maxWin: number;
  maxWinX: number;
  volatilityIndex: number;
  standardDeviation: number;
  bigWins: { big: number; mega: number; epic: number };
  winBuckets: { label: string; count: number; share: number }[];
  symbolWinShare: { symbol: SymbolId; win: number; share: number }[];
  durationMs: number;
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0x (no win)', min: 0, max: 0 },
  { label: '0 - 1x', min: 0.0001, max: 1 },
  { label: '1 - 2x', min: 1, max: 2 },
  { label: '2 - 5x', min: 2, max: 5 },
  { label: '5 - 10x', min: 5, max: 10 },
  { label: '10 - 25x', min: 10, max: 25 },
  { label: '25 - 50x', min: 25, max: 50 },
  { label: '50 - 100x', min: 50, max: 100 },
  { label: '100x +', min: 100, max: Infinity },
];

/**
 * Head-less maths simulator. Runs the *exact* engine the game runs - no graphics,
 * no timers - so the published RTP is the RTP players actually get.
 */
export function runSimulation(options: SimulationOptions): SimulationResult {
  const config = options.config ?? GAME_CONFIG;
  const bet = options.bet ?? config.betLevels[config.defaultBetIndex];
  const spins = options.spins;
  const rng: RandomSource = new SeededRNG(options.seed ?? 20260821);
  const math = new MathEngine(config);
  const bonus = new BonusEngine(config);

  const started = Date.now();

  let totalWin = 0;
  let baseWin = 0;
  let bonusWin = 0;
  let scatterWin = 0;
  let hitCount = 0;
  let freeSpinTriggers = 0;
  let freeSpinsPlayed = 0;
  let maxWin = 0;
  let sum = 0;
  let sumSquares = 0;
  const bigWins = { big: 0, mega: 0, epic: 0 };
  const bucketCounts: number[] = new Array(BUCKETS.length).fill(0);
  const symbolWins = new Map<SymbolId, number>();

  const progressStep = Math.max(1, Math.floor(spins / 100));

  for (let i = 0; i < spins; i++) {
    let roundWin = 0;

    const outcome = math.resolve({ mode: 'BASE', bet, rng });
    roundWin += outcome.totalWin;
    baseWin += outcome.lineWin;
    scatterWin += outcome.scatter.win;
    for (const line of outcome.lineWins) {
      symbolWins.set(line.symbol, (symbolWins.get(line.symbol) ?? 0) + line.win);
    }

    if (outcome.scatter.freeSpinsAwarded > 0) {
      freeSpinTriggers++;
      let state = bonus.createState(outcome.scatter.freeSpinsAwarded, bet);
      while (!bonus.isComplete(state)) {
        const fs = math.resolve({ mode: 'FREE', bet, rng, stickyWilds: state.stickyWilds });
        freeSpinsPlayed++;
        roundWin += fs.totalWin;
        bonusWin += fs.totalWin;
        for (const line of fs.lineWins) {
          symbolWins.set(line.symbol, (symbolWins.get(line.symbol) ?? 0) + line.win);
        }
        state = bonus.consumeSpin(state, fs);
      }
    }

    const cap = config.maxWinMultiplier * bet;
    if (roundWin > cap) roundWin = cap;

    totalWin += roundWin;
    if (roundWin > 0) hitCount++;
    if (roundWin > maxWin) maxWin = roundWin;

    const x = roundWin / bet;
    sum += x;
    sumSquares += x * x;
    if (x >= config.bigWin.epic) bigWins.epic++;
    else if (x >= config.bigWin.mega) bigWins.mega++;
    else if (x >= config.bigWin.big) bigWins.big++;

    for (let b = 0; b < BUCKETS.length; b++) {
      const bucket = BUCKETS[b];
      const inBucket = b === 0 ? x === 0 : x > bucket.min - 1e-9 && x <= bucket.max;
      if (inBucket) {
        bucketCounts[b]++;
        break;
      }
    }

    if (options.onProgress && i % progressStep === 0) options.onProgress(i, spins);
  }

  const totalBet = spins * bet;
  const mean = sum / spins;
  const variance = Math.max(0, sumSquares / spins - mean * mean);
  const standardDeviation = Math.sqrt(variance);
  const totalSymbolWin = [...symbolWins.values()].reduce((a, b) => a + b, 0) || 1;

  return {
    spins,
    bet,
    totalBet,
    totalWin,
    rtp: totalWin / totalBet,
    baseRtp: baseWin / totalBet,
    bonusRtp: bonusWin / totalBet,
    scatterRtp: scatterWin / totalBet,
    hitCount,
    hitFrequency: hitCount / spins,
    freeSpinTriggers,
    freeSpinFrequency: freeSpinTriggers / spins,
    freeSpinsPlayed,
    averageWin: totalWin / spins,
    averageWinningWin: hitCount ? totalWin / hitCount : 0,
    maxWin,
    maxWinX: maxWin / bet,
    volatilityIndex: standardDeviation,
    standardDeviation,
    bigWins,
    winBuckets: BUCKETS.map((b, i) => ({
      label: b.label,
      count: bucketCounts[i],
      share: bucketCounts[i] / spins,
    })),
    symbolWinShare: [...symbolWins.entries()]
      .map(([symbol, win]) => ({ symbol, win, share: win / totalSymbolWin }))
      .sort((a, b) => b.win - a.win),
    durationMs: Date.now() - started,
  };
}
