// games/numberpath/snapshot.js — was die SCHALE über einen gespeicherten
// Spielstand dieses Spiels wissen muss (s. numbersums/snapshot.js). Leicht:
// zieht nur model.js nach.

import { isSolved, progressPct, normalizePuzzle, normalizePath } from './model.js';

export function snapshotSolved(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.clues)) return false;
  return isSolved(p, normalizePath(g.path));
}

export function snapshotProgress(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.clues)) return 0;
  return progressPct(p, normalizePath(g.path));
}

// Aus der CLOUD: Arrays als Objekte mit numerischen Schlüsseln, leere fehlen.
export function healSnapshot(g) {
  if (!g || !g.puzzle) return g;
  const p = normalizePuzzle(g.puzzle);
  const path = g.path == null ? g.path : normalizePath(g.path);
  return p === g.puzzle && path === g.path ? g : { ...g, puzzle: p, path };
}
