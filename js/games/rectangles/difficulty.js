// games/rectangles/difficulty.js — die Schwierigkeitsstufen von „Rectangles".
//
// Die LEITER (neun Stufen, Name, Icon, Leitfarbe) ist in allen Spielen dieselbe
// (js/config.js). Hier stehen nur die Werte dieses Spiels:
//   dim       Brettgröße
//   maxArea   größte Fläche eines Rechtecks (größere Zahlen = mehr Formen je Zahl)
//   maxTier   höchste erlaubte Schlussstufe des Lösers (s. solver.js) — 1 nur
//             „eine Form / eine Zahl", 2 zusätzlich „sicherer Kern". Geraten
//             wird nie.
//   minTier2  so viele Kern-Schlüsse muss das Rätsel MINDESTENS verlangen (macht
//             die oberen Stufen spürbar schwerer statt nur größer)
// Kleinste Fläche ist immer 2: eine „1" ist kein Rätsel.

import { mergeLadder } from '../../config.js';

const PARAMS = {
  sehrleicht: { dim: { r: 5,  c: 5  }, maxArea: 6,  maxTier: 1, minTier2: 0 },
  leicht:     { dim: { r: 6,  c: 6  }, maxArea: 8,  maxTier: 1, minTier2: 0 },
  mittel:     { dim: { r: 7,  c: 7  }, maxArea: 9,  maxTier: 2, minTier2: 0 },
  schwer:     { dim: { r: 8,  c: 8  }, maxArea: 10, maxTier: 2, minTier2: 1 },
  extrem:     { dim: { r: 9,  c: 9  }, maxArea: 12, maxTier: 2, minTier2: 2 },
  mashallah:  { dim: { r: 10, c: 10 }, maxArea: 12, maxTier: 2, minTier2: 3 },
  dikkawas:   { dim: { r: 11, c: 11 }, maxArea: 14, maxTier: 2, minTier2: 4 },
  bismillah:  { dim: { r: 12, c: 12 }, maxArea: 16, maxTier: 2, minTier2: 5 },
  rip:        { dim: { r: 13, c: 13 }, maxArea: 18, maxTier: 2, minTier2: 6 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Große Zahlen" gibt es in diesem Spiel nicht (die Zahl IST die Fläche).
export function bigNumbersAllowed() { return false; }

// Generator-Optionen einer Schwierigkeit.
export function genOptionsFor(diffId) {
  const d = DIFF_BY_ID[diffId] || DIFFICULTIES[0];
  return {
    difficulty: d.id, rows: d.dim.r, cols: d.dim.c,
    minArea: 2, maxArea: d.maxArea, maxAspect: 5,
    maxTier: d.maxTier, minTier2: d.minTier2,
    tries: 3000,
  };
}
