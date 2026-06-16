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

export const DIFFICULTIES = [
  { id: 'sehrleicht', name: 'Sehr Leicht', emoji: '🟢', dim: { r: 6,  c: 6  }, keepRatio: 0.50, minSingleDigitSums: 2 },
  { id: 'leicht',     name: 'Leicht',      emoji: '🟡', dim: { r: 7,  c: 7  }, keepRatio: 0.48, minSingleDigitSums: 2 },
  { id: 'mittel',     name: 'Mittel',      emoji: '🟠', dim: { r: 8,  c: 8  }, keepRatio: 0.46, minSingleDigitSums: 2 },
  { id: 'schwer',     name: 'Schwer',      emoji: '🔴', dim: { r: 9,  c: 9  }, keepRatio: 0.46, minSingleDigitSums: 3 },
  { id: 'extrem',     name: 'Extrem',      emoji: '🟣', dim: { r: 10, c: 10 }, keepRatio: 0.44, minSingleDigitSums: 4 },
  { id: 'mashallah',  name: 'Mashallah',   emoji: '💀', dim: { r: 11, c: 11 }, keepRatio: 0.40, minSingleDigitSums: 5 },
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

// ─── STANDARD-EINSTELLUNGEN ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  darkMode: true,            // Dunkelmodus ist Standard
  errorReveal: 'instant',    // 'instant' = sofort aufdecken | 'onCheck' = erst beim Prüfen
  livesEnabled: true,        // Leben/Herzen aktiv? (false = Zen, unbegrenzt)
  showTimer: true,           // Timer anzeigen
  confirmTool: 'pen',        // Standard-Werkzeug: 'pen' (einkreisen) | 'eraser'
  eraseStyle: 'hide',        // gelöschte Zahl: 'hide' (verschwindet) | 'strike' (durchgestrichen)
};

// Standard-Spieloption (Start-Screen Vorauswahl)
export const DEFAULT_GAME_OPTIONS = {
  difficulty: 'mittel',
};
