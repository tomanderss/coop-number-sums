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
| F3 | Replay/Verlauf gelöster Rätsel | `claude/feat-history` | ⬜ offen |
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
- **Letzter abgeschlossener Schritt:** Feature 15 (Boss-Rätsel)
  vollständig: neue Datei `js/boss.js` (analog `js/daily.js`) mit eigener
  `isoWeekStr()` (ISO-Kalenderwoche, Montag-Start, lokale Zeit) +
  FNV-1a-Seed, rotierend über die 3 schwersten `DIFFICULTIES`
  (`schwer`/`extrem`/`mashallah`); neuer `KEYS.BOSS`-Storage-Key
  `{lastAttemptedWeek, lastCompletedWeek, currentStreak, bestStreak,
  totalCompleted}` mit `recordBossWin()`/`recordBossLoss()` — Streak
  bricht bei Niederlage **sofort** statt erst bei Wochen-Lücke; in allen
  vier Backup/Export-Funktionen + `deleteAllData()` ergänzt;
  `state.isBossGame` mit fest `maxLives=lives=1` unabhängig von
  `settings.livesEnabled`; eigener `startBossGame()`; Loss-/Gaveup-Screen
  ohne Retry-Button + Hinweistext "nächste Woche wieder versuchen";
  Win-Screen mit Streak-Badge statt "nächstes Rätsel"-Button;
  Home-Screen-Button analog Tagesrätsel mit Wochen-Status + Streak-Badge;
  solo-only. i18n (`home.bossChallenge`/`bossDone`, `boss.streakBadge`/
  `tryAgainNextWeek`) in allen 10 Sprachen ergänzt; Unit- (95/95) und
  E2E-Tests (40/40, inkl. 3 neuer Tests in `test/e2e/boss.spec.js`) grün;
  PR #48 nach grünem CI nach `master` gemerged. (Davor: Feature 10
  (Custom-Modus) + ROADMAP-Update, PR #46/#47 gemerged.)
- **Nächster Schritt:** Branch `claude/feat-history` von `master` anlegen
  und mit Feature 3 (Replay/Verlauf gelöster Rätsel) beginnen (siehe
  ursprünglicher Plan: kein Zug-Log vorhanden, daher v1 = Snapshot
  abgeschlossener Rätsel statt zugweises Playback; neuer Storage-Key
  `KEYS.HISTORY` = Ringpuffer (z.B. letzte 20) mit `{difficulty, dim,
  seed, marks, timeMs, outcome, ts}` — Seed statt vollem Puzzle
  gespeichert, `generatePuzzle({difficulty, seed, dim})` reproduziert das
  exakte Rätsel; neue Funktion `recordHistory()` in storage.js, aufgerufen
  in `win()/lose()/giveUp()`; `KEYS.HISTORY` in alle vier Backup/Export-
  Funktionen + `deleteAllData()` eintragen; neuer "history"-Screen
  (`state.screen`, `navigate()`) mit Liste gelöster Rätsel →
  Endboard/Lösung ansehen oder per Seed erneut spielen; i18n
  `history.*`).

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
