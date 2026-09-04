import { FillGradient, Text, TextStyle } from 'pixi.js';

export interface BoardLayout {
  /** top-left of the reel area */
  x: number;
  y: number;
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  reels: number;
  rows: number;
  /** full canvas size */
  screenW: number;
  screenH: number;
  /** ui scale factor, 1 = desktop reference */
  scale: number;
}

export function cellCenter(layout: BoardLayout, reel: number, row: number): { x: number; y: number } {
  return {
    x: layout.x + reel * layout.cellW + layout.cellW / 2,
    y: layout.y + row * layout.cellH + layout.cellH / 2,
  };
}

export const DISPLAY_FONT =
  'Orbitron, "Rajdhani", "Segoe UI", system-ui, -apple-system, sans-serif';

export function neonText(
  value: string,
  options: {
    size: number;
    color?: number;
    glow?: number;
    weight?: '400' | '600' | '700' | '900';
    letterSpacing?: number;
    strokeColor?: number;
    strokeWidth?: number;
    /** vertical metal ramp — turns flat text into a cast-metal wordmark */
    gradient?: [number, number][];
  },
): Text {
  const fill = options.gradient
    ? {
        fill: new FillGradient({
          type: 'linear',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 1 },
          colorStops: options.gradient.map(([offset, color]) => ({ offset, color })),
          textureSpace: 'local',
        }),
      }
    : (options.color ?? 0xffffff);

  const text = new Text({
    text: value,
    style: new TextStyle({
      fontFamily: DISPLAY_FONT,
      fontSize: options.size,
      fontWeight: options.weight ?? '900',
      letterSpacing: options.letterSpacing ?? 2,
      fill,
      stroke:
        options.strokeWidth === 0
          ? undefined
          : { color: options.strokeColor ?? 0x12021f, width: options.strokeWidth ?? 6, join: 'round' },
      dropShadow: {
        color: options.glow ?? 0xff2e88,
        blur: 16,
        distance: 0,
        alpha: 0.95,
        angle: 0,
      },
      align: 'center',
    }),
  });
  text.anchor.set(0.5);
  return text;
}

/** warm casino palette — the lines have to sit on gold and violet without shouting */
export const PAYLINE_COLORS = [
  0xffd257, 0xff9d2e, 0xff5ad1, 0xffe071, 0xffb020, 0xff7ab8, 0xffc46b, 0xff8f5a, 0xffd9a0, 0xff5a8c,
  0xffa229, 0xffe9a8, 0xff6b52, 0xffcf4a, 0xff8fe0, 0xffb45c, 0xff4d8f, 0xffd257, 0xff9a3c, 0xffbf6b,
];
