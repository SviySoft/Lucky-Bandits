import type { Cell, Grid, LineWin, ScatterResult, SymbolId, WildCell } from '../types';
import type { GameConfig } from '../config/game-config';
import { money } from '../config/game-config';

export interface EvaluationResult {
  lineWins: LineWin[];
  scatter: ScatterResult;
  lineWin: number;
  totalWin: number;
}

/**
 * Win Evaluator — pure function of (grid, wilds, bet). No RNG, no UI, no side effects,
 * which is exactly what makes it safe to run identically on a server later.
 */
export class WinEvaluator {
  constructor(private readonly config: GameConfig) {}

  evaluate(grid: Grid, wilds: WildCell[], bet: number): EvaluationResult {
    const lineBet = bet / this.config.lines;
    const wildMap = new Map<string, WildCell>();
    for (const w of wilds) wildMap.set(`${w.reel}:${w.row}`, w);

    const lineWins: LineWin[] = [];

    this.config.paylines.forEach((line, lineIndex) => {
      const win = this.evaluateLine(grid, line, lineIndex, lineBet, wildMap);
      if (win) lineWins.push(win);
    });

    const scatter = this.evaluateScatter(grid, bet);
    const lineWin = money(lineWins.reduce((sum, w) => sum + w.win, 0));
    const totalWin = money(lineWin + scatter.win);

    return { lineWins, scatter, lineWin, totalWin };
  }

  private evaluateLine(
    grid: Grid,
    line: number[],
    lineIndex: number,
    lineBet: number,
    wildMap: Map<string, WildCell>,
  ): LineWin | null {
    const wildId = this.config.wild.symbol;
    const scatterId = this.config.scatter.symbol;

    // The paying symbol is the first non-wild symbol on the line.
    let target: SymbolId | null = null;
    for (let reel = 0; reel < this.config.reels; reel++) {
      const sym = grid[reel][line[reel]];
      if (sym === scatterId) break;
      if (sym !== wildId) {
        target = sym;
        break;
      }
    }
    if (!target) return null;

    const pays = this.config.paytable[target];
    if (!pays) return null;

    const positions: Cell[] = [];
    let count = 0;
    for (let reel = 0; reel < this.config.reels; reel++) {
      const row = line[reel];
      const sym = grid[reel][row];
      if (sym === target || sym === wildId) {
        count++;
        positions.push({ reel, row });
      } else {
        break;
      }
    }

    if (count < 3) return null;

    const baseWin = money(pays[count - 3] * lineBet);
    if (baseWin <= 0) return null;

    // Wild multipliers taking part in the combination.
    let multiplier = 1;
    for (const pos of positions) {
      const wild = wildMap.get(`${pos.reel}:${pos.row}`);
      if (!wild || wild.multiplier <= 1) continue;
      multiplier =
        this.config.wild.combine === 'MULTIPLY'
          ? multiplier * wild.multiplier
          : Math.max(multiplier, wild.multiplier);
    }

    return {
      lineIndex,
      symbol: target,
      count,
      positions,
      baseWin,
      multiplier,
      win: money(baseWin * multiplier),
    };
  }

  private evaluateScatter(grid: Grid, bet: number): ScatterResult {
    const scatterId = this.config.scatter.symbol;
    const positions: Cell[] = [];
    for (let reel = 0; reel < this.config.reels; reel++) {
      for (let row = 0; row < this.config.rows; row++) {
        if (grid[reel][row] === scatterId) positions.push({ reel, row });
      }
    }
    const count = positions.length;
    if (count < this.config.scatter.minCount) {
      return { count, positions, win: 0, freeSpinsAwarded: 0 };
    }
    const payIndex = Math.min(count, 5) - 3;
    return {
      count,
      positions,
      win: money(this.config.scatterPays[payIndex] * bet),
      freeSpinsAwarded: this.config.scatter.freeSpins[Math.min(count, 5)] ?? 0,
    };
  }
}
