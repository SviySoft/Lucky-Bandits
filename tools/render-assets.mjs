/* eslint-disable no-console */
/**
 * Offline asset pipeline.
 *
 *   npm run assets            -> render everything
 *   npm run assets -- boss    -> render only ids matching "boss"
 *
 * Authored SVG (art/sources/*.mjs) -> headless Chrome -> PNG (transparent) -> WebP.
 * The game loads the finished files; nothing here runs at play time.
 */
import { mkdir, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, '.art-cache');

const CHROME =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error('No Chrome/Chromium found. Set CHROME_PATH=/path/to/chrome');
  process.exit(1);
}

const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const skipWebp = process.argv.includes('--no-webp');

async function loadAssets() {
  const dir = path.join(root, 'art', 'sources');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mjs')).sort();
  const assets = [];
  for (const file of files) {
    const mod = await import(path.join(dir, file));
    const list = mod.assets ?? [];
    for (const asset of list) assets.push(asset);
  }
  return assets;
}

async function renderOne(asset) {
  const { id, out, width, height, html } = asset;
  const htmlPath = path.join(tmp, `${id}.html`);
  const pngPath = path.join(root, 'art', 'source', 'png', out);
  await mkdir(path.dirname(pngPath), { recursive: true });
  await writeFile(htmlPath, html, 'utf8');

  await exec(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      '--virtual-time-budget=1200',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { maxBuffer: 1024 * 1024 * 32 },
  );

  const info = await stat(pngPath);
  let webpSize = 0;
  if (!skipWebp && existsSync('/opt/homebrew/bin/cwebp')) {
    const webpPath = path.join(root, 'public', 'assets', out).replace(/\.png$/, '.webp');
    await mkdir(path.dirname(webpPath), { recursive: true });
    await exec('/opt/homebrew/bin/cwebp', ['-quiet', '-q', '90', '-alpha_q', '100', pngPath, '-o', webpPath]);
    webpSize = (await stat(webpPath)).size;
  }
  return { png: info.size, webp: webpSize };
}

const started = Date.now();
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });

const all = await loadAssets();
const todo = filter.length ? all.filter((a) => filter.some((f) => a.id.includes(f))) : all;

console.log(`\n  LUCKY BANDITS — asset pipeline`);
console.log(`  ${todo.length} of ${all.length} assets\n`);

let totalPng = 0;
let totalWebp = 0;
for (const asset of todo) {
  const { png, webp } = await renderOne(asset);
  totalPng += png;
  totalWebp += webp;
  const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
  console.log(
    `  ✓ ${asset.id.padEnd(22)} ${String(asset.width).padStart(4)}x${String(asset.height).padEnd(5)} ${kb(png).padStart(8)}${webp ? ` -> ${kb(webp)}` : ''}`,
  );
}

// runtime manifest
const manifest = {
  generated: new Date().toISOString(),
  assets: Object.fromEntries(all.map((a) => [a.id, { src: a.out, width: a.width, height: a.height }])),
};
await writeFile(path.join(root, 'art', 'source', 'assets-manifest.json'), JSON.stringify(manifest, null, 2));

await rm(tmp, { recursive: true, force: true });
console.log(
  `\n  done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${(totalPng / 1024 / 1024).toFixed(2)} MB png` +
    (totalWebp ? `, ${(totalWebp / 1024 / 1024).toFixed(2)} MB webp` : '') +
    '\n',
);
