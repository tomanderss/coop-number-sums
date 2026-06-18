// Auto-generiert von build.js — nicht manuell bearbeiten!
export const BUILD      = '0.37';
export const BUILD_HASH = '28b6783';

export const CHANGELOG = [
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
      "Erste Version von Coop Number Sums 🎉",
      "Logik-Rätsel mit Reihen-, Spalten- und farbigen Regions-Summen",
      "Fünf Feldgrößen: Klein bis Unendlichkeit (4×4 bis 14×14)",
      "Vier Schwierigkeitsgrade: Leicht, Mittel, Schwer, Experte",
      "Jedes Rätsel ist garantiert eindeutig und ohne Raten lösbar",
      "Leben-/Fehlermodus mit „Sofort\"- oder „Beim Prüfen\"-Aufdeckung (einstellbar)",
      "Hinweise, Rückgängig, Auto-Durchstreichen, Timer & Statistik",
      "Dunkelmodus (Standard) und Hellmodus",
      "Offline spielbar (PWA), Fortsetzen-Funktion und Auto-Backups",
      "Coop-Modus in Vorbereitung 👥"
    ]
  }
];
