// games/gems/snapshot.js — was die SCHALE über einen gespeicherten Spielstand
// dieses Spiels wissen muss (s. numbersums/snapshot.js). Leicht: zieht nur
// model.js nach.

import { isSolved, progressPct, normalizePuzzle, normalizeCells } from './model.js';

export function snapshotSolved(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.regions)) return false;
  return isSolved(p, normalizeCells(g.gemCells, p.rows));
}

export function snapshotProgress(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.regions)) return 0;
  return progressPct(p, normalizeCells(g.gemCells, p.rows));
}

// Aus der CLOUD: Arrays als Objekte mit numerischen Schlüsseln.
export function healSnapshot(g) {
  if (!g || !g.puzzle) return g;
  const p = normalizePuzzle(g.puzzle);
  const cells = g.gemCells == null || !p || !p.rows ? g.gemCells : normalizeCells(g.gemCells, p.rows);
  return p === g.puzzle && cells === g.gemCells ? g : { ...g, puzzle: p, gemCells: cells };
}
