/* eslint-disable no-console */
/**
 * Master asset sheet slicer.
 *
 * The sheet has a smooth golden background and every symbol is an island on it, so the
 * background is removed by region-growing from the image border (which tolerates the
 * gradient but stops at the artwork's dark contours). Connected components of what is
 * left are the assets; each is trimmed, feathered, padded and exported as PNG + WebP.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SHEET = process.argv[2] ?? '/Users/sviysoft/Desktop/444444.png';
const OUT = 'art/source/png/lucky-bandits';
const RUNTIME = 'public/assets/lucky-bandits';

const LOCAL_TOLERANCE = 22; // how far the background may drift between neighbours
const SEED_TOLERANCE = 120; // hard leash so a leak cannot eat an object
const EDGE_BLOCK = 26; // artwork has dark contours: the flood is not allowed to cross them
const MIN_AREA = 2500;

const src = sharp(SHEET).ensureAlpha();
const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
console.log(`sheet ${W}x${H}x${C}`);

const at = (x, y) => (y * W + x) * C;
const dist = (a, b) =>
  Math.max(Math.abs(data[a] - data[b]), Math.abs(data[a + 1] - data[b + 1]), Math.abs(data[a + 2] - data[b + 2]));

/* ---------- 0. edge map: the artwork's contours are walls for the flood ---------- */
const lum = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  lum[i] = 0.299 * data[i * C] + 0.587 * data[i * C + 1] + 0.114 * data[i * C + 2];
}
const edge = new Float32Array(W * H);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx =
      -lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1] + lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1];
    const gy =
      -lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1] + lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1];
    edge[i] = Math.sqrt(gx * gx + gy * gy) / 4;
  }
}

/* ---------- 1. flood the background in from every border pixel ---------- */
const bg = new Uint8Array(W * H);
const queue = new Int32Array(W * H);
let qh = 0;
let qt = 0;
const push = (x, y, seed) => {
  const i = y * W + x;
  if (bg[i]) return;
  bg[i] = 1;
  seedOf[i] = seed;
  queue[qt++] = i;
};
const seedOf = new Int32Array(W * H);

for (let x = 0; x < W; x++) {
  push(x, 0, at(x, 0));
  push(x, H - 1, at(x, H - 1));
}
for (let y = 0; y < H; y++) {
  push(0, y, at(0, y));
  push(W - 1, y, at(W - 1, y));
}

while (qh < qt) {
  const i = queue[qh++];
  const x = i % W;
  const y = (i / W) | 0;
  const here = at(x, y);
  const seed = seedOf[i];
  const step = (nx, ny) => {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
    const ni = ny * W + nx;
    if (bg[ni]) return;
    const n = at(nx, ny);
    if (edge[ni] > EDGE_BLOCK) return;
    if (dist(here, n) > LOCAL_TOLERANCE) return;
    if (dist(seed, n) > SEED_TOLERANCE) return;
    bg[ni] = 1;
    seedOf[ni] = seed;
    queue[qt++] = ni;
  };
  step(x + 1, y);
  step(x - 1, y);
  step(x, y + 1);
  step(x, y - 1);
}

const bgCount = bg.reduce((a, b) => a + b, 0);
console.log(`background: ${((bgCount / (W * H)) * 100).toFixed(1)}% of the sheet`);

