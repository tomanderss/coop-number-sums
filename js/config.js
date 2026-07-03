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

// ─── MÜNZ-BELOHNUNG PRO SIEG ──────────────────────────────────────────────────
// In-Game-Währung (nicht auszahlbar) fürs Shop-/Marktplatz-System. Basiswert je
// Schwierigkeit (Reihenfolge = DIFFICULTIES). Die Schwierigkeit (und damit die
// Ø-Lösezeit) steigt exponentiell, daher wächst die Belohnung mindestens
// verdoppelnd: bis „Extrem" glatt ×2, ab „Mashallah" bewusst MEHR als das
// Doppelte (≈×2,2–2,25), weil die Zeit-/Komplexitätssprünge dort am größten sind.
// Auch nicht-perfekte Siege geben die vollen Basis-Münzen. Drei Multiplikatoren
// stapeln MULTIPLIKATIV (kein Cap): Coop/Wettkampf ×2 (Anreiz zum gemeinsamen
// Spielen), makelloser (hinweis-/fehlerfreier) Sieg ×2, und eine neue Bestzeit
// nochmal ×2. Eine Bestzeit gibt es ohnehin nur bei perfektem Spiel, daher real:
// perfekt+Bestzeit → ×4, Coop+perfekt+Bestzeit → ×8.
export const COIN_BASE = [5, 10, 20, 40, 80, 180, 400, 900, 2000];
export const COIN_COOP_MULT = 2, COIN_PERFECT_MULT = 2, COIN_BESTTIME_MULT = 2;
// Basis-Münzen für eine Schwierigkeit (per Index in DIFFICULTIES); dIdx<0 → 0.
export function coinBaseForIndex(dIdx) {
  if (dIdx < 0) return 0;
  return COIN_BASE[Math.min(dIdx, COIN_BASE.length - 1)];
}
// Gesamt-Multiplikator eines Siegs aus den aktiven Boni (für Anzeige + Reward).
export function coinMultiplier({ coop = false, perfect = false, bestTime = false } = {}) {
  let m = 1;
  if (coop) m *= COIN_COOP_MULT;
  if (perfect) m *= COIN_PERFECT_MULT;
  if (bestTime) m *= COIN_BESTTIME_MULT;
  return m;
}
// Endgültige Münzen für einen Sieg inkl. Coop-/Perfekt-/Bestzeit-Multiplikatoren.
export function coinReward(dIdx, { coop = false, perfect = false, bestTime = false } = {}) {
  return Math.round(coinBaseForIndex(dIdx) * coinMultiplier({ coop, perfect, bestTime }));
}

// ─── REGIONEN-FARBPALETTE ─────────────────────────────────────────────────────
// Kräftige, klar unterscheidbare Töne (funktionieren in Hell & Dunkel).
// Nutzer-Feedback: mehrere (v.a. grüne) Cages sahen fast identisch aus. Ursache
// war ein rein HUE-basiertes Design: 18 Farben passen NICHT mit je ≥30°
// Farbton-Abstand auf einen 360°-Kreis (Schnitt 20°), also lagen zwangsläufig
// mehrere Töne dicht beieinander — und weil sie zusätzlich ähnliche Helligkeit
// hatten, waren sie ununterscheidbar. Lösung: Helligkeit wird zur GLEICHWERTIGEN
// zweiten Achse. Diese Palette wurde per Farthest-Point-Sampling gegen die
// wahrgenommene Distanz (Redmean) der TATSÄCHLICH gerenderten Cage-Farbe
// (Farbe über Zellhintergrund gemischt, siehe .cell.region-Alpha in styles.css)
// im schlechteren der beiden Themes optimiert → jedes Paar ist auch komponiert
// klar getrennt (min. Redmean ≈ 81 statt vorher ≈ 29; keine "confusable" Paare).
// Nahe Farbtöne (z.B. mehrere Grüns) sind bewusst über die Helligkeit getrennt
// (dunkel/mittel/hell). Die Zuordnung zu Cages (generator.js colorRegions) nutzt
// dieselbe wahrgenommene Distanz (regionColorDist), damit direkt benachbarte
// Cages maximal auseinanderliegen. `name` nur für Tests/Debug (muss eindeutig
// sein). 18 Töne, da große Felder (13×13) entsprechend viele Cages haben.
export const REGION_COLORS = [
  { name: 'coral',    h: 8,   s: 88, l: 58 },
  { name: 'maroon',   h: 12,  s: 90, l: 30 },
  { name: 'peach',    h: 20,  s: 65, l: 70 },
  { name: 'amber',    h: 48,  s: 90, l: 54 },
  { name: 'olive',    h: 60,  s: 90, l: 30 },
  { name: 'lime',     h: 84,  s: 90, l: 62 },
  { name: 'grass',    h: 96,  s: 90, l: 46 },
  { name: 'forest',   h: 120, s: 90, l: 30 },
  { name: 'emerald',  h: 136, s: 90, l: 54 },
  { name: 'mint',     h: 152, s: 65, l: 70 },
  { name: 'teal',     h: 180, s: 90, l: 54 },
  { name: 'ocean',    h: 196, s: 78, l: 38 },
  { name: 'navy',     h: 224, s: 65, l: 30 },
  { name: 'blue',     h: 240, s: 90, l: 46 },
  { name: 'indigo',   h: 264, s: 90, l: 54 },
  { name: 'lavender', h: 264, s: 90, l: 70 },
  { name: 'plum',     h: 304, s: 90, l: 30 },
  { name: 'magenta',  h: 308, s: 90, l: 54 },
];

