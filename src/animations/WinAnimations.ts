import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { LineWin, SpinOutcome } from '../game/types';
import type { BoardLayout } from '../render/RenderContext';
import { cellCenter, neonText, PAYLINE_COLORS } from '../render/RenderContext';
import { formatMoney } from '../game/config/game-config';

export interface WinPresenterDeps {
  layout: () => BoardLayout;
  paylines: number[][];
  /** sprite currently showing grid cell (reel,row) */
  spriteAt: (reel: number, row: number) => Sprite | null;
  turbo: () => boolean;
  cycleDuration: () => number;
}

/**
 * Win Animations — dims the board, highlights the winning symbols and walks through
 * every winning payline one by one.
 */
export class WinPresenter {
  readonly container = new Container();
  private readonly lineLayer = new Container();
  private readonly labelLayer = new Container();
  private tweens: gsap.core.Tween[] = [];
  private readonly restoreY = new Map<Sprite, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolve: (() => void) | null = null;
  private cancelled = false;
  private active = false;

  constructor(private readonly deps: WinPresenterDeps) {
    this.container.addChild(this.lineLayer, this.labelLayer);
    this.container.eventMode = 'none';
  }

  get isActive(): boolean {
    return this.active;
  }

  async present(outcome: SpinOutcome, bet: number): Promise<void> {
    this.clear();
    if (outcome.lineWins.length === 0 && outcome.scatter.win <= 0) return;

    this.active = true;
    this.cancelled = false;

    const winning = new Set<string>();
    outcome.lineWins.forEach((w) => w.positions.forEach((p) => winning.add(`${p.reel}:${p.row}`)));
    outcome.scatter.positions.forEach((p) => winning.add(`${p.reel}:${p.row}`));

    // winners come alive, everything else steps back
    const characters = new Set(['BOSS', 'HACKER', 'DRIVER', 'LADY']);
    this.forEachSprite((sprite, reel, row) => {
      if (winning.has(`${reel}:${row}`)) {
        sprite.alpha = 1;
        const baseY = sprite.y;
        this.restoreY.set(sprite, baseY);
        this.tweens.push(
          gsap.to(sprite.scale, {
            x: sprite.scale.x * 1.12,
            y: sprite.scale.y * 1.12,
            duration: 0.42,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
          }),
        );
        // the crew reacts: a little hop and a cheeky tilt
        if (characters.has(outcome.grid[reel]?.[row] ?? '')) {
          this.tweens.push(
            gsap.to(sprite, {
              y: baseY - sprite.height * 0.06,
              duration: 0.34,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut',
            }),
          );
          this.tweens.push(
            gsap.fromTo(
              sprite,
              { rotation: -0.06 },
              { rotation: 0.06, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' },
            ),
          );
        } else {
          this.tweens.push(
            gsap.to(sprite, {
              y: baseY - sprite.height * 0.03,
              duration: 0.45,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut',
            }),
          );
        }
      } else {
        this.tweens.push(gsap.to(sprite, { alpha: 0.26, duration: 0.25 }));
        sprite.tint = 0x6a7396;
      }
    });

    // all lines at once first, then a cycle through each of them
    this.drawAllLines(outcome.lineWins);
    if (outcome.scatter.win > 0 || outcome.scatter.freeSpinsAwarded > 0) {
      this.drawScatterMarks(outcome);
    }

    if (outcome.lineWins.length === 1) this.drawLabel(outcome.lineWins[0], bet);

    const cycle = this.deps.cycleDuration();
    await this.wait(cycle * 0.75);
    if (this.cancelled || outcome.lineWins.length <= 1) return;

    for (const win of outcome.lineWins) {
      if (this.cancelled) return;
      this.lineLayer.removeChildren();
      this.labelLayer.removeChildren();
      this.drawLine(win, true);
      this.drawLabel(win, bet);
      await this.wait(cycle);
    }
    if (!this.cancelled) this.drawAllLines(outcome.lineWins);
  }

  /** player pressed spin: finish instantly */
  skip(): void {
    this.cancelled = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve?.();
  }

  clear(): void {
    this.skip();
    this.active = false;
    this.tweens.forEach((t) => t.kill());
    this.tweens = [];
    this.lineLayer.removeChildren();
    this.labelLayer.removeChildren();
    this.forEachSprite((sprite) => {
      gsap.killTweensOf(sprite.scale);
      gsap.killTweensOf(sprite);
      sprite.alpha = 1;
      sprite.tint = 0xffffff;
      sprite.rotation = 0;
      const y = this.restoreY.get(sprite);
      if (y !== undefined) sprite.y = y;
    });
    this.restoreY.clear();
  }

  private forEachSprite(fn: (sprite: Sprite, reel: number, row: number) => void): void {
    const layout = this.deps.layout();
    for (let reel = 0; reel < layout.reels; reel++) {
      for (let row = 0; row < layout.rows; row++) {
        const sprite = this.deps.spriteAt(reel, row);
        if (sprite) fn(sprite, reel, row);
      }
    }
  }

  private drawAllLines(wins: LineWin[]): void {
    this.lineLayer.removeChildren();
    this.labelLayer.removeChildren();
    wins.forEach((win) => this.drawLine(win, false));
  }

  private drawLine(win: LineWin, highlighted: boolean): void {
    const layout = this.deps.layout();
    const color = PAYLINE_COLORS[win.lineIndex % PAYLINE_COLORS.length];
    const line = this.deps.paylines[win.lineIndex];
    const points = line.map((row, reel) => cellCenter(layout, reel, row));

    const g = new Graphics();
    const alpha = highlighted ? 1 : 0.6;
    const w = layout.cellW;

    // soft halo, dark liner, bright core: reads on any background
    for (let i = 3; i >= 1; i--) {
      this.trace(g, points);
      g.stroke({ width: (highlighted ? 8 : 5) + i * 5, color, alpha: 0.05 * i * alpha });
    }
    this.trace(g, points);
    g.stroke({ width: highlighted ? 9 : 6, color: 0x2a1204, alpha: 0.8 * alpha });
    this.trace(g, points);
    g.stroke({ width: highlighted ? 5 : 3.5, color, alpha });
    this.trace(g, points);
    g.stroke({ width: highlighted ? 1.6 : 1.2, color: 0xfff6e0, alpha: 0.7 * alpha });

    // gold plate framing every winning symbol
    win.positions.forEach((p) => {
      const c = cellCenter(layout, p.reel, p.row);
      const rx = c.x - w / 2 + w * 0.06;
      const ry = c.y - layout.cellH / 2 + layout.cellH * 0.06;
      const rw = w * 0.88;
      const rh = layout.cellH * 0.88;
      const radius = w * 0.14;
      for (let i = 3; i >= 1; i--) {
        g.roundRect(rx, ry, rw, rh, radius).stroke({ width: 4 + i * 5, color: 0xffb020, alpha: 0.06 * i });
      }
      g.roundRect(rx, ry, rw, rh, radius).stroke({ width: highlighted ? 6 : 4, color: 0xffd257, alpha: 0.95 * alpha });
      g.roundRect(rx + 4, ry + 4, rw - 8, rh - 8, radius * 0.85).stroke({
        width: 1.5,
        color: 0xfff6e0,
        alpha: 0.5 * alpha,
      });
    });

    this.lineLayer.addChild(g);
    if (highlighted) {
      g.alpha = 0;
      this.tweens.push(gsap.to(g, { alpha: 1, duration: 0.18 }));
    }
  }

  private trace(g: Graphics, points: { x: number; y: number }[]): void {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  }

  private drawLabel(win: LineWin, _bet: number): void {
    const layout = this.deps.layout();
    const last = win.positions[win.positions.length - 1];
    const c = cellCenter(layout, last.reel, last.row);
    const color = PAYLINE_COLORS[win.lineIndex % PAYLINE_COLORS.length];

    const wrap = new Container();
    const label = neonText(
      `${formatMoney(win.win)}${win.multiplier > 1 ? `  x${win.multiplier}` : ''}`,
      { size: Math.round(22 * layout.scale), color: 0xffffff, glow: color, letterSpacing: 1 },
    );
    const pad = 14 * layout.scale;
    const bg = new Graphics();
    bg.roundRect(
      -label.width / 2 - pad,
      -label.height / 2 - pad * 0.45,
      label.width + pad * 2,
      label.height + pad * 0.9,
      12,
    )
      .fill({ color: 0x07020f, alpha: 0.82 })
      .stroke({ width: 2, color, alpha: 0.9 });

    wrap.addChild(bg, label);
    wrap.position.set(
      Math.min(Math.max(c.x, layout.x + 60), layout.x + layout.width - 60),
      c.y - layout.cellH * 0.55,
    );
    wrap.scale.set(0.6);
    this.labelLayer.addChild(wrap);
    this.tweens.push(gsap.to(wrap.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.4)' }));

    const lineNumber = neonText(`LINE ${win.lineIndex + 1}`, {
      size: Math.round(13 * layout.scale),
      color,
      glow: color,
      strokeWidth: 4,
    });
    lineNumber.position.set(0, -label.height * 0.75 - pad * 0.3);
    wrap.addChild(lineNumber);
  }

  private drawScatterMarks(outcome: SpinOutcome): void {
    const layout = this.deps.layout();
    const g = new Graphics();
    outcome.scatter.positions.forEach((p) => {
      const c = cellCenter(layout, p.reel, p.row);
      for (let i = 3; i >= 1; i--) {
        g.roundRect(
          c.x - layout.cellW / 2 + 6,
          c.y - layout.cellH / 2 + 6,
          layout.cellW - 12,
          layout.cellH - 12,
          14,
        ).stroke({ width: 3 + i * 4, color: 0xffd257, alpha: 0.07 * i });
      }
      g.roundRect(
        c.x - layout.cellW / 2 + 6,
        c.y - layout.cellH / 2 + 6,
        layout.cellW - 12,
        layout.cellH - 12,
        layout.cellW * 0.14,
      ).stroke({ width: 6, color: 0x9fe8ff, alpha: 0.95 });
    });
    this.lineLayer.addChild(g);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pendingResolve = null;
        resolve();
      }, ms);
    });
  }
}
