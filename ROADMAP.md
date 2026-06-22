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
| F12b | Team-vs-Team (2v2) | `claude/feat-team-vs-team` | ✅ fertig |
| F11 | Race-/Duell-Modus | `claude/feat-race` | ✅ fertig |

**Alle 11 geplanten Features sind abgeschlossen.**

Reihenfolge: Solo-Block (F6 → F8 → F10 → F15 → F3 → F1 → F5), dann
Coop-Block (F12a → F12c → F4 → F12b → F11). Details/Begründung der
Reihenfolge und jedes einzelnen Features stehen im ursprünglichen Plan
(siehe Konversation/PR-Beschreibungen).

## Aktueller Stand

- **Aktueller Branch:** `master` — Rollout abgeschlossen, kein offener
  Feature-Branch mehr.
- **Letzter abgeschlossener Schritt:** Feature 11 (Race-/Duell-Modus, v1)
  vollständig — **mit einer bewussten Architekturabweichung vom
  ursprünglichen Plantext**: statt einer neuen eigenständigen Datei
  `js/race.js` + neuer RTDB-Struktur `/races/{code}/` wird der **bestehende
  Coop-Raum/die bestehende Lobby aus F12a/F12b wiederverwendet**
  (`state.coop.raceMode`-Flag, client-seitig auf 2 Spieler begrenzt via
  `Coop.joinGame({..., maxPlayers: 2})`) — kein neues RTDB-Top-Level-Schema,
  kein manueller `database.rules.json`-Deploy nötig. Architektonische
  Kernentscheidung zur Leak-Vermeidung: `state.coop.active` wird während des
  laufenden Race-Matches **nie** gesetzt (anders als bei Team-vs-Team) —
  dadurch lösen `setMark()`/`registerMistake()`/`doCheck()` per Konstruktion
  keinerlei `coopSend()`-Aufrufe aus, es gibt also keine zellweise
  Übertragung, die einen Leak ermöglichen könnte. Drei getrennte Flags
  (`state.isRaceGame` für UI/Leben/Sofort-Fehleranzeige,
  `state.coop.raceMode` für den Lobby-Vorlauf, `state.race.active` für den
  laufenden Match-Zustand) statt eines einzigen — spiegelt das bestehende
  `isBossGame`/`coop.isDaily`- bzw. `isCustomGame`/`team.active`-Muster.
  `MSG.RACE_START` (`{seed, difficulty}`) startet beide Seiten synchron mit
  demselben Seed; `MSG.RACE_DONE` (`{outcome}`) beendet das Match hart und
  sofort — bei `outcome==='won'` gewinnt der Absender, bei
  `'lost'`/`'gaveup'` gewinne ich automatisch (kein Selbst-Skip-Check nötig
  wie bei `TEAM_DONE`, da Race strikt 1v1 ist). `recordRaceWin`/
  `recordRaceLoss` (neuer `storage.js`-Key `KEYS.RACE`:
  `racesPlayed`/`racesWon`/`racesLost`/`fastestWinMs`, in alle vier
  Backup/Export-Funktionen + `deleteAllData()` eingetragen) werden
  unconditional auf `remote` aufgerufen (Stats müssen für beide Seiten
  erfasst werden), während `broadcastRaceDone(...)` nur bei `!remote`
  gesendet wird (kein Re-Broadcast-Loop). Neuer Home-Button
  (`home.raceMode`/`home.raceHint`) sowie `race.*`-i18n-Keys
  (`startMatch`/`waitingForOpponent`/`opponentProgress`/`matchResult`/
  `youWon`/`youLost`) in allen 10 Sprachen ergänzt. Neue Unit-Tests für die
  `storage.js`-Race-Funktionen sowie `test/e2e/race.spec.js` (6 Tests:
  Pass-and-Play/Team-Toggle in der Race-Lobby ausgeblendet, Spielerzahl-Cap
  bei 2 gated den Start-Button, Match-Start zeigt Gegner-Chip +
  Fortschritts-Chip, Gegner gewinnt erzwingt sofortige Niederlage ohne
  Retry-Buttons, Gegner gibt auf → automatischer Sieg). Nebenbei behobene
  Test-Kollision: der neue Race-Home-Button teilte sich initial die Klasse
  `.btn-coop` mit dem bestehenden Coop-Button, wodurch `.btn-coop`-Selektoren
  in `coop.spec.js`/`home.spec.js`/`passandplay.spec.js`/`team.spec.js`
  plötzlich mehrdeutig wurden (strict-mode violation) — gefixt durch
  `btn-ghost race-btn` statt `btn-coop race-btn` für den neuen Button (beide
  Klassen sind visuell identisch gestylt). 115/115 Unit-Tests, 71/71
  E2E-Tests grün; PR #64 nach grünem CI nach `master` gemerged.
- **Nächster Schritt:** Keiner aus diesem Rollout — alle 11 geplanten
  Features (F6, F8, F10, F15, F3, F1, F5, F12a, F12c, F4, F12b, F11) sind
  gemerged. Bei Bedarf separat zu klären: der manuelle
  `database.rules.json`-Deploy für Team-vs-Team/Race ist weiterhin ein
  externer, nicht automatisierbarer Schritt (siehe ursprünglicher Plan) —
  ohne ihn funktionieren die RTDB-Teilfunktionen dieser beiden Features in
  Produktion nicht.

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
