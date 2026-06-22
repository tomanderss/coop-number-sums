// training.js — Tier-1-Logikschritte für den Trainings-/Lernmodus.
//
// Repliziert absichtlich (statt zu importieren) nur den einfachsten Teil der
// privaten tier1-Ableitung aus solver.js: kein Subset-Sum (Tier 2), keine
// Hypothesen (Tier 3) — siehe ROADMAP/Plan, v1 ist bewusst auf direkt aus der
// Summen-Constraint ableitbare Schritte beschränkt. findTrainingStep() liefert
// dafür (anders als logicalSolve()) pro Aufruf genau EINEN Schritt mitsamt der
// Begründung, welche Gruppe (Zeile/Spalte/Cage) ihn erzwingt.
import { buildModel, UNK, KEEP, REMOVE } from './solver.js';

function marksToValues(marks) {
  return marks.map(row => row.map(m => m === 'kept' ? KEEP : m === 'removed' ? REMOVE : UNK));
}

// Sucht über alle Gruppen den ersten per Tier-1-Logik erzwingbaren Zug.
// Liefert { r, c, action: 'kept'|'removed', reason, group: {kind, ref, target} }
// oder null, wenn keine Gruppe aktuell einen erzwungenen Zug liefert.
export function findTrainingStep(puzzle, marks) {
  const model = buildModel(puzzle);
  const values = marksToValues(marks);
  for (const g of model.groups) {
    let rem = g.target;
    const und = [];
    for (const ci of g.cells) {
      const cell = model.cells[ci];
      const v = values[cell.r][cell.c];
      if (v === KEEP) rem -= cell.val;
      else if (v === UNK) und.push(ci);
    }
    if (und.length === 0) continue;
    const info = { kind: g.kind, ref: g.ref, target: g.target };
    if (rem === 0) {
      const cell = model.cells[und[0]];
      return { r: cell.r, c: cell.c, action: 'removed', reason: 'sumReached', group: info };
    }
    const undTotal = und.reduce((s, ci) => s + model.cells[ci].val, 0);
    if (undTotal === rem) {
      const cell = model.cells[und[0]];
      return { r: cell.r, c: cell.c, action: 'kept', reason: 'allRemainingNeeded', group: info };
    }
    for (const ci of und) {
      const cell = model.cells[ci];
      if (cell.val > rem) return { r: cell.r, c: cell.c, action: 'removed', reason: 'tooLarge', group: info };
    }
  }
  return null;
}

// Simuliert ein Rätsel rein über wiederholte findTrainingStep()-Aufrufe (ohne
// Tier 2/3) und meldet, ob es sich dadurch VOLLSTÄNDIG lösen lässt — Grundlage
// für die Trainingsmodus-Generierung, die gezielt ein Rätsel sucht, das sich
// komplett mit den einfachen, in Worten erklärbaren Schritten lösen lässt.
export function isFullyTier1Solvable(puzzle) {
  const marks = Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill('none'));
  const total = puzzle.rows * puzzle.cols;
  for (let i = 0; i < total; i++) {
    const step = findTrainingStep(puzzle, marks);
    if (!step) break;
    marks[step.r][step.c] = step.action;
  }
  return marks.every(row => row.every(m => m !== 'none'));
}
