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
| F11 | Race-/Duell-Modus | `claude/feat-race` | ⬜ offen |

Reihenfolge: Solo-Block (F6 → F8 → F10 → F15 → F3 → F1 → F5), dann
Coop-Block (F12a → F12c → F4 → F12b → F11). Details/Begründung der
Reihenfolge und jedes einzelnen Features stehen im ursprünglichen Plan
(siehe Konversation/PR-Beschreibungen).

## Aktueller Stand

- **Aktueller Branch:** `master` (nächster Feature-Branch
  `claude/feat-race` noch nicht angelegt)
- **Letzter abgeschlossener Schritt:** Feature 12b (Team-vs-Team, 2v2)
  vollständig — **mit einer bewussten Architekturabweichung vom
  ursprünglichen Plantext**: statt zwei eigenständiger, gekoppelter
  Coop-Räume + einer separaten `/teamMatches/{matchCode}/`-RTDB-Struktur
  wird der **bestehende Einzel-Raum aus F12a wiederverwendet** (kein zweiter
  Raum, kein neues RTDB-Top-Level-Schema, kein manueller
  `database.rules.json`-Deploy nötig). Host aktiviert `state.coop.teamMode`
  in der bestehenden 4-Spieler-Lobby; jeder Spieler bekommt ein `team`-Feld
  (`'A'|'B'|null`) per Klick auf seinen Roster-Chip (`cycleTeam(id)`,
  zyklisch null→A→B→null). Start-Button bleibt deaktiviert, bis beide Teams
  mindestens einen Spieler haben. Gameplay-Events laufen team-intern über
  neue `teamEvents/{team}`-RTDB-Kanäle (`sendTeamEvent`/`listenTeamEvents`
  in `js/coop.js`) statt über den gemeinsamen `events`-Kanal — dadurch
  **keine zellweise Synchronisation über die Teamgrenze**, kein
  Antwort-Leak. Nur aggregierter Fortschritt (`pct`/`mistakes`) wird über
  `teamProgress/{team}` (`setTeamProgress`/`listenTeamProgress`) sichtbar
  gemacht. `MSG.TEAM_START` (raumweit, `{seed, difficulty}`) startet beide
  Teams synchron mit demselben Seed (`generatePuzzle({difficulty, seed})`
  lokal pro Client, kein Rätsel-Versand über die Teamgrenze).
  `MSG.TEAM_DONE` (raumweit, `{team, outcome}`) beendet das Match hart und
  sofort für beide Teams, sobald ein Team fertig ist — Sieger-Logik: bei
  `outcome==='won'` gewinnt das fertige Team, bei `'lost'`/`'gaveup'`
  gewinnt automatisch das andere Team; kein Weiterspielen für eigene Stats,
  keine Retry-/Neues-Spiel-Buttons auf dem Team-Ergebnis-Screen. Neuer
  `state.team`-Substate (`active`, `myTeam`, `matchOver`, `winningTeam`,
  Gegner-Fortschritt) getrennt von `state.coop`, neue `.coop-chip`-Anzeigen
  ("Team A"/"Gegner X%") im laufenden Spiel. i18n: `team.*` (Toggle-Label,
  Zuweisungs-Hinweis, Team-Labels, Start-Button, Warte-Hinweis,
  Gegner-Fortschritt, Match-Ergebnis-Texte) in allen 10 Sprachen ergänzt.
  Vue-3-Bugfix nebenbei behoben: Lobby-Roster-Template kombinierte `v-if`
  (Team- vs. Normal-Anzeige) mit `v-for` auf demselben Element — in Vue 3
  mehrdeutig/unsicher (andere Präzedenz als Vue 2) — gefixt durch
  Verschachtelung in `<template v-if>`/`<template v-else>`-Wrapper statt
  beider Direktiven auf demselben Tag. Debug-Hook `window.__cns` um
  `handleCoopMsg` erweitert, damit E2E-Tests ein eingehendes `TEAM_DONE` vom
  Gegnerteam simulieren können (gleiches Muster wie der bereits vorhandene
  `getDailyChallenge`-Hook). Neue E2E-Tests in `test/e2e/team.spec.js` (5
  Tests: Team-Toggle sichtbar, Roster gated Start-Button bis beide Teams
  besetzt sind, Match-Start zeigt Team-/Gegner-Chip, Gegner gewinnt erzwingt
  sofortige Niederlage ohne Retry-Buttons, Gegner gibt auf → automatischer
  Sieg) — die ersten Testversuche klickten noch durch den echten
  `Coop.hostGame()`-Netzwerkaufruf, der in diesem Sandbox-Netzwerk
  zuverlässig binnen ~500ms mit einem Verbindungsfehler scheitert und dabei
  `state.coop.waitingForGuest` mitten im mehrstufigen Test zurücksetzt
  (4 von 5 Tests flacker/timeout) — Fix: wie im bestehenden
  `coop.spec.js`-Gast-Test die echten `hostGame()`/`onOpen()`-Effekte direkt
  per `page.evaluate()` simulieren (`role`/`code`/`teamMode`/
  `waitingForGuest`/`myId`/`hostId`/`players` setzen) statt den echten
  Netzwerkaufruf zu klicken. 109/109 Unit-Tests, 65/65 E2E-Tests grün
  (inkl. 15/15 bei `--repeat-each=3` auf `team.spec.js` zur
  Flakiness-Kontrolle); PR #62 nach grünem CI nach `master` gemerged.
- **Nächster Schritt:** Branch `claude/feat-race` von `master` anlegen und
  mit Feature 11 (Race-/Duell-Modus, v1: nur "wer als Erster fehlerfrei
  fertig ist, gewinnt") beginnen — letztes Feature des Rollouts (siehe
  ursprünglicher Plan: neue eigenständige Datei `js/race.js`, neue
  RTDB-Struktur `/races/{code}/` mit `meta`/`players/{uid}`/
  `progress/{uid}` — Fortschritt **nie** zellweise, nur `pct`/`mistakes`/
  `finished`/`lastUpdate`, gedrosselt alle 2-3s gepusht statt bei jeder
  Markierung; gemeinsamer Seed, `generatePuzzle({difficulty, seed})` lokal
  bei beiden Spielern, kein Rätsel-Versand nötig; Leben/Fehleranzeige-
  Einstellungen werden in der Race-Runde ignoriert — immer sofortige
  Fehleranzeige mit unbegrenzter Selbstkorrektur; eigene Lobby mit
  Code-Eingabe + Identitäts-Gate analog Coop, Gegner-Fortschrittsanzeige
  als Prozent-Chip, eigener Sieg/Niederlage-Screen mit Wettkampf-Wortwahl;
  `database.rules.json` braucht eine neue `races`-Sektion — **muss manuell
  in der Firebase Console/CLI deployed werden**; neuer `storage.js`-Key
  `KEYS.RACE` (`racesPlayed`/`racesWon`/`racesLost`/`fastestWinMs`) in alle
  vier Backup/Export-Funktionen + `deleteAllData()` eintragen).

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
