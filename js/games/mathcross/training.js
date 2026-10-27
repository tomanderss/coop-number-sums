// training.js — Trainingsmodus: führt Schritt für Schritt durch ein Rätsel und
// erklärt jeden Zug. Nutzt nur die EINFACHSTE Deduktionsstufe (T1: in einer
// Rechnung fehlt genau eine Zahl), damit der Einstieg nachvollziehbar bleibt.
// Reine Logik — app.js setzt den Schritt um (applyTrainingStep).

import { nextForcedStep, equationText } from './hinttutor.js';
import { currentValues, isBoardSolved } from './model.js';
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

/**
 * Läuft das Rätsel mit der EINFACHSTEN Logik (T1) komplett durch? Nur solche
 * Rätsel taugen fürs Training — sonst bliebe der Tutor mittendrin stehen.
 * Der Trainingsmodus rief diese Funktion schon immer auf, sie existierte aber
 * nicht: „Training" endete in einem leeren Spielbildschirm.
 */
export function isFullyTier1Solvable(puzzle) {
  if (!puzzle || !Array.isArray(puzzle.slots) || !Array.isArray(puzzle.tray)) return false;
  const placed = puzzle.slots.map((row) => row.map(() => null));
  const rest = puzzle.tray.slice();
  // Jeder Schritt füllt genau ein Feld — mehr Schritte als Steine gibt es nicht.
  for (let guard = 0; guard <= puzzle.tray.length; guard++) {
    const step = nextTrainingStep(puzzle, placed, rest);
    if (!step) break;
    placed[step.r][step.c] = step.v;
    const i = rest.indexOf(step.v);
    if (i < 0) return false;          // der Vorrat gibt die Zahl nicht her
    rest.splice(i, 1);
  }
  return isBoardSolved(puzzle, placed);
}
