import { Assets, Texture } from 'pixi.js';
import type { SymbolId } from '../game/types';

/**
 * Asset loader — LUCKY BANDITS.
 *
 * Symbols, logo and win banners are slices of the delivered master sheet
 * (`tools/slice-sheet.mjs`); the hall and the cabinet are rendered by the art pipeline
 * (`npm run assets`). Nothing is drawn procedurally at play time: the game only loads
 * finished textures, so new artwork is a file swap.
 */
export const SYMBOL_ART: Record<SymbolId, string> = {
  BOSS: 'lucky-bandits/characters/boss',
  HACKER: 'lucky-bandits/characters/hacker',
  DRIVER: 'lucky-bandits/characters/driver',
  LADY: 'lucky-bandits/characters/lady',
  DIAMOND: 'lucky-bandits/premium/diamond',
  CASH: 'lucky-bandits/premium/cash',
  WATCH: 'lucky-bandits/premium/watch',
  CHIPS: 'lucky-bandits/premium/chips',
  A: 'lucky-bandits/low/a',
  K: 'lucky-bandits/low/k',
  Q: 'lucky-bandits/low/q',
  J: 'lucky-bandits/low/j',
  TEN: 'lucky-bandits/low/10',
  WILD: 'lucky-bandits/wild/wild',
  SCATTER: 'lucky-bandits/special/bonus',
};

export const SCENE_ART = {
  /** the reference render itself: hall, machine, crew, panels — reel window knocked out */
  plate: 'lucky-bandits/ui/scene-plate',
  logo: 'lucky-bandits/logo/lucky-bandits-logo',
  wildX2: 'lucky-bandits/wild/wild-x2',
  wildX3: 'lucky-bandits/wild/wild-x3',
  bigWin: 'lucky-bandits/wins/big-win',
  megaWin: 'lucky-bandits/wins/mega-win',
  epicWin: 'lucky-bandits/wins/epic-win',
  coin: 'effects/coin',
  gem: 'effects/gem',
  note: 'effects/note',
  burst: 'effects/burst',
  lock: 'effects/lock',
} as const;

/** the reel window cut into the cabinet, in cabinet-texture pixels */
export const FRAME_WINDOW = { x: 96, y: 146, width: 1108, height: 646, texW: 1300, texH: 900 };

/**
 * How much of a cell each symbol fills. The sheet art is already tightly cropped, so
 * these stay close to 1 — characters a touch larger so faces read on a phone (§13).
 */
export const SYMBOL_SCALE: Partial<Record<SymbolId, number>> = {
  BOSS: 0.94,
  HACKER: 0.94,
  DRIVER: 0.94,
  LADY: 0.94,
  DIAMOND: 0.99,
  CASH: 0.99,
  WATCH: 0.99,
  CHIPS: 0.99,
  A: 0.88,
  K: 0.88,
  Q: 0.88,
  J: 0.88,
  TEN: 0.88,
  WILD: 1.0,
  SCATTER: 1.02,
};

const BASE = `${import.meta.env.BASE_URL ?? '/'}assets/`.replace(/\/+/g, '/');

/**
 * Runtime artwork ships as WebP only — every browser that can run a WebGL slot supports
 * it, and it keeps the payload at ~2 MB instead of ~18 MB. The PNG masters are kept in
 * `art/source/png/` and can be re-exported with `npm run assets`.
 */
const EXT = '.webp';

export class AssetLoader {
  private textures = new Map<string, Texture>();
  private ext = EXT;
  private loaded = 0;
  private total = 0;

  get progress(): number {
    return this.loaded / Math.max(1, this.total);
  }

  async loadAll(onProgress?: (p: number) => void): Promise<void> {
    const keys = [...new Set([...Object.values(SYMBOL_ART), ...Object.values(SCENE_ART)])];
    this.total = keys.length;
    this.loaded = 0;

    await Promise.all(
      keys.map(async (key) => {
        const url = `${BASE}${key}${this.ext}`;
        try {
          this.textures.set(key, (await Assets.load(url)) as Texture);
        } catch {
          this.textures.set(key, Texture.EMPTY);
        }
        this.loaded += 1;
        onProgress?.(this.progress);
      }),
    );
  }

  get(key: string): Texture {
    return this.textures.get(key) ?? Texture.EMPTY;
  }

  symbol(id: SymbolId): Texture {
    return this.get(SYMBOL_ART[id]);
  }

  /** §14: the engine picks the finished wild / wild x2 / wild x3 artwork */
  wild(multiplier: number): Texture {
    if (multiplier >= 3) return this.scene('wildX3');
    if (multiplier === 2) return this.scene('wildX2');
    return this.symbol('WILD' as SymbolId);
  }

  symbolScale(id: SymbolId): number {
    return SYMBOL_SCALE[id] ?? 1;
  }

  scene(key: keyof typeof SCENE_ART): Texture {
    return this.get(SCENE_ART[key]);
  }

  symbolUrl(id: SymbolId): string {
    return `${BASE}${SYMBOL_ART[id]}${this.ext}`;
  }

  sceneUrl(key: keyof typeof SCENE_ART): string {
    return `${BASE}${SCENE_ART[key]}${this.ext}`;
  }
}
