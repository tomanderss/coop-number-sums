// config.js — statische Spielkonfiguration: Schwierigkeiten, Farben, Defaults
// (Analog zu werwolf-app/js/data.js — reine Daten, keine Logik)

// ─── SCHWIERIGKEITEN ──────────────────────────────────────────────────────────
// Jede Schwierigkeit hat eine FESTE Feldgröße (kein separater Größen-Wähler
// mehr). Leben, Hinweise und Zahlenbereich sind für alle Schwierigkeiten
// gleich — nur Dimension, Lösungsdichte (keepRatio) und die garantierte
// Mindestanzahl einstelliger Summen (für Mensch-Lösbarkeit) unterscheiden sich.
export const LIVES = 3;
export const HINTS = Infinity;
export const MAX_VAL = 9; // Zellwerte sind immer 1–9, nie höher — auch bei großen Feldern

// maxCageSize: Obergrenze für Cage-Größe, UNABHÄNGIG von der Felddimension —
// null = kein Limit (Cage-Größe = Spaltenzahl, wie bisher). Ab "schwer" gekappt,
// damit Teilsummen-Kollisionen nicht mit der Dimension explodieren (sonst nur
// noch durch Hypothese/Raten lösbar, siehe maxTier3Steps).
// maxTier3Steps: wie viele Tier-3-Hypothesenschritte (Beweis durch Widerspruch)
// der Solver maximal brauchen darf, damit das Rätsel noch akzeptiert wird —
// 0 = nur reine Stufe-1/2-Logik (kein Raten-artiger Schritt nötig). Bewusst
// für ALLE Schwierigkeiten (auch 10×10/11×11) auf 0 gesetzt: Tier 3 ist zwar
// logisch beweisbar (kein Zufallsraten), fühlt sich für Spieler ohne Solver
// aber wie Ausprobieren an — der Generator verwirft daher jedes Rätsel, das
// auch nur einen Tier-3-Schritt bräuchte, und versucht es mit neuem Seed
// erneut (per Stresstest verifiziert: kostet bei 10×10/11×11 im Schnitt nur
// 2–4 Versuche zusätzlich, weit innerhalb von genBudget).
// genBudget: maximale Generierungs-Versuche, bevor mit neuem Seed neu gestartet
// wird — höhere Schwierigkeiten brauchen mehr Versuche, weil Cage-Kappung und
// Tier-3-Limit die Akzeptanzrate senken.
export const DIFFICULTIES = [
  { id: 'sehrleicht', name: 'Sehr Leicht', emoji: '🟢', dim: { r: 6,  c: 6  }, keepRatio: 0.50, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  { id: 'leicht',     name: 'Leicht',      emoji: '🟡', dim: { r: 7,  c: 7  }, keepRatio: 0.48, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  { id: 'mittel',     name: 'Mittel',      emoji: '🟠', dim: { r: 8,  c: 8  }, keepRatio: 0.46, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  { id: 'schwer',     name: 'Schwer',      emoji: '🔴', dim: { r: 9,  c: 9  }, keepRatio: 0.46, minSingleDigitSums: 3, maxCageSize: 8,    maxTier3Steps: 0, genBudget: 6000 },
  { id: 'extrem',     name: 'Extrem',      emoji: '🟣', dim: { r: 10, c: 10 }, keepRatio: 0.44, minSingleDigitSums: 4, maxCageSize: 8,    maxTier3Steps: 0, genBudget: 8000 },
  { id: 'mashallah',  name: 'Mashallah',   emoji: '💀', dim: { r: 11, c: 11 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 12000 },
  // 12×12: schnell generierbar (~65 ms im Schnitt), ohne Raten (Tier ≤ 2.5);
  // Werte 1–9, Cages auf 9 gekappt.
  { id: 'dikkawas',   name: 'Dikka was',   emoji: '🫠', dim: { r: 12, c: 12 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 15000 },
  // 13×13: dank der Hypothese-Sparoptimierung im Generator (siehe generator.js)
  // weiterhin schnell (~0,27 s im Schnitt, <1 s im Worst Case), ohne Raten.
  // Zellwerte 1–9, Cages auf 9 gekappt; nur Reihen-/Spaltensummen wachsen moderat.
  { id: 'bismillah',  name: 'Bismillah',   emoji: '☄️', dim: { r: 13, c: 13 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 15000 },
  // 14×14: das absolute Maximum. Weiterhin ohne Raten generierbar (empirisch
  // Tier ≤ 2.5), Cages/Werte klein wie gehabt — ABER die Generierung ist spürbar
  // langsamer (median ~1,3 s, Ausreißer mehrere Sekunden), weil die Akzeptanzrate
  // mit der Feldgröße sinkt. Tragbar nur dank der Hintergrund-Vorgenerierung
  // (Prefetch, siehe app.js), die große Felder zuerst erzeugt; der seltene
  // Kaltstart-Fallback zeigt den Ladebildschirm. genBudget großzügig.
  { id: 'rip',        name: 'R.I.P.',      emoji: '🪦', dim: { r: 14, c: 14 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 20000 },
];

export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));

// ─── REGIONEN-FARBPALETTE ─────────────────────────────────────────────────────
// Kräftige, klar unterscheidbare Töne (funktionieren in Hell & Dunkel). Der
// Grünbereich (lime/emerald/teal) bekam Nutzer-Feedback ("zu ähnlich, zu
// soft"): drei Grüntöne liegen nah beieinander auf dem Farbkreis und wurden
// vorher zusätzlich mit fast identischer Sättigung/Helligkeit kombiniert, was
// sie nebeneinander praktisch ununterscheidbar machte. Jetzt: größere
// Hue-Abstände UND bewusst stark unterschiedliche Helligkeit/Sättigung pro
// Grünton (hell-satt / sehr dunkel / mittel-blaustichig), damit die drei
// auch ohne exaktes Farbsehen klar als eigene Farben lesbar sind. Restliche
// Paletten-Töne entsprechend kräftiger (höhere Sättigung) für mehr Kontrast
// insgesamt. Siehe auch HUE_SIM_THRESHOLD (generator.js) für die
// Mindestabstands-Logik zwischen direkt benachbarten Cages.
// Größere Felder (z.B. 13×13 "Dikka was") haben mehr Cages als die ursprünglichen
// 10 Farben — zu wenig, um direkt benachbarte Cages durchgängig deutlich (≥30°
// Farbton-Abstand) unterscheidbar zu halten. Daher zusätzliche, über den ganzen
// Farbkreis verteilte Töne mit bewusst variierender Helligkeit/Sättigung (auch
// nahe Farbtöne bleiben so durch unterschiedliche Helligkeit lesbar). Reihenfolge
// der ersten 10 unverändert (stabile colorIndex-Indizes für gespeicherte Spiele).
export const REGION_COLORS = [
  { name: 'coral',  h: 8,   s: 88, l: 58 },
  { name: 'amber',  h: 42,  s: 92, l: 54 },
  { name: 'lime',   h: 78,  s: 80, l: 54 },
  { name: 'emerald',h: 136, s: 75, l: 30 },
  { name: 'teal',   h: 180, s: 80, l: 44 },
  { name: 'cyan',   h: 202, s: 88, l: 56 },
  { name: 'blue',   h: 228, s: 82, l: 62 },
  { name: 'violet', h: 264, s: 75, l: 66 },
  { name: 'fuchsia',h: 300, s: 78, l: 58 },
  { name: 'rose',   h: 336, s: 85, l: 60 },
  { name: 'orange', h: 22,  s: 95, l: 50 },
  { name: 'gold',   h: 60,  s: 86, l: 48 },
  { name: 'green',  h: 110, s: 68, l: 40 },
  { name: 'spring', h: 158, s: 72, l: 50 },
  { name: 'sky',    h: 192, s: 90, l: 62 },
  { name: 'azure',  h: 244, s: 82, l: 64 },
  { name: 'purple', h: 282, s: 72, l: 58 },
  { name: 'magenta',h: 318, s: 82, l: 56 },
];

// ─── COOP-IDENTITÄTSFARBEN ────────────────────────────────────────────────────
// Bewusst ohne Grün/Smaragd-Töne (= Hinweis-Farbe --good, ~152°) und ohne Rot
// (= Fehler-Farbe --bad), damit Markierungs-Farbe nie mit Hinweis/Fehler verwechselbar ist.
// Größere Auswahl, da nun jeder Mitspieler eine EIGENE, eindeutige Farbe braucht
// (nicht mehr nur "meine" und "Partner"-Farbe).
export const COOP_COLORS = [
  { id: 'blau',       name: 'Blau',     hex: '#3b82f6' },
  { id: 'orange',     name: 'Orange',   hex: '#f97316' },
  { id: 'pink',       name: 'Pink',     hex: '#ec4899' },
  { id: 'lila',       name: 'Lila',     hex: '#a855f7' },
  { id: 'gelb',       name: 'Gelb',     hex: '#eab308' },
  { id: 'cyan',       name: 'Cyan',     hex: '#06b6d4' },
  { id: 'indigo',     name: 'Indigo',   hex: '#6366f1' },
  { id: 'bernstein',  name: 'Bernstein',hex: '#d97706' },
  { id: 'fuchsia',    name: 'Fuchsia',  hex: '#d946ef' },
  { id: 'himmelblau', name: 'Himmelblau',hex: '#0ea5e9' },
  { id: 'violett',    name: 'Violett',  hex: '#8b5cf6' },
  { id: 'koralle',    name: 'Koralle',  hex: '#fb7185' },
];

// Farbenblind-sichere Variante (angelehnt an die Okabe-Ito-/Wong-Palette) —
// ebenfalls ohne Grün (= Hinweis-Farbe) und ohne Rot (= Fehler-Farbe), aber
// mit größerem Mindestabstand der Farbtöne für Personen mit Rot-Grün- oder
// Blau-Gelb-Sehschwäche. Aktiv, wenn settings.colorBlindMode === true.
export const COOP_COLORS_CB = [
  { id: 'blau',      name: 'Blau',      hex: '#0072B2' },
  { id: 'orange',    name: 'Orange',    hex: '#E69F00' },
  { id: 'himmelblau',name: 'Himmelblau',hex: '#56B4E9' },
  { id: 'gelb',      name: 'Gelb',      hex: '#F0E442' },
  { id: 'magenta',   name: 'Magenta',   hex: '#CC79A7' },
  { id: 'graublau',  name: 'Graublau',  hex: '#5C6BC0' },
  { id: 'braun',     name: 'Braun',     hex: '#8B5A2B' },
  { id: 'violett',   name: 'Violett',   hex: '#7B5EA7' },
];

// Maximale Anzahl gleichzeitig aktiver Spieler pro Coop-Raum (geteiltes Gitter).
// Leben/Herzen skalieren NICHT mit der Spielerzahl — bewusster Trade-off, dass
// bei 4 Spielern die gemeinsamen Leben schneller aufgebraucht sind.
export const COOP_MAX_PLAYERS = 4;

// Link für den freiwilligen Unterstützer-Button (Startbildschirm-Kopfzeile +
// Einstellungen). Bewusst eine einfache, bedingungslose Spendenseite ohne
// Gegenleistung (kein Feature-Unlock o.ä.) — sonst rechtlich keine Schenkung
// mehr, sondern steuerpflichtiges Entgelt.
export const DONATE_URL = 'https://ko-fi.com/tomanders';

// ─── STANDARD-EINSTELLUNGEN ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  darkMode: true,            // Dunkelmodus ist Standard
  errorReveal: 'instant',    // 'instant' = sofort aufdecken | 'onCheck' = erst beim Prüfen
  livesEnabled: true,        // Leben/Herzen aktiv? (false = Zen, unbegrenzt)
  showTimer: true,           // Timer anzeigen
  confirmTool: 'pen',        // Standard-Werkzeug: 'pen' (einkreisen) | 'eraser'
  eraseStyle: 'hide',        // gelöschte Zahl: 'hide' (verschwindet) | 'strike' (durchgestrichen)
  coopName: '',              // eigener Anzeigename im Coop-Modus
  coopMyColor: '#3b82f6',    // eigene Spielerfarbe -- gilt für die eigenen Markierungen in JEDEM
                              // Modus (auch solo), nicht nur Coop (Default: Blau). Name des Storage-
                              // Keys bewusst beibehalten, um bestehende Nutzerfarben nicht zu verlieren.
  coopRemovedOutline: true,  // farbige Umrandung an gelöschten Zellen, die zeigt, wer sie gelöscht hat (rein optisch)
  language: null,           // UI-Sprache; null = noch nicht erkannt/gewählt -> Auto-Detect via navigator.language
  colorBlindMode: false,    // farbenblind-freundlicher Modus, global: ersetzt Grün/Rot
                            // (richtig/falsch, Hinweis/Fehler, Leben, Toasts, ...) durch
                            // Blau/Orange (css/styles.css) UND nutzt COOP_COLORS_CB statt
                            // COOP_COLORS für die Coop-Spielerpalette.
  // Prozedurale Zen-Hintergrundmusik (js/music.js), pro Bereich schaltbar.
  // Default an; Lautstärke 0..1. "competition" deckt Race (1v1) UND Team (2v2) ab.
  // musicMenu = Menüs/Statistik/Verlauf usw. (alle Nicht-Spiel-Screens). Sind
  // alle Schalter an, läuft die Musik nahtlos durchgehend in der ganzen App.
  musicMenu: true,
  musicSolo: true,
  musicCoop: true,
  musicCompetition: true,
  musicTraining: true,
  musicVolume: 0.6,
  // UI-Aktions-Sounds (js/music.js sfx*), je Aktion einzeln schaltbar. Default an.
  // sfxComplete = Käfig/Reihe/Spalte fertig (mit Stufung bei mehreren gleichzeitig),
  // sfxKeep = korrektes Einkreisen, sfxRemove = Löschen, sfxError = Fehler,
  // sfxHint = Hinweis (bei jeder Hinweis-Instanz).
  sfxComplete: true,
  sfxKeep: true,
  sfxRemove: true,
  sfxError: true,
  sfxHint: true,
  sfxToolSwitch: true,
  sfxWin: true,
  sfxLose: true,
  sfxUndo: true,
  // Dynamischer Skin (1.0, freischaltbar via Versionssprung/Code; Item 'dynamicColor'
  // im Inventar). Voll konfigurierbar; gilt nur, wenn freigeschaltet UND skinEnabled.
  // Greift auf die persönliche Farbe (--markcol pro Zelle) zurück ⇒ Coop-Identität bleibt.
  skinEnabled: true,         // Master-Schalter (nur wirksam, wenn freigeschaltet)
  skinStyle: 'gradient',     // 'solid' (rotierender Bogen) | 'gradient' (mehrfarbig) | 'rainbow'
  skinColor1: '',            // '' = aus persönlicher Farbe ableiten; sonst Hex
  skinColor2: '',
  skinColor3: '',
  skinSpeed: 2,              // Sekunden/Umdrehung; 0 = keine Rotation
  skinDirection: 'cw',       // 'cw' | 'ccw'
  skinGlow: 6,               // Leuchtradius px; 0 = kein Glow
  skinThickness: 2.5,        // Ring-/Rahmendicke px
  skinApplyTo: 'both',       // 'kept' (Einkreisen) | 'removed' (Coop-Umrandung) | 'both'
};

// Standard-Spieloption (Start-Screen Vorauswahl)
export const DEFAULT_GAME_OPTIONS = {
  difficulty: 'mittel',
};
