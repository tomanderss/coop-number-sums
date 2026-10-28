// games/pipes/snapshot.js — was die SCHALE über einen gespeicherten Spielstand
// dieses Spiels wissen muss (s. numbersums/snapshot.js). Leicht: zieht nur
// model.js nach.

import { isSolved, progressPct, normalizePuzzle, normalizeRot } from './model.js';

const ok = (p) => p && Array.isArray(p.tiles) && Number.isInteger(p.rows) && Number.isInteger(p.cols);
export function snapshotSolved(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!ok(p)) return false;
  return isSolved(p, normalizeRot(g.pipeRot, p.rows * p.cols));
}
export function snapshotProgress(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!ok(p)) return 0;
  return progressPct(p, normalizeRot(g.pipeRot, p.rows * p.cols));
}
// Aus der CLOUD: Arrays als Objekte mit numerischen Schlüsseln, leere fehlen.
export function healSnapshot(g) {
  if (!g || !g.puzzle) return g;
  const p = normalizePuzzle(g.puzzle);
  if (!ok(p)) return g;
  const rot = g.pipeRot == null ? g.pipeRot : normalizeRot(g.pipeRot, p.rows * p.cols);
  return p === g.puzzle && rot === g.pipeRot ? g : { ...g, puzzle: p, pipeRot: rot };
}