/* ---------- 2. label what is left ---------- */
const label = new Int32Array(W * H).fill(-1);
const boxes = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (bg[i] || label[i] !== -1) continue;
    const id = boxes.length;
    let minX = x;
    let maxX = x;
    let minY = y;
    let maxY = y;
    let area = 0;
    let qh2 = 0;
    let qt2 = 0;
    queue[qt2++] = i;
    label[i] = id;
    while (qh2 < qt2) {
      const j = queue[qh2++];
      const jx = j % W;
      const jy = (j / W) | 0;
      area++;
      if (jx < minX) minX = jx;
      if (jx > maxX) maxX = jx;
      if (jy < minY) minY = jy;
      if (jy > maxY) maxY = jy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx;
          const ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nj = ny * W + nx;
          if (bg[nj] || label[nj] !== -1) continue;
          label[nj] = id;
          queue[qt2++] = nj;
        }
      }
    }
    boxes.push({ id, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
}

const big = boxes.filter((b) => b.area >= MIN_AREA).sort((a, b) => a.y - b.y || a.x - b.x);
console.log(`\n${big.length} components (>= ${MIN_AREA}px):`);
big.forEach((b) =>
  console.log(`  #${String(b.id).padStart(3)}  x=${String(b.x).padStart(4)} y=${String(b.y).padStart(4)}  ${String(b.w).padStart(4)}x${String(b.h).padStart(4)}  area=${b.area}`),
);

await mkdir(OUT, { recursive: true });
await writeFile(path.join('art', 'source', 'sheet-components.json'), JSON.stringify(big, null, 2));

/* ---------- 3. export the named assets ---------- */
/** hand-verified against the component list above */
const ASSETS = [
  { file: 'logo/lucky-bandits-logo', box: [20, 3, 583, 332], scale: 2 },
  { file: 'wild/wild', box: [630, 13, 311, 321], scale: 2 },
  { file: 'wild/wild-x2', box: [979, 19, 265, 307], scale: 2 },
  { file: 'wild/wild-x3', box: [1271, 22, 250, 299], scale: 2 },
  { file: 'characters/boss', box: [9, 333, 276, 279], scale: 2 },
  { file: 'characters/lady', box: [310, 344, 273, 273], scale: 2 },
  { file: 'characters/hacker', box: [607, 349, 276, 268], scale: 2 },
  { file: 'characters/driver', box: [901, 345, 274, 272], scale: 2 },
  { file: 'special/bonus', box: [1211, 348, 309, 277], scale: 2 },
  { file: 'premium/cash', box: [13, 622, 239, 193], scale: 2 },
  { file: 'premium/gold', box: [284, 638, 273, 166], scale: 2 },
  { file: 'premium/watch', box: [592, 644, 222, 166], scale: 2 },
  { file: 'premium/chips', box: [857, 631, 232, 186], scale: 2 },
  { file: 'premium/diamond', box: [1128, 637, 233, 177], scale: 2 },
  { file: 'low/a', box: [5, 830, 167, 165], scale: 2 },
  { file: 'low/k', box: [205, 814, 147, 187], scale: 2 },
  { file: 'low/q', box: [389, 818, 156, 189], scale: 2 },
  { file: 'low/j', box: [584, 835, 159, 165], scale: 2 },
  { file: 'low/10', box: [774, 837, 178, 160], scale: 2 },
  { file: 'wins/big-win', box: [1004, 827, 160, 169], scale: 3 },
  { file: 'wins/mega-win', box: [1172, 818, 161, 184], scale: 3 },
  { file: 'wins/epic-win', box: [1346, 802, 181, 200], scale: 3 },
];

/** 1px erosion kills the gold halo the sheet's background leaves on soft edges */
function buildAlpha(x0, y0, w, h) {
  const raw = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      raw[y * w + x] = sx >= 0 && sy >= 0 && sx < W && sy < H && !bg[sy * W + sx] ? 255 : 0;
    }
  }
  const eroded = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let keep = raw[y * w + x];
      if (keep) {
        for (let dy = -1; dy <= 1 && keep; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || !raw[ny * w + nx]) {
              keep = 0;
              break;
            }
          }
        }
      }
      eroded[y * w + x] = keep;
    }
  }
  return eroded;
}

const exported = [];
for (const asset of ASSETS) {
  const [bx, by, bw, bh] = asset.box;
  const pad = 6;
  const x0 = Math.max(0, bx - pad);
  const y0 = Math.max(0, by - pad);
  const w = Math.min(W - x0, bw + pad * 2);
  const h = Math.min(H - y0, bh + pad * 2);

  const alpha = buildAlpha(x0, y0, w, h);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * W + (x0 + x)) * C;
      const d = (y * w + x) * 4;
      out[d] = data[s];
      out[d + 1] = data[s + 1];
      out[d + 2] = data[s + 2];
      out[d + 3] = alpha[y * w + x];
    }
  }

  const target = path.join(OUT, `${asset.file}.png`);
  await mkdir(path.dirname(target), { recursive: true });

  // soften the cut by a hair, then trim to the real content and give it breathing room
  const base = sharp(out, { raw: { width: w, height: h, channels: 4 } });
  const blurredAlpha = await base.clone().extractChannel(3).blur(0.6).toBuffer();
  const colours = await base.clone().removeAlpha().toBuffer();
  const merged = sharp(colours, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(blurredAlpha, { raw: { width: w, height: h, channels: 1 } })
    .png();

  const trimmed = await merged.trim({ threshold: 2 }).toBuffer({ resolveWithObject: true });
  const tw = trimmed.info.width;
  const th = trimmed.info.height;
  const scale = asset.scale ?? 1;
  const padded = Math.round(Math.max(tw, th) * 1.06 * scale);

  await sharp(trimmed.data)
    .resize({ width: Math.round(tw * scale), height: Math.round(th * scale), kernel: 'lanczos3' })
    .extend({
      top: Math.round((padded - th * scale) / 2),
      bottom: padded - Math.round(th * scale) - Math.round((padded - th * scale) / 2),
      left: Math.round((padded - tw * scale) / 2),
      right: padded - Math.round(tw * scale) - Math.round((padded - tw * scale) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(target);

  const runtimeTarget = path.join(RUNTIME, `${asset.file}.webp`);
  await mkdir(path.dirname(runtimeTarget), { recursive: true });
  await sharp(target).webp({ quality: 92, alphaQuality: 100 }).toFile(runtimeTarget);
  const meta = await sharp(target).metadata();
  exported.push({ file: asset.file, width: meta.width, height: meta.height });
  console.log(`  ✓ ${asset.file.padEnd(30)} ${meta.width}x${meta.height}`);
}

await writeFile(path.join('art', 'source', 'sheet-manifest.json'), JSON.stringify({ generated: new Date().toISOString(), assets: exported }, null, 2));

/* ---------- 3. debug view of the mask ---------- */
const dbg = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const on = !bg[i];
  dbg[i * 4] = on ? data[i * C] : 30;
  dbg[i * 4 + 1] = on ? data[i * C + 1] : 30;
  dbg[i * 4 + 2] = on ? data[i * C + 2] : 40;
  dbg[i * 4 + 3] = 255;
}
await sharp(dbg, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toFile(path.join(OUT, '_mask-debug.png'));
console.log('\nmask preview -> art/source/sheet-mask-debug.png');
