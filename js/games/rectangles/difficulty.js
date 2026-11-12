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

// Nutzerwunsch „zu leicht": ab „Mittel“ werden Zahlen als „?“ verdeckt (`hide`
// = höchstens so viele; die Fläche ist dann unbekannt, nur die Lage zählt),
// größere Flächen, mehr Kern-Schlüsse (`minTier2`), ab „Extrem“ zusätzlich
// Widerspruchs-Schlüsse (Stufe 3, `t3Tries` Versuche beim Verdecken).
// Jedes Rätsel bleibt vollständig ohne Raten lösbar.
const PARAMS = {
  sehrleicht: { dim: { r: 5,  c: 5  }, maxArea: 6,  maxTier: 1, minTier2: 0 },
  leicht:     { dim: { r: 6,  c: 6  }, maxArea: 8,  maxTier: 1, minTier2: 0 },
  mittel:     { dim: { r: 7,  c: 7  }, maxArea: 9,  maxTier: 2, minTier2: 1, hide: 2 },
  schwer:     { dim: { r: 8,  c: 8  }, maxArea: 10, maxTier: 2, minTier2: 2, hide: 3 },
  extrem:     { dim: { r: 9,  c: 9  }, maxArea: 12, maxTier: 3, minTier2: 3, hide: 5,  t3Tries: 3 },
  mashallah:  { dim: { r: 10, c: 10 }, maxArea: 14, maxTier: 3, minTier2: 4, hide: 6,  t3Tries: 3 },
  dikkawas:   { dim: { r: 11, c: 11 }, maxArea: 16, maxTier: 3, minTier2: 5, hide: 8,  t3Tries: 4 },
  bismillah:  { dim: { r: 12, c: 12 }, maxArea: 18, maxTier: 3, minTier2: 6, hide: 10, t3Tries: 4 },
  rip:        { dim: { r: 13, c: 13 }, maxArea: 20, maxTier: 3, minTier2: 8, hide: 12, t3Tries: 4 },
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
    hide: d.hide || 0, t3Tries: d.t3Tries || 0,
    tries: 3000,
  };
}
