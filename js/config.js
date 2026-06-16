// config.js — statische Spielkonfiguration: Größen, Schwierigkeiten, Farben, Defaults
// (Analog zu werwolf-app/js/data.js — reine Daten, keine Logik)

// ─── FELDGRÖSSEN ──────────────────────────────────────────────────────────────
// Jede Stufe bietet mehrere konkrete Dimensionen; beim Start wird zufällig eine
// aus dem Bereich gewählt (oder die kleinste, falls Generierung schwierig wird).
export const SIZE_TIERS = [
  { id: 'klein',   name: 'Klein',          emoji: '🔹', desc: 'Schnelle Runden, 4×4–5×5',
    dims: [{ r: 4, c: 4 }, { r: 5, c: 5 }] },
  { id: 'mittel',  name: 'Mittel',         emoji: '🔷', desc: 'Klassische Größe, 6×6',
    dims: [{ r: 6, c: 6 }] },
  { id: 'gross',   name: 'Groß',           emoji: '🟦', desc: 'Mehr Regionen, 7×7–8×8',
    dims: [{ r: 7, c: 7 }, { r: 8, c: 8 }] },
  { id: 'extrem',  name: 'Extrem',         emoji: '🟪', desc: 'Lange Rätsel, 9×9–10×10',
    dims: [{ r: 9, c: 9 }, { r: 10, c: 10 }] },
  { id: 'unendlich', name: 'Unendlichkeit', emoji: '♾️', desc: 'Riesig, 11×11–12×12',
    dims: [{ r: 11, c: 11 }, { r: 12, c: 12 }] },
];

export const SIZE_BY_ID = Object.fromEntries(SIZE_TIERS.map(s => [s.id, s]));

// ─── SCHWIERIGKEITEN ──────────────────────────────────────────────────────────
// maxVal     : größter Zahlenwert in einer Zelle
// keepRatio  : Anteil der Zellen, die zur Lösung gehören (eingekreist werden)
// lives      : Startleben (Herzen)
// allowHypo  : erlaubt Tier-3-Deduktion (Hypothese/Widerspruch) → schwerer
// (Cages bedecken IMMER das ganze Feld, je 8 Zellen — siehe generator.js)
export const DIFFICULTIES = [
  { id: 'leicht',  name: 'Leicht',  emoji: '🟢', maxVal: 6, keepRatio: 0.62,
    lives: 5, allowHypo: false, hints: 5 },
  { id: 'mittel',  name: 'Mittel',  emoji: '🟡', maxVal: 7, keepRatio: 0.56,
    lives: 4, allowHypo: false, hints: 3 },
  { id: 'schwer',  name: 'Schwer',  emoji: '🟠', maxVal: 9, keepRatio: 0.52,
    lives: 3, allowHypo: false, hints: 2 },
  { id: 'experte', name: 'Experte', emoji: '🔴', maxVal: 9, keepRatio: 0.48,
    lives: 3, allowHypo: true,  hints: 1 },
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
  haptics: true,             // Vibration bei Aktionen (falls Gerät unterstützt)
  showTimer: true,           // Timer anzeigen
  confirmTool: 'pen',        // Standard-Werkzeug: 'pen' (einkreisen) | 'eraser'
};

// Standard-Spieloptionen (Start-Screen Vorauswahl)
export const DEFAULT_GAME_OPTIONS = {
  size: 'mittel',
  difficulty: 'mittel',
};
