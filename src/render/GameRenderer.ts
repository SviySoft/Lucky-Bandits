import { Application, BlurFilter, Container, FillGradient, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import gsap from 'gsap';
import type { SpinOutcome, SymbolId, WildCell, WinTier } from '../game/types';
import { GAME_CONFIG, type GameConfig, type Timings } from '../game/config/game-config';
import { AssetLoader } from './AssetLoader';
import { SCENE_LAYOUT } from './sceneLayout';
import { ReelRenderer } from './ReelRenderer';
import { WinPresenter } from '../animations/WinAnimations';
import { BigWinPresenter } from '../animations/BigWinAnimations';
import { BonusPresenter } from '../animations/BonusAnimations';
import { reelStopDelay } from '../animations/SpinAnimations';
import type { GamePresenter } from './GamePresenter';
import type { BoardLayout } from './RenderContext';
import { cellCenter } from './RenderContext';
import type { AudioManager } from '../audio/AudioManager';

export interface GameRendererOptions {
  config?: GameConfig;
  audio?: AudioManager;
  bottomInset?: number;
  topInset?: number;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  life: number;
  alive: boolean;
}

/**
 * Game Renderer — LUCKY BANDITS.
 *
 * The scene is a vault hall: the crew stands at the sides, the machine stands in the
 * middle and the reels live inside its window. Everything here is placement, masking and
 * animation of finished artwork; outcomes come from the engine untouched.
 */
export class GameRenderer implements GamePresenter {
  readonly app = new Application();
  readonly assets = new AssetLoader();
  private readonly config: GameConfig;
  private readonly audio?: AudioManager;

  private winPresenter!: WinPresenter;
  private bigWinPresenter!: BigWinPresenter;
  private bonusPresenter!: BonusPresenter;

  private readonly world = new Container();
  private readonly bgLayer = new Container();
  private readonly charLayer = new Container();
  private readonly sceneLayer = new Container();
  private readonly reelBed = new Graphics();
  private readonly reelLayer = new Container();
  private readonly reelMask = new Graphics();
  private readonly suspense = new Graphics();
  private readonly stickyLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly mood = new Graphics();

  private plate!: Sprite;
  /** blurred copy of the scene filling the letterbox on odd aspect ratios */
  private plateBackdrop!: Sprite;
  private letterbox = new Graphics();
  /** where the reference plate currently sits on screen */
  plateRect = { x: 0, y: 0, width: 0, height: 0, scale: 1 };
  onPlateRect: ((rect: { x: number; y: number; width: number; height: number; scale: number }) => void) | null = null;

  private reels: ReelRenderer[] = [];
  private particles: Particle[] = [];

  private layout: BoardLayout = {
    x: 0, y: 0, width: 0, height: 0, cellW: 100, cellH: 100,
    reels: 5, rows: 3, screenW: 0, screenH: 0, scale: 1,
  };
  private frameRect = { x: 0, y: 0, width: 0, height: 0, scale: 1 };

  private mode: 'BASE' | 'FREE' = 'BASE';
  private turbo = false;
  private skipped = false;
  private currentOutcome: SpinOutcome | null = null;
  private stickyWilds: WildCell[] = [];
  private stickyCount = 0;
  private resizeObserver: ResizeObserver | null = null;
  private host: HTMLElement | null = null;
  private destroyed = false;
  private time = 0;
  private shake = 0;

  constructor(options: GameRendererOptions = {}) {
    this.config = options.config ?? GAME_CONFIG;
    this.audio = options.audio;
  }

  async init(host: HTMLElement, onProgress?: (p: number) => void): Promise<void> {
    this.host = host;
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      resizeTo: host,
    });
    if (this.destroyed) return;
    host.appendChild(this.app.canvas);
    this.app.canvas.style.cssText = 'display:block;width:100%;height:100%';

    await this.assets.loadAll(onProgress);
    if (this.destroyed) return;

    this.buildScene();
    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(host);
    window.addEventListener('orientationchange', this.onOrientation);
    this.app.ticker.add(this.tick);
  }

  private buildScene(): void {
    this.plate = new Sprite(this.assets.scene('plate'));
    this.plateBackdrop = new Sprite(this.assets.scene('plate'));
    this.plateBackdrop.filters = [new BlurFilter({ strength: 26, quality: 3 })];
    this.plateBackdrop.alpha = 0.5;
    this.plateBackdrop.tint = 0x8a6aa0;

    this.reelLayer.mask = this.reelMask;

    this.winPresenter = new WinPresenter({
      layout: () => this.layout,
      paylines: this.config.paylines,
      spriteAt: (reel, row) => this.reels[reel]?.spriteForRow(row) ?? null,
      turbo: () => this.turbo,
      cycleDuration: () => this.timings().winCycle,
    });
    this.bigWinPresenter = new BigWinPresenter(
      this.app.renderer,
      () => this.layout,
      () => this.audio?.play('coin'),
      {
        coin: this.assets.scene('coin'),
        gem: this.assets.scene('gem'),
        note: this.assets.scene('note'),
        burst: this.assets.scene('burst'),
        big: this.assets.scene('bigWin'),
        mega: this.assets.scene('megaWin'),
        epic: this.assets.scene('epicWin'),
      },
    );
    this.bonusPresenter = new BonusPresenter(() => this.layout, {
      burst: this.assets.scene('burst'),
      coin: this.assets.scene('coin'),
    });

    // reels live behind the plate; the knocked-out window reveals them
    this.sceneLayer.addChild(
      this.reelBed,
      this.reelLayer,
      this.reelMask,
      this.suspense,
      this.stickyLayer,
      this.winPresenter.container,
      this.plate,
      this.fxLayer,
    );
    this.world.addChild(this.letterbox, this.plateBackdrop, this.bgLayer, this.charLayer, this.mood, this.sceneLayer);
    this.app.stage.addChild(this.world, this.overlayLayer);
    this.overlayLayer.addChild(this.bonusPresenter.container, this.bigWinPresenter.container);

    this.buildReels();
  }

  private buildReels(): void {
    this.reels = [];
    this.reelLayer.removeChildren();
    const strips = this.config.reelSets.BASE;
    for (let i = 0; i < this.config.reels; i++) {
      const reel = new ReelRenderer(i, strips[i], this.assets, {
        x: 0, y: 0, width: this.layout.cellW, cellHeight: this.layout.cellH, rows: this.config.rows,
      });
      reel.onStop = () => this.onReelStop(i);
      this.reels.push(reel);
      this.reelLayer.addChild(reel.container);
    }
    const idle = strips.map((strip, i) => {
      const start = (i * 13 + 7) % strip.length;
      return [strip[start], strip[(start + 1) % strip.length], strip[(start + 2) % strip.length]];
    });
    this.reels.forEach((reel, i) => reel.setVisibleSymbols(idle[i]));
  }

  private onOrientation = () => setTimeout(() => this.handleResize(), 120);

  private tick = (ticker: Ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    this.time += dt;
    this.reels.forEach((reel) => reel.update(dt));
    this.bigWinPresenter.update(dt);
    this.bonusPresenter.update(dt);
    this.updateParticles(dt);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 46);
      this.world.x = (Math.random() - 0.5) * this.shake;
      this.world.y = (Math.random() - 0.5) * this.shake;
    } else if (this.world.x || this.world.y) {
      this.world.position.set(0, 0);
    }
  };

  /* ------------------------------- layout ------------------------------ */

  /** kept for API compatibility — the reference plate defines the composition now */
  setInsets(): void {
    this.handleResize();
  }

  private handleResize(): void {
    if (!this.host || this.destroyed || !this.app.renderer || !this.plate) return;
    const rect = this.host.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        Math.abs(this.app.screen.width - rect.width) > 0.5 ||
        Math.abs(this.app.screen.height - rect.height) > 0.5 ||
        this.app.renderer.resolution !== dpr
      ) {
        this.app.renderer.resolution = dpr;
        this.app.renderer.resize(rect.width, rect.height);
      }
    }

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w <= 0 || h <= 0) return;

    const ref = SCENE_LAYOUT.reference;
    // contain-fit: the whole reference composition always stays on screen
    const scale = Math.min(w / ref.width, h / ref.height);
    const plateW = ref.width * scale;
    const plateH = ref.height * scale;
    const plateX = (w - plateW) / 2;
    const plateY = (h - plateH) / 2;

    this.plate.position.set(plateX, plateY);
    this.plate.width = plateW;
    this.plate.height = plateH;
    this.plateRect = { x: plateX, y: plateY, width: plateW, height: plateH, scale };
    this.onPlateRect?.(this.plateRect);

    // fill the letterbox with a blurred copy of the hall so the plate never floats
    const coverScale = Math.max(w / ref.width, h / ref.height) * 1.1;
    this.plateBackdrop.scale.set(coverScale);
    this.plateBackdrop.position.set(
      (w - ref.width * coverScale) / 2,
      (h - ref.height * coverScale) / 2,
    );
    this.plateBackdrop.visible = plateW < w - 2 || plateH < h - 2;

    this.letterbox.clear();
    this.letterbox.rect(0, 0, w, h).fill({ color: 0x120311 });
    this.letterbox.rect(0, 0, w, h).fill({
      fill: new FillGradient({
        type: 'radial',
        center: { x: 0.5, y: 0.42 },
        innerRadius: 0,
        outerCenter: { x: 0.5, y: 0.42 },
        outerRadius: 0.72,
        colorStops: [
          { offset: 0, color: 'rgba(80,26,72,0.55)' },
          { offset: 0.6, color: 'rgba(40,10,38,0.35)' },
          { offset: 1, color: 'rgba(10,2,10,0)' },
        ],
        textureSpace: 'local',
      }),
    });

    const win = SCENE_LAYOUT.window;
    const boardX = plateX + win.x * scale;
    const boardY = plateY + win.y * scale;
    const boardW = win.w * scale;
    const boardH = win.h * scale;

    this.layout = {
      x: boardX,
      y: boardY,
      width: boardW,
      height: boardH,
      cellW: boardW / this.config.reels,
      cellH: boardH / this.config.rows,
      reels: this.config.reels,
      rows: this.config.rows,
      screenW: w,
      screenH: h,
      scale: Math.max(0.4, Math.min(1.6, boardW / win.w)),
    };
    this.frameRect = { x: plateX, y: plateY, width: plateW, height: plateH, scale };

    this.reelMask.clear();
    this.reelMask.roundRect(boardX, boardY, boardW, boardH, 22 * scale).fill({ color: 0xffffff });

    this.reels.forEach((reel, index) =>
      reel.applyLayout({
        x: boardX + index * this.layout.cellW + this.layout.cellW / 2,
        y: boardY,
        width: this.layout.cellW,
        cellHeight: this.layout.cellH,
        rows: this.config.rows,
      }),
    );

    this.mood.clear();
    this.mood.rect(0, 0, w, h).fill({ color: 0xffa22e, alpha: 1 });
    this.mood.blendMode = 'overlay';
    this.mood.alpha = this.mode === 'FREE' ? 0.14 : 0;

    this.drawReelBed();
    this.refreshStickyLayer();
    this.winPresenter?.clear();
    if (this.currentOutcome) this.applyWildVariants(this.currentOutcome);
  }

  /** dark reel field with one subtle tile per cell, as on the reference */
  private drawReelBed(): void {
    const l = this.layout;
    const free = this.mode === 'FREE';
    const s = this.frameRect.scale;
    this.reelBed.clear();

    this.reelBed
      .roundRect(l.x, l.y, l.width, l.height, 22 * s)
      .fill({ color: free ? 0x241004 : 0x1a0a26, alpha: 1 });
    this.reelBed
      .ellipse(l.x + l.width / 2, l.y + l.height / 2, l.width * 0.55, l.height * 0.72)
      .fill({ color: free ? 0xffa22e : 0x7a3cc8, alpha: 0.1 });

    const gap = Math.max(3, 5 * s);
    for (let reel = 0; reel < l.reels; reel++) {
      for (let row = 0; row < l.rows; row++) {
        const x = l.x + reel * l.cellW + gap;
        const y = l.y + row * l.cellH + gap;
        const w = l.cellW - gap * 2;
        const h = l.cellH - gap * 2;
        this.reelBed.roundRect(x, y, w, h, 14 * s).fill({
          color: free ? 0x30170a : 0x22093a,
          alpha: 0.85,
        });
        this.reelBed.roundRect(x, y, w, h, 14 * s).stroke({
          width: Math.max(1, 1.6 * s),
          color: free ? 0xffb45c : 0x8f63d8,
          alpha: 0.28,
        });
      }
    }

    this.reelBed.rect(l.x, l.y, l.width, l.cellH * 0.18).fill({ color: 0x000000, alpha: 0.35 });
    this.reelBed
      .rect(l.x, l.y + l.height - l.cellH * 0.18, l.width, l.cellH * 0.18)
      .fill({ color: 0x000000, alpha: 0.35 });
  }

  /* ------------------------- presenter contract ------------------------ */

  setTurbo(turbo: boolean): void {
    this.turbo = turbo;
    this.reels.forEach((reel) => reel.setTurbo(turbo));
  }

  async setMode(mode: 'BASE' | 'FREE'): Promise<void> {
    this.mode = mode;
    const strips = mode === 'FREE' ? this.config.reelSets.FREE : this.config.reelSets.BASE;
    this.reels.forEach((reel, i) => reel.setStrip(strips[i]));
    this.drawReelBed();
    await new Promise<void>((resolve) => {
      gsap.to(this.mood, {
        alpha: mode === 'FREE' ? 0.14 : 0,
        duration: this.turbo ? 0.2 : 0.9,
        onComplete: resolve,
      });
    });
  }

  setStickyWilds(wilds: WildCell[]): void {
    this.stickyWilds = wilds;
    this.refreshStickyLayer();
  }

  async spin(outcome: SpinOutcome): Promise<void> {
    this.currentOutcome = outcome;
    this.skipped = false;
    this.clearWins();

    const timings = this.timings();
    this.reels.forEach((reel) => reel.start());

    let anticipating = false;
    const stops = this.reels.map(async (reel, index) => {
      await this.wait(reelStopDelay(index, timings, outcome.anticipation));
      if (this.skipped) {
        reel.snapTo(outcome.grid[index]);
        this.applyWildVariants(outcome);
        return;
      }
      await reel.stopOn(outcome.grid[index]);
      const next = index + 1;
      if (!this.skipped && outcome.anticipation[next]) {
        this.reels[next]?.setAnticipation(true);
        if (!anticipating) {
          anticipating = true;
          this.audio?.startAnticipation();
          this.showSuspense(next);
        }
      }
    });

    await Promise.all(stops);
    this.reels.forEach((reel) => reel.setAnticipation(false));
    if (anticipating) {
      this.audio?.stopAnticipation();
      this.hideSuspense();
    }
    this.applyWildVariants(outcome);
  }

  /** §14: swap the landed wilds for their x2 / x3 artwork */
  private applyWildVariants(outcome: SpinOutcome): void {
    outcome.wilds.forEach((wild) => {
      if (wild.multiplier <= 1) return;
      const sprite = this.reels[wild.reel]?.spriteForRow(wild.row);
      if (!sprite) return;
      sprite.texture = this.assets.wild(wild.multiplier);
      const size = Math.min(this.layout.cellW, this.layout.cellH) * 1.0;
      sprite.setSize(size);
    });
  }

  private onReelStop(index: number): void {
    this.audio?.play('reelStop');
    const outcome = this.currentOutcome;
    if (!outcome) return;
    outcome.grid[index].forEach((symbol, row) => {
      if (symbol === 'WILD') {
        const wild = outcome.wilds.find((wc) => wc.reel === index && wc.row === row);
        if (wild && wild.multiplier > 1) {
          const sprite = this.reels[index]?.spriteForRow(row);
          if (sprite) {
            sprite.texture = this.assets.wild(wild.multiplier);
            sprite.setSize(Math.min(this.layout.cellW, this.layout.cellH) * 1.0);
          }
          this.audio?.play('multiplier');
        }
        this.impactAt(index, row);
        this.audio?.play('wild');
      } else if (symbol === 'SCATTER') {
        this.popAt(index, row);
        this.audio?.play('scatter');
      }
    });
  }

  /** the vault lands hard: shake, light burst, gold everywhere (§8) */
  private impactAt(reel: number, row: number): void {
    const c = cellCenter(this.layout, reel, row);
    this.shake = Math.max(this.shake, this.turbo ? 8 : 16);

    const burst = new Sprite(this.assets.scene('burst'));
    burst.anchor.set(0.5);
    burst.position.set(c.x, c.y);
    burst.width = this.layout.cellW * 2.3;
    burst.height = this.layout.cellW * 2.3;
    burst.alpha = 0.85;
    this.fxLayer.addChild(burst);
    gsap.to(burst, { alpha: 0, duration: 0.5, onComplete: () => burst.destroy() });
    gsap.fromTo(burst.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.5, ease: 'power2.out' });

    this.emitParticles(c.x, c.y, 6, 'coin');
    const sprite = this.reels[reel]?.spriteForRow(row);
    if (sprite) {
      gsap.fromTo(
        sprite.scale,
        { x: sprite.scale.x * 1.3, y: sprite.scale.y * 1.3 },
        { x: sprite.scale.x, y: sprite.scale.y, duration: 0.45, ease: 'elastic.out(1, 0.5)' },
      );
    }
  }

  private popAt(reel: number, row: number): void {
    const sprite = this.reels[reel]?.spriteForRow(row);
    if (!sprite) return;
    gsap.fromTo(
      sprite.scale,
      { x: sprite.scale.x * 0.72, y: sprite.scale.y * 0.72 },
      { x: sprite.scale.x, y: sprite.scale.y, duration: 0.55, ease: 'back.out(3)' },
    );
    const c = cellCenter(this.layout, reel, row);
    this.emitParticles(c.x, c.y, 7, 'gem');
  }

  private showSuspense(fromReel: number): void {
    const l = this.layout;
    this.suspense.clear();
    this.suspense.rect(0, 0, l.screenW, l.screenH).fill({ color: 0x0a0208, alpha: 1 });
    this.suspense
      .roundRect(l.x + fromReel * l.cellW - 6, l.y - 6, l.cellW * (l.reels - fromReel) + 12, l.height + 12, 18)
      .cut();
    this.suspense.alpha = 0;
    gsap.to(this.suspense, { alpha: 0.6, duration: 0.35 });
  }

  private hideSuspense(): void {
    gsap.to(this.suspense, { alpha: 0, duration: 0.4 });
  }

  async presentWins(outcome: SpinOutcome, bet: number): Promise<void> {
    const sparkled = new Set<string>();
    outcome.lineWins.slice(0, 2).forEach((win) =>
      win.positions.forEach((p) => {
        const key = `${p.reel}:${p.row}`;
        if (sparkled.has(key)) return;
        sparkled.add(key);
        const c = cellCenter(this.layout, p.reel, p.row);
        this.emitParticles(c.x, c.y, 1, 'coin');
      }),
    );
    await this.winPresenter.present(outcome, bet);
  }

  async presentBigWin(tier: WinTier, amount: number, bet: number): Promise<void> {
    this.winPresenter.clear();
    this.shake = 22;
    await this.bigWinPresenter.present(tier, amount, bet, this.turbo);
  }

  async presentBonusTrigger(scatterCount: number, freeSpins: number): Promise<void> {
    this.audio?.play('freespins');
    this.shake = 18;
    await this.bonusPresenter.presentTrigger(scatterCount, freeSpins, this.turbo);
  }

  async presentBonusSummary(totalWin: number, spins: number): Promise<void> {
    await this.bonusPresenter.presentSummary(totalWin, spins, this.turbo);
  }

  clearWins(): void {
    this.winPresenter?.clear();
  }

  skip(): void {
    this.skipped = true;
    if (this.bigWinPresenter.isRunning) return this.bigWinPresenter.skip();
    if (this.bonusPresenter.isRunning) return this.bonusPresenter.skip();
    if (this.winPresenter.isActive) return this.winPresenter.skip();
    if (this.currentOutcome) {
      this.reels.forEach((reel, i) => {
        if (reel.isSpinning) reel.snapTo(this.currentOutcome!.grid[i]);
      });
      this.applyWildVariants(this.currentOutcome);
      this.audio?.stopAnticipation();
      this.hideSuspense();
    }
  }

  /** §9 free spins: the wild is chained down for the round */
  private refreshStickyLayer(): void {
    const grew = this.stickyWilds.length > this.stickyCount;
    this.stickyCount = this.stickyWilds.length;
    if (grew) this.audio?.play('lock');

    this.stickyLayer.removeChildren();
    this.stickyWilds.forEach((wild) => {
      const c = cellCenter(this.layout, wild.reel, wild.row);
      const wrap = new Container();
      const size = Math.min(this.layout.cellW, this.layout.cellH);

      const symbol = new Sprite(this.assets.wild(wild.multiplier));
      symbol.anchor.set(0.5);
      symbol.width = size;
      symbol.height = size;
      wrap.addChild(symbol);

      const frame = new Graphics();
      const half = size * 0.47;
      frame
        .roundRect(-half, -half, half * 2, half * 2, 16 * this.frameRect.scale)
        .stroke({ width: 7 * this.frameRect.scale, color: 0xffd257, alpha: 0.95 });
      frame
        .roundRect(-half, -half, half * 2, half * 2, 16 * this.frameRect.scale)
        .stroke({ width: 18 * this.frameRect.scale, color: 0xffb020, alpha: 0.22 });
      wrap.addChild(frame);

      const chain = new Graphics();
      chain.moveTo(-half, -half * 0.4).lineTo(half, half * 0.4).stroke({ width: 8 * this.frameRect.scale, color: 0x9a8a6a, alpha: 0.75 });
      chain.moveTo(-half, half * 0.4).lineTo(half, -half * 0.4).stroke({ width: 8 * this.frameRect.scale, color: 0x9a8a6a, alpha: 0.75 });
      wrap.addChild(chain);

      const lock = new Sprite(this.assets.scene('lock'));
      lock.anchor.set(0.5);
      lock.width = size * 0.3;
      lock.height = size * 0.3;
      lock.position.set(0, half * 0.62);
      wrap.addChild(lock);

      wrap.position.set(c.x, c.y);
      this.stickyLayer.addChild(wrap);
      gsap.fromTo(wrap.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(3)' });
      gsap.to(frame, { alpha: 0.55, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
  }

  /* ----------------------------- particles ----------------------------- */

  private emitParticles(x: number, y: number, count: number, kind: 'coin' | 'gem' | 'note'): void {
    for (let i = 0; i < count; i++) {
      let particle = this.particles.find((p) => !p.alive);
      if (!particle) {
        if (this.particles.length > 150) return;
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        this.fxLayer.addChild(sprite);
        particle = { sprite, vx: 0, vy: 0, spin: 0, life: 0, alive: false };
        this.particles.push(particle);
      }
      const size = this.layout.cellW * (0.12 + Math.random() * 0.12);
      particle.sprite.texture = this.assets.scene(kind) as Texture;
      particle.sprite.width = size;
      particle.sprite.height = kind === 'note' ? size * 0.62 : size;
      particle.sprite.visible = true;
      particle.sprite.alpha = 1;
      particle.sprite.position.set(x + (Math.random() - 0.5) * this.layout.cellW * 0.5, y);
      particle.vx = (Math.random() - 0.5) * 420;
      particle.vy = -260 - Math.random() * 380;
      particle.spin = (Math.random() - 0.5) * 10;
      particle.life = 0;
      particle.alive = true;
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life += dt;
      p.vy += 1250 * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      if (p.life > 0.55) p.sprite.alpha = Math.max(0, 1 - (p.life - 0.55) / 0.4);
      if (p.life > 0.98 || p.sprite.y > this.layout.screenH + 80) {
        p.alive = false;
        p.sprite.visible = false;
      }
    }
  }

  symbolImageUrl(symbol: SymbolId): string {
    return this.assets.symbolUrl(symbol);
  }

  sceneImageUrl(key: 'wildX2' | 'wildX3'): string {
    return this.assets.sceneUrl(key);
  }

  private timings(): Timings {
    return this.turbo ? this.config.timings.turbo : this.config.timings.normal;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('orientationchange', this.onOrientation);
    this.resizeObserver?.disconnect();
    this.app.ticker?.remove(this.tick);
    gsap.globalTimeline.clear();
    this.reels.forEach((reel) => reel.destroy());
    this.bigWinPresenter?.destroy();
    this.bonusPresenter?.destroy();
    this.app.destroy(true, { children: true });
  }
}
