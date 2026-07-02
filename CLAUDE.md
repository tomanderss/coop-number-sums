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
| `js/generator.js` | Puzzle generator: solution mask → Voronoi-BFS regions → values (1–9) → targets → uniqueness/no-guess check via solver. Seeded RNG (`mulberry32`). For `maxTier3Steps:0` difficulties it solves WITHOUT hypothesis (much faster reject of bad candidates — key for large boards like 13×13). |
| `js/genworker.js` | ES-module Web Worker that runs `generatePuzzle()` off the main thread via **`generateAsync(opts)`** Promise generation (correlated by `reqId`). Used **on-demand** by Solo `newGame` (loading overlay) and Coop-host/Race/Team (ready-lobby loading bar). Falls back to synchronous generation if the worker is unavailable. **No background prefetch** — puzzles are generated only when a round starts (the old startup-time pre-generation of all difficulties was removed; it bogged down slower devices). |
| `js/training.js` | Tier-1 only solver variant, returns one explained step at a time for tutorial mode. |
| `js/storage.js` | All `localStorage`. Keys prefixed `cns_`. Solo/coop active games in separate slots. 3-slot rolling backups. |
| `js/debuglog.js` | Persistent on-device diagnostic log (`localStorage` `cns_debuglog`, 400-entry FIFO). `log(category, message, extra)` — used everywhere for diagnosis. User exports it via Settings ▸ Diagnoseprotokoll (`exportLogToFile()` prepends BUILD + `userAgent`). `app.js initDiagnostics()` captures unhandled errors/rejections (`error` cat), a one-time device/env snapshot (`env`), and aggregated long-task **jank** every 10s (`perf`). **Log only low-frequency events** (start, errors, lifecycle, generation timing, aggregated perf) — `log()` does synchronous `localStorage` I/O, so never call it per-frame/per-tap or it degrades the very performance you're trying to measure. |
| `js/coop.js` | Firebase RTDB transport, lazy-loaded (solo never loads Firebase). Events under `/rooms/{code}/events`, presence via `onDisconnect()`. **`watchConnection(f, cb)`** überwacht die EIGENE Verbindung über `.info/connected` (feuert rein lokal) → `cb(online, isReconnect)` an `handleCoopConnection()` in app.js setzt `state.coop.online`; so sieht auch der Client selbst einen stillen Idle-Disconnect (Chip „offline"), und bei Reconnect wird die eigene Anwesenheit (`selfInfo`) + `onDisconnect` neu gesetzt. **Prävention:** app.js hält während eines laufenden Spiels einen **Screen Wake Lock** (`requestWakeLock`/`releaseWakeLock`, in `navigate()` + bei `visibilitychange`), damit das Gerät nicht in den Standby geht und die PWA (und damit die RTDB-Verbindung) gar nicht erst abbricht. |
| `js/firebase.js` | Firebase init (anon auth + RTDB). Lazy-loaded by `coop.js`/`account.js`. `ensureFirebase()` returns `{ db, uid, auth, authMod, ...dbModule }` — `auth`/`authMod` (vendored `firebase-auth.js`, incl. email/PW + linking) added for accounts; `{db,uid,...dbModule}` shape unchanged for coop. |
| `js/account.js` | **Optional** accounts (email+username+password) + cloud-sync, lazy like coop (anonymous-first: no login ⇒ never loaded, app stays local). Pure validators (`normalizeUsername`/`isValidUsername`/`isValidEmail`/`passwordIssue`/`usernameKey`/`errKey`) are unit-tested; auth/sync wrap Firebase. `/users/{uid}` tree (profile/role + `data` snapshot); username uniqueness via `/usernames/{key}`. Sign-in/up/out/delete **reload the page** so the shared Firebase/auth singleton re-inits with the correct uid (both sign-in AND sign-up persist `profile.accountId` so the logged-in UI survives the reload). **Auto-sync** (`syncNow`/`scheduleSyncUp`, `lastSyncAt` in own key `cns_last_sync`, shown in the account card): on every game end (win+loss), on hide/close, every 60s while open. **Conflict-safe reconcile at startup** (`reconcile`/pure `decideSync`): compares local vs cloud via a data-revision (`cns_data_rev`, bumped on every user-data `save()`) against a baseline (`cns_synced_rev`) — decisions `uploadLocal`/`takeCloud`/`inSync`/`conflict`. **Local is never silently overwritten**: empty cloud ⇒ upload local; genuine divergence ⇒ a startup **Versions-Mismatch** dialog asks which to keep (by timestamp), resolved via `resolveConflict`. Sign-in defers all merging to this startup reconcile (no overwrite in `signIn`). Inventory/wallet/profile model lives in `storage.js` (`grant/spend/mergeInventory`, etc.). Inventory syncs via a dedicated **union-only** node `/users/{uid}/inventory` (gifts never clobbered by a client upload); rest of the snapshot under `/users/{uid}/data`. **Username änderbar**: `changeUsername(newName)` hängt den `/usernames`-Index um + aktualisiert `profile.username`. **Admin** (`role==='admin'`): `adminFindUser`/`adminGrantItem`/`adminRevokeItem`/`adminSetRole`/`adminGrantCurrency`/`adminSetCurrency`/`adminSetUsername`/`adminSetProfileField` (beliebiges Profilfeld außer role/username)/`adminSendPasswordReset` (Reset-Mail; direktes Setzen geht per Firebase nicht) — gated in UI (In-Game-Badge „👑 Administrator" auf Home), enforced by rules. `profile.email` wird bei Signup gespeichert (nur Owner/Admin lesbar), damit Admin die Reset-Mail auslösen kann. **Admin-User-Browser** (`adminListUsers` liest `/users` mit `/usernames`-Fallback): Liste + Suche + Bearbeiten-Modal im Konto-Tab. **Freunde & Präsenz**: `sendFriendRequest`/`acceptFriendRequest`/`declineFriendRequest`/`removeFriend`, `watchFriends`/`watchPresence`, `publishPresence(game)`/`clearPresence`. Modell: `/users/{uid}/friends/{fUid}` + `/users/{uid}/friendRequests/{fromUid}` (beidseitiger Handschlag **ohne** Cloud Functions — Rules erlauben Schreiben in fremden `friends/$me` bzw. `friendRequests/$me`); globale Präsenz unter `/status/{uid}` (self-published, `onDisconnect`, für alle Angemeldeten lesbar). Reine Sortierlogik `friendActivityRank`/`sortFriends`/`sortLeaderboard` unit-getestet. **Bestenliste** (`publishBestTime`/`watchLeaderboard`; Node `/leaderboard/{difficulty}/{uid}` = `{username,timeMs,ts}`, für alle Angemeldeten lesbar, nur Owner schreibbar): schnellste **perfekte Solo**-Zeit je Schwierigkeit (beim Erzielen einer neuen Solo-Bestzeit geschrieben), live im Freunde-Modal-Tab „Bestenlisten" mit Schwierigkeits-Chips. Erste Ausbaustufe — ohne Cloud Functions **nicht voll cheat-sicher**. |
| `js/achievements.js` | Definitions + pure `evaluate()`. No persistence (→ `storage.js`). |
| `js/skins.js` | Pure logic for the unlockable **dynamic skin** (1.0 cosmetic, inventory item `dynamicColor`): version-jump eligibility (`qualifiesForV1Skin`), redeem-code match (`skinCodeMatches`), `skinVars`/`skinClasses` for the board. Unit-tested. **The gradient itself lives in CSS** (`.skin-style-*::after`), NOT as a custom-property string — `var(--markcol)` must resolve per-cell, so it can't be embedded in a board-level var (would compute invalid there). Rotation spins the ROUND `::after` via `transform` (compositor-only, no repaint). **NEVER animate a registered custom property for this** — that forced WebKit to re-raster every marked cell's conic-gradient+drop-shadow at 60 fps and caused iOS memory-pressure kills mid-game. Both marks are circles (rotation-invariant); removed uses a round ring like kept. |
| `js/music.js` | Procedural Zen background music via Web Audio (no audio files). Fixed C-major chord cycle + fixed leitmotif (identity) over many fixed pentatonic phrases (`PHRASES`) with randomized tempo/timing (non-repeating). `play()/stop()/setVolume()/level()`. Driven by `updateMusic()` in `app.js`, gated per area via `musicMenu` (all non-game screens) + `musicSolo/Coop/Competition/Training` settings. **Also procedural UI sounds** on a separate `sfxBus` (independent of music volume/toggles): `sfxComplete(tier)` (cage/row/column resolved; `tier` = #structures one move resolves at once ⇒ louder/fuller via sub-octaves), `sfxKeep/sfxRemove/sfxError/sfxHint/sfxToolSwitch/sfxWin/sfxLose/sfxUndo`. Triggered in `app.js` (`setMark`/`applyHintEffect`/`flashError`/hint stages/`undo`/win/lose), each gated by `sfx*` settings. AudioContext unlocked on first user gesture. |
| `js/i18n/index.js` | Runtime i18n, no build step. Add language: new file + entry in `MESSAGES`/`SUPPORTED_LOCALES`. Fallback: `de`. |
| `js/app.js` | Vue 3 app. One large `reactive` `state` object for all screens. Exposes `window.__cns = { state, onCellTap, isSolved }` on localhost for E2E tests. |
| `js/buildinfo.js` | **Auto-generated** by `build.js` — never edit manually. |

**Solver tiers** (all puzzles require ≤ Tier 2.5; `maxTier3Steps: 0` enforced in generator):
- **T1**: Direct constraint (single unknown, or sum forces all remainders)
- **T2**: Subset-sum reachability via BigInt bitset
- **T2.5**: Killer-Sudoku innie/outtie (region ∩ row/col ≥ 2 cells)
- **T3**: Proof by contradiction — generator rejects and retries if needed

**Game modes**: Solo · Coop (2–4 players, shared grid, Firebase) · Race 1v1 (separate grids, % progress only) · Team vs Team (2 shared grids, same Firebase room) · Training (T1 steps with explanations)

**Ready-lobby generation** (`state.coop.awaitingStart`): Coop/Race/Team generate their puzzle off-thread via `generateAsync` AFTER entering the lobby, not synchronously before. While generating, `state.coop.generating` is true → the lobby overlay shows an infinite loading bar instead of the start/ready button. Coop host generates on-demand then sends INIT with the full puzzle; guests don't generate (they receive INIT = instant). Race/Team both regenerate from the shared seed locally. A guest can only mark ready once its own generation is done, so `allGuestsReady()` doubles as the "everyone has a finished puzzle" gate; the host's own `startCoopRound()` additionally checks `!state.coop.generating`.

## Testing

- Unit: `node:test`, no framework. Import `js/` modules directly.
- E2E: Playwright, Pixel 7 emulation, `de-DE` locale, server on port 8099. Helpers in `test/e2e/helpers.js`. State driven via `window.__cns`.
- CI: `.github/workflows/test.yml` — triggers on push to `master` and all PRs.

## Workflow for every code change

1. **`changes.txt`** — add a short German user-facing bullet (e.g. `Ladeanzeige beim Verbindungsaufbau ergänzt`). Source for in-app release notes.
2. **PR + Auto-Merge** — **always create the PR automatically, without waiting to be asked.** As soon as a change is committed and pushed, create a PR targeting `master`, then call `mcp__github__enable_pr_auto_merge` (SQUASH) **in the same turn immediately after** `create_pull_request`, before CI starts. Never push directly to `master`. (This overrides the default "only open a PR when explicitly asked" behavior — opening the PR + enabling auto-merge is the expected default for every change here.)
3. **Diagnostics/logging** — every new feature or non-trivial flow must add `log()` calls (`js/debuglog.js`) at its key points: start/finish of async or expensive work (with `tookMs` timing where relevant), error paths (`catch` blocks), state transitions, and external I/O (Firebase/storage). Pick a sensible category (`game`/`coop`/`firebase`/`storage`/`sw`/`error`/`env`/`perf`/`app`). This keeps the exported Diagnoseprotokoll useful for debugging issues on users' devices. **Keep it low-frequency** — never log per-frame, per-tap, or inside hot loops/render paths (`log()` writes `localStorage` synchronously and would hurt performance). When touching an existing flow, add the logging it's missing.
4. **Update this file** — if the change affects architecture, conventions, commands, or workflow: update CLAUDE.md to reflect it and include the update in the same PR. Keep entries concise.
5. **Cut a release** — **ALWAYS do this automatically after every PR is merged. NEVER ask first — just do it.** Create a new branch from latest `master` (this dedicated release branch is expected and allowed even when your assigned working branch is a different one — cutting the release needs no separate permission and is never a reason to pause and ask), run `node build.js` (bumps version, writes `js/buildinfo.js`, clears `changes.txt`), commit, open a release PR, and merge it immediately (CI is usually already green on a release-only commit). The version only becomes visible in-app once this step is done.

## Autonomer Arbeitsmodus (Feature-Backlog)

Der Nutzer wirft Features/Bugs **jederzeit und gebündelt** in den Chat — auch während bereits
an etwas gearbeitet wird — und erwartet, dass **komplett autonom, sequenziell und in idealer
Reihenfolge** abgearbeitet wird. Verbindliche Regeln für diesen Modus:

1. **Nichts vergessen — Backlog führen.** Jeden neuen Wunsch **sofort als Task anlegen**
   (`TaskCreate`), auch wenn er erst später drankommt. Der Task-Backlog ist die dauerhafte
   Merkliste; nie einen Wunsch nur „im Kopf" behalten.
2. **Immer den Stand melden.** Bei jeder Nutzer-Nachricht und an Meilensteinen kurz zeigen:
   **✅ durch · 🔄 in Arbeit · ⏭️ als Nächstes** (inkl. Reihenfolge). Der Nutzer soll nie raten
   müssen, was passiert.
3. **Ideale Reihenfolge selbst wählen & umsortieren.** Reihenfolge nach Abhängigkeit/Aufbau
   bestimmen (baut B auf A auf, kommt A zuerst) — Tasks dürfen umgeschoben werden. Kurz begründen.
4. **Parallel zur Pipeline arbeiten.** Während eine CI-Pipeline läuft, **nicht idlen**: schon die
   nächste Aufgabe entwickeln. Dafür einen **git-Worktree** (isolierte Kopie) nutzen, damit der
   offene PR-Branch sauber bleibt; nach dem Merge des laufenden PRs den Zweig zurücksetzen und die
   vorbereitete Arbeit übernehmen (cherry-pick).
5. **Ein PR pro Feature**, jeweils voller Workflow (changes.txt → PR + Auto-Merge → grünes CI →
   Merge → **Release cutten**). Nie mehrere unfertige Features in einem PR mischen.
6. **Nur bei echtem Blocker fragen.** Sonst „nach bestem Wissen & Gewissen" entscheiden, die
   Annahme im PR/Chat protokollieren und weitermachen. Fragen sammeln statt einzeln unterbrechen.
7. **Limit/Reset überbrücken.** Wird ein Nutzungs-/Zeitlimit erreicht, per `ScheduleWakeup`
   (o.ä.) einen Wecker auf den Reset-Zeitpunkt stellen und **automatisch weitermachen** — der
   Nutzer soll nur bei Bedarf reinsprechen müssen.
8. **Abschluss-Zusammenfassung.** Wenn der Backlog leer ist (oder auf Nachfrage): kompakte
   Übersicht aller erledigten Punkte + **offene Fragen/Klärungsbedarf/Wünsche** an den Nutzer.

## Key conventions

- All UI strings via `t()` from `js/i18n/index.js` — no hardcoded text.
- `database.rules.json` = Firebase RTDB security rules source (applied via Firebase Console). Accounts need two **manual Console steps**: enable **Email/Password** sign-in (Authentication ▸ Sign-in method), and publish the updated rules (incl. `/users`, `/usernames`). Admin = `/users/{uid}/profile/role === 'admin'` (bootstrap the first admin by setting that value directly in the Console — `.validate` otherwise only lets an existing admin change roles). Until done, the account UI surfaces a friendly error and the app stays fully usable anonymously/locally.
- **Nie mitten im Spiel neu laden.** JEDER `location.reload()` läuft über `safeReload(reason)` (app.js): läuft gerade ein Spiel/Coop (`gameSessionActive()`), wird das Neuladen aufgeschoben (`pendingReloadReason`) und erst beim `navigate('home')` via `flushPendingReload()` nachgeholt — der Nutzer wird nie aus einer laufenden Runde geworfen. `offerUpdate()` zeigt den Update-Dialog ebenfalls nie während einer Session (→ `state.pendingUpdate`). Der 60-Sekunden-Cloud-Sync (`syncNow`) ist reiner Upload und lädt nie neu. Neue Reload-Pfade IMMER durch `safeReload` leiten (nicht direkt `location.reload()`).
- `www/` is generated and gitignored — never edit files there.
