/* eslint-disable no-console */
import { runSimulation } from './Simulator';
import { GAME_CONFIG } from '../game/config/game-config';

/**
 * npm run simulate                   -> 100 000 spins
 * npm run simulate -- 1000000        -> 1 000 000 spins
 * npm run simulate -- 1000000 1 42   -> spins, bet, seed
 */
const args = process.argv.slice(2);
const spins = Number(args[0] ?? 100_000);
const bet = Number(args[1] ?? 1);
const seed = Number(args[2] ?? 20260821);

const C = { magenta: '\x1b[95m', green: '\x1b[92m', dim: '\x1b[90m', reset: '\x1b[0m' };
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const money = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const oneIn = (v: number) => (v > 0 ? `1 in ${Math.round(1 / v).toLocaleString('en-US')}` : 'never');

console.log('');
console.log(`  ${C.magenta}${GAME_CONFIG.name}${C.reset}  maths simulation`);
console.log(
  `  ${C.dim}engine v${GAME_CONFIG.version} - ${GAME_CONFIG.reels}x${GAME_CONFIG.rows} - ${GAME_CONFIG.lines} lines${C.reset}`,
);
console.log('  ' + '-'.repeat(58));
console.log(`  spins: ${spins.toLocaleString('en-US')}   bet: ${money(bet)}   seed: ${seed}`);
console.log('');

let lastShown = -1;
const result = runSimulation({
  spins,
  bet,
  seed,
  onProgress: (done, total) => {
    const p = Math.floor((done / total) * 100);
    if (p !== lastShown && p % 10 === 0) {
      lastShown = p;
      process.stdout.write(`\r  simulating... ${p}%   `);
    }
  },
});
process.stdout.write('\r' + ' '.repeat(40) + '\r');
console.log('');

const row = (label: string, value: string) => console.log(`  ${label.padEnd(26)} ${value}`);

console.log('  RESULTS');
console.log('  ' + '-'.repeat(58));
row('Total bets', money(result.totalBet));
row('Total wins', money(result.totalWin));
row('Calculated RTP', `${C.green}${pct(result.rtp)}${C.reset}`);
row('  - base game lines', pct(result.baseRtp));
row('  - scatter pays', pct(result.scatterRtp));
row('  - free spins', pct(result.bonusRtp));
row('Hit frequency', `${pct(result.hitFrequency)}  (${oneIn(result.hitFrequency)})`);
row('Free spin frequency', `${pct(result.freeSpinFrequency)}  (${oneIn(result.freeSpinFrequency)})`);
row('Free spins played', result.freeSpinsPlayed.toLocaleString('en-US'));
row('Average win / spin', money(result.averageWin));
row('Average winning spin', money(result.averageWinningWin));
row('Maximum win', `${money(result.maxWin)}  (${result.maxWinX.toFixed(1)}x bet)`);
row('Volatility index (sigma)', result.volatilityIndex.toFixed(2));
row('Big / Mega / Epic wins', `${result.bigWins.big} / ${result.bigWins.mega} / ${result.bigWins.epic}`);
row('Runtime', `${(result.durationMs / 1000).toFixed(2)}s`);

console.log('');
console.log('  WIN DISTRIBUTION');
console.log('  ' + '-'.repeat(58));
for (const bucket of result.winBuckets) {
  const bar = '#'.repeat(Math.max(0, Math.round(bucket.share * 40)));
  console.log(`  ${bucket.label.padEnd(14)} ${pct(bucket.share).padStart(7)}  ${bar}`);
}

console.log('');
console.log('  WIN SHARE BY SYMBOL');
console.log('  ' + '-'.repeat(58));
for (const entry of result.symbolWinShare.slice(0, 15)) {
  console.log(`  ${entry.symbol.padEnd(12)} ${pct(entry.share).padStart(7)}   ${money(entry.win)}`);
}
console.log('');
