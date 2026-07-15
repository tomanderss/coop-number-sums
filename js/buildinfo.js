// Auto-generiert von build.js — nicht manuell bearbeiten!
export const BUILD      = '1.157';
export const BUILD_HASH = '93175d5';

export const CHANGELOG = [
  {
    "version": "1.157",
    "date": "15.07.2026",
    "changes": [
      "Freunde einladen: Die Freundesliste öffnet jetzt als eigenes Pop-up-Fenster über allem (komplett scrollbar) statt als kurze Liste am Button — in allen Lobbys und im Pausenmenü",
      "„Code teilen\"-Knopf bei der Solo-Einladung entfernt"
    ]
  },
  {
    "version": "1.156",
    "date": "11.07.2026",
    "changes": [
      "Neuer Farbstil „Dark Sakura\" im Shop: dunkles Pflaumen-Theme mit Kirschblüten-Rosa-Akzenten"
    ]
  },
  {
    "version": "1.155",
    "date": "11.07.2026",
    "changes": [
      "Coop-Beitritt: Schwarzbild-Prävention beim Zurückkehren aus dem Hintergrund (iOS-PWA zeichnet das WebView jetzt zuverlässig neu) und der Beitretende lädt korrekt im Coop-Kontext"
    ]
  },
  {
    "version": "1.154",
    "date": "11.07.2026",
    "changes": [
      "Prestige-Aufstiegs-Feier: Strahlenkranz sitzt jetzt eng um die Medaille (schnitt vorher quer durch den Text); Gewinn-Screen wird oben nicht mehr von der Statusleiste abgeschnitten"
    ]
  },
  {
    "version": "1.153",
    "date": "11.07.2026",
    "changes": [
      "„Große Zahlen\"-Modus jetzt auch in allen Multiplayer-Modi (Coop, Race, 1v1/2v2, Team) — im Host-Setup umschaltbar"
    ]
  },
  {
    "version": "1.152",
    "date": "10.07.2026",
    "changes": [
      "Neue Achievements: „R.I.P.\" (14×14 gewinnen) sowie drei fürs „Große Zahlen\"-Modus (erster Sieg, makelloser Sieg, Sieg auf R.I.P.)"
    ]
  },
  {
    "version": "1.151",
    "date": "10.07.2026",
    "changes": [
      "Prestige neu ausbalanciert: Die Schwellen (v.a. Legendär) waren selbst für sehr aktive Spieler kaum erreichbar – jetzt sind Gold/Legendär für regelmäßiges Spielen realistisch und „Großmeister\" ein echtes Langzeitziel"
    ]
  },
  {
    "version": "1.150",
    "date": "10.07.2026",
    "changes": [
      "„Große Zahlen\"-Modus jetzt für ALLE Feldgrößen verfügbar (6×6 bis 14×14), nicht mehr nur die kleinen"
    ]
  },
  {
    "version": "1.149",
    "date": "10.07.2026",
    "changes": [
      "Neuer „Große Zahlen\"-Modus: Zellwerte 10–19 statt 1–9 als frischer Denkreiz – gleicher Rätseltyp, gleiche Eindeutigkeit, per Umschalter im Setup (für 6×6 bis 9×9)"
    ]
  },
  {
    "version": "1.148",
    "date": "10.07.2026",
    "changes": [
      "Fehler behoben: Ein bereits abgeschlossenes (gelöstes) Spiel wird nicht mehr fälschlich als „Spiel fortsetzen\" angeboten – bisher lud es ein festhängendes 100%-Brett"
    ]
  },
  {
    "version": "1.147",
    "date": "09.07.2026",
    "changes": [
      "Spielernamen in der Coop-Ansicht sind jetzt kleiner, dünner und kompakter – sie nehmen deutlich weniger Platz ein"
    ]
  },
  {
    "version": "1.146",
    "date": "09.07.2026",
    "changes": [
      "Kritischer Fix: Mitspieler landen beim Einladen ins Solo-Spiel jetzt wirklich direkt im Spiel – ein „unendlich\"-Wert (unbegrenzte Hinweise) hatte zuvor die Spielstand-Übertragung an Firebase komplett scheitern lassen; nebenbei synchronisiert sich auch der Solo-Spielstand geräteübergreifend wieder"
    ]
  },
  {
    "version": "1.145",
    "date": "09.07.2026",
    "changes": [
      "Solo-Einladung: zusätzliches Sicherheitsnetz – sobald der Partner etwas tut, steigt der Beitretende garantiert ins Spiel ein (kein Lobby-Hänger mehr), plus mehr Diagnose-Infos im Protokoll"
    ]
  },
  {
    "version": "1.144",
    "date": "09.07.2026",
    "changes": [
      "Mitspieler-Einladung ins Solo-Spiel noch robuster: Der Host schickt Beitretenden den laufenden Spielstand jetzt aktiv zu – so landet jeder garantiert direkt im Spiel statt in der Lobby, egal wie das Timing liegt"
    ]
  },
  {
    "version": "1.143",
    "date": "09.07.2026",
    "changes": [
      "Mitspieler-Einladung ins Solo-Spiel: Beitretende landen jetzt garantiert direkt im laufenden Spiel (keine Bereit-Lobby mehr) und eine bestehende Pause endet beim Beitritt automatisch"
    ]
  },
  {
    "version": "1.142",
    "date": "09.07.2026",
    "changes": [
      "Mitspieler mitten im Solo-Spiel einladen: Über das Pausenmenü lässt sich ein Freund per Code oder Freundes-Einladung dazuholen – tritt er bei, wird die laufende Partie nahtlos zum gemeinsamen Coop-Spiel (Spielstand, Leben und Zeit bleiben erhalten)"
    ]
  },
  {
    "version": "1.141",
    "date": "09.07.2026",
    "changes": [
      "Direkteinstieg in laufende Coop-Runden (Beitritt per Code und \"Coop fortsetzen\") per Test dauerhaft abgesichert"
    ]
  },
  {
    "version": "1.140",
    "date": "09.07.2026",
    "changes": [
      "Coop-Räume stabiler: „Coop fortsetzen\" funktioniert zuverlässig (Raum wird nicht mehr fälschlich gelöscht) und beim Beitritt mit altem Raumcode spielen keine alten Sieganimationen/Lobbys mehr ab — läuft eine Runde, steigt man direkt in sie ein"
    ]
  },
  {
    "version": "1.139",
    "date": "09.07.2026",
    "changes": [
      "Chat-Verbesserungen: Beim Tippen schiebt sich das Chat-Fenster jetzt über die eingeblendete Tastatur, sodass Eingabefeld und Text sichtbar bleiben — und eine eingehende Nachricht hat einen eigenen Benachrichtigungston (nicht mehr denselben wie der Hinweis-Ton)"
    ]
  },
  {
    "version": "1.138",
    "date": "09.07.2026",
    "changes": [
      "Name und Prestige-Abzeichen sind im Hauptmenü größer, der Name wird jetzt immer angezeigt — und in JEDEM Mehrspieler-Modus erscheint das Prestige-Symbol neben jedem Spielernamen (auch während des laufenden Spiels), ebenfalls größer"
    ]
  },
  {
    "version": "1.137",
    "date": "09.07.2026",
    "changes": [
      "Geldverlauf: Eine Sieg-Belohnung zeigt jetzt die Schwierigkeit und den Modus, und beim Antippen klappt die volle Multiplikator-Aufschlüsselung auf — Basis, jeder einzelne Faktor (Mehrspieler ×2, makellos ×2, neue Bestzeit ×2, Serien-Bonus) und der Gesamt-Multiplikator"
    ]
  },
  {
    "version": "1.136",
    "date": "09.07.2026",
    "changes": [
      "Neuer „Zufall\"-Knopf im Schwierigkeitsauswahl-Screen: Ein Tipp wählt eine zufällige Schwierigkeit — verfügbar in Solo und allen Mehrspieler-Modi (Coop/Wettkampf/Team), und nach jedem Spiel im Auswahl-Screen erneut nutzbar"
    ]
  },
  {
    "version": "1.135",
    "date": "09.07.2026",
    "changes": [
      "Neue Prestige-Stufe freischalten wird jetzt groß gefeiert: Nach dem Spiel erscheint eine Ankündigung mit der Medaille — je höher die Stufe, desto spektakulärer (Bronze/Silber schlicht, Gold mit Strahlenkranz, Legendär mit Prisma-Ring und Feier-Animation)"
    ]
  },
  {
    "version": "1.134",
    "date": "09.07.2026",
    "changes": [
      "Cage-Farben weichen jetzt automatisch deiner Spielerfarbe aus: Eine pinke Cage bei pinker Markierungsfarbe (unsichtbare Einkreis-Ringe) kommt nicht mehr vor — geprüft beim Brett-Laden, bei Farb-/Palettenwechsel und im Mehrspieler für alle Spielerfarben"
    ]
  },
  {
    "version": "1.133",
    "date": "09.07.2026",
    "changes": [
      "Geldverlauf ist jetzt geräteübergreifend zuverlässig: Buchungen reisen mit dem Konto mit (inkl. Details wie Schwierigkeit, Modus, Basis und Multiplikator je Sieg) — erspieltes Geld eines anderen Geräts erscheint nie mehr fälschlich als „Admin-Geschenk\", nur echte Geschenke werden noch so gebucht"
    ]
  },
  {
    "version": "1.132",
    "date": "08.07.2026",
    "changes": [
      "Große Bretter (z.B. Bismillah) bleiben jetzt auch im Spielendspurt flüssig: Der Spieltimer rendert das Brett nur noch einmal statt viermal pro Sekunde neu, Markierungs-Styles werden gecacht, das Skin-Leuchten liegt nicht mehr auf den rotierenden Ringen (GPU-schonend, die Rotation pausiert in der Pause) und eine Layout-Messung ist gedrosselt — Tippen, Pause und Fortsetzen reagieren auf älteren Geräten wieder sofort"
    ]
  },
  {
    "version": "1.131",
    "date": "08.07.2026",
    "changes": [
      "Einstellungen ▸ Daten: Automatisch angelegte Sicherheitskopien (verdrängter Daten- oder Spielstand) sind jetzt sichtbar und lassen sich per Knopfdruck wieder einspielen — beim Einspielen wird der aktuelle Stand seinerseits als Kopie aufbewahrt"
    ]
  },
  {
    "version": "1.130",
    "date": "08.07.2026",
    "changes": [
      "Der „Unterschiedliche Spielstände\"-Dialog beim Start erscheint nur noch, wenn sich wirklich das Guthaben unterscheidet — alle übrigen Fortschritte (Siege, Erfolge, Käufe, Bestzeiten, Serien) werden automatisch verlustfrei zusammengeführt und Kleinigkeiten lösen sich still im Hintergrund"
    ]
  },
  {
    "version": "1.129",
    "date": "08.07.2026",
    "changes": [
      "Prestige: Die Fortschrittsbalken zeigen jetzt den Stand relativ zur nächsten Stufen-Schwelle (z.B. 8 von 9 = fast voll) statt einer verwirrenden Segment-Rechnung"
    ]
  },
  {
    "version": "1.128",
    "date": "08.07.2026",
    "changes": [
      "Tippe im Hauptmenü auf die Versionsnummer, um aktiv nach Updates zu suchen — ist eine neue Version bereit, übernimmst du sie per Dialog sofort mit einem Neustart (dein Spielstand bleibt erhalten)"
    ]
  },
  {
    "version": "1.127",
    "date": "08.07.2026",
    "changes": [
      "Laufende Spiele überleben jetzt Updates und Geräte-Sync zuverlässig: Ein Cloud-Abgleich kann einen lokal gespeicherten Spielstand nicht mehr stillschweigend löschen oder durch einen älteren ersetzen (der jüngere Stand gewinnt, verdrängte Stände werden gesichert)"
    ]
  },
  {
    "version": "1.126",
    "date": "08.07.2026",
    "changes": [
      "Symbol-Feinschliff: Der Blitz im VS-Duell-Symbol ist jetzt deutlich größer, und das kleine pulsierende Extra-Herz am Spenden-Button entfällt (das Herz steckt jetzt in der Tasse selbst)"
    ]
  },
  {
    "version": "1.125",
    "date": "08.07.2026",
    "changes": [
      "Symbol-Feinschliff: Das Herz in der Spenden-Kaffeetasse sitzt jetzt mittig im Tassenkörper (ohne den Rand zu berühren), und das VS-Duell-Symbol zeigt zwei Spieler mit Blitz dazwischen"
    ]
  },
  {
    "version": "1.124",
    "date": "08.07.2026",
    "changes": [
      "Neu gezeichnete Symbole: Die Kaffee-Tasse am Spendenlink ist jetzt symmetrisch mit Herz (Ko-fi-Stil) statt verbeult, und das VS-Duell-Symbol ist ein klares diagonales V/S mit Gold-Blitz — beide bleiben auch in Chipgröße gut lesbar"
    ]
  },
  {
    "version": "1.123",
    "date": "08.07.2026",
    "changes": [
      "Freundesliste: Hängen gebliebener Online-Status läuft jetzt automatisch ab — ohne Lebenszeichen gilt ein Freund nach 5 Minuten als offline (kein „ewig online\" mehr durch verwaiste Browser-Sitzungen)"
    ]
  },
  {
    "version": "1.122",
    "date": "07.07.2026",
    "changes": [
      "iPad-Querformat: Werkzeug-Knöpfe (Zurück/Werkzeug-Wechsel/Hinweis) stehen jetzt untereinander mit klarem Abstand statt gedrängt nebeneinander — kein versehentliches Fehltippen mehr; der Werkzeug-Wechsel sitzt ganz unten, am nächsten zum Daumen"
    ]
  },
  {
    "version": "1.121",
    "date": "07.07.2026",
    "changes": [
      "Konto-Anmeldung: E-Mail- und Passwort-Felder haben jetzt einen sichtbaren Rahmen (auch ohne Fokus klar erkennbar)"
    ]
  },
  {
    "version": "1.120",
    "date": "07.07.2026",
    "changes": [
      "Spielfeld nutzt jetzt auf ALLEN Geräten und in beiden Ausrichtungen den vollen Platz — insbesondere Tablets (iPad) und Querformat zeigen das Brett deutlich größer, ohne dass Zeilen/Spalten abgeschnitten werden"
    ]
  },
  {
    "version": "1.119",
    "date": "07.07.2026",
    "changes": [
      "Home: Spiel-Icon lädt beim Wechsel ins Hauptmenü sofort (kein Nachladen mehr)"
    ]
  },
  {
    "version": "1.118",
    "date": "07.07.2026",
    "changes": [
      "Weitere Render-Optimierung: Zeilen-/Spaltensummen und Käfig-Farben werden jetzt ebenfalls nur einmal pro Zug (bzw. je Palette) berechnet statt in jeder Zelle bei jedem Render — gilt für ALLE Brettgrößen, nicht nur 14×14"
    ]
  },
  {
    "version": "1.117",
    "date": "07.07.2026",
    "changes": [
      "Gelöst-Screen zeigt jetzt oben fett die Schwierigkeit + Maße (z.B. „R.I.P. · 14×14\")",
      "Große Bretter (14×14 „R.I.P.\") ruckeln nicht mehr gegen Spielende: das Brett berechnet aufgelöste Zeilen/Spalten/Käfige nur noch einmal pro Zug statt in jeder Zelle bei jedem Render (deutlich weniger CPU-Last/Hitze)"
    ]
  },
  {
    "version": "1.116",
    "date": "07.07.2026",
    "changes": [
      "App startet jetzt zuverlässig offline vom Home-Bildschirm (Flugmodus): App-Shell wird cache-first ausgeliefert, robustes Precaching + atomarer Cache-Swap (kein Aussperren mehr nach misslungenem Update)",
      "Offline-Bewusstsein: Home zeigt einen Offline-Hinweis; Coop/Wettkampf/Freunde sind offline sauber deaktiviert (statt in einen Verbindungsfehler zu laufen); bei Rückkehr online wird automatisch abgeglichen",
      "Versions-Mismatch-Dialog zurück: hast du offline gespielt UND woanders online, fragt die App beim Abgleich, welchen Stand du behalten willst (dieses Gerät oder Cloud) — die andere Version wird als Backup gesichert, nie still überschrieben"
    ]
  },
  {
    "version": "1.115",
    "date": "07.07.2026",
    "changes": [
      "Geräteübergreifende Konsistenz: ein laufendes Solo-Spiel ist jetzt über alle angemeldeten Geräte synchron — wird es woanders beendet/fortgesetzt, zieht das andere Gerät sofort nach (kein Überschreiben eines neueren Stands, keine Doppel-Belohnung)"
    ]
  },
  {
    "version": "1.114",
    "date": "06.07.2026",
    "changes": [
      "Der „Alles stummschalten\"-Schalter sitzt jetzt in den Einstellungen (Ton) statt auf dem Startbildschirm"
    ]
  },
  {
    "version": "1.113",
    "date": "06.07.2026",
    "changes": [
      "Solo-Spielstand wird nie mehr von einem Coop-/Wettkampf-Spiel überschrieben (stabile Slot-Zuordnung statt flackernder Flags)",
      "Im Shop-Untermenü „Klänge\" und „Musik\" pausieren jetzt Hintergrundmusik und alle UI-Sounds — nur die ▶-Vorschau erzeugt dort Ton, damit nichts interferiert"
    ]
  },
  {
    "version": "1.112",
    "date": "06.07.2026",
    "changes": [
      "Neuer „Alles stummschalten\"-Knopf oben im Menü — legt Musik und alle Sounds mit einem Tipp still (Master-Lautstärke bleibt erhalten)"
    ]
  },
  {
    "version": "1.111",
    "date": "06.07.2026",
    "changes": [
      "Chat in allen Multiplayer-Modi (Coop, 1v1, Jeder-gegen-Jeden, Team) — Chat-Button in der Spielleiste mit Ungelesen-Zähler"
    ]
  },
  {
    "version": "1.110",
    "date": "06.07.2026",
    "changes": [
      "Spielstart/Fortsetzen: das Brett wird jetzt IMMER sofort vollständig eingepasst — auch die größten Bretter (14×14) auf schmalen Handys, keine abgeschnittene Zeile/Spalte mehr"
    ]
  },
  {
    "version": "1.109",
    "date": "06.07.2026",
    "changes": [
      "Desktop: frei belegbare Taste (Standard Tab) schaltet im Spiel zwischen Einkreisen und Radiergummi um — neuer Einstellungs-Abschnitt „Desktop“; Tab kapert nicht mehr den Browser-Fokus",
      "Prestige: Großmeister-Karte kompakter und im Scrollbereich — die Abzeichen-Liste lässt sich wieder normal durchscrollen"
    ]
  },
  {
    "version": "1.108",
    "date": "06.07.2026",
    "changes": [
      "Neues Krönungs-Abzeichen „Großmeister\": freigeschaltet, wenn alle 12 Prestige-Abzeichen auf Legendär stehen — mit glühender Profil-Zelle, dynamischer Prisma-Schrift und Freischalt-Feier"
    ]
  },
  {
    "version": "1.107",
    "date": "06.07.2026",
    "changes": [
      "Desktop: Spielfeld nutzt jetzt die volle Fensterbreite (nicht mehr auf den Mobil-Rahmen geklemmt) — größer per Default, beim Zoomen erst am Fensterrand beschnitten",
      "Siegesanimation + Ergebnis-Dialog erscheinen jetzt sofort und ruckelfrei; die Animation liegt sichtbar über dem Dialog",
      "Admin-Panel: alle Datenfelder in Klartext-Deutsch — keine rohen Datenbank-Schlüssel mehr (Cosmetic-Einstellungen, Rolle, Profilfeld-Auswahl, JSON-Titel)"
    ]
  },
  {
    "version": "1.106",
    "date": "06.07.2026",
    "changes": [
      "Bestenliste: kein Flackern/Verschieben mehr beim Schwierigkeit-Wechsel — Chips fix, nur die Rangliste scrollt"
    ]
  },
  {
    "version": "1.105",
    "date": "06.07.2026",
    "changes": [
      "Admin-Panel: Inventar zeigt jetzt „besessen / möglich\" (z.B. 4 / 81)",
      "Admin „Alles freischalten\": neu freigeschaltete Artikel (auch Musik-/Sound-Pakete) greifen sofort ohne Neustart"
    ]
  },
  {
    "version": "1.104",
    "date": "06.07.2026",
    "changes": [
      "Admin-Panel: Geschenk-Auswahl ist jetzt ein kategorisierter Popup-Screen (wie der Shop) mit klaren deutschen Namen statt einer rohen Dropdown-Liste"
    ]
  },
  {
    "version": "1.103",
    "date": "05.07.2026",
    "changes": [
      "Admin: Gold-Geschenke an andere Nutzer erscheinen jetzt auch in deren Geldverlauf und lösen bei ihnen eine Benachrichtigung aus",
      "Admin-Panel: fehlende E-Mail-Adressen werden beim Start automatisch nachgetragen und immer angezeigt"
    ]
  },
  {
    "version": "1.102",
    "date": "05.07.2026",
    "changes": [
      "Schwierigkeitsauswahl: Hintergrund füllt jetzt den ganzen Screen (full-bleed, kein dunkler Rahmen) und blendet zu allen vier Rändern weich aus; Coop/1v1/2v2 sehen identisch wie Solo aus, der Raumcode ist in den Screen integriert"
    ]
  },
  {
    "version": "1.101",
    "date": "05.07.2026",
    "changes": [
      "Solo-Setup-Hintergrund flart jetzt an den Rändern weich aus (kein hartes Rechteck mehr)"
    ]
  },
  {
    "version": "1.100",
    "date": "05.07.2026",
    "changes": [
      "Siegesanimation ist jetzt komplett sichtbar: Rendering-Bug behoben (Animation wurde fälschlich im Toast-<transition> verschluckt), läuft über allen Overlays, und die Ergebnis-Karte erscheint mit kurzem Vorlauf"
    ]
  },
  {
    "version": "1.99",
    "date": "05.07.2026",
    "changes": [
      "Slider-Schwierigkeitsauswahl jetzt in ALLEN Modi: Coop-, 1v1- und 2v2-Lobby zeigen denselben Slider (als morphende Karte) statt Kartenraster"
    ]
  },
  {
    "version": "1.98",
    "date": "05.07.2026",
    "changes": [
      "Schwierigkeits-Slider reagiert flott: Regler und Füllung ziehen nicht mehr hinterher, der Hintergrund morpht weiterhin smooth"
    ]
  },
  {
    "version": "1.97",
    "date": "05.07.2026",
    "changes": [
      "Shop-Vorschau bleibt beim Scrollen deckend: hochgescrollte Rahmen blenden nicht mehr über die Zahlen-Vorschau"
    ]
  },
  {
    "version": "1.96",
    "date": "05.07.2026",
    "changes": [
      "Neue Schwierigkeitsauswahl: ein Slider von schwach nach stark mit smooth morphendem Hintergrund, großem Stufen-Icon, Maßen und Zeiten"
    ]
  },
  {
    "version": "1.95",
    "date": "05.07.2026",
    "changes": [
      "Cloud-Sync: Bei Spielstart, Pause, Sieg, Niederlage und beim Schließen der App wird jetzt SOFORT synchronisiert (statt erst nach bis zu 30 s) – fertige Spiele mit Belohnung gehen beim schnellen Schließen nicht mehr verloren"
    ]
  },
  {
    "version": "1.94",
    "date": "05.07.2026",
    "changes": [
      "Einstellungen: Alle erworbenen Cosmetics (App-Theme, Brett-Palette, Ziffern-Stil, Rahmen, Sound-Paket, Musik-Paket) lassen sich jetzt direkt in den Einstellungen ausrüsten – nicht nur im Shop"
    ]
  },
  {
    "version": "1.93",
    "date": "05.07.2026",
    "changes": [
      "Admin: Wenn man sich selbst Guthaben gibt, erscheint das jetzt im Geldverlauf UND man bekommt eine Benachrichtigung (vorher beides nicht)"
    ]
  },
  {
    "version": "1.92",
    "date": "05.07.2026",
    "changes": [
      "Siegesanimationen: Einhorn, Drache, Phönix, Rakete und Disco fliegen jetzt als eigene SVG-Grafik statt als Emoji (kein Emoji mehr in den Effekten)",
      "Offline-Zwischenspeicher (Service Worker) enthält jetzt alle App-Module – Updates greifen zuverlässiger, keine hängenden Alt-Versionen mehr"
    ]
  },
  {
    "version": "1.91",
    "date": "05.07.2026",
    "changes": [
      "Admin: Guthaben spenden (+), abziehen (−) oder Zielwert (=) statt fixem Setzen – mit Live-Anzeige der Differenz; die Buchung erscheint im Geldverlauf des Nutzers"
    ]
  },
  {
    "version": "1.90",
    "date": "05.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Musik-Pakete\": kaufbare Hintergrundmusik-Stile (Lo-Fi, Klassik, Chiptune, Synth-Nacht) neben dem Zen-Standard – mit Hör-Vorschau (▶)"
    ]
  },
  {
    "version": "1.89",
    "date": "05.07.2026",
    "changes": [
      "Admin: Geschenke/Entzüge (auch „Alles freischalten\") werden jetzt gesammelt und erst beim Speichern gesendet – vorher, mit Vorschau-Chips",
      "Admin: Schenken-Buttons farbig hervorgehoben"
    ]
  },
  {
    "version": "1.88",
    "date": "05.07.2026",
    "changes": [
      "Siegesanimationen machen jetzt Sound – eine Fanfare, die zum Effekt passt und mit dessen Stufe grandioser wird (auch in der Shop-Vorschau)",
      "Siegesanimation: Auswahl in Einstellungen und Shop sind jetzt garantiert synchron (gleiche aktive Anzeige)"
    ]
  },
  {
    "version": "1.87",
    "date": "05.07.2026",
    "changes": [
      "Geldverlauf: Guthaben-Chip im Shop öffnet jetzt die Transaktionshistorie (Siege, Käufe, Admin-Geschenke)"
    ]
  },
  {
    "version": "1.86",
    "date": "04.07.2026",
    "changes": [
      "Coop/Wettkampf: Spielzeit läuft jetzt geräteübergreifend synchron (keine falsche/negative Zeit mehr beim Start aus der Lobby)"
    ]
  },
  {
    "version": "1.85",
    "date": "04.07.2026",
    "changes": [
      "2v2: Gegner-Team jetzt als Fortschrittsbalken + Lebensanzeige (Layout wie in den anderen Wettkampfmodi)",
      "2v2: Falscher eigener Prozentwert im Endscreen behoben"
    ]
  },
  {
    "version": "1.84",
    "date": "04.07.2026",
    "changes": [
      "Wettkampf: neuer „Jeder gegen jeden\"-Modus (3–4 Spieler, jeder auf eigenem Gitter mit gleichem Rätsel, erster Fertiger gewinnt)"
    ]
  },
  {
    "version": "1.83",
    "date": "04.07.2026",
    "changes": [
      "Komplette Oberfläche ohne System-Emojis: i18n-Texte, Popups, Schwierigkeits- & Changelog-Symbole auf eigene SVG-Icons umgestellt"
    ]
  },
  {
    "version": "1.82",
    "date": "04.07.2026",
    "changes": [
      "Erfolge: eigene SVG-Icons statt Emoji (gesperrte Erfolge mit Schloss-Symbol)"
    ]
  },
  {
    "version": "1.81",
    "date": "04.07.2026",
    "changes": [
      "Shop: eigene SVG-Icons für alle Artikel, Kategorien und Sieganimationen statt System-Emojis"
    ]
  },
  {
    "version": "1.80",
    "date": "04.07.2026",
    "changes": [
      "Streak-Anzeige überlappt nicht mehr das Freunde-Symbol (sitzt jetzt in der sicheren Mittelzone zwischen den Kopfleisten-Buttons)",
      "Sieganimationen neu: Drache, Einhorn und Phönix als detailliert gezeichnete SVG-Kreaturen (Flügelschlag/Galopp/wehender Schweif); alle Emoji-Partikel durch eigene SVG-Formen ersetzt"
    ]
  },
  {
    "version": "1.79",
    "date": "04.07.2026",
    "changes": [
      "Prestige-System: Profil-Abzeichen werden jetzt VERDIENT statt gekauft — 12 Kategorien (an Statistiken gekoppelt) mit je 4 Stufen (Bronze→Legendär), eigener Prestige-Screen zum Ausrüsten; Badges raus aus dem Shop",
      "Streak-Flamme auf dem Home-Screen vergrößert"
    ]
  },
  {
    "version": "1.78",
    "date": "04.07.2026",
    "changes": [
      "Brettrahmen-Fix: Feld ragt mit aktivem Rahmen nicht mehr aus dem Bildschirm (Rahmen-Abstand wird jetzt in die Zellgröße eingerechnet); animierte Rahmen-Effekte laufen nur noch am Rand entlang statt durchs Spielfeld"
    ]
  },
  {
    "version": "1.77",
    "date": "04.07.2026",
    "changes": [
      "Eigenes Icon-Set: Emoji in der Oberfläche (Einstellungen, Kopfleisten-Buttons, Münz-/Streak-Chip, Schließen) durch selbst gezeichnete SVG-Icons ersetzt"
    ]
  },
  {
    "version": "1.76",
    "date": "04.07.2026",
    "changes": [
      "Eigene Abzeichen-Medaillen: Profil-Abzeichen sind jetzt selbst gezeichnete Medaillen (Bronze→Silber→Gold→Legendär) statt Emojis"
    ]
  },
  {
    "version": "1.75",
    "date": "04.07.2026",
    "changes": [
      "Streak-Bonus: +5% Münzen pro Streak-Tag (additiv, z.B. 5er-Streak +25%), sichtbar im Sieg- und Streak-Popup"
    ]
  },
  {
    "version": "1.74",
    "date": "04.07.2026",
    "changes": [
      "Shop aufgeräumt: WIP-Banner und Platzhalter-Karten entfernt.",
      "Brett-Rahmen liegen jetzt außen um die Spielfläche und ragen nicht mehr in die Zellen."
    ]
  },
  {
    "version": "1.73",
    "date": "04.07.2026",
    "changes": [
      "Skin-Vorlagen sind jetzt für alle frei kaufbar und sofort nutzbar — der exklusive dynamische Skin schaltet nur noch zusätzlich den freien Skin-Editor frei.",
      "Dein Profil-Badge erscheint jetzt auch auf dem Home-Screen.",
      "Bestenliste: Vorhandene Bestzeiten werden beim Start automatisch eingetragen (nicht mehr nur neue Rekorde)."
    ]
  },
  {
    "version": "1.72",
    "date": "04.07.2026",
    "changes": [
      "Shop: 5 neue dynamische Brett-Rahmen — Lauflicht, Plasma-Ring, Sternenstaub, Funkenring und Pulsar (durchgehend animiert)."
    ]
  },
  {
    "version": "1.71",
    "date": "04.07.2026",
    "changes": [
      "Shop: Die Live-Vorschau bleibt beim Scrollen durch die Karten immer sichtbar (die Auswahl scrollt dahinter)."
    ]
  },
  {
    "version": "1.70",
    "date": "04.07.2026",
    "changes": [
      "Sieganimationen 2.0: Alle Animationen sind jetzt mehrphasig und deutlich spektakulärer — platzende Ballons, aufsteigende Feuerwerksraketen, Münzvulkane, Disco-Lichtkegel, marschierende Invader, Drachen-Feueratem, wachsender Kristall, Doppel-Regenbogen mit Komet u.v.m."
    ]
  },
  {
    "version": "1.69",
    "date": "04.07.2026",
    "changes": [
      "Shop: Auch „Klassisch\"-Gratis-Karten zeigen Farbpunkte/Demo und haben die ▶-Vorschau.",
      "Admin-Inventar: neuer Button „Alles freischalten\" schenkt alle Artikel auf einmal."
    ]
  },
  {
    "version": "1.68",
    "date": "04.07.2026",
    "changes": [
      "Shop: Live-Vorschau für jedes Item — ▶ auf jeder Karte zeigt Paletten, Zahlen-Stile, Rahmen und Skin-Vorlagen auf einem Demo-Brett, Badges als Namens-Chip und Themes 4 Sekunden in echt."
    ]
  },
  {
    "version": "1.67",
    "date": "04.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Skin-Vorlagen\": 8 kuratierte Designs für den exklusiven dynamischen Skin (Lagune, Smaragd, Abendrot, Goldrausch, Mitternacht, Polarlicht, Lava, Hyper-Regenbogen)."
    ]
  },
  {
    "version": "1.66",
    "date": "04.07.2026",
    "changes": [
      "Geschenke & Guthaben vom Admin sind jetzt sofort nutzbar — ohne App-Neustart (Live-Abgleich des Inventars).",
      "Sieganimation: ▶-Vorschau-Knopf direkt in den Einstellungen."
    ]
  },
  {
    "version": "1.65",
    "date": "04.07.2026",
    "changes": [
      "5 neue legendäre Sieganimationen (1500 Münzen): Meteorsturm, Gewitter, Dimensionsportal, Feuertornado und Synthwave-Sonne."
    ]
  },
  {
    "version": "1.64",
    "date": "04.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Profil-Badges\": 12 Abzeichen neben deinem Namen — sichtbar im Coop, in der Freundesliste und der Bestenliste."
    ]
  },
  {
    "version": "1.63",
    "date": "04.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Brett-Rahmen\": 7 dekorative Rahmen (Holz, Gold-Barock, Eiskristall, Neon-Puls, Feuerring, Regenbogen-Lauf, Galaxie-Ring mit kreisenden Lichtern)."
    ]
  },
  {
    "version": "1.62",
    "date": "04.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Zahlen-Stile\": 7 Schrift-Stile für die Zahlen auf dem Brett (Mono, Serif, Handschrift, Graviert, Neon, Umriss, Gold)."
    ]
  },
  {
    "version": "1.61",
    "date": "04.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Sound-Pakete\": 5 Klangwelten für alle Spiel-Sounds (Zen-Garten, 8-Bit-Arcade, Kristallglocken, Kosmos, Synthwave) — mit Hör-Vorschau."
    ]
  },
  {
    "version": "1.60",
    "date": "03.07.2026",
    "changes": [
      "Sieganimationen räumen sauber auf: keine nachglühenden Pixel mehr nach dem Schwarzen Loch, Overlays enden jetzt direkt mit der sichtbaren Animation."
    ]
  },
  {
    "version": "1.59",
    "date": "03.07.2026",
    "changes": [
      "Neue Shop-Kategorie „App-Themes\": 8 komplette Farbwelten für die ganze App (OLED-Nacht, Nebula, Tiefsee, Nachtwald, Sakura, Sonnenuntergang, Kaffeehaus, Cyberpunk)."
    ]
  },
  {
    "version": "1.58",
    "date": "03.07.2026",
    "changes": [
      "Neue Shop-Kategorie „Brett-Farbpaletten\": 8 kaufbare Paletten (Pastell-Traum, Neon-Glühen, Cyber-Grid, Spiegelwelt, …) färben die Cages um — Farb-Unterscheidbarkeit bleibt immer erhalten."
    ]
  },
  {
    "version": "1.57",
    "date": "03.07.2026",
    "changes": [
      "Admin-Änderungen benachrichtigen den Betroffenen jetzt („X hat dir Y geschenkt/entzogen\", auch Guthaben) — abschaltbar per Haken im Admin-Editor."
    ]
  },
  {
    "version": "1.56",
    "date": "03.07.2026",
    "changes": [
      "Admin-Werkzeug: Nutzer-Passwort direkt per Skript setzen (ohne Reset-Mail) — für vergessene Passwörter."
    ]
  },
  {
    "version": "1.55",
    "date": "03.07.2026",
    "changes": [
      "Admin: Selbst verschenkte Items und gesetztes Guthaben sind sofort nutzbar (kein Neustart mehr nötig)."
    ]
  },
  {
    "version": "1.54",
    "date": "03.07.2026",
    "changes": [
      "Shop: Sieganimationen liegen jetzt in einer eigenen Kategorie — erst Kategorie antippen, dann stöbern."
    ]
  },
  {
    "version": "1.53",
    "date": "03.07.2026",
    "changes": [
      "Solo fortsetzen: bereits eingekreiste Zahlen zeigen wieder Farbe und dynamischen Skin. Außerdem geht ein gespeicherter Spielstand nicht mehr verloren, wenn die App ohne zu spielen geschlossen wird oder Training läuft."
    ]
  },
  {
    "version": "1.52",
    "date": "03.07.2026",
    "changes": [
      "Freunde-Einladungen erreichen dich jetzt auch mitten im Spiel (laufende Solo-Partie wird beim Annehmen gesichert), und offene Einladungen lassen sich per „Zurückziehen\" zurücknehmen und sofort neu senden."
    ]
  },
  {
    "version": "1.51",
    "date": "03.07.2026",
    "changes": [
      "Neuer Shop-Bereich „Sieganimationen\": 22 kaufbare Animationen (400–900 Münzen, z.B. Feuerwerk, Schwarzes Loch, Drachenflug, Jackpot) mit Vorschau — Auswahl im Shop oder in den Einstellungen, Confetti bleibt gratis."
    ]
  },
  {
    "version": "1.50",
    "date": "03.07.2026",
    "changes": [
      "Coop-Verbindung deutlich stabiler: Nach Hintergrund/Standby heilt sich die Lobby jetzt beidseitig selbst (kein „halb verbundenes\" Spiel mehr, Züge gehen nicht mehr verloren), und der „Coop fortsetzen\"-Button funktioniert endlich (bis 12 Std. nach der letzten Runde, ohne den Spielstand zu überschreiben)."
    ]
  },
  {
    "version": "1.49",
    "date": "02.07.2026",
    "changes": [
      "Lobby-Einladung: „Eingeladen\"-Button springt nach Annahme des Freundes zurück auf „Einladen\" (erneutes Einladen nach Verlassen möglich)."
    ]
  },
  {
    "version": "1.48",
    "date": "02.07.2026",
    "changes": [
      "Admin-Editor: Guthaben antippbar (Chip öffnet die Wallet-Sektion) und Wallet ist auch für Nutzer ohne Guthaben-Knoten editierbar."
    ]
  },
  {
    "version": "1.47",
    "date": "02.07.2026",
    "changes": [
      "Freunde-Übersicht zeigt bei offline, wann zuletzt online. Admin sieht die eigene E-Mail auch ohne gespeicherte Profil-E-Mail."
    ]
  },
  {
    "version": "1.46",
    "date": "02.07.2026",
    "changes": [
      "Freunde hinzufügen jetzt über das ＋ oben im Freunde-Dialog (eigenes Popup statt festem Formular)."
    ]
  },
  {
    "version": "1.45",
    "date": "02.07.2026",
    "changes": [
      "Abmelden sichert den Stand in der Cloud und setzt dieses Gerät zurück — Daten können nicht mehr in einen zweiten Account geklont werden.",
      "Passwort lässt sich jetzt direkt im Konto-Bereich ändern (neues Passwort zweimal eingeben).",
      "Der 1.0-Feier-Skin und das Gründer-Abzeichen sind jetzt exklusiv für Spieler der ersten Stunde — Neuinstallationen erhalten sie nicht mehr automatisch.",
      "Freunde-Dialog: Annehmen/Ablehnen stehen unter dem Namen, mehr Abstand zwischen den Bereichen.",
      "Lobby-Einladung: „Koop\"-Tippfehler korrigiert (Coop) und der Einladen-Button wird nach einer Ablehnung wieder freigegeben."
    ]
  },
  {
    "version": "1.44",
    "date": "02.07.2026",
    "changes": [
      "Freunde-Button zeigt einen grünen Punkt, sobald mindestens ein Freund online ist."
    ]
  },
  {
    "version": "1.43",
    "date": "02.07.2026",
    "changes": [
      "Admin-Editor spricht jetzt Klartext: jedes Feld mit verständlichem Namen + Beschreibung, Auswahlfelder als Dropdown mit allen Optionen, Zeitstempel als lesbares Datum, Datums-Picker für den letzten Spieltag."
    ]
  },
  {
    "version": "1.42",
    "date": "02.07.2026",
    "changes": [
      "Einstellungen starten jetzt immer komplett zugeklappt — keine gemerkte Position mehr."
    ]
  },
  {
    "version": "1.41",
    "date": "02.07.2026",
    "changes": [
      "Design folgt jetzt automatisch dem System (Hell/Dunkel) — in den Einstellungen weiterhin manuell auf Hell oder Dunkel festlegbar."
    ]
  },
  {
    "version": "1.40",
    "date": "02.07.2026",
    "changes": [
      "Einstellungen komplett neu gestaltet: alle Bereiche als aufklappbare Karten auf einer Seite (nichts mehr versteckt), kompaktere Optik, klarer Scroll-Hinweis."
    ]
  },
  {
    "version": "1.39",
    "date": "02.07.2026",
    "changes": [
      "Admin-Änderungen an den eigenen Daten (z. B. Streak) greifen jetzt sofort und werden nicht mehr vom automatischen Cloud-Sync überschrieben."
    ]
  },
  {
    "version": "1.38",
    "date": "02.07.2026",
    "changes": [
      "Admin: Nutzer-Editor zeigt jetzt ALLE Daten (Streak, Statistiken, Guthaben, Erfolge, Einstellungen …) in übersichtlichen Sektionen — jedes Feld direkt editierbar, Änderungen gesammelt speicherbar."
    ]
  },
  {
    "version": "1.37",
    "date": "02.07.2026",
    "changes": [
      "Dynamischer Skin dreht jetzt GPU-beschleunigt (kein Dauer-Neuzeichnen aller Markierungen mehr) — behebt Abstürze mitten im Spiel auf iPhones.",
      "Admin-Konsole beginnt nicht mehr hinter der Dynamic Island (Safe-Area beachtet).",
      "Admin-Bearbeiten: Item-IDs und Profilfelder per Auswahlliste statt Freitext (alle verfügbaren Werte werden angeboten)."
    ]
  },
  {
    "version": "1.36",
    "date": "02.07.2026",
    "changes": [
      "Admin-Verwaltung als vollständige, editierbare Nutzer-Tabelle (Vollbild-Konsole)."
    ]
  },
  {
    "version": "1.35",
    "date": "01.07.2026",
    "changes": [
      "Absturz-Schleife im Menü (alle ~36 s) behoben — die Reload-Bremse greift jetzt auch bei langsamen Loops.",
      "Cloud-Sync im laufenden Spiel entschlackt (max. alle 30 s, kein 60-s-Sync während der Partie) — weniger Speicherlast, seltenere iOS-Abstürze."
    ]
  },
  {
    "version": "1.34",
    "date": "01.07.2026",
    "changes": [
      "Fehlgeschlagene Präsenz-/Cloud-Schreibzugriffe (PERMISSION_DENIED) werden nicht mehr endlos wiederholt — schont Verbindung und Akku."
    ]
  },
  {
    "version": "1.33",
    "date": "01.07.2026",
    "changes": [
      "Wichtiger Fix: Die Admin-Rolle wird nicht mehr versehentlich mit „Benutzer\" überschrieben. Die Rolle ist ausschließlich serverseitig (in der Datenbank) festgelegt und wird beim Cloud-Sync weder mitgeschrieben noch beim Laden überschrieben."
    ]
  },
  {
    "version": "1.32",
    "date": "01.07.2026",
    "changes": [
      "Freundesliste: Der Aktivitätsstatus (online / im Spiel mit Modus, Level und Fortschritt) wird jetzt nur noch bei tatsächlich online-Freunden angezeigt. Offline-Freunde erscheinen zuverlässig als „offline\" – kein veralteter Spielstatus mehr."
    ]
  },
  {
    "version": "1.31",
    "date": "01.07.2026",
    "changes": [
      "Admin-Status wird jetzt live aktualisiert: Wird deine Rolle (z. B. Administrator) gesetzt oder entfernt, ändert sich die Anzeige sofort – ohne App-Neustart oder Menü-Wechsel."
    ]
  },
  {
    "version": "1.30",
    "date": "01.07.2026",
    "changes": [
      "Ton-Einstellungen: Der Lautstärkeregler steht jetzt ganz oben im „Ton\"-Tab (über den einzelnen Musik-/Sound-Schaltern)."
    ]
  },
  {
    "version": "1.29",
    "date": "01.07.2026",
    "changes": [
      "Coop/Wettkampf: Statt „Teilen\" kannst du jetzt Freunde direkt in die Lobby einladen. Eingeladene bekommen eine Einladung zum Annehmen (treten automatisch bei) oder Ablehnen – eine Ablehnung wird dir angezeigt."
    ]
  },
  {
    "version": "1.28",
    "date": "01.07.2026",
    "changes": [
      "Neue Bestenliste: Der Tab „Bestenlisten\" im Freunde-Menü zeigt jetzt je Schwierigkeit die schnellsten (perfekten) Solo-Zeiten aller angemeldeten Spieler in Echtzeit – mit Hervorhebung des eigenen Eintrags."
    ]
  },
  {
    "version": "1.27",
    "date": "01.07.2026",
    "changes": [
      "Cloud-Sync: Weichen lokale und online gespeicherte Daten voneinander ab, werden jetzt immer automatisch die Online-Daten übernommen. Der frühere Auswahldialog beim Start entfällt."
    ]
  },
  {
    "version": "1.26",
    "date": "01.07.2026",
    "changes": [
      "Schwierigkeitsauswahl kompakter: Die Münz-Belohnung steht jetzt neben der Feldgröße (statt in einer eigenen Zeile) — die ganze Auswahl passt wieder ohne Scrollen auf den Bildschirm und die Namen werden vollständig angezeigt."
    ]
  },
  {
    "version": "1.25",
    "date": "01.07.2026",
    "changes": [
      "Admin-Status wird jetzt zuverlässiger erkannt: Die Rolle wird beim Zurückkehren ins Hauptmenü frisch aus der Cloud geladen und lokal gespeichert, sodass ein neu vergebener Admin-Status sofort (statt verzögert) angezeigt wird."
    ]
  },
  {
    "version": "1.24",
    "date": "01.07.2026",
    "changes": [
      "Eine neue Bestzeit gibt jetzt doppelte Münzen. Dieser Bonus stapelt mit dem Coop-/Wettkampf-Bonus und dem Bonus für einen makellosen Sieg (bis zu ×8); der aktive Gesamt-Multiplikator wird auf dem Sieg-Screen angezeigt."
    ]
  },
  {
    "version": "1.23",
    "date": "01.07.2026",
    "changes": [
      "Schwierigkeitsauswahl: die Münz-Belohnung sitzt jetzt in einer eigenen Zeile über dem Namen und überdeckt den Schwierigkeitsnamen nicht mehr (auch bei langen Namen/großen Beträgen)."
    ]
  },
  {
    "version": "1.22",
    "date": "01.07.2026",
    "changes": [
      "Spielanleitung wandert vom Hauptmenü in die Einstellungen unter „Spiel\" (das Fragezeichen-Icon oben rechts entfällt, die Streak-Flamme wird nicht mehr verdeckt).",
      "Der Einstellungen-Tab „Spiel\" wurde verschlankt: Fehler werden jetzt immer sofort angezeigt, Leben und Timer sind immer aktiv – die Schalter „Fehleraufdeckung\", „Leben\" und „Timer anzeigen\" entfallen."
    ]
  },
  {
    "version": "1.21",
    "date": "01.07.2026",
    "changes": [
      "Aufräumung: ungenutzte Texte des früheren Update-Dialogs aus allen Sprachdateien entfernt (keine sichtbare Änderung)."
    ]
  },
  {
    "version": "1.20",
    "date": "01.07.2026",
    "changes": [
      "Update-Ablauf vereinfacht: Der „Update – Backup/Neustart\"-Dialog und die ständige Update-Prüfung im Hintergrund entfallen. Neue Versionen werden nur noch beim nächsten Start der App geladen; was neu ist, zeigt weiterhin der „Was ist neu\"-Dialog."
    ]
  },
  {
    "version": "1.19",
    "date": "01.07.2026",
    "changes": [
      "Neue Freunde-Funktion: -Icon im Hauptmenü öffnet eine Freundesliste mit Live-Status (online/offline/im Spiel inkl. Modus, Schwierigkeit, Größe und Fortschrittsbalken); Freunde per Benutzername hinzufügen, Anfragen annehmen/ablehnen. Zweiter Tab „Bestenlisten\" folgt."
    ]
  },
  {
    "version": "1.18",
    "date": "01.07.2026",
    "changes": [
      "Coop/Race/Team: neben dem Anzeigenamen wird jetzt auch der eindeutige Account-Username angezeigt („Anzeigename (username)\") – in Lobby, Roster, Auswertung und Meldungen"
    ]
  },
  {
    "version": "1.17",
    "date": "01.07.2026",
    "changes": [
      "Benutzername ändern: die Verfügbarkeit wird jetzt live beim Tippen geprüft (frei/vergeben farbig markiert) und Speichern ist gesperrt, solange der Name bereits vergeben oder ungültig ist"
    ]
  },
  {
    "version": "1.16",
    "date": "01.07.2026",
    "changes": [
      "Admin: neuer User-Browser im Konto-Tab — alle Nutzer auflisten, per Suche filtern und je Nutzer ein Bearbeiten-Fenster für Rolle, Anzeigename/Username, Guthaben, Skin u. a."
    ]
  },
  {
    "version": "1.15",
    "date": "01.07.2026",
    "changes": [
      "Schwierigkeitsauswahl: die Münz-Belohnung überdeckt nicht mehr den Namen der Schwierigkeit",
      "Admin-Kennzeichen aus dem Hauptmenü entfernt (überdeckte Icons); der Admin-Status steht jetzt nur in den Einstellungen unter Konto ()"
    ]
  },
  {
    "version": "1.14",
    "date": "01.07.2026",
    "changes": [
      "Diagnose verbessert: die App protokolliert jetzt dauerhaft Lebenszyklus-Ereignisse (Hintergrund/Einfrieren/Neustart, letzter Zustand vor einem Absturz), damit seltene Spielabbrüche über das Diagnoseprotokoll nachvollziehbar sind",
      "App-Update-Prüfung läuft nicht mehr während eines laufenden Spiels (verhindert, dass iOS die PWA beim Service-Worker-Wechsel mitten im Spiel neu lädt) und seltener (alle 2 Min statt 30 Sek)"
    ]
  },
  {
    "version": "1.13",
    "date": "01.07.2026",
    "changes": [
      "Einstellungen-Seitenleiste: oberer Rand berücksichtigt jetzt die Dynamic Island/Notch — der Titel wird nicht mehr verdeckt",
      "Einstellungen: Zurück-Button ist jetzt oben links, das Menü oben rechts (Seitenleiste schiebt von rechts rein)",
      "Coins nur noch in der Shop-Übersicht sichtbar (nicht mehr im Hauptmenü); Coin-Symbol gewechselt (war einem Mond zu ähnlich)",
      "Benutzername ist jetzt in den Einstellungen unter „Konto\" änderbar (mit Eindeutigkeitsprüfung); der freie Anzeigename bleibt davon getrennt",
      "Admin erweitert: In-Game-Abzeichen „ Administrator\", jeden Nutzer umfassend bearbeiten (Username, Rolle, Guthaben, Inventar, beliebige Profilfelder) und Passwort-Reset-Mail auslösen"
    ]
  },
  {
    "version": "1.12",
    "date": "01.07.2026",
    "changes": [
      "Endlos-Neulade-Schleife behoben: fehlerhafter Cloud-Abgleich lud die App nicht mehr wiederholt neu (Splash→Menü); zusätzlich harte Schleifen-Bremse, die wiederholtes Neuladen stoppt"
    ]
  },
  {
    "version": "1.11",
    "date": "01.07.2026",
    "changes": [
      "Cage-Summen wieder überall gut lesbar: Schriftfarbe der Summe passt sich der Cage-Farbe an (dunkel auf hellen, weiß auf dunklen Cages) und das Summenfeld hebt sich klar vom Cage-Hintergrund ab",
      "Coop-Verbindung stabiler: Während eines Spiels bleibt der Bildschirm aktiv (Wake Lock), damit das Gerät nicht in den Standby geht und die Verbindung gar nicht erst abreißt"
    ]
  },
  {
    "version": "1.10",
    "date": "01.07.2026",
    "changes": [
      "Nie mehr mitten im Spiel herausgeworfen: App-Updates und Cloud-Übernahmen laden die Seite nicht mehr während einer laufenden Runde neu, sondern erst zurück im Menü (stiller Hintergrund-Sync bleibt)"
    ]
  },
  {
    "version": "1.9",
    "date": "01.07.2026",
    "changes": [
      "Einstellungen neu strukturiert: ausklappbare Seitenleiste (von links, Hamburger oben links) statt Tabs, thematisch sortierte Bereiche (Spiel · Darstellung · Farbe & Anpassung · Ton · Konto · Daten & Sicherung)"
    ]
  },
  {
    "version": "1.8",
    "date": "01.07.2026",
    "changes": [
      "Coop: verlorene eigene Verbindung wird jetzt auch beim Client erkannt und als „offline\" angezeigt (vorher sah das nur der Host); automatische Wiederverbindung bei Rückkehr"
    ]
  },
  {
    "version": "1.7",
    "date": "01.07.2026",
    "changes": [
      "Cage-Farben komplett überarbeitet: alle 18 Cage-Farben klar unterscheidbar (auch die zuvor zu ähnlichen Grüntöne), optimiert für Hell- und Dunkelmodus"
    ]
  },
  {
    "version": "1.6",
    "date": "01.07.2026",
    "changes": [
      "Lokales Auto-Backup entfernt (die Cloud-Sicherung ersetzt es für Konten); Backup exportieren/importieren bleibt als manuelle Sicherung erhalten."
    ]
  },
  {
    "version": "1.5",
    "date": "01.07.2026",
    "changes": [
      "Cloud-Sync sicher gegen Datenverlust: lokale Daten werden NIE stillschweigend überschrieben. Bei Erstanmeldung ohne Cloud-Daten werden die lokalen Daten hochgeladen; unterscheiden sich lokale und Cloud-Daten, fragt beim Start eine „Versions-Mismatch\"-Warnung mit Zeitstempeln, welcher Stand behalten werden soll."
    ]
  },
  {
    "version": "1.4",
    "date": "01.07.2026",
    "changes": [
      "Anmeldung bleibt jetzt nach dem Neustart erhalten: Nach dem Login wurde die Account-Sitzung beim App-Neustart versehentlich durch eine anonyme Sitzung überschrieben – dadurch musste man sich erneut anmelden. Behoben."
    ]
  },
  {
    "version": "1.3",
    "date": "01.07.2026",
    "changes": [
      "Konto-Anzeige korrigiert: Nach dem Anmelden ist jetzt sichtbar, dass du eingeloggt bist (Benutzername/E-Mail/Rolle) statt weiter das Login-Formular",
      "Cloud-Sicherung sichtbar gemacht: Konto-Karte zeigt „Gesichert um …\" bzw. „Synchronisiere …\" + „Jetzt sichern\"-Knopf",
      "Automatische Cloud-Sicherung ALLER Daten: beim Start, nach jedem Spiel, beim Schließen/Wegwischen und alle 60 Sekunden während die App offen ist"
    ]
  },
  {
    "version": "1.2",
    "date": "01.07.2026",
    "changes": [
      "Skin-Drehgeschwindigkeit korrigiert: der Regler wirkt jetzt richtig herum (weiter rechts = schneller statt langsamer)"
    ]
  },
  {
    "version": "1.1",
    "date": "01.07.2026",
    "changes": [
      "Skin ist ab 1.0 ein Geschenk für alle (zur Feier des Tages) — standardmäßig aus, in den Einstellungen aktivierbar; wer den Sprung auf 1.0 miterlebt hat, bekommt zusätzlich einen bleibenden „Founder\"-Marker",
      "Münzen pro gewonnenem Spiel (abhängig von der Schwierigkeit, perfekt = doppelt) — sichtbar auf dem Sieg-Screen und in der Statistik"
    ]
  },
  {
    "version": "1.0",
    "date": "30.06.2026",
    "changes": [
      "Daten-Fundament für kommende Accounts & Skins: Inventar, Guthaben und Profil werden nun in Backups und im Export/Import mitgesichert",
      "Optionale Konten: Mit E-Mail + Benutzername + Passwort anmelden und Einstellungen, Statistik und Freischaltungen geräteübergreifend in der Cloud sichern (Einstellungen ▸ Konto). Ohne Konto bleibt wie bisher alles lokal.",
      "Admin-Bereich (nur für Administratoren): Spieler per Benutzername finden, Geschenke (z. B. Skins) und Rollen vergeben.",
      "Zur Feier von 1.0: freischaltbarer „Dynamischer Skin\" — deine persönliche Farbe wird zu einer sich drehenden, leuchtenden Einkreisung/Umrandung. Automatisch beim Sprung auf 1.0 oder per Code freigeschaltet, voll anpassbar (Stil, Farben, Tempo, Leuchten, Dicke) in den Einstellungen."
    ]
  },
  {
    "version": "0.166",
    "date": "30.06.2026",
    "changes": [
      "Bestzeiten jetzt auch in der Coop-Auswahl sichtbar (Coop-Zeiten); im Wettkampf werden die Solo-Bestzeiten angezeigt – Karten wie im Solo-Setup, alles passt ohne Scrollen auf einen Bildschirm"
    ]
  },
  {
    "version": "0.165",
    "date": "29.06.2026",
    "changes": [
      "Diagnoseprotokoll: Worker-Status + synchrone Generierung erfasst (zeigt Geräte, auf denen Rätsel den Haupt-Thread blockieren)"
    ]
  },
  {
    "version": "0.164",
    "date": "29.06.2026",
    "changes": [
      "Coop-Zahlencode kleiner/kompakter dargestellt (Eingabe und angezeigter Code)"
    ]
  },
  {
    "version": "0.163",
    "date": "29.06.2026",
    "changes": [
      "Coop-/Wettkampf-Schwierigkeitsauswahl passt wieder komplett auf einen Screen – „Hosten“ und „Zurück“ sind immer sichtbar (kompakte Levelkarten in der Host-Auswahl)"
    ]
  },
  {
    "version": "0.162",
    "date": "29.06.2026",
    "changes": [
      "Diagnoseprotokoll erweitert: erfasst jetzt unbehandelte Fehler, einen Geräte-/Umgebungs-Schnappschuss beim Start und Hänger (Jank) – hilft, Performance-Probleme auf einzelnen Geräten zu finden"
    ]
  },
  {
    "version": "0.161",
    "date": "29.06.2026",
    "changes": [
      "Schnellerer App-Start: Rätsel werden erst beim Spielstart erzeugt (kein Vorab-Generieren aller Schwierigkeiten mehr) – das bremste manche Geräte beim Start aus"
    ]
  },
  {
    "version": "0.160",
    "date": "29.06.2026",
    "changes": [
      "Levelauswahl: einheitlich gestapelte Karten (Name, Feldgröße, Zeiten) – alle gleich hoch, nichts mehr versetzt"
    ]
  },
  {
    "version": "0.159",
    "date": "29.06.2026",
    "changes": [
      "Levelauswahl scrollt nie mehr + Namen immer komplett sichtbar",
      "Einstellungen: Trennlinie direkt unter den Reitern entfernt"
    ]
  },
  {
    "version": "0.158",
    "date": "29.06.2026",
    "changes": [
      "Einstellungen in Reiter aufgeteilt (Allgemein/Spiel/Ton/Daten)",
      "Levelauswahl kompakter und strukturiert: alle Schwierigkeitsgrade auf einen Screen, je Level Ø-Zeit und Bestzeit als ausgerichtete Chips (nur der jeweilige Modus)"
    ]
  },
  {
    "version": "0.157",
    "date": "29.06.2026",
    "changes": [
      "Coop & Wettkampf: Rätsel werden jetzt im Hintergrund erstellt (kein Einfrieren bei großen Feldern); die „Bereit?\"-Lobby zeigt währenddessen einen Ladebalken und startet erst, wenn bei allen das Rätsel fertig ist"
    ]
  },
  {
    "version": "0.156",
    "date": "29.06.2026",
    "changes": [
      "„Was ist neu\"-Dialog zeigt jetzt alle seit dem letzten Besuch verpassten Versionen (neueste oben, scrollbar)"
    ]
  },
  {
    "version": "0.155",
    "date": "29.06.2026",
    "changes": [
      "Statistik überarbeitet: drei Reiter „Allgemein\", „Solo\" und „Coop\". Der neue Allgemein-Reiter zeigt einen Überblick (Spiele, Siege & Quote, Spielzeit, perfekte Siege, Tages-Streak, Lieblingslevel, Erfolge)"
    ]
  },
  {
    "version": "0.154",
    "date": "29.06.2026",
    "changes": [
      "Schwierigkeiten angepasst: 12×12 = „Dikka was\", 13×13 = „Bismillah\", neu 14×14 = „R.I.P.\" (die Stufe „Çüş\" entfällt)"
    ]
  },
  {
    "version": "0.153",
    "date": "29.06.2026",
    "changes": [
      "Neue Schwierigkeit „Çüş\" (12×12) – schließt die Lücke zwischen Mashallah (11×11) und Dikka was (13×13), schnell generierbar und weiterhin ohne Raten lösbar"
    ]
  },
  {
    "version": "0.152",
    "date": "29.06.2026",
    "changes": [
      "Neue Schwierigkeit „Bismillah\" (14×14) – das bislang größte Feld, weiterhin garantiert ohne Raten lösbar (dank Vorgenerierung im Hintergrund startet es trotz aufwändiger Generierung normalerweise sofort)",
      "Vorgenerierung priorisiert jetzt große Felder, damit sie früher bereitliegen"
    ]
  },
  {
    "version": "0.151",
    "date": "29.06.2026",
    "changes": [
      "Neue Schwierigkeit „Dikka was\" (13×13) – größere Felder, längeres Knobeln, weiterhin garantiert ohne Raten lösbar",
      "Rätsel werden jetzt im Hintergrund vorgeneriert – der Spielstart ist dadurch sofort, ohne spürbare Wartezeit oder kurzes Aufblitzen",
      "Generierung großer Felder deutlich beschleunigt",
      "Mehr Cage-Farben für klarere Unterscheidbarkeit, besonders auf großen Feldern",
      "Schönerer Ladebildschirm (falls doch mal generiert werden muss) mit animiertem Fortschrittsbalken"
    ]
  },
  {
    "version": "0.150",
    "date": "29.06.2026",
    "changes": [
      "Undo-Button hat jetzt einen eigenen Sound (dezenter Klick mit tiefem Thump), abschaltbar in den Einstellungen",
      "Zoom-Zurücksetzen-Button erscheint nun links neben +/-, damit sich die Zoom-Buttons beim Einblenden nicht mehr verschieben"
    ]
  },
  {
    "version": "0.149",
    "date": "29.06.2026",
    "changes": [
      "Renn-Modus: Prozentleisten setzen beim Rematch wieder korrekt auf 0 zurück (statt den Stand des vorigen Spiels zu zeigen)",
      "Zoom: neuer Zurücksetzen-Button (↺) oben rechts im Spiel, der den Zoom auf den Standard bringt – erscheint nur, wenn gezoomt wurde"
    ]
  },
  {
    "version": "0.148",
    "date": "29.06.2026",
    "changes": [
      "Streak-Feier-Screen ergänzt: nach dem ersten Spiel des Tages erscheint ein Feuer-Hinweis mit aktueller Streak, Bestmarke und Lob bei neuer Höchstmarke; der Streak-verloren-Hinweis wurde freundlicher gestaltet"
    ]
  },
  {
    "version": "0.147",
    "date": "29.06.2026",
    "changes": [
      "iOS: Ton folgt nicht mehr dem Stummschalter – Musik und Effekte spielen jetzt zuverlässig (steuerbar über die In-App-Schalter und die Lautstärke)"
    ]
  },
  {
    "version": "0.146",
    "date": "28.06.2026",
    "changes": [
      "Zurück-Navigation als Stack: führt jetzt überall Schritt für Schritt zur vorherigen Ansicht statt direkt zum Hauptmenü (z.B. in der Coop-Lobby Name → Hosten → Warten)"
    ]
  },
  {
    "version": "0.145",
    "date": "28.06.2026",
    "changes": [
      "Aufgeben-Funktion komplett entfernt (Button, Aufgabe-Bildschirm und Aufgegeben-Statistik) – nicht mehr benötigt"
    ]
  },
  {
    "version": "0.144",
    "date": "28.06.2026",
    "changes": [
      "Neue Sounds beim Gewinnen (befriedigende Fanfare) und Verlieren (sanfter Moll-Fall) – je einzeln in den Einstellungen schaltbar"
    ]
  },
  {
    "version": "0.143",
    "date": "28.06.2026",
    "changes": [
      "Aufgeräumte Spielleiste: oben nur noch Pause; Aufgeben, Einstellungen und Anleitung sind ins Pausenmenü gewandert",
      "Einstellungen im Spiel öffnen pausiert jetzt korrekt für alle (gleiche Mechanik wie der Pause-Knopf), auch im Coop"
    ]
  },
  {
    "version": "0.142",
    "date": "28.06.2026",
    "changes": [
      "Coop-Hinweise gefixt: gemeinsames Hinweisfeld für alle Spieler, Stufen 1–3 laufen pro Spieler einzeln, kein sofortiges Auflösen mehr und keine Überhänge aus alten Runden"
    ]
  },
  {
    "version": "0.141",
    "date": "28.06.2026",
    "changes": [
      "Neuer Sound beim Umschalten zwischen Einkreis- und Lösch-Modus (einzeln in den Einstellungen schaltbar)"
    ]
  },
  {
    "version": "0.140",
    "date": "28.06.2026",
    "changes": [
      "Einstellungen jetzt von überall per Zahnrad erreichbar (auch im Spiel) – beim Öffnen im Spiel wird automatisch pausiert (Solo und Coop)",
      "Fehler behoben: Beim Auflösen einer Cage/Reihe/Spalte leuchtet der Rand jetzt auch bei per Hinweis gelöschten Feldern korrekt auf"
    ]
  },
  {
    "version": "0.139",
    "date": "28.06.2026",
    "changes": [
      "Grundpegel der Hintergrundmusik wieder halbiert (Aktions-Sounds bleiben unverändert laut)",
      "Lautstärke-Regler feiner einstellbar (1%-Schritte statt grober Stufen)"
    ]
  },
  {
    "version": "0.138",
    "date": "28.06.2026",
    "changes": [
      "Neue Aktions-Sounds: Vervollständigung (Käfig/Reihe/Spalte) mit Stufung bei mehreren gleichzeitig, Einkreisen, Löschen, Fehler und Hinweis – warm und zen-artig synthetisiert",
      "Aktions-Sounds einzeln pro Aktion in den Einstellungen schaltbar (Vorhören beim Einschalten)"
    ]
  },
  {
    "version": "0.137",
    "date": "28.06.2026",
    "changes": [
      "Hintergrundmusik deutlich abwechslungsreicher: viele neue Melodie-Phrasen, variables Tempo/Timing (gleiche Klangfarbe und Tonart, Leitmotiv bleibt als seltener Hook)"
    ]
  },
  {
    "version": "0.136",
    "date": "28.06.2026",
    "changes": [
      "Hauptmenü-Hintergrund ist jetzt schon ab dem ersten Frame randlos bis unten (vorher unten kurz abgeschnitten, bis man scrollte)"
    ]
  },
  {
    "version": "0.135",
    "date": "28.06.2026",
    "changes": [
      "Musik startet auf iPhone jetzt zuverlässig beim ersten Antippen (hängender Audio-Kontext wird in der Geste neu aufgebaut)",
      "Kurzer Ton beim Schließen/Wechseln in den Hintergrund weiter reduziert (Ausgang wird sofort hart vom Lautsprecher getrennt)"
    ]
  },
  {
    "version": "0.134",
    "date": "28.06.2026",
    "changes": [
      "Hauptmenü-Hintergrund reicht jetzt randlos bis über alle Kanten, auch unten (kein Beschnitt mehr)",
      "Hintergrundmusik versucht direkt beim Öffnen der App zu starten (bzw. spätestens beim ersten Antippen)"
    ]
  },
  {
    "version": "0.133",
    "date": "28.06.2026",
    "changes": [
      "Hintergrundbild im Hauptmenü wieder auf den passenden Zoom gesetzt (randlos über alle Kanten)",
      "Musik startet jetzt sofort beim Spielstart (AudioContext wird nur noch innerhalb einer Nutzergeste erzeugt)"
    ]
  },
  {
    "version": "0.132",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund-Zoom feinjustiert, sodass das Gitter auch unten zuverlässig über den Rand (unter den Home-Indicator) ragt, ohne zu viel abzuschneiden"
    ]
  },
  {
    "version": "0.131",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund etwas weniger gezoomt – das Gitter ragt jetzt nur noch knapp über die Bildschirmränder (weniger abgeschnitten)"
    ]
  },
  {
    "version": "0.130",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund wieder uniform gezoomt (statt gestreckt) und so über alle Bildschirmkanten gezogen, dass kein Bildrand mehr sichtbar ist – auch unter dem Home-Indicator des iPhones",
      "Musik: schriller Ton beim App-Wechsel in den Hintergrund behoben – die Tonausgabe wird beim Verlassen vollständig beendet und beim Zurückkehren neu aufgebaut"
    ]
  },
  {
    "version": "0.129",
    "date": "27.06.2026",
    "changes": [
      "Einstellungen: Lautstärke-Regler deutlich kräftiger/dicker – mit gefülltem Pegelbalken und größerem, besser greifbarem Knopf"
    ]
  },
  {
    "version": "0.128",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund-Gitter wird gestreckt und ragt jetzt auch unten klar über den Bildschirmrand (bis unter den Home-Indicator), nicht nur oben",
      "Musik: schriller „Arcade\"-Ton beim App-Wechsel in den Hintergrund behoben (weiche WaveShaper-Sättigung statt Kompressor, kein Noten-Scheduling mehr im Hintergrund)"
    ]
  },
  {
    "version": "0.127",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund-Gitter ragt jetzt auf allen vier Seiten über die Kante (auch unten) – echtes randloses Infinity",
      "Startseite: Hintergrund ist beim Zurücknavigieren sofort/statisch da, kein sichtbares Live-Reinzoomen mehr",
      "Musik: weitere Härtung gegen den kurzen Ton beim App-Wechsel in den Hintergrund (pagehide + sofortige Stummschaltung)"
    ]
  },
  {
    "version": "0.126",
    "date": "27.06.2026",
    "changes": [
      "Einstellungen: Bereiche (Darstellung, Spielhilfe, Ton …) sind jetzt klar mit Trennlinie und kräftiger Überschrift abgegrenzt – übersichtlichere Struktur",
      "Musik: kein schriller kurzer Ton mehr beim Wechsel in den Hintergrund (Audio wird sauber pausiert und beim Zurückkehren sanft fortgesetzt)"
    ]
  },
  {
    "version": "0.125",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund füllt jetzt wirklich den gesamten Bildschirm randlos – auch auf iPhones mit Notch/Safe-Area (vorher blieben außen Streifen ohne Gitter)",
      "Musik: deutlich höherer Grundpegel (rund 2–3× lauter) und wärmerer, weniger schriller Klang (ruhiger, japanisch-zen, hölzern)"
    ]
  },
  {
    "version": "0.124",
    "date": "27.06.2026",
    "changes": [
      "Hintergrundmusik: ruhige, prozedural erzeugte Zen-Musik mit eigener Wiedererkennungs-Melodie – in den Einstellungen unter „Ton\" pro Bereich schaltbar (Menüs + je Spielmodus, Default an) inkl. Lautstärke; alle an = läuft durchgehend in der ganzen App"
    ]
  },
  {
    "version": "0.123",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Hintergrund-Gitter füllt jetzt den ganzen Bildschirm und läuft über alle Ränder (Infinity-Look) statt rechteckigem Ausschnitt"
    ]
  },
  {
    "version": "0.122",
    "date": "27.06.2026",
    "changes": [
      "Startseite: Das App-Icon (Zahlengitter) bildet jetzt dezent und scharf den Hintergrund; das Logo oben bleibt, etwas größer"
    ]
  },
  {
    "version": "0.121",
    "date": "26.06.2026",
    "changes": [
      "Hinweis: Nach dem Lösen einer Zelle beginnt der nächste Hinweis wieder bei Stufe 1 (kein versehentliches Sofort-Auflösen durch einen veralteten Hinweis)"
    ]
  },
  {
    "version": "0.120",
    "date": "26.06.2026",
    "changes": [
      "Hinweis: Schon die erste Stufe (Bereich markieren) entwertet jetzt die Bestzeit – die Warnung kommt entsprechend bereits vor Stufe 1"
    ]
  },
  {
    "version": "0.119",
    "date": "26.06.2026",
    "changes": [
      "Hinweis ist jetzt dreistufig: erst nur den relevanten Bereich markieren, dann die Leitfrage einblenden, dann auflösen — und das Hinweis-Banner lässt sich per wegklicken"
    ]
  },
  {
    "version": "0.118",
    "date": "26.06.2026",
    "changes": [
      "Hinweis überarbeitet: Der erste Tipp highlightet jetzt die passende Zeile/Spalte/Gruppe und stellt eine Leitfrage, statt die Lösung sofort zu verraten – erst „Auflösen\" deckt die Zelle auf"
    ]
  },
  {
    "version": "0.117",
    "date": "26.06.2026",
    "changes": [
      "Coop: Verbleibender Spieler übernimmt Host-Rolle automatisch, auch wenn er zunächst alleine im Raum ist",
      "Coop: Ursprünglicher Host kann nach „Zum Menü\" wieder beitreten — tritt als Gast bei, wenn inzwischen ein anderer Host ernannt wurde",
      "Coop: Alle Spieler sehen eine Benachrichtigung, wer die neue Host-Rolle übernommen hat",
      "Startseite: Alle Inhalte passen ohne Scrollen auf den Bildschirm, kompakteres Layout"
    ]
  },
  {
    "version": "0.116",
    "date": "26.06.2026",
    "changes": [
      "Text lässt sich in der App nicht mehr markieren oder kopieren",
      "Alle 30 Sekunden wird automatisch nach einer neuen Version gesucht — der Update-Dialog erscheint danach außerhalb eines laufenden Spiels",
      "App pausiert automatisch wenn man den Tab wechselt oder die App in den Hintergrund schiebt",
      "Timer-Icon erscheint jetzt zentriert über der Spielzeit",
      "Coop: Pause-Screen erscheint beim Host nicht mehr vor dem Lobby-Bereit-Screen",
      "Coop: Über „Zum Menü\" verlassen behält das Spiel als Fortsetzen-Option im Hauptmenü, solange der Raum noch offen ist"
    ]
  },
  {
    "version": "0.115",
    "date": "26.06.2026",
    "changes": [
      "Lobby bleibt beim Wechsel in den Hintergrund (Bildschirm sperren, App-Wechsel) bis zu 5 Minuten erhalten und verbindet sich beim Zurückkehren automatisch wieder",
      "Solo- und Coop-Spielstände werden jetzt getrennt gespeichert -- ein laufendes Coop-Spiel überschreibt kein pausiertes Solo-Spiel mehr (und umgekehrt)",
      "Neuer \"Coop fortsetzen\"-Button auf dem Startbildschirm, getrennt vom Solo-Fortsetzen-Button -- bei beiden gleichzeitig erscheinen sie nebeneinander"
    ]
  },
  {
    "version": "0.114",
    "date": "26.06.2026",
    "changes": [
      "Bereit-Status in der Mehrspieler-Lobby kann jetzt zurückgenommen werden, falls man sich versehentlich bereit gemeldet hat."
    ]
  },
  {
    "version": "0.113",
    "date": "26.06.2026",
    "changes": [
      "Achievements-Button steht jetzt ganz oben im Statistik-Screen statt unten"
    ]
  },
  {
    "version": "0.112",
    "date": "26.06.2026",
    "changes": [
      "Wettkampf: Fortschrittsbalken stehen wieder direkt untereinander, Gegner-Fehleranzahl wird jetzt als Herzen statt als Text angezeigt"
    ]
  },
  {
    "version": "0.111",
    "date": "26.06.2026",
    "changes": [
      "Mindestabstand zwischen Logo und Kopfzeilen-Icons im Hauptmenü erzwungen, damit das Menü bei aktivem Spiel (\"Fortsetzen\"-Button) nicht mehr nach oben in die Icons/Streak-Flamme rutscht"
    ]
  },
  {
    "version": "0.110",
    "date": "26.06.2026",
    "changes": [
      "Cages bei Schwer/Extrem/Mashallah wachsen jetzt kompakter und seltener lang gestreckt horizontal"
    ]
  },
  {
    "version": "0.109",
    "date": "26.06.2026",
    "changes": [
      "Eigene Farbe gilt jetzt überall, nicht mehr nur im Coop-Modus — eigene Markierungen werden auch solo, im Trainings-, Tages-, Boss- und Wettkampf-Modus in der gewählten Farbe hervorgehoben."
    ]
  },
  {
    "version": "0.108",
    "date": "25.06.2026",
    "changes": [
      "Hinweise sind jetzt auch im 2v2-Team-Modus deaktiviert (vorher nur im 1v1-Wettkampf)"
    ]
  },
  {
    "version": "0.107",
    "date": "25.06.2026",
    "changes": [
      "Fehler im Wettkampf-/Team-Modus werden dem Gegner jetzt sofort gemeldet, statt erst beim nächsten korrekten Zug",
      "2v2-Lobby: Teams werden jetzt über eine Pfeil-Tabelle (Team A | Spieler | Team B) zugewiesen statt durch Antippen"
    ]
  },
  {
    "version": "0.106",
    "date": "25.06.2026",
    "changes": [
      "Neuer \"Zufall\"-Button in der 2-gegen-2-Lobby: teilt alle Spieler per Klick zufällig in Team A und Team B auf (statt jeden einzeln per Tippen zuzuweisen)."
    ]
  },
  {
    "version": "0.105",
    "date": "25.06.2026",
    "changes": [
      "Wettkampf-Fortschrittsbalken (1 gegen 1 / 2 gegen 2) richten sich wieder exakt an derselben Stelle aus -- die Fehleranzahl des Gegners steht jetzt in Namensgröße unterhalb seines Namens statt den Prozent-Balken zu verschieben."
    ]
  },
  {
    "version": "0.104",
    "date": "25.06.2026",
    "changes": [
      "Bugfix: Im Team-vs-Team-Modus startete das Spiel beim Klick auf \"Starten\" nur für das eigene Team -- das gegnerische Team blieb in der Lobby haengen, da das Startsignal faelschlich ueber den team-internen Kanal statt raumweit verschickt wurde."
    ]
  },
  {
    "version": "0.103",
    "date": "25.06.2026",
    "changes": [
      "Wettkampf-Lobby-Layout-Bug behoben: Wartebildschirm beim Hosten passt wieder auf eine Seite, ohne Zoom/Scrollen",
      "Wettkampf: Fehleranzahl des Gegners bzw. gegnerischen Teams wird jetzt live während des Spiels angezeigt",
      "Mehrspieler-Bereit-System: Mitspieler müssen erst \"Bereit\" drücken, bevor der Host das Spiel final starten kann"
    ]
  },
  {
    "version": "0.102",
    "date": "25.06.2026",
    "changes": [
      "Querformat-Fix: oberer Sicherheitsabstand ergänzt, damit Icons in der Kopfzeile nicht mehr direkt am oberen Bildschirmrand kleben"
    ]
  },
  {
    "version": "0.101",
    "date": "25.06.2026",
    "changes": [
      "App-Icon korrigiert: das ursprünglich bereitgestellte Icon-Design wird jetzt unverändert verwendet (statt einer fehlerhaften Nachbau-Version)"
    ]
  },
  {
    "version": "0.100",
    "date": "25.06.2026",
    "changes": [
      "Neues App-Icon: detailgetreuer Mini-Ausschnitt des Spielfelds mit zweizeiligen Summenanzeigen, grünen/violetten Cage-Farben und blauem \"Behalten\"-Ring"
    ]
  },
  {
    "version": "0.99",
    "date": "25.06.2026",
    "changes": [
      "\"Neues Spiel\" führt jetzt in jedem Modus zur Schwierigkeitsauswahl statt direkt erneut in dieselbe Schwierigkeit zu starten"
    ]
  },
  {
    "version": "0.98",
    "date": "24.06.2026",
    "changes": [
      "Wettkampf-Modus einheitlich benannt: \"Duell\"/\"Rennen\"/\"Race\" in allen 10 Sprachen durch einen konsistenten Begriff ersetzt",
      "Sieg/Niederlage-Bildschirm nennt sofort den Grund (z.B. Gegner ohne Leben) statt ihn unter Statistiken zu verstecken",
      "Gegnername statt \"dein Gegner\" im 1v1- und 2v2-Ergebnis, inkl. Leben-Verlust pro Spieler im Team-Modus",
      "Prozentanzeigen im Ergebnis-Bildschirm zeigen jetzt eindeutig, welcher Wert zu welchem Spieler/Team gehört",
      "Niederlage-Titel im Wettkampf/Team-Modus klingt nicht mehr versehentlich nach Sieg",
      "Nicht mehr benötigte Buttons \"Spielfeld ansehen\" und \"Lösung anzeigen\" entfernt"
    ]
  },
  {
    "version": "0.97",
    "date": "24.06.2026",
    "changes": [
      "\"Nochmal versuchen\" entfernt: nach Niederlage/Aufgeben startet jetzt immer ein neues Rätsel statt das identische zu wiederholen",
      "10×10/11×11-Rätsel sind jetzt garantiert ohne Raten lösbar (reine Logik, kein Hypothesen-Schritt nötig)",
      "Coop-Bug behoben: doppelt zählende Fehler/Leben und falsche \"hat die Lobby verlassen\"-Namen nach Lobby-Verlassen-und-Wiederbeitreten",
      "Trainingsmodus zeigt nicht mehr fälschlich ein \"Coop offline\"-Abzeichen an"
    ]
  },
  {
    "version": "0.96",
    "date": "24.06.2026",
    "changes": [
      "Race- und Team-Modus: Der Ergebnis-Screen zeigte beim Sieg immer \"Gelöst!\", auch wenn man nur gewann, weil der Gegner/das andere Team alle Leben verloren oder aufgegeben hat -- jetzt zeigt der Titel passend \"Sieg!\" und der Text erklärt den tatsächlichen Ausgang (Sieg durch Leben-Verlust/Aufgabe der Gegenseite bzw. eigene Niederlage durch Leben-Verlust/Aufgabe)."
    ]
  },
  {
    "version": "0.95",
    "date": "24.06.2026",
    "changes": [
      "Querformat: seitliches Safe-Area-Padding ergänzt, damit Buttons nicht mehr von Dynamic Island/Notch/abgerundeten Ecken verdeckt werden"
    ]
  },
  {
    "version": "0.94",
    "date": "24.06.2026",
    "changes": [
      "Datenschutzerklärung um Hinweis zum Ko-fi-Spendenlink ergänzt"
    ]
  },
  {
    "version": "0.93",
    "date": "24.06.2026",
    "changes": [
      "Echten Ko-fi-Spendenlink hinterlegt"
    ]
  },
  {
    "version": "0.92",
    "date": "24.06.2026",
    "changes": [
      "Unterstützer-Button in der Startbildschirm-Kopfzeile (oben links)"
    ]
  },
  {
    "version": "0.91",
    "date": "24.06.2026",
    "changes": [
      "Hauptmenü: Der Solo-Modus-Button zeigte als Untertext eine Anweisung (\"Schwierigkeit wählen\") statt einer Beschreibung wie bei Coop/Race -- heißt jetzt passend \"Allein lösen\" (in allen 10 Sprachen angepasst)."
    ]
  },
  {
    "version": "0.90",
    "date": "24.06.2026",
    "changes": [
      "Android-CI-Workflow repariert: GitHub Actions lehnte die Pipeline als ungültig ab, weil Secrets in einer if-Bedingung referenziert wurden (dort nicht erlaubt) -- der Check läuft jetzt im Build-Skript selbst."
    ]
  },
  {
    "version": "0.89",
    "date": "24.06.2026",
    "changes": [
      "Querformat-Optimierung erweitert: Statistik/Achievements/Verlauf nutzen jetzt ein dynamisches Mehrspalten-Layout statt einer einzelnen langen Liste, der Trainingsmodus-Erklärbanner war im Querformat unsichtbar (Grid-Layout-Fehler) und wurde behoben, und Popups/Overlays (Pause, Sieg, Niederlage, Aufgegeben, Coop-Lobby) bleiben jetzt auch bei wenig Höhe vollständig erreichbar und scrollbar."
    ]
  },
  {
    "version": "0.88",
    "date": "24.06.2026",
    "changes": [
      "Neu: Home-Screen, Spielauswahl und Coop-Lobby sind im Querformat jetzt ebenfalls komplett ohne Scrollen sichtbar (kompakteres Layout statt einfach nur kleinerer Schrift)"
    ]
  },
  {
    "version": "0.87",
    "date": "24.06.2026",
    "changes": [
      "Neu: Querformat-Layout für den Spiel-Screen — Spielfeld links, Steuerelemente rechts gestapelt, alles ohne Scrollen sichtbar",
      "Entfernt: erzwungene Hochformat-Sperre (war als Web-App ohnehin nicht zuverlässig durchsetzbar)"
    ]
  },
  {
    "version": "0.86",
    "date": "24.06.2026",
    "changes": [
      "Fix: Home- und andere Screens wabbelten beim Ziehen mit dem Finger, auch wenn es nichts zu scrollen gab"
    ]
  },
  {
    "version": "0.85",
    "date": "24.06.2026",
    "changes": [
      "Interne Aufräumarbeiten (keine sichtbaren Änderungen)"
    ]
  },
  {
    "version": "0.84",
    "date": "24.06.2026",
    "changes": [
      "Der farbige \"Cage gelöst\"-Lichteffekt leuchtet jetzt auch auf, wenn eine ganze Reihe oder Spalte fertig wird, nicht nur bei Cages.",
      "Das Konfetti am Spielende (vor allem bei einem perfekten Sieg) ruckelt am Anfang deutlich weniger."
    ]
  },
  {
    "version": "0.83",
    "date": "23.06.2026",
    "changes": [
      "Cage-Farben: deutlich kräftigere, stärker unterscheidbare Farbpalette – besonders die drei Grüntöne waren sich bisher zu ähnlich",
      "Bugfix: benachbarte Cages konnten in dicht gepackten Bereichen trotz \"Ähnlichkeits\"-Regel fast identische Farben bekommen, weil die Regel bei vollem Bann komplett aufgegeben wurde, statt nur schrittweise gelockert zu werden",
      "Cage-Hintergrundfarbe ist jetzt deutlich satter/kräftiger statt blass-transparent"
    ]
  },
  {
    "version": "0.82",
    "date": "23.06.2026",
    "changes": [
      "Abgestufte Sieg-Animation: makelloser Sieg (0 Fehler, 0 Hinweise) bekommt zusätzliches Konfetti, Glanz und ein Badge",
      "Cage-Resolve-Sweep: vollständig gelöste Cages leuchten jetzt in der eigenen Cage-Farbe statt nur dem allgemeinen Rand-Puls",
      "Tippflächen-Audit: Zoom-, Segment- und kleine Buttons erreichen jetzt die 44px-Mindestgröße",
      "Race-/Team-Spiele bekommen einen dezenten farbigen Akzent-Streifen am oberen Bildschirmrand",
      "database.rules.json: Schreibvalidierung für Team-vs-Team- und Race-Fortschrittsdaten ergänzt"
    ]
  },
  {
    "version": "0.81",
    "date": "23.06.2026",
    "changes": [
      "Race-Modus: Prozentanzeige des Gegners bleibt jetzt zuverlässig synchron, auch bei schnellen Zügen",
      "Race-Modus: nach einem Match direkt eine neue Runde mit Schwierigkeitsauswahl starten, statt den Raum verlassen zu müssen"
    ]
  },
  {
    "version": "0.80",
    "date": "23.06.2026",
    "changes": [
      "Bugfix: Cage-Farben konnten bei dichten Rätseln zweimal exakt identisch nebeneinander liegen (Cage-Grenzen unsichtbar)",
      "Bugfix: Im Race-Modus zogen Fehler keine Leben mehr ab — Herzen werden nun wie gewohnt verloren",
      "Bugfix: Pause im Race-Modus pausierte nur lokal — jetzt pausiert/synchronisiert sie beide Spieler"
    ]
  },
  {
    "version": "0.79",
    "date": "23.06.2026",
    "changes": [
      "Fehler behoben: Beim Abbrechen des Trainingsmodus blieb die Trainings-Schaltfläche (\"nächster Zug\"/\"super, geschafft!\") fälschlicherweise im nächsten Spiel sichtbar"
    ]
  },
  {
    "version": "0.78",
    "date": "23.06.2026",
    "changes": [
      "Farbenblind-Modus wirkt jetzt global im gesamten Spiel (richtig/falsch, Hinweise, Leben, Toasts, ...) statt nur auf die Coop-Spielerfarben"
    ]
  },
  {
    "version": "0.77",
    "date": "23.06.2026",
    "changes": [
      "Viel mehr Achievements zum Freischalten, inkl. Fortschrittsanzeige",
      "Tagesrätsel entfernt – die Streak lebt weiter und zählt jetzt jede gespielte Partie",
      "Neue Erinnerung beim App-Start, falls die Spiel-Streak gerissen ist",
      "Anleitung-Button ist jetzt ein eigenes Icon neben den Einstellungen",
      "Race-Statistiken (1v1 & 2v2) jetzt übersichtlich in der Statistik-Ansicht",
      "Statistik-Kacheln werden immer angezeigt, auch ohne Daten",
      "Solo-Modus-Button deutlicher vom Coop-Modus abgegrenzt",
      "Kleinere Bugfixes (doppeltes Icon beim Changelog-Button entfernt)"
    ]
  },
  {
    "version": "0.76",
    "date": "23.06.2026",
    "changes": [
      "Statistik-Karten zeigen jetzt Wortbeschriftungen statt nur Symbole, Solo- und Coop-Werte als eigene Karten",
      "Startbildschirm überarbeitet: Einstellungen wandern auf ein Zahnrad oben rechts, Trainingsmodus startet jetzt aus der Anleitung, Team-vs-Team ist Teil des Race-Modus (1v1/2v2-Auswahl), Changelog liegt jetzt in den Einstellungen",
      "Fix: Startbildschirm scrollt beim Öffnen immer ganz nach oben",
      "Fix: Race-Modus zeigt nach einer Niederlage die korrekte Prozentzahl und erklärt in Worten, dass der Gegner schneller war",
      "Fix: \"fehlerfrei\"-Texte im Race-Modus berücksichtigen jetzt die tatsächliche Fehleranzahl beider Spieler",
      "Fix: Fortschrittsbalken im Race-Modus beginnen und enden unabhängig vom Namen an derselben Position",
      "Fix: Verlassen-Meldungen in der Lobby nennen jetzt den Namen, genau wie Beitreten-Meldungen",
      "Fix: eigene Leben werden im Race-Modus wieder angezeigt"
    ]
  },
  {
    "version": "0.75",
    "date": "23.06.2026",
    "changes": [
      "Boss-Rätsel entfernt -- inkl. Streak, Achievements und Home-Button."
    ]
  },
  {
    "version": "0.74",
    "date": "22.06.2026",
    "changes": [
      "Coop-Tagesrätsel (\"Heute zusammen spielen\") entfernt -- unnötige Dopplung zum normalen Coop-Modus."
    ]
  },
  {
    "version": "0.73",
    "date": "22.06.2026",
    "changes": [
      "Eigener Fortschritt wird jetzt immer als Prozentzahl + Fortschrittsbalken angezeigt. Im 1v1-Rennmodus liegen der eigene und der gegnerische Balken direkt übereinander für den direkten Vergleich."
    ]
  },
  {
    "version": "0.72",
    "date": "22.06.2026",
    "changes": [
      "Profanitätsfilter für Coop-Namen entfernt: jeder Anzeigename ist erlaubt.",
      "Eigene Rätselgröße (Custom-Modus) wieder entfernt.",
      "Trainingsmodus: Erklär-Banner überdeckt das Spielfeld nicht mehr.",
      "Cage-Farben deutlich klarer unterscheidbar: auch über Eck benachbarte Cages erhalten verschiedene Farbtöne, kräftigerer Kontrast."
    ]
  },
  {
    "version": "0.71",
    "date": "22.06.2026",
    "changes": [
      "Race-/Team-Modus: Niederlage durch einen schnelleren Gegner zeigt jetzt das korrekte Wettkampf-Ergebnis statt der irreführenden \"Keine Leben mehr\"-Meldung",
      "Im Race-Modus (1vs1) gibt es jetzt konsequenterweise keine Hinweise mehr -- passend dazu, dass dort auch keine Leben angezeigt werden",
      "Pass-and-Play entfernt: der lokale Mehrspieler-Modus an einem Gerät wurde mangels Nutzen wieder ausgebaut"
    ]
  },
  {
    "version": "0.70",
    "date": "22.06.2026",
    "changes": [
      "Neuer Race-/Duell-Modus: 1-gegen-1-Wettrennen auf demselben Rätsel -- wer als Erster fehlerfrei fertig ist, gewinnt; Fortschritt des Gegners wird laufend angezeigt"
    ]
  },
  {
    "version": "0.69",
    "date": "22.06.2026",
    "changes": [
      "Neuer Team-vs-Team-Modus (2 gegen 2): Spieler im Coop-Raum lassen sich Teams zuordnen, wer als Team zuerst fertig ist, gewinnt sofort für beide Teams"
    ]
  },
  {
    "version": "0.68",
    "date": "22.06.2026",
    "changes": [
      "Neu: Tagesrätsel im Coop -- \"Heute zusammen spielen\" auf dem Home-Screen startet einen Coop-Raum mit dem heutigen Tagesrätsel-Seed, alle Mitspieler lösen exakt dasselbe Rätsel"
    ]
  },
  {
    "version": "0.67",
    "date": "22.06.2026",
    "changes": [
      "Pass-and-Play: lokaler Mehrspieler-Modus an einem Gerät, kein Netz nötig"
    ]
  },
  {
    "version": "0.66",
    "date": "22.06.2026",
    "changes": [
      "Coop-Raumkapazität auf bis zu 4 Spieler erhöht — Host startet die Runde jetzt per Button aus einer echten Warte-Lobby statt automatisch beim ersten Beitritt."
    ]
  },
  {
    "version": "0.65",
    "date": "22.06.2026",
    "changes": [
      "Neu: Trainingsmodus – Rätsel werden Schritt für Schritt mit erklärter Logik gelöst"
    ]
  },
  {
    "version": "0.64",
    "date": "22.06.2026",
    "changes": [
      "Achievements/Badges: 15 Erfolge zum Freischalten (erster Sieg, Siegesserien, perfektes Spiel, schwerste Stufe, Coop-Sieg, Daily-/Boss-Streaks u.v.m.) — Übersicht über die Stats-Seite erreichbar"
    ]
  },
  {
    "version": "0.63",
    "date": "21.06.2026",
    "changes": [
      "Verlauf: gelöste Rätsel werden jetzt gespeichert und können angesehen oder per Seed erneut gespielt werden"
    ]
  },
  {
    "version": "0.62",
    "date": "21.06.2026",
    "changes": [
      "Boss-Rätsel: jede Woche ein neues Sudden-Death-Rätsel (eine der drei schwersten Stufen, ein Leben, ein Versuch) mit eigener Streak"
    ]
  },
  {
    "version": "0.61",
    "date": "21.06.2026",
    "changes": [
      "Eigene Rätselgröße: im Setup-Screen lässt sich jetzt eine quadratische Rastergröße von 6×6 bis 11×11 frei wählen (zählt nicht zu Streaks/Bestzeiten)"
    ]
  },
  {
    "version": "0.60",
    "date": "21.06.2026",
    "changes": [
      "Profanitätsfilter: anstößige Coop-Anzeigenamen werden beim Bestätigen und in den Einstellungen abgelehnt"
    ]
  },
  {
    "version": "0.59",
    "date": "21.06.2026",
    "changes": [
      "Barrierefreiheit: Spielfeldzellen haben jetzt eine Rolle/Beschreibung für Screenreader und lassen sich per Tastatur (Enter/Leertaste) bedienen",
      "Neue Einstellung: farbenblind-sichere Coop-Farbpalette mit höherem Kontrast für Rot-Grün-/Blau-Gelb-Sehschwäche",
      "Tippflächen der Symbol-Buttons von 40 auf 44 px vergrößert, sichtbarer Fokusring beim Bedienen per Tastatur"
    ]
  },
  {
    "version": "0.58",
    "date": "21.06.2026",
    "changes": [
      "Coop: Namensbegrenzung von 16 auf 32 Zeichen verdoppelt, damit längere Namen nicht mehr beschnitten werden müssen."
    ]
  },
  {
    "version": "0.57",
    "date": "21.06.2026",
    "changes": [
      "Coop: \"Nächstes Rätsel\" führt jetzt zur Schwierigkeitsauswahl statt automatisch dieselbe Schwierigkeit zu wiederholen",
      "Neue Einstellung: farbige Umrandung an gelöschten Zellen im Coop-Modus ein-/ausschaltbar",
      "Einstellungen: Coop-Bereich zusammengefasst (Name, Farbe, neue Umrandungs-Option)",
      "Coop: Rätselstart zeigt jetzt eine \"Lobby\"-Ansicht mit Start-Button statt direkt als \"Pause\" zu erscheinen"
    ]
  },
  {
    "version": "0.56",
    "date": "21.06.2026",
    "changes": [
      "Fix: Verlässt der Host eine laufende Coop-Runde, wird der Mitspieler nicht mehr aus dem Spiel geworfen – er übernimmt jetzt wie bei einem unerwarteten Verbindungsabbruch die Host-Rolle und spielt weiter."
    ]
  },
  {
    "version": "0.55",
    "date": "21.06.2026",
    "changes": [
      "Fix: Die Streak des Tagesrätsels wurde nicht zurückgesetzt, wenn ein Kalendertag übersprungen wurde – sie blieb fälschlich bis zum nächsten gelösten Tagesrätsel stehen, statt sofort beim Öffnen der App zu reagieren."
    ]
  },
  {
    "version": "0.54",
    "date": "19.06.2026",
    "changes": [
      "Versehentliches Scrollen der ganzen Seite beim Lösen eines Rätsels behoben — nur das gezoomte Spielfeld selbst lässt sich noch verschieben, wenn es nicht ganz passt.",
      "Hintergrund hinter offenen Fenstern (z. B. Anleitung) bleibt jetzt zuverlässig stehen, auch beim Scrollen im Fenster selbst.",
      "Tagesrätsel-Button auffälliger gestaltet, solange das heutige Rätsel noch nicht gelöst ist."
    ]
  },
  {
    "version": "0.53",
    "date": "19.06.2026",
    "changes": [
      "Design der Lösungsanzeige überarbeitet — sie verdeckt nicht mehr die Werkzeug-Buttons und fügt sich als schwebende Pille ins restliche App-Design ein."
    ]
  },
  {
    "version": "0.52",
    "date": "18.06.2026",
    "changes": [
      "Hintergrund-Scrollen hinter Popups (z. B. Anleitung) behoben — die Seite dahinter bewegt sich nicht mehr mit.",
      "Versehentliche Textmarkierung beim gedrückt halten von Schaltern in den Einstellungen behoben."
    ]
  },
  {
    "version": "0.51",
    "date": "18.06.2026",
    "changes": [
      "Tägliches Rätsel hinzugefügt — jeden Tag ein weltweit identisches Puzzle (immer sehr leicht, leicht oder mittel), inklusive Serien-Zähler (Streak).",
      "Teilen-Funktion eingebaut: Ergebnis des täglichen Rätsels und Coop-Einladungen können jetzt direkt als Link verschickt werden."
    ]
  },
  {
    "version": "0.50",
    "date": "18.06.2026",
    "changes": [
      "CI/CD-Pipelines für Android- und iOS-Builds via GitHub Actions ergänzt",
      "iOS-Capacitor-Projekt (ios/) inkl. App-Icon & Splash-Screens hinzugefügt",
      "Android-Release-Signing optional über keystore.properties/CI-Secrets vorbereitet"
    ]
  },
  {
    "version": "0.49",
    "date": "18.06.2026",
    "changes": [
      "Echtes App-Icon (statt Capacitor-Platzhalter) für Android-Launcher und Splashscreen erstellt"
    ]
  },
  {
    "version": "0.48",
    "date": "18.06.2026",
    "changes": [
      "Datenschutzerklärung um Hosting-Hinweis (GitHub Pages) und Drittlandtransfer (Google) ergänzt",
      "Neuen \"Alle lokalen Daten löschen\"-Button in den Einstellungen hinzugefügt",
      "Impressum hinzugefügt (Deutsch/Englisch), über die Einstellungen abrufbar"
    ]
  },
  {
    "version": "0.47",
    "date": "18.06.2026",
    "changes": [
      "Datenschutzerklärung hinzugefügt (Deutsch/Englisch), über die Einstellungen abrufbar"
    ]
  },
  {
    "version": "0.46",
    "date": "18.06.2026",
    "changes": [
      "Firebase-RTDB-Security-Rules jetzt im Repo versioniert (database.rules.json)",
      "manifest.json um App-Kategorien (games, puzzle) ergänzt"
    ]
  },
  {
    "version": "0.45",
    "date": "18.06.2026",
    "changes": [
      "Capacitor-Setup für native iOS/Android-Apps (Android-Projekt bereits gescaffoldet, iOS folgt auf macOS)",
      "Service Worker registriert sich in nativen Apps nicht mehr (nur für GitHub-Pages-Updates relevant)"
    ]
  },
  {
    "version": "0.44",
    "date": "18.06.2026",
    "changes": [
      "Fehler beim Beitreten zu einem Coop-Raum behoben (numChildren ist in Firebase v10 keine Funktion mehr, sondern die Property \"size\")",
      "Diagnoseprotokoll deckt jetzt die gesamte App ab (Storage, Service-Worker-Updates, globale Fehler, Spielverlauf), nicht mehr nur den Coop-Bereich"
    ]
  },
  {
    "version": "0.43",
    "date": "18.06.2026",
    "changes": [
      "Coop-Hosten/Beitreten-Fehler (\"Verbindungsfehler\") behoben: der Spieler-Eintrag erfüllt jetzt die Firebase-Sicherheitsregeln",
      "Coop-Verbindungsaufbau erholt sich jetzt von einem fehlgeschlagenen Versuch, statt dauerhaft zu hängen",
      "Neu: Diagnoseprotokoll in den Einstellungen exportierbar, um Coop-Verbindungsprobleme melden zu können"
    ]
  },
  {
    "version": "0.42",
    "date": "18.06.2026",
    "changes": [
      "Coop-Transport von WebRTC/PeerJS auf Firebase Realtime Database umgestellt — zuverlässiger hinter Firewalls, NAT und iCloud Private Relay"
    ]
  },
  {
    "version": "0.41",
    "date": "18.06.2026",
    "changes": [
      "Update-Sicherheitsnetz: bei neuer Version erscheint ein Hinweis mit der Möglichkeit, vorher ein Backup herunterzuladen, bevor aktualisiert und neu gestartet wird"
    ]
  },
  {
    "version": "0.40",
    "date": "18.06.2026",
    "changes": [
      "CI eingerichtet: Tests laufen jetzt automatisch bei jedem Push/PR via GitHub Actions"
    ]
  },
  {
    "version": "0.39",
    "date": "18.06.2026",
    "changes": [
      "Automatisierte Testsuite für die ganze App ergänzt (Unit-Tests für Solver, Generator, Storage, Config, i18n + Playwright-E2E-Tests für alle Bildschirme)",
      "Bug behoben: beim allerersten Laden ohne gespeicherte Statistik konnte ein intern geteiltes Datenobjekt verunreinigt werden"
    ]
  },
  {
    "version": "0.38",
    "date": "18.06.2026",
    "changes": [
      "Coop-Farbwahl vereinfacht: nur noch der freie Farbwähler statt fester Farbpalette, zuletzt gewählte Farbe wird gemerkt"
    ]
  },
  {
    "version": "0.37",
    "date": "18.06.2026",
    "changes": [
      "Fix: Logo auf dem Hauptmenü erschien beim Navigieren kurz verzögert (Service Worker liefert Icons jetzt direkt aus dem Cache statt per Netzwerk-Roundtrip)"
    ]
  },
  {
    "version": "0.36",
    "date": "18.06.2026",
    "changes": [
      "Mehrsprachigkeit: App ist jetzt auf Deutsch und Englisch vollständig übersetzt",
      "8 weitere Sprachen (Spanisch, Französisch, Portugiesisch, Italienisch, Japanisch, Koreanisch, Türkisch, Russisch) als erste maschinelle Übersetzung verfügbar",
      "Neue Sprachauswahl in den Einstellungen"
    ]
  },
  {
    "version": "0.35",
    "date": "18.06.2026",
    "changes": [
      "Hochformat-Sperre per \"pointer: coarse\" statt Breiten-Schwelle erkannt (griff bei großen Handys im Querformat bisher nicht)",
      "Warnung vor dem ersten Hinweis je Partie: Bestzeit ist danach nicht mehr möglich",
      "Toast oben im Spiel bei Lebensverlust oder Hinweis, ohne das Feld zu verdecken",
      "Gewinn-Screen zeigt jetzt an, wenn die Zeit ohne Fehler/Hinweise eine neue Bestzeit gewesen wäre",
      "Spielanleitung ergänzt: langes Drücken zum Zurücknehmen (Solo, \"Beim Prüfen\") und Bestzeit-Regel",
      "Statistik: Solo/Coop-Übersicht entfernt, dafür pro Schwierigkeit eigene Solo- und Coop-Unterzeile"
    ]
  },
  {
    "version": "0.34",
    "date": "18.06.2026",
    "changes": [
      "Hochformat-Zwang: Rotations-Fix von <html> auf dedizierten Wrapper umgestellt (vorige Version griff in der Praxis nicht)"
    ]
  },
  {
    "version": "0.33",
    "date": "18.06.2026",
    "changes": [
      "Querformat ersetzt: Spiel bleibt jetzt erzwungen im Hochformat statt Hinweis-Screen"
    ]
  },
  {
    "version": "0.32",
    "date": "18.06.2026",
    "changes": [
      "Hochformat-Sperre: Landschaft auf Handy/Tablet wird jetzt blockiert",
      "Cage-/Reihen-/Spalten-Umrandung beim Fertigstellen: Lücken an den Ecken behoben"
    ]
  },
  {
    "version": "0.31",
    "date": "17.06.2026",
    "changes": [
      "Beim Gewinnen gibt es jetzt — wie beim Verlieren/Aufgeben — einen Button \"Spielfeld ansehen\", um das fertige Rätsel noch einmal anzusehen (Solo & Coop)."
    ]
  },
  {
    "version": "0.30",
    "date": "17.06.2026",
    "changes": [
      "Markierungen im Modus \"Beim Prüfen\" (Solo) lassen sich jetzt durch langes Drücken einer Zelle mit dem passenden Werkzeug zurücksetzen (Radierer auf gelöschter Zahl, Stift auf eingekreister Zahl)."
    ]
  },
  {
    "version": "0.29",
    "date": "17.06.2026",
    "changes": [
      "Pinch-to-Zoom entfernt (nur noch Button-Zoom, Finger verschiebt im gezoomten Modus)",
      "Schwer/Extrem/Mashallah wieder anspruchsvoller (größere Cage-Obergrenze, nicht nur größeres Feld)"
    ]
  },
  {
    "version": "0.28",
    "date": "17.06.2026",
    "changes": [
      "Cage-Form bei Schwer/Extrem/Mashallah wieder organisch (kreuz & quer statt Reihen/Blöcke)"
    ]
  },
  {
    "version": "0.27",
    "date": "17.06.2026",
    "changes": [
      "Statistik: Schatten der Stat-Boxen (und der violette Coop-Ring) werden am linken/rechten Rand nicht mehr abgeschnitten"
    ]
  },
  {
    "version": "0.26",
    "date": "17.06.2026",
    "changes": [
      "Rätsel ab Schwer (9×9) sind jetzt ohne Raten lösbar: kleinere Cages (max. 6-7 Zellen statt bis zu 11) und neue Solver-Logik (Überlapp-Deduktion zwischen Cage und Zeile/Spalte) sorgen dafür, dass fast alle Rätsel allein durch logisches Kombinieren lösbar sind",
      "Sehr Leicht/Leicht/Mittel unverändert"
    ]
  },
  {
    "version": "0.25",
    "date": "17.06.2026",
    "changes": [
      "Statistik: Solo- und Coop-Werte werden jetzt komplett getrennt erfasst und in zwei eigenen, klar gekennzeichneten Bereichen angezeigt",
      "Statistik: Aufgeben und Verloren werden jetzt auch für Coop separat getrackt (Übersicht & nach Schwierigkeit)",
      "Statistik: Durchschnittszeit und Bestzeit pro Schwierigkeit gelten weiterhin getrennt für Solo und Coop, jetzt visuell als Coop-Werte hervorgehoben"
    ]
  },
  {
    "version": "0.24",
    "date": "17.06.2026",
    "changes": [
      "Coop: Beitritt scheitert seltener über getrennte Mobilfunknetze (z.B. iCloud Private Relay) — bei Fehlschlag wird automatisch ein zweiter Versuch mit reinem TURN-Relay unternommen",
      "Coop: hängende Verbindungsversuche werden jetzt korrekt aufgeräumt, statt im Hintergrund weiterzulaufen"
    ]
  },
  {
    "version": "0.23",
    "date": "17.06.2026",
    "changes": [
      "Coop: Leben werden jetzt geteilt — alle Spieler haben zusammen 3 Leben statt jeder eigene",
      "Verbrauchtes Herz wird diagonal durchgestrichen, in der Farbe des Spielers, der den Fehler gemacht hat (nur im Coop)",
      "Neu auf dem Gelöst-/Verloren-Screen im Coop: Team-Performance-Auswertung mit richtig eingekreisten/gelöschten Feldern, Fehlern pro Spieler und MVP-Krönung"
    ]
  },
  {
    "version": "0.22",
    "date": "17.06.2026",
    "changes": [
      "Coop: dein zuletzt verwendeter Name wird beim nächsten Mal automatisch im Namensfeld vorausgefüllt (lässt sich aber wie gewohnt ändern)"
    ]
  },
  {
    "version": "0.21",
    "date": "17.06.2026",
    "changes": [
      "App-Icon neu gestaltet: nachgestellte Spielfeld-Ecke statt abstraktem Symbol, mit weich abgerundeten Ziffern statt blockiger 7-Segment-Optik",
      "Neues Icon wird jetzt auch auf dem Lade-Screen und im Hauptmenü-Logo angezeigt (statt der alten \"∑\"-Grafik)"
    ]
  },
  {
    "version": "0.20",
    "date": "17.06.2026",
    "changes": [
      "\"Neues Spiel\"- und \"Coop-Modus\"-Icon im Hauptmenü sind jetzt exakt auf einer Höhe",
      "Die vier unteren Hauptmenü-Buttons sind jetzt im 2x2-Raster immer gleich breit",
      "Lösung anzeigen im Coop ist jetzt rein lokal: dein Partner sieht davon nichts und kann währenddessen weiterspielen",
      "Neuer \"Zurück\"-Button bei angezeigter Lösung führt wieder zum Aufgeben-Dialog zurück",
      "Beim Coop-Beitritt wird jetzt zuerst nach Name und eigener Farbe gefragt",
      "Alle verbundenen Mitspieler werden im Spiel jetzt namentlich mit ihrer Farbe angezeigt",
      "Eigene Coop-Farbe frei wählbar per Farbpicker, andere Mitspieler bekommen automatisch eine eigene Farbe zugewiesen",
      "Bestzeit und Durchschnittszeit werden für Coop-Partien jetzt getrennt von Solo-Partien geführt und angezeigt"
    ]
  },
  {
    "version": "0.19",
    "date": "17.06.2026",
    "changes": [
      "Rückgängig-Button wieder da (macht nur den letzten Zug rückgängig)",
      "Pause-Timer läuft nicht mehr heimlich weiter, wenn man über \"Zum Menü\" zurückkehrt",
      "Alle Buttons (inkl. Schwierigkeitskarten, Coop-Hosten/Beitreten) haben jetzt zentrierten Text",
      "Schnelles Umschalten der Schwierigkeit fühlt sich nicht mehr ruckelig an",
      "Statistik: \"Aufgegeben\"/\"Verloren\"-Chips sehen jetzt wie Bestzeit/Schnitt aus",
      "Coop: Aufgeben beendet nur die Runde, die Lobby bleibt bestehen",
      "Coop: \"Zum Menü\" schließt die Lobby jetzt für beide Spieler",
      "Coop: \"Lösung zeigen\" und \"Nochmal versuchen\" werden jetzt mit dem Partner synchronisiert",
      "Neuer \"Neues Spiel\"-Button nach Niederlage/Aufgeben (in Coop ohne dass der Partner etwas wählen muss)",
      "Coop: Hinweise zeigen jetzt zusätzlich, wer sie ausgelöst hat (farbiger Rahmen)",
      "Coop: weitere STUN-Server als Fallback für Verbindungen über getrennte Netzwerke",
      "Versionsnummer bleibt jetzt bei 0.x, bis explizit ein neues Hauptrelease angefordert wird"
    ]
  },
  {
    "version": "0.18",
    "date": "17.06.2026",
    "changes": [
      "Versionsnummer basiert jetzt auf einem eigenen Release-Zähler statt der Git-Commit-Anzahl (keine Sprünge mehr pro Release)"
    ]
  },
  {
    "version": "0.17",
    "date": "17.06.2026",
    "changes": [
      "Hosten- und Beitreten-Button im Coop-Menü haben jetzt denselben Text-Offset von links",
      "Titel im Header wird beim Hosten/Warten auf Mitspieler jetzt korrekt zentriert angezeigt"
    ]
  },
  {
    "version": "0.15",
    "date": "17.06.2026",
    "changes": [
      "Coop-Modus funktioniert jetzt auch über getrennte Netzwerke hinweg (TURN-Server als Fallback, falls Direktverbindung nicht möglich ist)"
    ]
  },
  {
    "version": "0.13",
    "date": "17.06.2026",
    "changes": [
      "Aufgeben-Button hat jetzt ein passendes Flaggen-Icon im Stil von Pause/Anleitung",
      "Hinweise werden im Coop-Modus jetzt an den Mitspieler übertragen",
      "Fehler beim Endbildschirm im Coop-Modus behoben (NaN-Zeit, abweichende Zeitanzeige)",
      "Bestzeit wird beim Host im Coop-Modus jetzt korrekt erkannt",
      "Trennt sich der Host im Coop-Modus, übernimmt der Mitspieler automatisch als neuer Host",
      "Coop-Raum wird nach Spielende bzw. bei Verbindungsabbruch wieder freigegeben",
      "Durchschnittszeit in der Statistik wird jetzt auf gleicher Höhe und Größe wie die Bestzeit angezeigt",
      "Zentrierungsfehler im Spielfeld bei bestimmten Bildschirmbreiten behoben"
    ]
  },
  {
    "version": "0.11",
    "date": "17.06.2026",
    "changes": [
      "Toggle-Kontrast verbessert: aktives Werkzeug ist jetzt klar erkennbar (weißes Symbol)",
      "Summenkästchen außen haben jetzt exakt dieselbe Größe wie die Spielfelder",
      "Obere linke Eckzelle farblich abgehoben",
      "Fertige Reihen/Spalten/Cages bekommen nur noch eine äußere Umrandung statt einzeln aufblitzender Kästchen",
      "Änderungshistorie lässt sich jetzt immer schließen (Modal scrollt korrekt)",
      "Herzen verschieben sich beim Lebensverlust nicht mehr, sondern grauen nur noch aus",
      "Spielanleitung zeigt jetzt die echten Stift-/Radierer-Symbole statt Text",
      "Statistik: Bestzeit und Durchschnittszeit je Schwierigkeit, Bestzeiten zählen nur bei fehler- und hinweisfreien Spielen",
      "Neue Bestzeit wird beim Sieg mit einem Hinweis gefeiert",
      "Neuer Aufgeben-Button im Spiel; aufgegebene Spiele werden getrennt von verlorenen Spielen gezählt",
      "Generator garantiert jetzt zuverlässig die Mindestanzahl einstelliger Summen je Schwierigkeit"
    ]
  },
  {
    "version": "0.8",
    "date": "17.06.2026",
    "changes": [
      "Coop-Modus: gemeinsam Rätsel lösen in Echtzeit (Host legt 6-stelligen Code fest)",
      "Coop: Pause ist übergreifend – pausiert einer, pausiert der Partner auch",
      "Coop: eigene Farbe und Partner-Farbe in den Einstellungen frei wählbar",
      "Coop: Zellen zeigen farblich, wer sie eingekreist oder gelöscht hat"
    ]
  },
  {
    "version": "0.6",
    "date": "16.06.2026",
    "changes": [
      "Einstellungen lassen sich jetzt wieder nach oben scrollen (Topbar bleibt fixiert)",
      "Toolbar: Undo immer links, Toggle immer mittig, Tipps immer rechts — auch ohne Undo-Modus",
      "Toggle und Buttons vergrößert (60 px)",
      "Cage-Farben: ähnliche Farbtöne (< 40° Abstand) werden bei Nachbar-Cages vermieden",
      "Bereits markierte Zellen (eingekreist/gelöscht) lassen sich nicht mehr durch Antippen rückgängig machen — nur noch per Undo",
      "Reihe/Spalte leuchtet beim Fertigwerden komplett auf (nicht nur die Summe), genau wie Cages"
    ]
  },
  {
    "version": "0.4",
    "date": "16.06.2026",
    "changes": [
      "Stabilitätsverbesserungen"
    ]
  },
  {
    "version": "0.3",
    "date": "16.06.2026",
    "changes": [
      "Cages haben jetzt exakt so viele Zellen wie die Felddimension (8×8 → 8er-Cages)",
      "Cages werden eingefärbt statt umrandet – unregelmäßige Formen (auch über Eck)",
      "Cage-Färbung und Außensumme verschwinden, sobald die Gruppe vollständig gelöst ist",
      "Reihe/Spalte/Cage löst sich erst auf, wenn ALLE richtigen Zahlen eingekreist und alle anderen gelöscht sind (kein automatisches Auflösen)",
      "Außen wird jetzt zusätzlich die aktuelle (temporäre) Summe angezeigt – grün, wenn sie die Zielsumme trifft",
      "Neuer Pausenmodus: Zeit stoppt, Feld wird verschwommen verdeckt",
      "Radieren löscht die Zahl vollständig (statt sie durchzustreichen)",
      "Neue Icons für Rückgängig, Löschen, Einkreisen und Hinweise",
      "Spielfeld jetzt mittig zentriert; Werkzeugleiste nach oben gerückt, Symbole weiter auseinander",
      "Größte Felder auf 11×11–12×12 angepasst (eindeutig & ohne Raten lösbar)",
      "Temporäre Summe färbt sich nicht mehr grün, wenn die Zielsumme erreicht ist",
      "Beim Hineinzoomen lässt sich das Feld jetzt frei verschieben (scrollen)"
    ]
  },
  {
    "version": "0.2",
    "date": "16.06.2026",
    "changes": [
      "Farbige Regionen bedecken jetzt das ganze Feld – unregelmäßige Formen (auch über Eck)",
      "Radieren löscht die Zahl jetzt vollständig, statt sie nur durchzustreichen",
      "Zahlen bleiben bis 10×10 klein (1–9) – authentischer wie im Original",
      "Benachbarte Regionen bekommen automatisch unterschiedliche Farben",
      "Fehler behoben: Regionen ohne Lösungszahl bzw. fälschlich vorab geleerte Felder"
    ]
  },
  {
    "version": "0.1",
    "date": "16.06.2026",
    "changes": [
      "Erste Version von Coop Number Sums",
      "Logik-Rätsel mit Reihen-, Spalten- und farbigen Regions-Summen",
      "Fünf Feldgrößen: Klein bis Unendlichkeit (4×4 bis 14×14)",
      "Vier Schwierigkeitsgrade: Leicht, Mittel, Schwer, Experte",
      "Jedes Rätsel ist garantiert eindeutig und ohne Raten lösbar",
      "Leben-/Fehlermodus mit „Sofort\"- oder „Beim Prüfen\"-Aufdeckung (einstellbar)",
      "Hinweise, Rückgängig, Auto-Durchstreichen, Timer & Statistik",
      "Dunkelmodus (Standard) und Hellmodus",
      "Offline spielbar (PWA), Fortsetzen-Funktion und Auto-Backups",
      "Coop-Modus in Vorbereitung"
    ]
  }
];
