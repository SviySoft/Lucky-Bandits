import { BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { SymbolId } from '../game/types';

import { REEL_MOTION, TURBO_MOTION, type ReelPhase } from '../animations/SpinAnimations';

export interface ReelLayout {
  x: number;
  y: number;
  width: number;
  cellHeight: number;
  rows: number;
}

/**
 * One reel column. Owns a small sprite pool that is recycled while the strip scrolls,
 * so a 5x3 board costs 25 sprites total no matter how long the spin runs.
 */
export class ReelRenderer {
  readonly container = new Container();
  private readonly symbolLayer = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly symbols: SymbolId[] = [];
  private readonly blur = new BlurFilter({ strength: 0, quality: 2 });
  private maskShape = new Graphics();

  private layout: ReelLayout;
  private phase: ReelPhase = 'IDLE';
  private offset = 0;
  private speed = 0;
  private accelTime = 0;
  private accelDuration = 0.22;
  private landingQueue: SymbolId[] = [];
  private bounceTime = 0;
  private bounceDuration = 0.24;
  private resolveStop: (() => void) | null = null;
  private turbo = false;
  private anticipating = false;
  private stripCursor = 0;
  private symbolSize = 100;
  private landingTotal = 4;

  onStop: (() => void) | null = null;

  constructor(
    readonly index: number,
    private strip: SymbolId[],
    private readonly textures: { symbol(id: SymbolId): Texture; symbolScale(id: SymbolId): number },
    layout: ReelLayout,
  ) {
    this.layout = layout;
    this.container.addChild(this.symbolLayer);
    this.container.addChild(this.maskShape);
    this.symbolLayer.mask = this.maskShape;
    this.blur.strengthX = 0;
    this.blur.strengthY = 0;

    const count = layout.rows + 2;
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      this.sprites.push(sprite);
      this.symbols.push(strip[i % strip.length]);
      this.symbolLayer.addChild(sprite);
    }
    this.applyLayout(layout);
    this.refreshTextures();
  }

  get isSpinning(): boolean {
    return this.phase !== 'IDLE';
  }

  setStrip(strip: SymbolId[]): void {
    this.strip = strip;
    this.stripCursor = Math.floor(Math.random() * strip.length);
  }

  setTurbo(turbo: boolean): void {
    this.turbo = turbo;
  }

  applyLayout(layout: ReelLayout): void {
    this.layout = layout;
    this.container.position.set(layout.x, layout.y);

    this.maskShape.clear();
    this.maskShape
      .rect(-layout.width / 2, 0, layout.width, layout.cellHeight * layout.rows)
      .fill({ color: 0xffffff });

    // the sheet art is tightly cropped, so a symbol fills ~90% of its cell (§13)
    this.symbolSize = Math.min(layout.width, layout.cellHeight);
    this.sprites.forEach((sprite, i) => sprite.setSize(this.symbolSize * this.textures.symbolScale(this.symbols[i])));
    this.position();
  }

  /** shows a static grid (used on boot and when jumping into another mode) */
  setVisibleSymbols(symbols: SymbolId[]): void {
    this.offset = 0;
    for (let row = 0; row < this.layout.rows; row++) {
      this.symbols[row + 1] = symbols[row];
    }
    this.symbols[0] = this.strip[this.randomStripIndex()];
    this.symbols[this.symbols.length - 1] = this.strip[this.randomStripIndex()];
    this.refreshTextures();
    this.position();
  }

  getVisibleSymbols(): SymbolId[] {
    return this.symbols.slice(1, 1 + this.layout.rows);
  }

  /** returns the sprite that currently shows grid row `row` */
  spriteForRow(row: number): Sprite {
    return this.sprites[row + 1];
  }

  start(): void {
    if (this.phase !== 'IDLE') return;
    this.symbolLayer.filters = [this.blur];
    this.phase = 'ACCEL';
    this.accelTime = 0;
    this.anticipating = false;
    this.landingQueue = [];
  }

  setAnticipation(active: boolean): void {
    this.anticipating = active;
  }

  /** requests the stop; resolves once the bounce has finished */
  stopOn(symbols: SymbolId[]): Promise<void> {
    return new Promise((resolve) => {
      const motion = this.turbo ? TURBO_MOTION : REEL_MOTION;
      const rows = this.layout.rows;
      const queue: SymbolId[] = [];
      // a couple of neutral cells first so the deceleration has room to breathe
      for (let i = 0; i < Math.max(0, motion.landingCells - rows); i++) {
        queue.push(this.strip[this.randomStripIndex()]);
      }
      // then the final window, bottom row first
      for (let i = rows - 1; i >= 0; i--) queue.push(symbols[i]);
      // one filler completes the last wrap and puts row 0 in place
      queue.push(this.strip[this.randomStripIndex()]);

      this.landingQueue = queue;
      this.landingTotal = queue.length;
      this.phase = 'LANDING';
      this.resolveStop = resolve;
    });
  }

  /** immediately snaps to the final symbols (turbo / player skip) */
  snapTo(symbols: SymbolId[]): void {
    this.landingQueue = [];
    this.phase = 'IDLE';
    this.symbolLayer.filters = [];
    this.offset = 0;
    this.speed = 0;
    this.blur.strengthY = 0;
    this.setVisibleSymbols(symbols);
    const resolve = this.resolveStop;
    this.resolveStop = null;
    this.onStop?.();
    resolve?.();
  }

  update(dt: number): void {
    if (this.phase === 'IDLE') return;

    const motion = this.turbo ? TURBO_MOTION : REEL_MOTION;
    const cell = this.layout.cellHeight;
    const maxSpeed = motion.maxSpeedCells * cell;

    if (this.phase === 'BOUNCE') {
      this.bounceTime += dt;
      const t = Math.min(1, this.bounceTime / this.bounceDuration);
      const damped = Math.sin(t * Math.PI) * (1 - t) * motion.bouncePixels;
      this.offset = damped;
      this.position();
      if (t >= 1) {
        this.offset = 0;
        this.position();
        this.phase = 'IDLE';
        this.symbolLayer.filters = [];
        const resolve = this.resolveStop;
        this.resolveStop = null;
        resolve?.();
      }
      return;
    }

    if (this.phase === 'ACCEL') {
      this.accelTime += dt;
      const t = Math.min(1, this.accelTime / (this.turbo ? 0.09 : this.accelDuration));
      this.speed = maxSpeed * t * t;
      if (t >= 1) this.phase = 'SPIN';
    } else if (this.phase === 'SPIN') {
      this.speed = this.anticipating ? maxSpeed * 0.45 : maxSpeed;
    } else if (this.phase === 'LANDING') {
      const progress = 1 - this.landingQueue.length / Math.max(1, this.landingTotal);
      this.speed = maxSpeed * (1 - progress * 0.72);
    }

    this.offset += this.speed * dt;

    let guard = 0;
    while (this.offset >= cell && guard < 60) {
      guard++;
      this.offset -= cell;
      this.rotate();
    }

    this.blur.strengthY = Math.min(14, (this.speed / cell) * 0.55);
    this.position();
  }

  private rotate(): void {
    // everything shifts one row down; the bottom sprite is recycled to the top
    const last = this.sprites.pop();
    const lastSymbol = this.symbols.pop();
    if (!last || !lastSymbol) return;
    this.sprites.unshift(last);

    let next: SymbolId;
    if (this.landingQueue.length > 0) {
      next = this.landingQueue.shift() as SymbolId;
    } else {
      this.stripCursor = (this.stripCursor - 1 + this.strip.length) % this.strip.length;
      next = this.strip[this.stripCursor];
    }
    this.symbols.unshift(next);
    last.texture = this.textures.symbol(next);
    last.setSize(this.symbolSize * this.textures.symbolScale(next));
    last.alpha = 1;
    last.tint = 0xffffff;

    if (this.phase === 'LANDING' && this.landingQueue.length === 0) {
      this.offset = 0;
      this.speed = 0;
      this.blur.strengthY = 0;
      this.phase = 'BOUNCE';
      this.bounceTime = 0;
      this.bounceDuration = this.turbo ? 0.12 : 0.24;
      this.onStop?.();
    }
  }

  private position(): void {
    const cell = this.layout.cellHeight;
    this.sprites.forEach((sprite, i) => {
      sprite.position.set(0, (i - 1) * cell + this.offset + cell / 2);
    });
  }

  private refreshTextures(): void {
    this.sprites.forEach((sprite, i) => {
      sprite.texture = this.textures.symbol(this.symbols[i]) as Texture;
      sprite.alpha = 1;
      sprite.setSize(this.symbolSize * this.textures.symbolScale(this.symbols[i]));
    });
  }

  private randomStripIndex(): number {
    return Math.floor(Math.random() * this.strip.length);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
