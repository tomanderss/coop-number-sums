// Auto-generiert von build.js — nicht manuell bearbeiten!
export const BUILD      = '0.17';
export const BUILD_HASH = '46523ad';

export const CHANGELOG = [
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
