import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import type { BoardLayout } from '../render/RenderContext';
import { neonText } from '../render/RenderContext';
import { formatMoney } from '../game/config/game-config';

/**
 * Bonus Animations — the "FREE SPINS AWARDED" curtain and the end-of-round summary.
 */
export class BonusPresenter {
  readonly container = new Container();
  private readonly backdrop = new Graphics();
  private readonly art = new Graphics();
  private readonly textLayer = new Container();
  private timeline: gsap.core.Timeline | null = null;
  private running = false;

  private readonly burst: Sprite;
  private readonly coinLayer = new Container();
  private readonly coins: { sprite: Sprite; vy: number; vx: number; spin: number }[] = [];

  constructor(
    private readonly layout: () => BoardLayout,
    artTex: { burst: Texture; coin: Texture },
  ) {
    this.burst = new Sprite(artTex.burst);
    this.burst.anchor.set(0.5);
    this.burst.alpha = 0.34;
    for (let i = 0; i < 40; i++) {
      const sprite = new Sprite(artTex.coin);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.coinLayer.addChild(sprite);
      this.coins.push({ sprite, vy: 0, vx: 0, spin: 0 });
    }
    this.container.addChild(this.backdrop, this.burst, this.art, this.coinLayer, this.textLayer);
    this.container.visible = false;
    this.container.eventMode = 'none';
  }

  get isRunning(): boolean {
    return this.running;
  }

  skip(): void {
    if (this.running) this.timeline?.progress(1);
  }

  presentTrigger(scatterCount: number, spins: number, turbo: boolean): Promise<void> {
    return this.show({
      title: 'FREE SPINS',
      subtitle: `${spins} SPINS AWARDED`,
      footnote: `${scatterCount} SCATTERS`,
      color: 0xffd257,
      glow: 0xff9d2e,
      ramp: [
        [0, 0xfffdf2],
        [0.32, 0xffe89a],
        [0.5, 0xffc93c],
        [0.64, 0xb87413],
        [0.8, 0xffe08a],
        [1, 0x8a5406],
      ],
      turbo,
      hold: turbo ? 0.5 : 1.5,
    });
  }

  presentSummary(totalWin: number, spins: number, turbo: boolean): Promise<void> {
    return this.show({
      title: 'BONUS COMPLETE',
      subtitle: formatMoney(totalWin),
      footnote: `IN ${spins} FREE SPINS`,
      color: 0x7ce8ff,
      glow: 0x2ef0ff,
      ramp: [
        [0, 0xffffff],
        [0.32, 0xc9f6ff],
        [0.5, 0x4fd8ff],
        [0.64, 0x0d5f8a],
        [0.8, 0x9df0ff],
        [1, 0x073d5c],
      ],
      turbo,
      hold: turbo ? 0.5 : 1.7,
    });
  }

  update(dt: number): void {
    if (!this.container.visible) return;
    this.art.rotation += dt * 0.18;
    this.burst.rotation += dt * 0.09;
    const layout = this.layout();
    for (const coin of this.coins) {
      if (!coin.sprite.visible) continue;
      coin.vy += 900 * dt;
      coin.sprite.x += coin.vx * dt;
      coin.sprite.y += coin.vy * dt;
      coin.sprite.rotation += coin.spin * dt;
      if (coin.sprite.y > layout.screenH + 100) coin.sprite.visible = false;
    }
    this.recentre();
  }

  /** the vault bursts open and money rains down */
  private rainCoins(): void {
    const layout = this.layout();
    this.coins.forEach((coin, i) => {
      const size = layout.cellW * (0.3 + Math.random() * 0.4);
      coin.sprite.visible = true;
      coin.sprite.width = size;
      coin.sprite.height = size;
      coin.sprite.x = Math.random() * layout.screenW;
      coin.sprite.y = -100 - Math.random() * 600 - i * 8;
      coin.vx = (Math.random() - 0.5) * 120;
      coin.vy = 200 + Math.random() * 300;
      coin.spin = (Math.random() - 0.5) * 8;
    });
  }

