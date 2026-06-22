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
// 0 = nur reine Stufe-1/2-Logik (kein Raten-artiger Schritt nötig).
// genBudget: maximale Generierungs-Versuche, bevor mit neuem Seed neu gestartet
// wird — höhere Schwierigkeiten brauchen mehr Versuche, weil Cage-Kappung und
// Tier-3-Limit die Akzeptanzrate senken.
export const DIFFICULTIES = [
  { id: 'sehrleicht', name: 'Sehr Leicht', emoji: '🟢', dim: { r: 6,  c: 6  }, keepRatio: 0.50, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  { id: 'leicht',     name: 'Leicht',      emoji: '🟡', dim: { r: 7,  c: 7  }, keepRatio: 0.48, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  { id: 'mittel',     name: 'Mittel',      emoji: '🟠', dim: { r: 8,  c: 8  }, keepRatio: 0.46, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  { id: 'schwer',     name: 'Schwer',      emoji: '🔴', dim: { r: 9,  c: 9  }, keepRatio: 0.46, minSingleDigitSums: 3, maxCageSize: 8,    maxTier3Steps: 2, genBudget: 6000 },
  { id: 'extrem',     name: 'Extrem',      emoji: '🟣', dim: { r: 10, c: 10 }, keepRatio: 0.44, minSingleDigitSums: 4, maxCageSize: 8,    maxTier3Steps: 4, genBudget: 8000 },
  { id: 'mashallah',  name: 'Mashallah',   emoji: '💀', dim: { r: 11, c: 11 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 6, genBudget: 10000 },
];

export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));

// ─── REGIONEN-FARBPALETTE ─────────────────────────────────────────────────────
// Kräftige, klar unterscheidbare Töne (funktionieren in Hell & Dunkel).
export const REGION_COLORS = [
  { name: 'rose',   h: 340, s: 82, l: 60 },
  { name: 'amber',  h: 38,  s: 92, l: 55 },
  { name: 'emerald',h: 152, s: 64, l: 46 },
  { name: 'sky',    h: 199, s: 89, l: 52 },
  { name: 'violet', h: 263, s: 72, l: 62 },
  { name: 'teal',   h: 174, s: 70, l: 44 },
  { name: 'orange', h: 22,  s: 92, l: 56 },
  { name: 'fuchsia',h: 292, s: 70, l: 60 },
  { name: 'lime',   h: 88,  s: 62, l: 48 },
  { name: 'cyan',   h: 188, s: 78, l: 48 },
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

// ─── STANDARD-EINSTELLUNGEN ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  darkMode: true,            // Dunkelmodus ist Standard
  errorReveal: 'instant',    // 'instant' = sofort aufdecken | 'onCheck' = erst beim Prüfen
  livesEnabled: true,        // Leben/Herzen aktiv? (false = Zen, unbegrenzt)
  showTimer: true,           // Timer anzeigen
  confirmTool: 'pen',        // Standard-Werkzeug: 'pen' (einkreisen) | 'eraser'
  eraseStyle: 'hide',        // gelöschte Zahl: 'hide' (verschwindet) | 'strike' (durchgestrichen)
  coopName: '',              // eigener Anzeigename im Coop-Modus
  coopMyColor: '#3b82f6',    // eigene Spielerfarbe im Coop-Modus (Default: Blau)
  coopRemovedOutline: true,  // farbige Umrandung an gelöschten Zellen, die zeigt, wer sie gelöscht hat (rein optisch)
  language: null,           // UI-Sprache; null = noch nicht erkannt/gewählt -> Auto-Detect via navigator.language
  colorBlindMode: false,    // farbenblind-sichere Coop-Spielerpalette (COOP_COLORS_CB) statt der Standardpalette
};

// Standard-Spieloption (Start-Screen Vorauswahl)
export const DEFAULT_GAME_OPTIONS = {
  difficulty: 'mittel',
};