// Wahrgenommene Distanz zwischen zwei Cage-Farben, GENAU wie sie im Brett
// erscheinen: die Farbe wird (wie in CSS) mit Alpha über den Zellhintergrund
// gemischt und im Redmean-Farbraum verglichen; zurückgegeben wird der schlechtere
// (kleinere) Wert aus Hell- und Dunkelmodus, damit "unterscheidbar" in BEIDEN
// Themes gilt. Reine Datei-lokale Helfer — genutzt von generator.js (Cage-Färbung)
// und den Farb-Regressionstests, damit beide dieselbe Metrik verwenden.
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const k = n => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}
// Zellhintergründe (styles.css: --cell-bg) + Cage-Alpha je Theme.
const CELL_BG_DARK = [26, 33, 56];      // #1a2138
const CELL_BG_LIGHT = [255, 255, 255];  // #ffffff
const CAGE_ALPHA_DARK = 0.64, CAGE_ALPHA_LIGHT = 0.52;
function composite(rgb, bg, a) { return rgb.map((v, i) => a * v + (1 - a) * bg[i]); }
function redmean(A, B) {
  const rm = (A[0] + B[0]) / 2, dr = A[0] - B[0], dg = A[1] - B[1], db = A[2] - B[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
export function regionColorDist(a, b) {
  const ra = hslToRgb(a.h, a.s, a.l), rb = hslToRgb(b.h, b.s, b.l);
  const dDark = redmean(composite(ra, CELL_BG_DARK, CAGE_ALPHA_DARK), composite(rb, CELL_BG_DARK, CAGE_ALPHA_DARK));
  const dLight = redmean(composite(ra, CELL_BG_LIGHT, CAGE_ALPHA_LIGHT), composite(rb, CELL_BG_LIGHT, CAGE_ALPHA_LIGHT));
  return Math.min(dDark, dLight);
}

// ─── CAGE-SUMMEN-CHIP: Kontrast ───────────────────────────────────────────────
// Der Summen-Chip (.rchip) hat einen OPAKEN Hintergrund in der Cage-Farbe
// (Helligkeit l−CHIP_L_OFFSET, in beiden Themes identisch). Bei sehr hellen
// Cage-Farben war die weiße Ziffer kaum lesbar. CHIP_L_MIN/MAX/OFFSET klemmen die
// Chip-Helligkeit in ein lesbares Band (identisch zur clamp()-Regel in
// styles.css) — so, dass für JEDE Palettenfarbe entweder Schwarz oder Weiß
// mindestens WCAG-AA-Kontrast (4.5:1) erreicht — und regionChipInk()
// wählt anhand der WAHRGENOMMENEN Helligkeit dieses (opaken) Chips schwarze oder
// weiße Schrift — theme-unabhängig, weil der Chip in beiden Themes gleich aussieht.
export const CHIP_L_MIN = 24, CHIP_L_MAX = 54, CHIP_L_OFFSET = 14;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// WCAG-Relativluminanz (0..1) einer RGB-Farbe (0..255).
function relLuminance([r, g, b]) {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const DARK_INK = '#12182a', LIGHT_INK = '#ffffff';
const DARK_INK_L = relLuminance([0x12, 0x18, 0x2a]), LIGHT_INK_L = relLuminance([255, 255, 255]);
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
// Ideale Schriftfarbe für den Summen-Chip einer Cage-Farbe: wähle dunkel ODER
// weiß — je nachdem, was den HÖHEREN WCAG-Kontrast zum (opaken, geklemmten)
// Chip-Hintergrund liefert. Maximiert die Lesbarkeit über die ganze Palette
// (statt einer festen Helligkeitsschwelle, die bei mittleren Tönen daneben liegt).
export function regionChipInk(color) {
  const lc = clamp(color.l - CHIP_L_OFFSET, CHIP_L_MIN, CHIP_L_MAX);
  const bgL = relLuminance(hslToRgb(color.h, color.s, lc));
  return contrast(DARK_INK_L, bgL) >= contrast(LIGHT_INK_L, bgL) ? DARK_INK : LIGHT_INK;
}

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
  // 'auto' folgt dem System-Theme (prefers-color-scheme, live bei Systemwechsel);
  // 'dark'/'light' = manuelle Wahl. Alte gespeicherte darkMode-Booleans migriert
  // storage.loadSettings() auf die entsprechende explizite Wahl.
  themeMode: 'auto',
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
  winEffect: 'confetti',    // aktive Sieganimation (js/wineffects.js); alles außer
                            // 'confetti' muss im Inventar liegen (Shop-Kauf/Gift),
                            // sonst Fallback auf Confetti (resolveActiveEffect).
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
  skinEnabled: false,        // Master-Schalter (aus per Default: „Feier des Tages"-Skin ist erst manuell/über die Feier-Anzeige aktivierbar)
  skinStyle: 'gradient',     // 'solid' (rotierender Bogen) | 'gradient' (mehrfarbig) | 'rainbow'
  skinColor1: '',            // '' = aus persönlicher Farbe ableiten; sonst Hex
  skinColor2: '',
  skinColor3: '',
  skinSpeed: 6,              // Drehgeschwindigkeit (höher = schneller); 0 = keine Rotation. Dauer = 12/Speed s (6 ⇒ 2 s/Umdrehung)
  skinDirection: 'cw',       // 'cw' | 'ccw'
  skinGlow: 6,               // Leuchtradius px; 0 = kein Glow
  skinThickness: 2.5,        // Ring-/Rahmendicke px
  skinApplyTo: 'both',       // 'kept' (Einkreisen) | 'removed' (Coop-Umrandung) | 'both'
};

// Standard-Spieloption (Start-Screen Vorauswahl)
export const DEFAULT_GAME_OPTIONS = {
  difficulty: 'mittel',
};
