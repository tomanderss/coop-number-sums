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
| F8 | Profanitätsfilter für Coop-Namen | `claude/feat-profanity` | ⬜ offen |
| F10 | Eigene Rätselgröße/-schwierigkeit (Custom-Modus) | `claude/feat-custom-size` | ⬜ offen |
| F15 | Boss-Rätsel (wöchentliches Sudden-Death) | `claude/feat-boss` | ⬜ offen |
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
- **Letzter abgeschlossener Schritt:** Feature 6 (Barrierefreiheit)
  vollständig: Farbenblind-Palette, ARIA-Labels + Tastaturbedienung für
  Zellen, 44px-Tippflächen, Fokusring; i18n in allen 10 Sprachen ergänzt;
  Unit- (85/85) und E2E-Tests (35/35) grün; PR #43 nach grünem CI nach
  `master` gemerged (zusammen mit PR #42 ROADMAP.md-Setup).
- **Nächster Schritt:** Branch `claude/feat-profanity` von `master`
  anlegen und mit Feature 8 (Profanitätsfilter für Coop-Namen) beginnen
  (siehe ursprünglicher Plan: neue Datei `js/profanity.js`, Hook in
  `confirmCoopIdentity()` + Settings-`coopName`-Input).

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
