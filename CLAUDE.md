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
| `js/music.js` | Procedural Zen background music via Web Audio (no audio files). Fixed C-major chord cycle + fixed leitmotif (identity) over many fixed pentatonic phrases (`PHRASES`) with randomized tempo/timing (non-repeating). `play()/stop()/setVolume()/level()`. Driven by `updateMusic()` in `app.js`, gated per area via `musicMenu` (all non-game screens) + `musicSolo/Coop/Competition/Training` settings. **Also procedural UI sounds** on a separate `sfxBus` (independent of music volume/toggles): `sfxComplete(tier)` (cage/row/column resolved; `tier` = #structures one move resolves at once ⇒ louder/fuller via sub-octaves), `sfxKeep/sfxRemove/sfxError/sfxHint`. Triggered in `app.js` (`setMark`/`applyHintEffect`/`flashError`/hint stages), each gated by `sfx*` settings. AudioContext unlocked on first user gesture. |
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

Every version ships as **two squash-merged PRs**: a **feature/fix PR** (code + one `changes.txt` line), then a **release PR** (`node build.js`). Never push directly to `master`; never merge before the CI `test` job is green.

### A) Feature / fix PR
1. **Branch** from latest `master` (`git checkout master && git pull && git checkout -b <name>`).
2. **`changes.txt`** — add **one** short German, user-facing bullet (e.g. `Ladeanzeige beim Verbindungsaufbau ergänzt`). This is the *only* hand-maintained changelog source; `build.js` consumes and empties it. Multiple bullets in one release = multiple lines.
3. **Update CLAUDE.md** in the same PR if the change affects architecture/conventions/commands/workflow. Keep entries concise.
4. **Commit + push**, open PR (base `master`), then `mcp__github__enable_pr_auto_merge` (SQUASH) right after `create_pull_request`. If auto-merge reports "already clean"/unavailable, poll `pull_request_read get_check_runs` and `merge_pull_request` (squash) once `test` is `success`.

### B) Release PR — **do this automatically after every feature PR merges, without being asked**
1. Branch from latest `master` (now contains the feature merge).
2. `node build.js` (`--major` only on explicit request — bumps Major, resets Minor).
3. Commit all changed files, open a release PR, merge once green. The version is only live in-app after this step.

### What `node build.js` does (never edit its outputs by hand)
- `.release-counter` — source of truth for the version (`Major.Minor`, no patch). Default: `minor += 1`.
- `js/buildinfo.js` — **auto-generated**: `BUILD`, `BUILD_HASH` (`git rev-parse --short HEAD`), `CHANGELOG` (new `{version,date,changes}` entry prepended; `changes` = the non-empty lines of `changes.txt`). Drives the in-app "what's new" modal.
- `sw.js` — bumps the cache name `coop-number-sums-v<VERSION>` → clients detect the update (update banner).
- `changes.txt` — **emptied** after being read.
- `version-<VERSION>.txt` — marker file (old `version-*.txt` deleted).

### Caveats
- **`changes.txt` merge conflict**: if a release emptied it between branch creation and merge, resolve by keeping your own feature line(s).
- **Flaky `test/e2e/training.spec.js`** (solve-timing): if green locally, re-trigger with an empty commit (`git commit --allow-empty -m "CI rerun" && git push`) — never weaken the gate.
- Deploy is automatic: GitHub Pages serves `master`; native iOS/Android are wrapped separately via `npm run cap:sync`.

## Key conventions

- All UI strings via `t()` from `js/i18n/index.js` — no hardcoded text.
- `database.rules.json` = Firebase RTDB security rules source (applied via Firebase Console).
- `www/` is generated and gitignored — never edit files there.
