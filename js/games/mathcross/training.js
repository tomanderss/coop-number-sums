// training.js — Trainingsmodus: führt Schritt für Schritt durch ein Rätsel und
// erklärt jeden Zug. Nutzt nur die EINFACHSTE Deduktionsstufe (T1: in einer
// Rechnung fehlt genau eine Zahl), damit der Einstieg nachvollziehbar bleibt.
// Reine Logik — app.js setzt den Schritt um (applyTrainingStep).

import { nextForcedStep, equationText } from './hinttutor.js';
import { currentValues } from './model.js';
import { TIER } from './solver.js';

/**
 * Nächster Trainings-Schritt oder null, wenn die einfache Logik nicht mehr
 * weiterkommt (dann darf frei zu Ende gespielt werden).
 * @returns {{r, c, v, key, params}|null}
 */
export function nextTrainingStep(puzzle, placed, restTray, divSym = '÷') {
  const found = nextForcedStep(puzzle, placed, restTray, { maxTier: TIER.DIRECT });
  if (!found) return null;
  const { step } = found;
  const [r, c] = step.cells[0];
  const v = step.values[0];
  const values = currentValues(puzzle, placed);
  return {
    r, c, v,
    key: 'training.step.direct',
    params: { v, eq: step.eq ? equationText(puzzle, step.eq, values, [r, c], divSym) : '' },
  };
}
