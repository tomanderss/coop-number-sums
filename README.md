# Coop Number Sums

Ein Number-Sums-Logikrätsel als Progressive Web App (PWA) — offline spielbar, mit
Dunkelmodus, mehreren Feldgrößen und Schwierigkeitsgraden. Aufgebaut wie die
Werwolf-App (Vanilla + Vue 3 via ESM, kein Build-Tooling, Versionierung über
Commit-Anzahl).

## Spielregeln
- Jede Zahl **links neben einer Reihe** und **über einer Spalte** ist die **Zielsumme**.
- Kreise mit dem **Stift (○)** genau die Zahlen ein, die zusammen die Zielsumme ergeben.
- Überflüssige Zahlen mit dem **Radierer (⌫)** durchstreichen.
- Jede **farbige Region** hat zusätzlich eine eigene Zielsumme (Zahl in der Ecke).
- Jedes Rätsel ist garantiert **eindeutig** und **ohne Raten** lösbar.

## Lokal testen (iPhone im selben WLAN)
Doppelklick auf **`start-server.bat`** → die angezeigte `http://<IP>:8080`-Adresse
im iPhone-Safari öffnen → *Teilen → Zum Home-Bildschirm*.
(Benötigt Python.)

## Deployment via GitHub Pages
Einmalige Einrichtung:
1. Auf GitHub ein neues, leeres Repo `coop-number-sums` anlegen.
2. Im Projektordner:
   ```
   git remote add origin https://github.com/<dein-user>/coop-number-sums.git
   git add -A
   git commit -m "Initial"
   git push -u origin master
   ```
3. Auf GitHub: **Settings → Pages → Source: `master` / `(root)`** → Speichern.
   Die App liegt danach unter `https://<dein-user>.github.io/coop-number-sums/`.

Jeder weitere Release: Doppelklick auf **`build.bat`** — generiert Version &
Changelog, bumpt den Service-Worker-Cache, committet und pusht. GitHub Pages
deployt automatisch.

### Versionierung
`build.js` setzt die Version auf `0.<Commit-Anzahl+1>`, übernimmt die Zeilen aus
`changes.txt` in den Changelog (`js/buildinfo.js`) und leert `changes.txt`.
Vor einem Release einfach die Stichpunkte der neuen Version in `changes.txt`
schreiben — sie erscheinen automatisch im „Was ist neu"-Popup und im Changelog.

### Icons neu erzeugen
`node create-icons.js` (erzeugt `icons/icon-192.png` & `icon-512.png`).

## Projektstruktur
```
index.html            Splashscreen + App-Mount
manifest.json         PWA-Manifest
sw.js                 Service Worker (offline-Cache)
build.js / build.bat  Versionierung & Deploy
start-server.bat      Lokaler Testserver
create-icons.js       Icon-Generator
css/styles.css        Styles (Dark default + Light)
js/
  config.js           Größen, Schwierigkeiten, Farben, Defaults
  solver.js           Deduktions-Engine (Eindeutigkeit + Schwierigkeitsmaß)
  generator.js        Rätsel-Generator (immer eindeutig & ohne Raten lösbar)
  storage.js          localStorage: Einstellungen, Resume, Statistik, Backups
  buildinfo.js        Auto-generiert: Version + Changelog
  app.js              Vue-App (Screens, Board, Interaktion)
```

## Coop-Modus (geplant)
Der Coop-Button ist als „bald" markiert. Architektur ist vorbereitet: Spielzüge
laufen zentral über `setMark()` und der Rätselzustand ist serialisierbar (Seed +
`marks`). Für Echtzeit-Coop kommt eine Netzwerk-Schicht hinzu (z. B. Firebase
Realtime Database oder WebRTC/PeerJS), die `setMark`-Ereignisse broadcastet und
beim Beitritt den vollen Zustand synchronisiert. Bluetooth ist auf iOS-Safari
nicht möglich, daher braucht Coop Internet + eine Relay-Schicht.
