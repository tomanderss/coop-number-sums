// hinttutor.js — findet den naechsten ERZWUNGENEN Zug und beschreibt ihn.
//
// Reine Logik (keine UI, kein Vue). `nextForcedStep(puzzle, placed, tray)` sucht
// die am einfachsten erklaerbare Deduktion, die aus der AKTUELLEN Lage erzwungen
// ist (Solver-Stufen T1 → T2 → T2.5 → T3); `equationText` setzt eine Gleichung
// mit den KONKRETEN Zahlen des Bretts als lesbaren Text.
//
// Genutzt vom TRAININGSmodus (js/training.js). Die Tipp-Funktion im Spiel ist
// entfallen (Nutzerwunsch) — mit ihr buildHintTutorial, das daraus eine
// Schritt-fuer-Schritt-Kette baute.

import { eqCells, evalExpr } from './equations.js';
import { OP_SYMBOL, currentValues, equationsAt } from './model.js';
import { logicalSolve, TIER } from './solver.js';

/** Eine Gleichung als Text, mit „?" für noch leere Felder. */
// `divSym` beschriftet die Division im Erklaertext — dieselbe Nutzer-Wahl wie
// auf dem Brett (DIV_STYLES in config.js), damit Text und Feld nicht
// auseinanderlaufen. Default = Obelus, jeder Alt-Aufruf bleibt unveraendert.
export function equationText(puzzle, eq, values, highlight = null, divSym = '÷') {
  const cells = eqCells(eq);
  const cols = puzzle.cols;
  const parts = [];
  for (let i = 0; i <= eq.n; i++) {
    const [r, c] = cells[i];
    const v = values[r * cols + c];
    const isTarget = highlight && highlight[0] === r && highlight[1] === c;
    parts.push(v == null ? (isTarget ? '?' : '□') : String(v));
    if (i < eq.n - 1) parts.push(eq.ops[i] === '/' ? divSym : OP_SYMBOL[eq.ops[i]]);
    else if (i === eq.n - 1) parts.push('=');
  }
  return parts.join(' ');
}

function eqIndexOf(puzzle, eq) {
  return puzzle.equations.findIndex(e => e.dir === eq.dir && e.r === eq.r && e.c === eq.c && e.n === eq.n);
}

/**
 * Nächster erzwungener Schritt aus der laufenden Partie.
 * @param {object} puzzle
 * @param {Array<Array<number|null>>} placed
 * @param {number[]} restTray  noch nicht gelegte Zahlen
 */
export function nextForcedStep(puzzle, placed, restTray, opts = {}) {
  const values = currentValues(puzzle, placed);
  const res = logicalSolve(puzzle, { maxTier: opts.maxTier ?? 3, from: { values, pool: restTray } });
  return res.steps.length ? { step: res.steps[0], values } : null;
}
