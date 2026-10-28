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

const PARAMS = {
  sehrleicht: { dim: { r: 5,  c: 5  }, walls: 0,  maxTier: 1, minClues: 7,  minTier2: 0 },
  leicht:     { dim: { r: 6,  c: 6  }, walls: 0,  maxTier: 1, minClues: 8,  minTier2: 0 },
  mittel:     { dim: { r: 6,  c: 6  }, walls: 3,  maxTier: 2, minClues: 6,  minTier2: 0 },
  schwer:     { dim: { r: 7,  c: 7  }, walls: 4,  maxTier: 2, minClues: 6,  minTier2: 1 },
  extrem:     { dim: { r: 7,  c: 7  }, walls: 6,  maxTier: 2, minClues: 5,  minTier2: 2 },
  mashallah:  { dim: { r: 8,  c: 8  }, walls: 6,  maxTier: 2, minClues: 6,  minTier2: 2 },
  dikkawas:   { dim: { r: 8,  c: 8  }, walls: 8,  maxTier: 2, minClues: 5,  minTier2: 3 },
  bismillah:  { dim: { r: 9,  c: 9  }, walls: 9,  maxTier: 2, minClues: 6,  minTier2: 3 },
  rip:        { dim: { r: 10, c: 10 }, walls: 11, maxTier: 2, minClues: 6,  minTier2: 4 },
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
    seedDensity: 0.08, tries: 60, maxMs: 4000,
  };
}
