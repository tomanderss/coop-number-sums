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
| F4 | Tagesrätsel im Coop | `claude/feat-daily-coop` | ⬜ offen |
| F12b | Team-vs-Team (2v2) | `claude/feat-team-vs-team` | ⬜ offen |
| F11 | Race-/Duell-Modus | `claude/feat-race` | ⬜ offen |

Reihenfolge: Solo-Block (F6 → F8 → F10 → F15 → F3 → F1 → F5), dann
Coop-Block (F12a → F12c → F4 → F12b → F11). Details/Begründung der
Reihenfolge und jedes einzelnen Features stehen im ursprünglichen Plan
(siehe Konversation/PR-Beschreibungen).

## Aktueller Stand

- **Aktueller Branch:** `master` (nächster Feature-Branch
  `claude/feat-daily-coop` noch nicht angelegt)
- **Letzter abgeschlossener Schritt:** Feature 12c (Lokaler
  Pass-and-Play-Modus) vollständig: mehrere Spieler (2–4, `COOP_MAX_PLAYERS`)
  teilen sich ein Gerät und lösen ein Rätsel abwechselnd, ganz ohne
  Netzwerk. Maximale Wiederverwendung der bestehenden Coop-Infrastruktur
  statt eines parallelen Codepfads: `state.coop.active/role/players/myId`
  werden genauso gesetzt wie bei echtem Netz-Coop (Rolle bleibt `'host'`,
  damit alle host-gegateten Aktionen unverändert funktionieren), nur
  `state.coop.connected` bleibt dauerhaft `false`, wodurch der bestehende
  `coopSend()`-Guard (`if (!state.coop.active || !state.coop.connected)
  return;`) Netzwerk-Sends automatisch zu No-ops macht — keine neue
  Bedingung an irgendeiner Aufrufstelle nötig. Neuer dritter Button auf dem
  Coop-Rollenauswahlbildschirm (`initPassAndPlaySetup`, Klasse `.btn-coop`
  statt `.btn-ghost`, um die bestehende Playwright-Selektor-Eindeutigkeit
  auf diesem Screen — `.coop-body .btn-ghost` matcht dort exakt den
  "Beitreten"-Button — nicht zu brechen). Eigener Setup-Screen
  (`state.coop.role==='local'`): Spieleranzahl per `option-grid` (Muster
  wie `CUSTOM_SIZES`-Auswahl, `setLocalPlayerCount()`), Name pro Spieler
  mit Profanitätsfilter (`onLocalNameBlur()`), Schwierigkeitswahl,
  `startPassAndPlayMatch()` generiert das Rätsel und befüllt
  `state.coop.players` mit synthetischen ids (`local0`, `local1`, …).
  Rundenwechsel über explizites "Zug beenden" (`endLocalTurn()`, pausiert
  die Zeit analog zu `pauseGame()`) + Geräteübergabe-Vollbild-Overlay
  (`state.coop.turnHandoff`, `confirmTurnHandoff()` schaltet
  `state.coop.myId` auf den nächsten Spieler um — dadurch springen
  Markierungs-Attribution und das bestehende "(Du)"-Roster-Suffix
  automatisch mit). `restartPuzzle()` setzt die Zugreihenfolge bei
  Retry auf Spieler 1 zurück. `win()`/`lose()`/`giveUp()` bucketen
  Pass-and-Play-Ergebnisse unverändert über die bestehenden
  `state.coop.active`-gesteuerten Coop-Statistikfelder — **keine neuen
  `storage.js`-Keys** nötig. i18n: `coop.localOption`/`localHint`,
  `game.localTag` + komplettes neues `passandplay.*`-Objekt in allen 10
  Sprachen ergänzt. Neue E2E-Tests in `test/e2e/passandplay.spec.js` (5
  Tests: Setup-Defaults + Namens-Gate, Spieleranzahl erhöhen, Matchstart
  mit korrektem ersten Spieler, Zugwechsel-Overlay + Spielerwechsel, Sieg
  ohne jede Netzwerkaktivität) — 56/56 E2E-Tests grün, 109/109 Unit-Tests
  grün; PR #58 nach grünem CI nach `master` gemerged.
- **Nächster Schritt:** Branch `claude/feat-daily-coop` von `master`
  anlegen und mit Feature 4 (Tagesrätsel im Coop) beginnen — drittes
  Feature des Coop-Blocks (siehe ursprünglicher Plan: Host startet einen
  Coop-Raum, der statt frischer Generierung das deterministische Puzzle aus
  `getDailyChallenge()` (daily.js) verwendet, Raum als "daily" geflaggt,
  Verteilung über den bestehenden Coop-`INIT`-Pfad; Coop-Daily zählt
  **nicht** zur Solo-Daily-Streak, sondern wird als normaler Coop-Sieg
  gewertet (optional separater `coopDaily`-Zähler), kein Eingriff in
  `recordDailyResult()`; Einstieg über einen Button "heute zusammen
  spielen" auf dem Daily-Screen, der den Coop-Host-Flow mit dem heutigen
  Daily-Seed öffnet; profitiert von der in F12a generalisierten
  Lobby/Start-Button-Logik).

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
