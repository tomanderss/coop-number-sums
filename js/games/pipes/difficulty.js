// games/pipes/difficulty.js — die Schwierigkeitsstufen von „Pipes".
//
// Die LEITER (neun Stufen) ist in allen Spielen dieselbe (js/config.js). Hier
// nur die Werte dieses Spiels:
//   dim       Brettgröße (4×4 bis 11×11)
//   branchy   0..1 — wie verzweigt das Netz ist (mehr T-Stücke = schwerer)
//   maxTier   höchste Schlussstufe des Lösers (1 = Rand & Nachbarn,
//             2 = Netz-Schlüsse); geraten wird nie
//   minTier2  so viele Netz-Schlüsse verlangt die Stufe mindestens

import { mergeLadder } from '../../config.js';

const PARAMS = {
  sehrleicht: { dim: { r: 4,  c: 4  }, branchy: 0.2,  maxTier: 1, minTier2: 0 },
  leicht:     { dim: { r: 5,  c: 5  }, branchy: 0.3,  maxTier: 1, minTier2: 0 },
  mittel:     { dim: { r: 6,  c: 6  }, branchy: 0.4,  maxTier: 2, minTier2: 0 },
  schwer:     { dim: { r: 7,  c: 7  }, branchy: 0.5,  maxTier: 2, minTier2: 1 },
  extrem:     { dim: { r: 8,  c: 8  }, branchy: 0.55, maxTier: 2, minTier2: 2 },
  mashallah:  { dim: { r: 8,  c: 8  }, branchy: 0.65, maxTier: 2, minTier2: 3 },
  dikkawas:   { dim: { r: 9,  c: 9  }, branchy: 0.65, maxTier: 2, minTier2: 4 },
  bismillah:  { dim: { r: 10, c: 10 }, branchy: 0.7,  maxTier: 2, minTier2: 5 },
  rip:        { dim: { r: 11, c: 11 }, branchy: 0.75, maxTier: 2, minTier2: 6 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Große Zahlen" gibt es hier nicht.
export function bigNumbersAllowed() { return false; }

export function genOptionsFor(diffId) {
  const d = DIFF_BY_ID[diffId] || DIFFICULTIES[0];
  return { difficulty: d.id, rows: d.dim.r, cols: d.dim.c, branchy: d.branchy, maxTier: d.maxTier, minTier2: d.minTier2, tries: 400, maxMs: 4000 };
}
