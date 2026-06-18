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
database.rules.json   Firebase-RTDB-Security-Rules (versioniert, Quelle: Firebase Console)
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
  coop.js             Coop-Transport (Firebase Realtime Database, lazy geladen)
  firebase.js         Firebase-Init (anonyme Auth + RTDB), lazy geladen
  vendor/firebase/    Lokal vendorter Firebase-SDK-Build (app/auth/database)
  buildinfo.js        Auto-generiert: Version + Changelog
  app.js              Vue-App (Screens, Board, Interaktion)
```

## Coop-Modus
Zwei Spieler (Host + ein Mitspieler) lösen ein Rätsel gemeinsam in Echtzeit.
Spielzüge laufen über `setMark()`; Transport ist Firebase Realtime Database
(Region `europe-west1`): der Host legt einen 6-stelligen Code an, jede Aktion
landet als Event unter `/rooms/{code}/events` und wird an alle Lauscher
verteilt. Anwesenheit läuft über `onDisconnect()` statt eines eigenen
Heartbeats. Es werden keine Statistiken/Einstellungen in die Cloud
übertragen — die bleiben wie bisher rein lokal (`localStorage`).

## Native Apps (iOS / Android via Capacitor)

### Überblick
[Capacitor](https://capacitorjs.com) wrapt die bestehende, unveränderte
Web-App 1:1 in eine native iOS/Android-Shell. GitHub Pages bleibt der
primäre Web-Kanal — Capacitor ist nur ein zusätzlicher Vertriebsweg über die
App Stores. Es gibt keinen Bundler/Compile-Schritt für den eigentlichen
App-Code; Capacitor verlangt lediglich ein `webDir` ungleich dem Projekt-Root,
deshalb spiegelt `scripts/cap-copy-www.js` die zur Laufzeit benötigten
Dateien (`index.html`, `manifest.json`, `sw.js`, `css/`, `icons/`, `js/`)
unverändert nach `www/` (generiert, nicht versioniert — siehe `.gitignore`).

### Einmalige Einrichtung
```
npm install
npx cap add android   # bereits erledigt, nur bei Bedarf erneut nötig
```
`npx cap add ios` erfordert macOS + Xcode und ist hier nicht eingerichtet.

### Android-Build (lokal, Android Studio/SDK erforderlich)
```
npm run cap:sync       # kopiert www/ neu & führt `cap sync android` aus
npx cap open android   # öffnet das Projekt in Android Studio
```
Von dort wie gewohnt per Android Studio (oder `./gradlew assembleDebug` im
`android/`-Ordner) bauen, signieren und auf Play Store hochladen.

### iOS-Build (nur auf einem Mac)
```
npm run cap:copy
npx cap add ios        # einmalig, nur auf dem Mac
npx cap sync ios
npx cap open ios
```
Danach in Xcode signieren (Apple Developer Account nötig) und einreichen.

### Web-Code-Änderungen für Capacitor
Die Service-Worker-Registrierung in `js/app.js` ist um eine Bedingung
ergänzt, die innerhalb einer nativen Capacitor-App (`Capacitor.isNativePlatform()`)
greift: dort wird der Service Worker nicht registriert, da er ausschließlich
dem GitHub-Pages-Update-Banner dient — ein Konzept, das in einer Store-App
keine Rolle spielt (Updates laufen über neue Store-Binaries). Alle anderen
Web-Dateien sind unverändert.

### Firebase-Konsole
Für den Coop-Modus müssen die nativen App-Origins (`https://localhost` unter
Android per `androidScheme`, `capacitor://localhost` unter iOS) ggf. unter
**Firebase Console → Authentication → Settings → Authorized domains**
freigegeben werden, falls Anmeldungen aus der nativen App fehlschlagen.

### Versionierung
`build.js`/die Commit-basierte Versionierung bleibt unverändert — `android/`
und `capacitor.config.json` haben keinen Einfluss auf die Web-Versionsnummer.
Nach einem Release ggf. `npm run cap:sync` ausführen, um die neue Version in
einen nativen Build zu übernehmen.

### Bekannte Einschränkungen
Store-spezifische Schritte (App-Icons in allen Store-Größen, Splash-Screens,
Datenschutzerklärung, Store-Listing-Texte/Screenshots, Code-Signing) sind
bewusst nicht Teil dieses Setups und folgen separat.
