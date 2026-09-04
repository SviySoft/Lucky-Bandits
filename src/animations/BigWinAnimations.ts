import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import gsap from 'gsap';
import type { WinTier } from '../game/types';
import type { BoardLayout } from '../render/RenderContext';
import { neonText } from '../render/RenderContext';
import { formatMoney } from '../game/config/game-config';

interface Coin {
  sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  alive: boolean;
}

interface TierStyle {
  label: string;
  color: number;
  glow: number;
  duration: number;
  ramp: [number, number][];
}

const TIER_STYLE: Record<Exclude<WinTier, 'NONE' | 'NORMAL'>, TierStyle> = {
  BIG: {
    label: 'BIG WIN',
    color: 0xffd257,
    glow: 0xff9d2e,
    duration: 2.6,
    ramp: [
      [0, 0xfffdf2],
      [0.3, 0xffe89a],
      [0.5, 0xffc93c],
      [0.62, 0xb87413],
      [0.78, 0xffe08a],
      [1, 0x8a5406],
    ],
  },
  MEGA: {
    label: 'MEGA WIN',
    color: 0xff6bd6,
    glow: 0xff2e88,
    duration: 3.4,
    ramp: [
      [0, 0xffffff],
      [0.3, 0xffc2e6],
      [0.5, 0xff4fa2],
      [0.64, 0x9c0d52],
      [0.8, 0xff8ac4],
      [1, 0x66052f],
    ],
  },
  EPIC: {
    label: 'EPIC WIN',
    color: 0x7ce8ff,
    glow: 0x2ef0ff,
    duration: 4.4,
    ramp: [
      [0, 0xffffff],
      [0.3, 0xc9f6ff],
      [0.5, 0x4fd8ff],
      [0.64, 0x0d5f8a],
      [0.8, 0x9df0ff],
      [1, 0x073d5c],
    ],
  },
};

/**
 * Big Win Animations — dark backdrop, rotating light rays, 3D-ish title,
 * flying coins and a fast counter. Skippable with a tap.
 */
export class BigWinPresenter {
  readonly container = new Container();
  private readonly backdrop = new Graphics();
  private readonly rays = new Graphics();
  private readonly coinLayer = new Container();
  private readonly textLayer = new Container();
  private readonly coins: Coin[] = [];
  private readonly art: {
    coin: Texture;
    gem: Texture;
    note: Texture;
    burst: Texture;
    big: Texture;
    mega: Texture;
    epic: Texture;
  };
  private readonly burst: Sprite;
  private running = false;
  private timeline: gsap.core.Timeline | null = null;

  constructor(
    _renderer: Renderer,
    private readonly layout: () => BoardLayout,
    private readonly onCoinSound: (() => void) | undefined,
    art: {
      coin: Texture;
      gem: Texture;
      note: Texture;
      burst: Texture;
      big: Texture;
      mega: Texture;
      epic: Texture;
    },
  ) {
    this.art = art;
    this.burst = new Sprite(art.burst);
    this.burst.anchor.set(0.5);
    this.burst.alpha = 0.3;
    this.container.addChild(this.backdrop, this.burst, this.rays, this.coinLayer, this.textLayer);
    this.container.visible = false;
    this.container.eventMode = 'none';
  }

  get isRunning(): boolean {
    return this.running;
  }

  skip(): void {
    if (!this.running) return;
    this.timeline?.progress(1);
  }

