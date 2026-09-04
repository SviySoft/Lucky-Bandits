/* eslint-disable no-console */
/** Builds a contact sheet of every sliced asset so the cuts can be eyeballed. */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'art/source/png/lucky-bandits';
const manifest = JSON.parse(await readFile('art/source/sheet-manifest.json', 'utf8'));
const CELL = 250;
const COLS = 6;
const rows = Math.ceil(manifest.assets.length / COLS);
const W = COLS * CELL;
const H = rows * CELL;

// checkerboard so transparency and white halos are obvious
const checker = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
     <defs><pattern id="c" width="24" height="24" patternUnits="userSpaceOnUse">
       <rect width="24" height="24" fill="#2b2b33"/>
       <rect width="12" height="12" fill="#3a3a45"/>
       <rect x="12" y="12" width="12" height="12" fill="#3a3a45"/>
     </pattern></defs>
     <rect width="${W}" height="${H}" fill="url(#c)"/>
   </svg>`,
);

const layers = [];
for (let i = 0; i < manifest.assets.length; i++) {
  const asset = manifest.assets[i];
  const col = i % COLS;
  const row = (i / COLS) | 0;
  const size = CELL - 46;
  const buf = await sharp(path.join(OUT, `${asset.file}.png`))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  layers.push({ input: buf, left: col * CELL + 23, top: row * CELL + 8 });
  layers.push({
    input: Buffer.from(
      `<svg width="${CELL}" height="30" xmlns="http://www.w3.org/2000/svg">
        <text x="${CELL / 2}" y="20" text-anchor="middle" font-family="Helvetica" font-size="15"
              fill="#ffe9a8">${asset.file}</text></svg>`,
    ),
    left: col * CELL,
    top: row * CELL + CELL - 30,
  });
}

await sharp(checker).composite(layers).png().toFile('docs/screenshots/contact-sheet.png');
console.log(`contact sheet -> docs/screenshots/contact-sheet.png (${W}x${H})`);
