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
  `claude/feat-pass-and-play` noch nicht angelegt)
- **Letzter abgeschlossener Schritt:** Feature 12a (Coop-Raumkapazität auf 4
  erhöhen + Start-Button-Lobby) vollständig: neue Konstante
  `COOP_MAX_PLAYERS = 4` in `js/config.js`, ersetzt die bisherige harte
  `playersSnap.size >= 2`-Kapazitätsprüfung in `coop.js`s `joinGame()`.
  Deterministische Host-Migration über `pickNewHostId()` (kleinste
  verbleibende Spieler-uid lexikografisch — jeder Client berechnet das
  unabhängig identisch) statt eines zentralen Failover-Mechanismus.
  Generalisiertes `connected`-Flag (`updateConnectedFlag()`,
  `state.coop.connected = players.some(p => p.id !== myId)`).
  `startHosting()`s automatischer Spielstart beim ersten Beitritt wurde zu
  einer echten Warte-Lobby mit explizitem Host-"Start"-Button
  (`canStartCoopMatch()`/`startCoopMatch()`, gated auf Host-Rolle + ≥2
  Spieler) — Spieler 3/4 können dadurch noch rechtzeitig beitreten.
  `broadcastRoster()` ruft `Coop.send()` direkt statt über `coopSend()`,
  da Roster-Updates auch während der Vor-Spiel-Lobby funktionieren müssen
  (umgeht den sonst aktiven Guard). `state.coop.hostId` wird Gästen per
  zusätzlichem Feld im bestehenden `MSG.ROSTER`-Broadcast mitgeteilt.
  Ein subtiler Bug wurde vor dem Testen gefunden und behoben: `coop.js`s
  `onLeave`-Callback gab die Spieler-id nicht an `onClose` weiter (war
  `() => onClose && onClose()`, nötig für die Host-Migrationslogik in
  `app.js`s `startJoining()` ist aber `onClose(id)` — gefixt zu
  `(id) => onClose && onClose(id)`). i18n: 4 neue `coop.*`-Keys
  (`playerJoinedLobby`, `playersCount`, `startMatch`,
  `waitingForHostStart`) in allen 10 Sprachen ergänzt. Keine neuen
  `storage.js`-Keys nötig (kein Backup/Export-Eintrag erforderlich). Neue
  E2E-Tests in `test/e2e/coop.spec.js` (Host-Lobby gated Start-Button +
  Navigation ins Spiel; Gast sieht Roster + "Warte auf Start durch
  Host…") — 51/51 E2E-Tests grün, 109/109 Unit-Tests grün; PR #56 nach
  grünem CI nach `master` gemerged.
- **Nächster Schritt:** Branch `claude/feat-pass-and-play` von `master`
  anlegen und mit Feature 12c (Lokaler Pass-and-Play-Modus) beginnen —
  zweites Feature des Coop-Blocks (siehe ursprünglicher Plan: kein Netzwerk
  nötig, `state.markedBy` speichert bereits pro Zelle, wer sie markiert
  hat; Umsetzung als Variante des bestehenden Coop-State
  (`state.coop.connected = false` dauerhaft, der existierende Guard
  `if (!state.coop.active || !state.coop.connected)` macht
  `Coop.send()`-Aufrufe automatisch zu No-ops); neu:
  `state.coop.activePlayerIdx` + ein "Gerät an Spieler X
  weitergeben"-Vollbild-Overlay als Rundenwechsel-Grenze, empfohlen per
  explizitem "Zug beenden"-Button statt nach jeder einzelnen Markierung;
  Team-Performance/Sieg-Screen funktioniert unverändert, da er nur
  `state.coop.players` + `state.markedBy` liest; keine `storage.js`-
  Schemaänderung, Ergebnisse laufen über die bestehenden
  `coop`-Statistikfelder).

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
