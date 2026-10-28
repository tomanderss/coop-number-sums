// games/rectangles/snapshot.js — was die SCHALE über einen gespeicherten
// Spielstand dieses Spiels wissen muss (s. numbersums/snapshot.js). Leicht:
// zieht nur model.js nach, keinen Löser/Generator.

import { isSolved, progressPct, normalizePuzzle, normalizeRects } from './model.js';

// Gelöst = jede Zelle genau einmal bedeckt, jedes Rechteck regelkonform.
export function snapshotSolved(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.clues)) return false;
  return isSolved(p, normalizeRects(g.rects));
}

// Fortschritt in Prozent = bedeckte Zellen (Belegen ist Fortschritt; ob es
// aufgeht, zeigt erst das volle Brett).
export function snapshotProgress(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.clues)) return 0;
  return progressPct(p, normalizeRects(g.rects));
}

// Ein aus der CLOUD stammender Stand kann Arrays als Objekte mit numerischen
// Schlüsseln tragen (die RTDB kennt keine Arrays) — rein und idempotent heilen.
export function healSnapshot(g) {
  if (!g || !g.puzzle) return g;
  const p = normalizePuzzle(g.puzzle);
  const rects = g.rects == null ? g.rects : normalizeRects(g.rects);
  return p === g.puzzle && rects === g.rects ? g : { ...g, puzzle: p, rects };
}
