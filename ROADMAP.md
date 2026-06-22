# Feature-Rollout Roadmap

Diese Datei trackt den Fortschritt des 11-Feature-Rollouts (Brainstorming siehe
PR-Historie). Sie wird nach jedem abgeschlossenen Schritt aktualisiert, damit
die Arbeit nach einer Session-Unterbrechung exakt da weitergeht, wo sie stand.

**Ablage je Feature:** eigener Branch `claude/feat-<kurzname>` von `master`,
Implementierung ausschließlich in `js/` (Root — `www/`, `android/.../public`,
`ios/.../public` sind gitignored, generiert), Standard-Rollout
(`changes.txt` → `node build.js` → Tests → Commit/Push → PR → Merge nach
`master` bei grünem CI).

## Status

| # | Feature | Branch | Status |
|---|---------|--------|--------|
| 0 | ROADMAP.md (dieses Setup) | `claude/feat-roadmap` | ✅ fertig |
| F6 | Barrierefreiheit (Farbenblind-Palette, ARIA, Tippflächen) | `claude/feat-a11y` | ✅ fertig |
| F8 | Profanitätsfilter für Coop-Namen | `claude/feat-profanity` | ✅ fertig |
| F10 | Eigene Rätselgröße/-schwierigkeit (Custom-Modus) | `claude/feat-custom-size` | ✅ fertig |
| F15 | Boss-Rätsel (wöchentliches Sudden-Death) | `claude/feat-boss` | ✅ fertig |
| F3 | Replay/Verlauf gelöster Rätsel | `claude/feat-history` | ✅ fertig |
| F1 | Achievements/Badges | `claude/feat-achievements` | ✅ fertig |
| F5 | Trainings-/Lernmodus | `claude/feat-training` | ✅ fertig |
| F12a | Coop-Raumkapazität auf 4 erhöhen + Start-Button-Lobby | `claude/feat-coop-4players` | ✅ fertig |
| F12c | Lokaler Pass-and-Play-Modus | `claude/feat-pass-and-play` | ✅ fertig |
| F4 | Tagesrätsel im Coop | `claude/feat-daily-coop` | ✅ fertig |
| F12b | Team-vs-Team (2v2) | `claude/feat-team-vs-team` | ⬜ offen |
| F11 | Race-/Duell-Modus | `claude/feat-race` | ⬜ offen |

Reihenfolge: Solo-Block (F6 → F8 → F10 → F15 → F3 → F1 → F5), dann
Coop-Block (F12a → F12c → F4 → F12b → F11). Details/Begründung der
Reihenfolge und jedes einzelnen Features stehen im ursprünglichen Plan
(siehe Konversation/PR-Beschreibungen).

## Aktueller Stand

- **Aktueller Branch:** `master` (nächster Feature-Branch
  `claude/feat-team-vs-team` noch nicht angelegt)
- **Letzter abgeschlossener Schritt:** Feature 4 (Tagesrätsel im Coop)
  vollständig: neuer "Heute zusammen spielen"-Button auf dem Home-Screen
  (`goCoopDaily()`, stabile Klasse `.daily-coop-btn` analog
  `.daily-btn`/`.boss-btn`/`.training-btn`) setzt `state.coop.isDaily=true`
  und `state.coop.lobbyDiffId` auf die heutige Tagesschwierigkeit, bevor er
  zum Coop-Screen navigiert. `confirmCoopIdentity()` überspringt bei
  `isDaily` die Host/Join/Pass-and-Play-Auswahl und routet direkt zu
  `role='host'`. Host-Setup-Screen zeigt bei `isDaily` eine feste,
  nicht wählbare Schwierigkeitskarte statt des `option-grid` (verschachteltes
  `<template v-if/v-else>` um den bestehenden Block). `startCoopMatch()`
  zieht bei `isDaily` Seed+Schwierigkeit aus `getDailyChallenge()`
  (daily.js) statt einer freien Generierung — alle Mitspieler lösen exakt
  das heutige Rätsel, da der Host das volle Puzzle ohnehin per `MSG.INIT`
  verteilt (`isDaily` wird im INIT-Payload mitgeschickt, von
  `handleCoopMsg()` auf `state.coop.isDaily` zurückgespiegelt; eine normale
  Coop-Folgerunde über `newGame()` schickt `isDaily:false` und löscht damit
  ein eventuell noch gesetztes Flag beim Gast). Zählt bewusst **nicht** zur
  Solo-Daily-Streak — `win()`/`lose()`/`giveUp()` bucketen ausschließlich
  über `state.coop.active`, daher **keine Änderung an `recordDailyResult()`
  und keine neuen `storage.js`-Keys** nötig (auf den optionalen separaten
  `coopDaily`-Zähler aus dem ursprünglichen Plan bewusst verzichtet, da
  bereits voll über die bestehenden `coopWon`/`coopBestTimeMs`-Felder
  abgedeckt). Neuer Game-Chip `📅 {{ t('game.coopDailyTag') }}` zeigt die
  Tagesrätsel-Kennzeichnung im laufenden Coop-Spiel. i18n: `home.dailyCoop`,
  `home.dailyCoopHint`, `game.coopDailyTag`, `daily.coopIntro` in allen 10
  Sprachen ergänzt. Debug-Hook `window.__cns` um `getDailyChallenge`
  erweitert (Seed-Paritäts-Checks in Tests, ohne den FNV-1a-Hash im Testcode
  zu duplizieren). Neue E2E-Tests in `test/e2e/dailycoop.spec.js` (4 Tests:
  Host-Setup überspringt die Auswahl + zeigt feste Schwierigkeit, Abbrechen
  löscht das Flag, Hosten+Start nutzt denselben Seed wie der Solo-Daily,
  Sieg zählt als Coop-Sieg statt Daily-Streak) — die ersten beiden
  Matchstart-Tests pushten initial nur **einen** Fake-Gast und scheiterten
  dadurch mit `Test timeout … waiting for '.screen.game'`, weil
  `canStartCoopMatch()` zusätzlich den echten (asynchronen, gegen die
  Live-Firebase-Instanz laufenden) Host-Eintrag aus `onOpen()` braucht, der
  in diesem Sandbox-Netzwerk nicht zuverlässig/rechtzeitig ankommt — Fix:
  wie im bestehenden `coop.spec.js`-Host-Test **zwei** Fake-Gäste pushen,
  damit `players.length>=2` unabhängig vom echten Host-Roundtrip erreicht
  wird. 109/109 Unit-Tests, 60/60 E2E-Tests grün; PR #60 nach grünem CI nach
  `master` gemerged.
