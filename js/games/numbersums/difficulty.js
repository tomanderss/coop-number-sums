// games/numbersums/difficulty.js — die Schwierigkeitsstufen von „Number Sums".
//
// Die LEITER selbst (neun Stufen mit Name, Icon und Leitfarbe) ist in allen
// Spielen dieselbe und steht in js/config.js. Hier stehen nur die Werte, die
// dieses Spiel daraus macht: Brettmasse und Erzeugungs-Parameter. Coop Math
// Cross nutzt dieselben neun Stufen, aber ganz andere Bretter (5×4 bis 10×8)
// und ganz andere Parameter (Gleichungen statt Kaefige).

import { mergeLadder } from '../../config.js';

// keepRatio = Anteil der Loesungszellen, minSingleDigitSums = Mindestzahl an
// „Ansatzpunkten" (Summe im Einzelwert-Bereich), maxCageSize = Kaefig-Deckel
// (null = frei), maxTier3Steps = 0 erzwingt ratefreie Raetsel (Tier ≤ 2.5),
// genBudget = Versuche, bevor der Generator aufgibt.
const PARAMS = {
  sehrleicht: { dim: { r: 6,  c: 6  }, keepRatio: 0.50, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  leicht:     { dim: { r: 7,  c: 7  }, keepRatio: 0.48, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  mittel:     { dim: { r: 8,  c: 8  }, keepRatio: 0.46, minSingleDigitSums: 2, maxCageSize: null, maxTier3Steps: 0, genBudget: 2500 },
  schwer:     { dim: { r: 9,  c: 9  }, keepRatio: 0.46, minSingleDigitSums: 3, maxCageSize: 8,    maxTier3Steps: 0, genBudget: 6000 },
  extrem:     { dim: { r: 10, c: 10 }, keepRatio: 0.44, minSingleDigitSums: 4, maxCageSize: 8,    maxTier3Steps: 0, genBudget: 8000 },
  mashallah:  { dim: { r: 11, c: 11 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 12000 },
  // 12×12: schnell generierbar (~65 ms im Schnitt), ohne Raten (Tier ≤ 2.5);
  // Werte 1–9, Cages auf 9 gekappt.
  dikkawas:   { dim: { r: 12, c: 12 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 15000 },
  // 13×13: dank der Hypothese-Sparoptimierung im Generator weiterhin schnell
  // (~0,27 s im Schnitt, <1 s im Worst Case), ohne Raten.
  bismillah:  { dim: { r: 13, c: 13 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 15000 },
  // 14×14: das absolute Maximum. Weiterhin ohne Raten generierbar, aber
  // spuerbar langsamer (Median ~1,3 s, Ausreisser mehrere Sekunden), weil die
  // Akzeptanzrate mit der Feldgroesse sinkt — laeuft off-thread mit Ladebalken.
  rip:        { dim: { r: 14, c: 14 }, keepRatio: 0.40, minSingleDigitSums: 5, maxCageSize: 9,    maxTier3Steps: 0, genBudget: 20000 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Big Numbers"-Modus (Zellwerte 10–19) gibt es nur in diesem Spiel. Fuer ALLE
// Feldgroessen freigegeben (6×6–14×14): per Spike verifiziert, dass die
// Generierung ueberall eindeutig & ratefrei bleibt (Tier ≤ 2.5) und in
// vertretbarer Zeit laeuft (14×14 ~1,3 s Ø, off-thread mit Ladebalken).
export function bigNumbersAllowed(diffId) {
  return !!DIFF_BY_ID[diffId];
}
