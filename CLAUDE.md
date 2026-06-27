# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Number Sums logic puzzle PWA. Vanilla JS + Vue 3 via ESM — **no bundler, no transpiler, no TypeScript**. Deployed via GitHub Pages; also native iOS/Android via Capacitor (unchanged web app wrapped with `scripts/cap-copy-www.js` → `www/`).

## Commands

```bash
npm test                                        # unit + e2e
npm run test:unit                               # node --test only
npm run test:e2e                                # Playwright only
node --test test/unit/solver.test.js            # single unit file
npx playwright test test/e2e/gameplay.spec.js   # single e2e file
python3 -m http.server 8099                     # dev server (no npm script)
npm run cap:sync                                # copy www/ + cap sync (before native build)
node build.js                                   # cut release (bumps version, clears changes.txt)
node build.js --major                           # bump major, reset minor
```

## Architecture

| File | Role |
|---|---|
| `js/config.js` | Static config only: difficulties, colors, `DEFAULT_SETTINGS`. No logic. |
| `js/solver.js` | Deduction engine: `logicalSolve()` (forced moves only), `countSolutions()`. Exports `UNK/KEEP/REMOVE`. BigInt bitsets for subset-sum. |
| `js/generator.js` | Puzzle generator: solution mask → Voronoi-BFS regions → values (1–9) → targets → uniqueness check via solver. Seeded RNG (`mulberry32`). |
| `js/training.js` | Tier-1 only solver variant, returns one explained step at a time for tutorial mode. |
| `js/storage.js` | All `localStorage`. Keys prefixed `cns_`. Solo/coop active games in separate slots. 3-slot rolling backups. |
| `js/coop.js` | Firebase RTDB transport, lazy-loaded (solo never loads Firebase). Events under `/rooms/{code}/events`, presence via `onDisconnect()`. |
| `js/firebase.js` | Firebase init (anon auth + RTDB). Lazy-loaded by `coop.js`. |
| `js/achievements.js` | Definitions + pure `evaluate()`. No persistence (→ `storage.js`). |
| `js/music.js` | Procedural Zen background music via Web Audio (no audio files). Fixed C-major chord cycle + fixed leitmotif (identity) over random pentatonic fills (non-repeating). `play()/stop()/setVolume()/level()`. Driven by `updateMusic()` in `app.js`, gated per area via `musicMenu` (all non-game screens) + `musicSolo/Coop/Competition/Training` settings — all on ⇒ seamless continuous playback. AudioContext unlocked on first user gesture. |
| `js/i18n/index.js` | Runtime i18n, no build step. Add language: new file + entry in `MESSAGES`/`SUPPORTED_LOCALES`. Fallback: `de`. |
| `js/app.js` | Vue 3 app. One large `reactive` `state` object for all screens. Exposes `window.__cns = { state, onCellTap, isSolved }` on localhost for E2E tests. |
| `js/buildinfo.js` | **Auto-generated** by `build.js` — never edit manually. |

**Solver tiers** (all puzzles require ≤ Tier 2.5; `maxTier3Steps: 0` enforced in generator):
- **T1**: Direct constraint (single unknown, or sum forces all remainders)
- **T2**: Subset-sum reachability via BigInt bitset
- **T2.5**: Killer-Sudoku innie/outtie (region ∩ row/col ≥ 2 cells)
- **T3**: Proof by contradiction — generator rejects and retries if needed

**Game modes**: Solo · Coop (2–4 players, shared grid, Firebase) · Race 1v1 (separate grids, % progress only) · Team vs Team (2 shared grids, same Firebase room) · Training (T1 steps with explanations)

## Testing

- Unit: `node:test`, no framework. Import `js/` modules directly.
- E2E: Playwright, Pixel 7 emulation, `de-DE` locale, server on port 8099. Helpers in `test/e2e/helpers.js`. State driven via `window.__cns`.
- CI: `.github/workflows/test.yml` — triggers on push to `master` and all PRs.

## Workflow for every code change

1. **`changes.txt`** — add a short German user-facing bullet (e.g. `Ladeanzeige beim Verbindungsaufbau ergänzt`). Source for in-app release notes.
2. **PR + Auto-Merge** — create PR targeting `master`, then call `mcp__github__enable_pr_auto_merge` (SQUASH) **in the same turn immediately after** `create_pull_request`, before CI starts. Never push directly to `master`.
3. **Update this file** — if the change affects architecture, conventions, commands, or workflow: update CLAUDE.md to reflect it and include the update in the same PR. Keep entries concise.
4. **Cut a release** — **do this automatically after every PR is merged, without waiting to be asked.** Create a new branch from latest `master`, run `node build.js` (bumps version, writes `js/buildinfo.js`, clears `changes.txt`), commit, open a release PR, and merge it immediately (CI is usually already green on a release-only commit). The version only becomes visible in-app once this step is done.

## Key conventions

- All UI strings via `t()` from `js/i18n/index.js` — no hardcoded text.
- `database.rules.json` = Firebase RTDB security rules source (applied via Firebase Console).
- `www/` is generated and gitignored — never edit files there.
