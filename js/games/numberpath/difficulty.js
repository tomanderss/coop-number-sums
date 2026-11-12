// games/numberpath/difficulty.js — die Schwierigkeitsstufen von „Number Path".
//
// Die LEITER (neun Stufen) ist in allen Spielen dieselbe (js/config.js). Hier
// nur die Werte dieses Spiels:
//   dim        Brettgröße (5×5 bis 10×10 — mit dem Daumen gut ziehbar)
//   walls      Anzahl Wände auf vom Weg nicht benutzten Kanten (ab „Mittel")
//   maxTier    höchste Schlussstufe des Lösers (1 = nur Inseln/Sackgassen,
//              2 = einen Schritt vorausschauen); geraten wird nie
//   minClues   so wenige Zahlen bleiben mindestens (leichte Stufen behalten
//              mehr Orientierung)
//   minTier2   so viele vorausschauende Schlüsse verlangt die Stufe mindestens

import { mergeLadder } from '../../config.js';

// Nutzerwunsch „zu leicht": ab „Mittel“ WENIGE Zahlen (`sparse`, generator.js
// generateSparse) — eindeutig gemacht durch gezielt gesetzte Wände (höchstens
// `maxWalls`), ab „Schwer“ zusätzlich mit Vorausblick ausgedünnt (`t2Prune`).
// Vorher R.I.P. 10×10 ~18 Zahlen + 11 zufällige Wände; jetzt z.B. 7×7 mit ~4,
// 12×12 mit ~15 Zahlen. Gemessen ≤ 0,7 s, immer ohne Raten lösbar.
const PARAMS = {
  sehrleicht: { dim: { r: 5,  c: 5  }, walls: 0,  maxTier: 1, minClues: 7,  minTier2: 0 },
  leicht:     { dim: { r: 6,  c: 6  }, walls: 0,  maxTier: 1, minClues: 8,  minTier2: 0 },
  mittel:     { dim: { r: 7,  c: 7  }, walls: 3,  maxTier: 1, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 14 },
  schwer:     { dim: { r: 8,  c: 8  }, walls: 4,  maxTier: 2, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 18, t2Prune: 8 },
  extrem:     { dim: { r: 9,  c: 9  }, walls: 6,  maxTier: 2, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 24, t2Prune: 10 },
  mashallah:  { dim: { r: 10, c: 10 }, walls: 6,  maxTier: 2, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 32, t2Prune: 12 },
  dikkawas:   { dim: { r: 11, c: 11 }, walls: 8,  maxTier: 2, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 40, t2Prune: 14 },
  bismillah:  { dim: { r: 12, c: 12 }, walls: 9,  maxTier: 2, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 48, t2Prune: 16 },
  rip:        { dim: { r: 12, c: 12 }, walls: 11, maxTier: 2, minClues: 4,  minTier2: 0, sparse: true, maxWalls: 48, t2Prune: 24 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Große Zahlen" gibt es hier nicht.
export function bigNumbersAllowed() { return false; }

export function genOptionsFor(diffId) {
  const d = DIFF_BY_ID[diffId] || DIFFICULTIES[0];
  return {
    difficulty: d.id, rows: d.dim.r, cols: d.dim.c,
    walls: d.walls, maxTier: d.maxTier, minClues: d.minClues, minTier2: d.minTier2,
    seedDensity: 0.08, tries: 60,
    sparse: !!d.sparse, maxWalls: d.maxWalls, t2Prune: d.t2Prune || 0, sparseSeeds: 2,
  };
}
