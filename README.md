# LUCKY BANDITS — HTML5 video slot

A complete, production-ready 5×3 / 20-line video slot for the **SviySoft Casino Platform**.
A crew of charming bandits works a luxury vault casino: golden vault wilds with x2/x3
multipliers, a diamond key that opens free spins, and locked wilds that stay put for the
whole bonus round.

Built with TypeScript, React, Vite and PixiJS. No backend required to run — and a one-line
switch to hand RNG, maths and the wallet to a real casino server.

---

## Documentation

| document | for |
| --- | --- |
| [docs/INSTALL-HOSTING.md](docs/INSTALL-HOSTING.md) | uploading the built game to any static host |
| [docs/INSTALL-GITHUB.md](docs/INSTALL-GITHUB.md) | installing and building the source project |
| [docs/INSTALL-CODECANYON.md](docs/INSTALL-CODECANYON.md) | what is inside the purchased package |
| [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) | configuration, maths, artwork, API integration |

Open `docs/index.html` in a browser for the same set as a browsable site.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5180
```

| command | what it does |
| --- | --- |
| `npm run dev` | development server with hot reload |
| `npm run build` | type-checks and builds `dist/` for hosting |
| `npm run preview` | serves the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run simulate` | head-less RTP / volatility simulation |
| `npm run assets` | re-renders the generated effect artwork |

```bash
npm run simulate                   # 100 000 spins
npm run simulate -- 5000000        # 5 000 000 spins
npm run simulate -- 1000000 1 42   # spins, bet, seed
```

---

## The game

|  |  |
| --- | --- |
| Layout | 5 reels × 3 rows, **20 fixed paylines**, left to right from reel 1 |
| Bets | $0.20 · $0.40 · $0.60 · $1 · $2 · $5 · $10 · $20 · $50 · $100 |
| Wild | golden vault on reels 2–4, substitutes for everything except the Bonus key |
| Multipliers | wilds carry **x2 / x3**; several in one line multiply (x3 · x3 = x9) |
| Bonus | 3 / 4 / 5 keys → **8 / 12 / 15 free spins** (+0.5x / 2x / 5x total bet) |
| Free spins | every wild on reels 2–4 **locks in place** with its multiplier for the round |
| Big wins | BIG 10x · MEGA 25x · EPIC 50x, capped at 5 000x per round |
| Extras | auto play (10/25/50/100/∞), turbo, paytable, game history, jackpot ladder |

### Verified maths

```
Calculated RTP             95.9%      (measured over 20 000 000 simulated spins)
  - base game lines        58.0%
  - scatter pays            0.3%
  - free spins             37.4%
Hit frequency              32.6%      (1 in 3)
Free spin frequency         0.46%     (1 in 218 spins)
Maximum win observed       2 648 x bet
Volatility index (sigma)   13.2       -> HIGH volatility
```

`npm run simulate` runs the **same engine the browser runs** — same reel strips, paytable
and bonus rules; only the RNG is swapped for a seeded one so runs are reproducible.
Nothing about the maths is hard-coded in the renderer: change a number in
`src/game/config/` and re-run the simulation.

---

## Project layout

```
src/
  game/                    the slot itself — no rendering, no DOM
    GameEngine.ts          orchestrates api <-> state machine <-> presenter <-> audio
    GameState.ts           explicit state machine, illegal transitions throw
    engine/                RNG · reels · win evaluator · bonus · maths · win tiers
    config/                bets, reel strips, paytable, paylines, jackpots, timings
    wallet/WalletService.ts   balance, debit/credit/rollback, transaction log
    api/GameAPI.ts         IGameAPI + LocalGameAPI (in-browser) + RemoteGameAPI (HTTP)
  render/                  PixiJS scene, reels, asset loader, scene layout
  animations/              spin, win, big win and bonus presentation
  audio/AudioManager.ts    all sound synthesised at runtime — no audio files to ship
  ui/                      React interface anchored to the painted scene
  simulation/              head-less RTP simulator and tuning tool
  dev/DebugPanel.tsx       development only, dropped from production builds
art/
  source/                  PNG masters, sliced sheet output, scene layout
  sources/                 authored SVG for the generated effect artwork
public/assets/             the artwork the browser actually loads (WebP)
tools/                     asset pipeline and screenshot capture
docs/                      documentation and screenshots
```

---

## Artwork

Every visual is a finished file — the game never draws artwork at runtime.

* **Symbols, logo and win banners** are sliced from the delivered master sheet by
  `tools/slice-sheet.mjs`: the background is removed by region-growing from the image
  border using the artwork's own dark contours as walls, then each piece is eroded,
  feathered, trimmed, centred and exported.
* **The game screen** is cut from the delivered reference render by
  `tools/extract-scene.mjs`: the reel window is knocked through to transparency so the
  live reels show inside the machine, and every painted value (balance, jackpots, free
  spins, message, bet, win, clock) is erased so the running game can own it. All those
  coordinates are exported to `src/render/sceneLayout.ts`.
* **Effects** (coin, gem, note, lock, burst) are rendered offline from authored SVG by
  `npm run assets`.

```bash
node tools/slice-sheet.mjs   path/to/master-asset-sheet.png
node tools/contact-sheet.mjs                     # visual check of every cut
node tools/extract-scene.mjs path/to/game-screen-reference.png --debug
```

Runtime artwork ships as **WebP only** (~1.8 MB); the PNG masters live in
`art/source/png/`. To replace the artwork, drop files with the same names into
`public/assets/` — `src/render/AssetLoader.ts` is the only place that maps a symbol to a
file.

---

## Going server-authoritative

`IGameAPI` already has the production shape:

| method | endpoint |
| --- | --- |
| `createSession(bet)` | `POST /game/session` |
| `spin(request)` | `POST /game/spin` |
| `bonusSpin(request)` | `POST /game/bonus` |
| `getBalance(sessionId)` | `GET /game/balance` |
| `getHistory(sessionId)` | `GET /game/history` |

Copy `.env.example` to `.env` and fill in:

```
VITE_GAME_API_URL=https://your-casino.example.com/api
VITE_GAME_API_TOKEN=player-session-token
```

With both set, the client stops deciding anything and only renders what the server
returns. Everything the server needs is already in the contract: unique transaction ids
on every movement, idempotency keys so a replayed request never charges twice, session
validation, a rollback path, and a full audit record per spin.

---

## Controls

| input | action |
| --- | --- |
| `SPIN` / `Space` / `Enter` | spin, or fast-forward the current animation |
| `BET` − / + | change stake; the value opens the full bet list |
| `AUTO PLAY` | auto spin menu; press again to stop |
| `TURBO` | shorter animations, identical maths |
| `I` / `H` | paytable / game history |
| `Ctrl + Shift + D` | debug panel (development builds only) |

---

## Browser support & performance

* Chrome, Edge, Safari 14+, Firefox — desktop and mobile, portrait and landscape.
* WebGL rendering at 60 FPS; the reel board costs 25 sprites regardless of spin length.
* ~2 MB of artwork downloaded, ~280 kB gzipped code.
* All sound is synthesised with the Web Audio API — nothing to download, nothing to
  license.

---

© SviySoft. See `LICENSE`.