- **Nächster Schritt:** Branch `claude/feat-team-vs-team` von `master`
  anlegen und mit Feature 12b (Team-vs-Team, 2v2) beginnen — viertes Feature
  des Coop-Blocks (siehe ursprünglicher Plan: Formations-Lobby lässt bis zu
  4 Spieler beitreten und sich in Team A/Team B einteilen; startet der Host,
  entstehen zwei eigenständige, gekoppelte Coop-Räume mit demselben Seed
  — `generatePuzzle({difficulty, seed})` lokal pro Team-Host, kein
  Rätsel-Versand über die Team-Grenze, um kein Antwort-Leak zu riskieren;
  neue dünne RTDB-Struktur `/teamMatches/{matchCode}/` nur für aggregierten
  Fortschritt (Prozent korrekt, Fehleranzahl), **keine** zellweise
  Synchronisation zwischen den Teams; `database.rules.json` braucht eine
  neue `teamMatches`-Sektion — **muss manuell in der Firebase Console/CLI
  deployed werden**, dafür gibt es im Repo keinen automatisierten Schritt;
  neuer `state.team`-Substate getrennt von `state.coop`; Match-Ende: sobald
  ein Team fertig ist, sofortiger Eingabe-Stopp für beide Teams, kein
  Zu-Ende-Spielen für eigene Stats; profitiert von der in F12a
  generalisierten 4-Spieler-Lobby/Roster-Logik als Formations-Lobby).

## Pro-Feature-Checkliste (Referenz)

1. Branch von `master` anlegen (`claude/feat-<kurzname>`)
2. Implementieren in `js/`
3. i18n: **alle 10 Sprachdateien** (`de`, `en`, `es`, `fr`, `it`, `ja`,
   `ko`, `pt-BR`, `ru`, `tr`) ergänzen — `test/unit/i18n.test.js` erzwingt
   strikte Schlüssel-Parität über alle Locales, nicht nur de+en.
4. Neue `storage.js`-Keys in alle vier Backup/Export-Funktionen
   (`createBackup`, `loadBackups`/`restoreBackup`, `exportToFile`,
   `importFromFile`) **und** `deleteAllData()` eintragen
5. Bei neuen Helper-Funktionen, die im `<template>`-String verwendet
   werden: unbedingt auch im `setup()`-Return-Objekt auflisten — Vues
   Runtime-Compiler sieht nur explizit zurückgegebene Bindings, nicht
   beliebige Modul-Scope-Funktionen (sonst `TypeError: <fn> is not a
   function` zur Laufzeit, siehe Feature 6 Postmortem).
6. Unit-/E2E-Tests ergänzen, `npm test` grün
7. `changes.txt`-Eintrag + `node build.js` ausführen
8. Commit + Push + PR öffnen
9. CI grün → PR nach `master` mergen
10. Diese Datei (`ROADMAP.md`) aktualisieren (Status-Tabelle + Aktueller
    Stand) — auf `master` nach dem Merge committen
