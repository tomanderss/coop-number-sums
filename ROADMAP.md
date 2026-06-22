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

- **Aktueller Branch:** `master` (nächster Feature-Branch
  `claude/feat-coop-4players` noch nicht angelegt)
- **Letzter abgeschlossener Schritt:** Feature 5 (Trainings-/Lernmodus)
  vollständig: neue Datei `js/training.js` mit `findTrainingStep(puzzle,
  marks)` (nutzt die bestehende Constraint-Struktur, um pro Aufruf eine
  logisch erzwungene Zelle + Begründungstyp zu liefern: `sumReached` /
  `allRemainingNeeded` / `tooLarge`, je Zeilen-/Spalten-/Käfig-Constraint)
  und `isFullyTier1Solvable(puzzle)` (Generator-Filter, der garantiert nur
  Rätsel auswählt, die sich komplett über erzwungene Tier-1-Schritte lösen
  lassen). Neuer Home-Button `.training-btn` (in `.home-actions`, bewusst
  **nicht** in `.home-grid`, um die nth-index-basierten E2E-Tests in
  `home.spec.js`/`settings.spec.js` nicht zu gefährden — gleiche Lehre wie
  bei Feature 1/Achievements). `state.isTrainingGame`-Flag steuert: (a) ein
  fixes `.training-banner`-Overlay mit Zielsumme, betroffener Gruppe und
  Begründungstext + "Anwenden"-Button (wendet exakt den einen vorgeschlagenen
  Schritt an), (b) `onCellTap` ignoriert manuelle Taps, solange ein
  erzwungener Schritt aussteht, (c) Sieg-/Niederlage-/Aufgeben-Overlays
  zeigen statt der üblichen "nächstes Rätsel"/"neues Spiel"-Aktionen einen
  "Weiteres Beispiel"-Button (`startTrainingGame()`), (d) keine
  Statistik-/Highscore-Schreibung. Visuelles Markieren der vorgeschlagenen
  Zelle über neue CSS-Klasse `.cell.training-highlight` (gepulster
  Box-Shadow). Keine neuen `storage.js`-Keys nötig. i18n: neue
  `home.trainingMode`/`home.trainingHint` + komplettes `training.*`-Objekt
  in allen 10 Sprachen ergänzt (dabei zwei Apostroph-Escaping-Bugs in
  `fr.js`/`it.js` gefunden und nach bestehender Konvention behoben — siehe
  PR). Neue Unit-Tests (`training.test.js`, 5/5) und neue
  `test/e2e/training.spec.js` (4 Tests: Start liefert lösbares Rätsel,
  Schritt-für-Schritt-Lösen ohne Stats-Änderung, Sieg-Screen bietet
  "weiteres Beispiel" statt "nächstes Rätsel", Zell-Taps werden bei
  ausstehendem Schritt ignoriert) — 49/49 E2E-Tests grün; PR #54 nach
  grünem CI nach `master` gemerged.
- **Nächster Schritt:** Branch `claude/feat-coop-4players` von `master`
  anlegen und mit Feature 12a (Coop-Raumkapazität auf 4 erhöhen +
  Start-Button-Lobby) beginnen — erstes Feature des Coop-Blocks (siehe
  ursprünglicher Plan: `coop.js:114` `playersSnap.size >= 2` durch
  konfigurierbare Konstante `COOP_MAX_PLAYERS = 4` in `config.js` ersetzen;
  veralteten "max. 2 Spieler"-Kommentar in `coop.js:10-12` aktualisieren;
  `startHosting()`s `onJoin`-Callback (app.js:715-733) von Auto-Start beim
  ersten Beitritt auf eine echte Warte-Lobby mit explizitem Host-
  "Start"-Button umstellen, damit Spieler 3/4 noch rechtzeitig beitreten
  können; `pickAvailableColor()`/Herzen-Reihe/`.coop-roster`-Chips/
  Team-Performance-Panel sind laut Plan bereits spieleranzahl-agnostisch —
  kurzer visueller Check bei 4 Spielern reicht; i18n: Lobby-Text "wartet
  auf Spieler (n/4)" statt der bisherigen Singular-Formulierung
  `coop.waitingForGuest`, ohne ICU-Pluralregeln zu benötigen, da `t()` nur
  flache `{param}`-Substitution unterstützt).

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
