# Changelog

All notable changes to LUCKY BANDITS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-08-28

First public release.

### Game
- 5×3 reels, 20 fixed paylines, ten bet levels from $0.20 to $100.
- Cryptographic RNG (`crypto.getRandomValues`) behind a swappable interface, with a
  seeded RNG used by the simulator for reproducible runs.
- Golden vault **Wild** on reels 2–4 carrying **x2 / x3** multipliers that multiply when
  several take part in the same line.
- Diamond key **Bonus** symbol: 3 / 4 / 5 keys award 8 / 12 / 15 free spins.
- **Locked wilds** during free spins — a wild that lands on reels 2–4 stays for the round
  with its multiplier.
- BIG / MEGA / EPIC win presentations, jackpot ladder, auto play, turbo, paytable and
  game history.
- Wallet service with unique transaction ids, idempotency keys and a rollback path.
- Measured RTP **95.9%**, hit frequency 32.6%, free spins 1 in 218 spins, high volatility.

### Presentation
- Game screen built from the delivered reference render: live reels inside the machine's
  window, live values on the painted panels.
- Symbols, logo and win banners sliced from the delivered master asset sheet.
- Runtime artwork shipped as WebP (~1.8 MB); PNG masters kept as project sources.
- All sound synthesised at runtime with the Web Audio API.

### Tooling
- `npm run simulate` — head-less RTP / volatility simulator running the production engine.
- `tools/slice-sheet.mjs`, `tools/extract-scene.mjs`, `tools/contact-sheet.mjs`,
  `tools/capture.mjs`, `npm run assets` — the full offline asset pipeline.
- Optional server-authoritative mode via `VITE_GAME_API_URL` / `VITE_GAME_API_TOKEN`.