  private recentre(): void {
    const layout = this.layout();
    this.art.position.set(layout.screenW / 2, layout.screenH / 2);
    this.textLayer.position.set(layout.screenW / 2, layout.screenH / 2);
    this.burst.position.set(layout.screenW / 2, layout.screenH / 2);
    const size = Math.max(layout.screenW, layout.screenH) * 1.5;
    this.burst.width = size;
    this.burst.height = size;
  }

  private async show(options: {
    title: string;
    subtitle: string;
    footnote: string;
    color: number;
    glow: number;
    ramp: [number, number][];
    turbo: boolean;
    hold: number;
  }): Promise<void> {
    const layout = this.layout();
    this.running = true;
    this.container.visible = true;
    this.container.alpha = 0;
    this.textLayer.removeChildren();

    this.backdrop.clear();
    this.backdrop
      .rect(-layout.screenW, -layout.screenH, layout.screenW * 3, layout.screenH * 3)
      .fill({ color: 0x0a0206, alpha: 0.93 });

    this.art.clear();
    const radius = Math.min(layout.screenW, layout.screenH) * 0.42;
    for (let i = 0; i < 5; i++) {
      this.art.circle(0, 0, radius - i * 26).stroke({
        width: 2,
        color: options.color,
        alpha: 0.06 + i * 0.03,
      });
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      this.art
        .moveTo(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55)
        .lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
        .stroke({ width: i % 3 === 0 ? 4 : 2, color: options.color, alpha: i % 3 === 0 ? 0.22 : 0.1 });
    }
    this.recentre();

    const title = neonText(options.title, {
      size: Math.round(Math.min(layout.screenW * 0.115, 98)),
      gradient: options.ramp,
      glow: options.glow,
      letterSpacing: 8,
      strokeColor: 0x2b0f02,
      strokeWidth: 15,
    });
    title.position.set(0, -54 * layout.scale);
    title.scale.set(0.4);

    const subtitle = neonText(options.subtitle, {
      size: Math.round(Math.min(layout.screenW * 0.075, 56)),
      gradient: [
        [0, 0xffffff],
        [0.5, 0xf2f6ff],
        [0.62, 0xb9c8ea],
        [1, 0xffffff],
      ],
      glow: options.glow,
      letterSpacing: 4,
      strokeColor: 0x2b0f02,
      strokeWidth: 12,
    });
    subtitle.position.set(0, 36 * layout.scale);
    subtitle.alpha = 0;

    const footnote = neonText(options.footnote, {
      size: Math.round(19 * layout.scale),
      color: options.color,
      glow: options.glow,
      letterSpacing: 5,
      strokeWidth: 4,
    });
    footnote.position.set(0, 96 * layout.scale);
    footnote.alpha = 0;

    this.textLayer.addChild(title, subtitle, footnote);

    this.rainCoins();
    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      this.timeline = tl;
      this.burst.scale.set(0.2);
      tl.to(this.container, { alpha: 1, duration: 0.25 })
        .to(this.burst.scale, { x: 1, y: 1, duration: 1.2, ease: 'power3.out' }, 0)
        .to(title.scale, { x: 1, y: 1, duration: 0.6, ease: 'back.out(2.6)' }, 0)
        .to(subtitle, { alpha: 1, duration: 0.35 }, 0.35)
        .fromTo(subtitle.scale, { x: 0.7, y: 0.7 }, { x: 1, y: 1, duration: 0.45, ease: 'back.out(2)' }, 0.35)
        .to(footnote, { alpha: 1, duration: 0.3 }, 0.6)
        .to({}, { duration: options.hold })
        .to(this.container, { alpha: 0, duration: 0.35 });
    });

    this.timeline = null;
    this.running = false;
    this.container.visible = false;
    this.textLayer.removeChildren();
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
