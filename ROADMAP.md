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
| F1 | Achievements/Badges | `claude/feat-achievements` | ⬜ offen |
| F5 | Trainings-/Lernmodus | `claude/feat-training` | ⬜ offen |
| F12a | Coop-Raumkapazität auf 4 erhöhen + Start-Button-Lobby | `claude/feat-coop-4players` | ⬜ offen |
| F12c | Lokaler Pass-and-Play-Modus | `claude/feat-pass-and-play` | ⬜ offen |
| F4 | Tagesrätsel im Coop | `claude/feat-daily-coop` | ⬜ offen |
| F12b | Team-vs-Team (2v2) | `claude/feat-team-vs-team` | ⬜ offen |
| F11 | Race-/Duell-Modus | `claude/feat-race` | ⬜ offen |

Reihenfolge: Solo-Block (F6 → F8 → F10 → F15 → F3 → F1 → F5), dann
Coop-Block (F12a → F12c → F4 → F12b → F11). Details/Begründung der
Reihenfolge und jedes einzelnen Features stehen im ursprünglichen Plan
(siehe Konversation/PR-Beschreibungen).

## Aktueller Stand

- **Aktueller Branch:** `master` (nächster Feature-Branch noch nicht
  angelegt)
- **Letzter abgeschlossener Schritt:** Feature 3 (Replay/Verlauf gelöster
  Rätsel) vollständig: neuer `KEYS.HISTORY`-Storage-Key in `storage.js` =
  Ringpuffer der letzten 20 abgeschlossenen Rätsel
  (`{difficulty, dim, seed, marks, timeMs, outcome, coop, ts}`), Seed statt
  vollem Puzzle gespeichert — `generatePuzzle({difficulty, seed, dim})`
  reproduziert das exakte Rätsel deterministisch; `recordHistory()`
  aufgerufen in `win()/lose()/giveUp()`; in allen vier Backup/Export-
  Funktionen + `deleteAllData()` ergänzt. Neuer "history"-Screen
  (`state.screen`, `navigate('history')`) mit Liste gelöster Rätsel; "Ansehen"
  öffnet ein rein lesbares Endboard-Overlay (`state.historyDetail`), das
  bewusst **nicht** `state.puzzle`/`state.marks`/`state.status` wiederverwendet
  (Daten-Sicherheits-Lehre aus dem Plan: `quitToHome()`/`revealSolution()`
  hängen an genau diesem State, eine geteilte Nutzung hätte ein laufendes,
  resumable Spiel überschreiben können); "Erneut spielen" regeneriert per
  Seed eine frische, spielbare Partie. Home-Button ans Ende des
  `.home-grid` angehängt (nicht dazwischen), damit bestehende
  nth-index-basierte E2E-Tests (`home.spec.js`/`settings.spec.js`) ohne
  Anpassung weiterlaufen. i18n (`home.history`, `history.*` inkl.
  `history.outcome.{won,lost,gaveup}`) in allen 10 Sprachen ergänzt;
  Unit-Tests weiterhin grün, 3 neue E2E-Tests in `test/e2e/history.spec.js`
  (leerer Zustand, Sieg → Ansehen/Replay, Niederlage) — 43/43 E2E-Tests
  grün; PR #50 nach grünem CI nach `master` gemerged.
- **Nächster Schritt:** Branch `claude/feat-achievements` von `master`
  anlegen und mit Feature 1 (Achievements/Badges) beginnen (siehe
  ursprünglicher Plan: neue Datei `js/achievements.js` mit
  `ACHIEVEMENTS`-Definitionen (id, i18n-Key, Icon, Bedingung) +
  `evaluate(context)` → neu freigeschaltete ids; neuer Storage-Key
  `KEYS.ACHIEVEMENTS` = `{ id: unlockedTs }`; Hooks nach `recordResult()`
  in `win()/lose()/giveUp()` sowie nach Daily-/Boss-Recording, Context u.a.
  outcome, `mistakes===0`, `coop`, `newHighscore`, difficulty, Daily-/
  Boss-Streak, Bestzeit, "erster Coop-Sieg"; Freischaltung → Toast +
  Badges-Ansicht (eigener Screen oder Sektion im Stats-Screen);
  `KEYS.ACHIEVEMENTS` in alle vier Backup/Export-Funktionen +
  `deleteAllData()` eintragen; i18n `achievements.*`).

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
