// games/mathcross/difficulty.js — die Schwierigkeitsstufen von „Math Cross".
//
// Die LEITER selbst (neun Stufen mit Name, Icon und Leitfarbe) ist in allen
// Spielen dieselbe und steht in js/config.js. Hier stehen nur die Werte, die
// dieses Spiel daraus macht. Uebernommen aus Coop Math Cross (js/config.js),
// Werte unveraendert.
//
// Jede Stufe hat ein festes LOGISCHES Raster (Zahl-Felder). Das Anzeige-Raster
// ist doppelt so fein (2*dim-1), weil zwischen je zwei Zahlen ein Operator- bzw.
// Gleichheitszeichen sitzt. Die Schwierigkeit waechst ueber vier Achsen:
//   dim        Brettgroesse (mehr Gleichungen, mehr Vorratssteine)
//   eqTarget   Anzahl Gleichungen (Dichte/Verzahnung des Kreuzworts)
//   ops        erlaubte Rechenarten (erst +/−, dann × und ÷)
//   maxOperand/maxResult  Zahlenraum
//   ternaryChance  Anteil Gleichungen mit DREI Operanden (a op b op c = d,
//              Punkt vor Strich) — erst in den obersten Stufen
// maxTier: hoechste erlaubte Deduktionsstufe des Solvers (siehe solver.js).
//   ≤2.5 = nur Gleichungs-/Kreuzungslogik, 3 = zusaetzlich das Zaehlargument
//   ueber den Vorrat. Geraten wird NIE — der Generator verwirft jedes Raetsel,
//   das die erlaubten Stufen nicht komplett durchloesen.
// blankRatio: Zielanteil der Felder, die der Spieler fuellt (Rest = Vorgaben).

import { mergeLadder } from '../../config.js';

const PARAMS = {
  sehrleicht: { dim: { r: 5, c: 4 },  eqTarget: 8,  ops: ['+', '-'],           maxOperand: 12, maxResult: 80,  ternaryChance: 0,    blankRatio: 0.58, maxTier: 2.5, genBudget: 40 },
  leicht:     { dim: { r: 5, c: 5 },  eqTarget: 11, ops: ['+', '-', '*'],      maxOperand: 12, maxResult: 99,  ternaryChance: 0,    blankRatio: 0.60, maxTier: 3,   genBudget: 50 },
  mittel:     { dim: { r: 6, c: 5 },  eqTarget: 13, ops: ['+', '-', '*', '/'], maxOperand: 15, maxResult: 120, ternaryChance: 0,    blankRatio: 0.60, maxTier: 3,   genBudget: 50 },
  schwer:     { dim: { r: 6, c: 6 },  eqTarget: 15, ops: ['+', '-', '*', '/'], maxOperand: 15, maxResult: 130, ternaryChance: 0,    blankRatio: 0.62, maxTier: 3,   genBudget: 60 },
  extrem:     { dim: { r: 7, c: 6 },  eqTarget: 19, ops: ['+', '-', '*', '/'], maxOperand: 22, maxResult: 150, ternaryChance: 0.10, blankRatio: 0.62, maxTier: 3,   genBudget: 60 },
  mashallah:  { dim: { r: 7, c: 7 },  eqTarget: 23, ops: ['+', '-', '*', '/'], maxOperand: 24, maxResult: 170, ternaryChance: 0.15, blankRatio: 0.64, maxTier: 3,   genBudget: 70 },
  dikkawas:   { dim: { r: 8, c: 7 },  eqTarget: 27, ops: ['+', '-', '*', '/'], maxOperand: 26, maxResult: 190, ternaryChance: 0.20, blankRatio: 0.65, maxTier: 3,   genBudget: 70 },
  bismillah:  { dim: { r: 9, c: 7 },  eqTarget: 32, ops: ['+', '-', '*', '/'], maxOperand: 28, maxResult: 210, ternaryChance: 0.25, blankRatio: 0.66, maxTier: 3,   genBudget: 80 },
  rip:        { dim: { r: 10, c: 8 }, eqTarget: 40, ops: ['+', '-', '*', '/'], maxOperand: 32, maxResult: 250, ternaryChance: 0.35, blankRatio: 0.68, maxTier: 3,   genBudget: 120 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Grosse Zahlen": derselbe Bauplan, nur ein deutlich groesserer Zahlenraum
// (dreistellige Ergebnisse). Fuer ALLE Stufen erlaubt.
export const BIG_OPERAND_MULT = 2.5, BIG_RESULT_MULT = 3;
export function bigNumbersAllowed() { return true; }

// Generator-Optionen einer Schwierigkeit (optional mit „Grosse Zahlen").
export function genOptionsFor(diffId, { bigNumbers = false } = {}) {
  const d = DIFF_BY_ID[diffId] || DIFFICULTIES[0];
  return {
    difficulty: d.id,
    rows: d.dim.r, cols: d.dim.c,
    eqTarget: d.eqTarget,
    ops: d.ops.slice(),
    ternaryChance: d.ternaryChance,
    // „Grosse Zahlen" hebt AUCH die Untergrenze an — sonst waeren die Zahlen
    // zwar erlaubt groesser, blieben aber zufaellig oft klein und der Modus
    // fuehlte sich nicht anders an.
    minOperand: bigNumbers ? Math.max(2, Math.round(d.maxOperand * BIG_OPERAND_MULT * 0.3)) : 1,
    maxOperand: bigNumbers ? Math.round(d.maxOperand * BIG_OPERAND_MULT) : d.maxOperand,
    minResult: 1,
    maxResult: bigNumbers ? Math.round(d.maxResult * BIG_RESULT_MULT) : d.maxResult,
    blankRatio: d.blankRatio,
    maxTier: d.maxTier,
    tries: d.genBudget,
    bigNumbers,
  };
}
