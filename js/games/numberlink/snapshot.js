// games/numberlink/snapshot.js — was die SCHALE über einen gespeicherten
// Spielstand dieses Spiels wissen muss (s. numbersums/snapshot.js). Leicht:
// zieht nur model.js nach.

import { isSolved, progressPct, normalizePuzzle, normalizeLinks, pairCount } from './model.js';

const puzzleOf = (g) => {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  return p && Array.isArray(p.ends) && p.ends.length ? p : null;
};

export function snapshotSolved(g) {
  const p = puzzleOf(g);
  return !!p && isSolved(p, normalizeLinks(g.links, pairCount(p)));
}

export function snapshotProgress(g) {
  const p = puzzleOf(g);
  return p ? progressPct(p, normalizeLinks(g.links, pairCount(p))) : 0;
}

// Aus der CLOUD: Arrays als Objekte mit numerischen Schlüsseln, leere fehlen.
export function healSnapshot(g) {
  if (!g || !g.puzzle) return g;
  const p = normalizePuzzle(g.puzzle);
  const links = Array.isArray(p.ends) ? normalizeLinks(g.links, pairCount(p)) : g.links;
  return p === g.puzzle && links === g.links ? g : { ...g, puzzle: p, links };
}
