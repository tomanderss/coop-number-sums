// games/numberlink/difficulty.js — die Schwierigkeitsstufen von „Number Link".
//
// Die LEITER (neun Stufen) ist in allen Spielen dieselbe (js/config.js). Hier
// nur die Werte dieses Spiels. Nutzerwunsch: mit jeder Stufe ein größeres Brett
// und mehr Paare — die Paarzahl ergibt sich aus dem Brett (der Generator
// verschmilzt Paare, solange das Rätsel eindeutig bleibt; gemessen 5×5 ≈ 3–4,
// 8×8 ≈ 10, 10×10 ≈ 15, 13×13 ≈ 27 Paare).
//   dim       Brettgröße
//   maxTier   höchste Schlussstufe (1 = ein Blick, 2 = ein Schritt voraus)
//   t2Merges  so viele zusätzliche Verschmelzungen probiert der Generator mit
//             Vorausschau — macht die oberen Stufen härter (feste Zahl, nie Zeit)

import { mergeLadder } from '../../config.js';

const PARAMS = {
  sehrleicht: { dim: { r: 5,  c: 5  }, maxTier: 1, t2Merges: 0 },
  leicht:     { dim: { r: 6,  c: 6  }, maxTier: 1, t2Merges: 0 },
  mittel:     { dim: { r: 7,  c: 7  }, maxTier: 2, t2Merges: 4 },
  schwer:     { dim: { r: 8,  c: 8  }, maxTier: 2, t2Merges: 6 },
  extrem:     { dim: { r: 9,  c: 9  }, maxTier: 2, t2Merges: 6 },
  mashallah:  { dim: { r: 10, c: 10 }, maxTier: 2, t2Merges: 6 },
  dikkawas:   { dim: { r: 11, c: 11 }, maxTier: 2, t2Merges: 5 },
  bismillah:  { dim: { r: 12, c: 12 }, maxTier: 2, t2Merges: 4 },
  rip:        { dim: { r: 13, c: 13 }, maxTier: 2, t2Merges: 4 },
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
    minLen: 3, tries: 40, probeBudget: (d.dim.r * d.dim.c) * 4,
  };
}
