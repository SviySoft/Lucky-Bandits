/* eslint-disable no-console */
/**
 * Screenshot tool: drives a real Chrome through the DevTools protocol so the game
 * is fully loaded (WebGL, assets, first spin) before each frame is captured.
 *
 *   node tools/capture.mjs [url]
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_TARGET = process.argv[2] ?? 'http://localhost:5180';
const PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false, dsf: 2 },
  { name: 'macbook-1512x982', width: 1512, height: 982, mobile: false, dsf: 2 },
  { name: 'iphone-portrait-390x844', width: 390, height: 844, mobile: true, dsf: 3 },
  { name: 'iphone-landscape-844x390', width: 844, height: 390, mobile: true, dsf: 3 },
  { name: 'android-portrait-412x915', width: 412, height: 915, mobile: true, dsf: 2.6 },
];

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--hide-scrollbars',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1600,1000',
  'about:blank',
]);
chrome.stderr.on('data', () => {});

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error('Chrome did not expose a debugging target');
}

const ws = new WebSocket(await connect());
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result ?? {});
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await mkdir('docs/screenshots', { recursive: true });

for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.dsf,
    mobile: vp.mobile,
  });
  await send('Page.navigate', { url: URL_TARGET });
  await sleep(7000);
  if (!process.argv.includes('--idle')) {
    // let the reels settle on a real spin so the shot shows the game, not the idle board
    await send('Runtime.evaluate', {
      expression: `(() => { const b = document.querySelector('.spin-btn'); if (b) b.click(); })()`,
    });
    await sleep(4600);
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`docs/screenshots/${vp.name}.png`, Buffer.from(data, 'base64'));
  console.log(`  ✓ ${vp.name}`);
}

ws.close();
chrome.kill();
console.log('\n  screenshots written to ./docs/screenshots\n');