  async present(tier: WinTier, amount: number, bet: number, turbo: boolean): Promise<void> {
    if (tier === 'NONE' || tier === 'NORMAL') return;
    const style = TIER_STYLE[tier];
    const layout = this.layout();

    this.running = true;
    this.container.visible = true;
    this.container.alpha = 0;
    this.textLayer.removeChildren();

    this.backdrop.clear();
    // deliberately oversized: the curtain must cover the screen even mid-resize
    this.backdrop
      .rect(-layout.screenW, -layout.screenH, layout.screenW * 3, layout.screenH * 3)
      .fill({ color: 0x0a0206, alpha: 0.95 });

    this.drawRays(style.glow, layout);
    this.recentre();

    // §22: the delivered BIG / MEGA / EPIC WIN artwork, never re-drawn as text
    const titleTex = tier === 'EPIC' ? this.art.epic : tier === 'MEGA' ? this.art.mega : this.art.big;
    const title = new Sprite(titleTex);
    title.anchor.set(0.5);
    const titleW = Math.min(layout.screenW * 0.62, 620);
    title.width = titleW;
    title.height = (titleW / titleTex.width) * titleTex.height;
    title.position.set(0, -title.height * 0.34);
    title.scale.set(title.scale.x * 0.2, title.scale.y * 0.2);
    title.alpha = 0;
    const titleScale = { x: (titleW / titleTex.width), y: (titleW / titleTex.width) };

    const counter = neonText(formatMoney(0), {
      size: Math.round(Math.min(layout.screenW * 0.1, 80)),
      gradient: [
        [0, 0xffffff],
        [0.45, 0xfff3d0],
        [0.6, 0xffd257],
        [1, 0xb87413],
      ],
      glow: style.glow,
      letterSpacing: 2,
      strokeColor: 0x2b0f02,
      strokeWidth: 13,
    });
    counter.position.set(0, title.height * 0.46);

    const sub = neonText(`${(amount / bet).toFixed(2)}x YOUR BET`, {
      size: Math.round(20 * layout.scale),
      color: style.color,
      glow: style.glow,
      strokeWidth: 5,
    });
    sub.position.set(0, title.height * 0.46 + 62 * layout.scale);
    sub.alpha = 0;

    this.textLayer.addChild(title, counter, sub);

    const counterValue = { value: 0 };
    const duration = turbo ? style.duration * 0.45 : style.duration;

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      this.timeline = tl;
      this.container.scale.set(1.12);
      this.container.pivot.set(layout.screenW / 2, layout.screenH / 2);
      this.container.position.set(layout.screenW / 2, layout.screenH / 2);
      tl.to(this.container, { alpha: 1, duration: 0.22 })
        .to(this.container.scale, { x: 1, y: 1, duration: 1.1, ease: 'power2.out' }, 0)
        .to(title.scale, { x: titleScale.x, y: titleScale.y, duration: 0.55, ease: 'back.out(2.2)' }, 0)
        .to(title, { alpha: 1, duration: 0.3 }, 0)
        .to(
          counterValue,
          {
            value: amount,
            duration: duration * 0.62,
            ease: 'power1.inOut',
            onUpdate: () => {
              counter.text = formatMoney(counterValue.value);
              if (Math.random() < 0.25) this.spawnCoins(2, layout);
            },
          },
          0.25,
        )
        .to(sub, { alpha: 1, duration: 0.3 }, 0.5)
        .to(title.scale, { x: 1.06, y: 1.06, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.6)
        .to({}, { duration: turbo ? 0.2 : 0.7 })
        .to(this.container, { alpha: 0, duration: 0.35 });
      this.spawnCoins(28, layout);
      this.onCoinSound?.();
    });

    this.timeline = null;
    this.running = false;
    this.container.visible = false;
    this.clearCoins();
    this.textLayer.removeChildren();
  }

  update(dt: number): void {
    if (!this.container.visible) return;
    this.rays.rotation += dt * 0.25;
    this.burst.rotation -= dt * 0.16;
    // stay centred even if the viewport changes mid-animation (phone rotation)
    this.recentre();
    const layout = this.layout();
    this.coins.forEach((coin) => {
      if (!coin.alive) return;
      coin.vy += 1400 * dt;
      coin.sprite.x += coin.vx * dt;
      coin.sprite.y += coin.vy * dt;
      coin.sprite.rotation += coin.spin * dt;
      coin.sprite.skew.x = Math.sin(coin.sprite.rotation * 1.2) * 0.35;
      if (coin.sprite.y > layout.screenH + 80) {
        coin.alive = false;
        coin.sprite.visible = false;
      }
    });
  }

  private recentre(): void {
    const layout = this.layout();
    this.rays.position.set(layout.screenW / 2, layout.screenH / 2);
    this.textLayer.position.set(layout.screenW / 2, layout.screenH / 2);
    this.burst.position.set(layout.screenW / 2, layout.screenH / 2);
    const size = Math.max(layout.screenW, layout.screenH) * 1.35;
    this.burst.width = size;
    this.burst.height = size;
  }

  private spawnCoins(count: number, layout: BoardLayout): void {
    for (let i = 0; i < count; i++) {
      let coin = this.coins.find((c) => !c.alive);
      if (!coin) {
        if (this.coins.length > 90) return;
        const sprite = new Sprite(this.art.coin);
        sprite.anchor.set(0.5);
        this.coinLayer.addChild(sprite);
        coin = { sprite, vx: 0, vy: 0, spin: 0, alive: false };
        this.coins.push(coin);
      }
      coin.alive = true;
      coin.sprite.visible = true;
      const roll = Math.random();
      coin.sprite.texture = roll > 0.78 ? this.art.gem : roll > 0.6 ? this.art.note : this.art.coin;
      const size = layout.cellW * (0.34 + Math.random() * 0.34);
      coin.sprite.width = size;
      coin.sprite.height = coin.sprite.texture === this.art.note ? size * 0.62 : size;
      coin.sprite.x = layout.screenW / 2 + (Math.random() - 0.5) * layout.screenW * 0.7;
      coin.sprite.y = layout.screenH * 0.62 + Math.random() * 60;
      coin.vx = (Math.random() - 0.5) * 520;
      coin.vy = -520 - Math.random() * 620;
      coin.spin = (Math.random() - 0.5) * 12;
    }
  }

  private clearCoins(): void {
    this.coins.forEach((coin) => {
      coin.alive = false;
      coin.sprite.visible = false;
    });
  }

  private drawRays(color: number, layout: BoardLayout): void {
    const radius = Math.max(layout.screenW, layout.screenH);
    this.rays.clear();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const spread = 0.06;
      this.rays
        .moveTo(0, 0)
        .lineTo(Math.cos(a - spread) * radius, Math.sin(a - spread) * radius)
        .lineTo(Math.cos(a + spread) * radius, Math.sin(a + spread) * radius)
        .closePath()
        .fill({ color, alpha: i % 2 === 0 ? 0.05 : 0.025 });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
