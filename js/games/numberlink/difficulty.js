// games/numberlink/difficulty.js — die Schwierigkeitsstufen von „Number Link".
//
// Die LEITER (neun Stufen) ist in allen Spielen dieselbe (js/config.js). Hier
// nur die Werte dieses Spiels.
//   dim       Brettgröße
//   maxTier   höchste Schlussstufe (1 = ein Blick, 2 = ein Schritt voraus)
//   t2Merges  (klassisch) zusätzliche Verschmelzungen mit Vorausschau
//   walls     obere Stufen: LANGE Linien (Ziel `lineLen` Zellen), eindeutig
//             gemacht durch Wände (generator.js generateWalled);
//             t2Prune = so viele Wände versucht der Generator mit Vorausblick
//             wegzunehmen (macht das Rätsel härter, kostet Zeit)
//
// Nutzerwunsch „zu leicht": vorher hatte jede Stufe ~6,5 Zellen je Linie, nur
// das Brett wuchs. Jetzt: Sehr leicht/Leicht wie bisher, ab Mittel lange
// Linien mit Wänden, ab Extrem zusätzlich Schlüsse mit Vorausblick.

import { mergeLadder } from '../../config.js';

const PARAMS = {
  sehrleicht: { dim: { r: 5,  c: 5  }, maxTier: 1, t2Merges: 0 },
  leicht:     { dim: { r: 6,  c: 6  }, maxTier: 1, t2Merges: 0 },
  mittel:     { dim: { r: 8,  c: 8  }, maxTier: 1, t2Merges: 0, walls: true, lineLen: 9 },
  schwer:     { dim: { r: 9,  c: 9  }, maxTier: 1, t2Merges: 0, walls: true, lineLen: 11 },
  extrem:     { dim: { r: 10, c: 10 }, maxTier: 2, t2Merges: 4, walls: true, lineLen: 12, t2Prune: 10 },
  mashallah:  { dim: { r: 11, c: 11 }, maxTier: 2, t2Merges: 4, walls: true, lineLen: 13, t2Prune: 12 },
  dikkawas:   { dim: { r: 12, c: 12 }, maxTier: 2, t2Merges: 4, walls: true, lineLen: 14, t2Prune: 14 },
  bismillah:  { dim: { r: 13, c: 13 }, maxTier: 2, t2Merges: 4, walls: true, lineLen: 15, t2Prune: 16 },
  rip:        { dim: { r: 13, c: 13 }, maxTier: 2, t2Merges: 4, walls: true, lineLen: 18, t2Prune: 24 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Große Zahlen" gibt es hier nicht.
export function bigNumbersAllowed() { return false; }

export function genOptionsFor(diffId) {
  const d = DIFF_BY_ID[diffId] || DIFFICULTIES[0];
  return {
    difficulty: d.id, rows: d.dim.r, cols: d.dim.c,
    maxTier: d.maxTier, t2Merges: d.t2Merges,
    walls: !!d.walls, lineLen: d.lineLen, t2Prune: d.t2Prune || 0,
    minLen: 3, tries: 40, probeBudget: (d.dim.r * d.dim.c) * 4,
  };
}
