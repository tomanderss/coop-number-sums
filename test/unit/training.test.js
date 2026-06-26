import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findTrainingStep, isFullyTier1Solvable } from '../../js/training.js';
import { generatePuzzle } from '../../js/generator.js';

// Kleines, handgebautes 2x2-Rätsel ohne Regionen, rein über Zeilen/Spalten lösbar.
// values: [[1,5],[5,1]]   rowTargets: [1,1]   colTargets: [1,1]
// Lösung: (0,0) kept, (0,1) removed, (1,0) removed, (1,1) kept
const tinyPuzzle = {
  rows: 2, cols: 2,
  values: [[1, 5], [5, 1]],
  rowTargets: [1, 1],
  colTargets: [1, 1],
  regions: [],
  solution: [[true, false], [false, true]],
};

describe('training.findTrainingStep', () => {
  test('finds a forced move on an empty grid', () => {
    const marks = [['none', 'none'], ['none', 'none']];
    const step = findTrainingStep(tinyPuzzle, marks);
    assert.ok(step);
    assert.ok(['kept', 'removed'].includes(step.action));
    assert.ok(['sumReached', 'allRemainingNeeded', 'tooLarge'].includes(step.reason));
  });

  test('returns null once every cell is correctly marked', () => {
    const marks = [['kept', 'removed'], ['removed', 'kept']];
    assert.equal(findTrainingStep(tinyPuzzle, marks), null);
  });

  test('repeated application solves the tiny puzzle completely', () => {
    assert.equal(isFullyTier1Solvable(tinyPuzzle), true);
  });

  test('a row whose sum is already reached forces the rest to be removed', () => {
    // Zeile 0 (Ziel 3): (0,0)=3 bereits kept -> Rest der Zeile muss removed werden.
    const marks = [['kept', 'none'], ['none', 'none']];
    const step = findTrainingStep(tinyPuzzle, marks);
    assert.equal(step.r, 0);
    assert.equal(step.c, 1);
    assert.equal(step.action, 'removed');
    assert.equal(step.reason, 'sumReached');
    assert.equal(step.group.kind, 'row');
  });

  // `rem` (noch fehlende Summe bis zum Ziel) speist die sokratische Leitfrage —
  // muss je Begründungstyp den richtigen Wert liefern.
  test('reports rem = 0 when the target is already reached (sumReached)', () => {
    const marks = [['kept', 'none'], ['none', 'none']]; // Zeile 0 (Ziel 1) schon erreicht
    const step = findTrainingStep(tinyPuzzle, marks);
    assert.equal(step.reason, 'sumReached');
    assert.equal(step.rem, 0);
  });

  test('reports the remaining sum when a value is too large (tooLarge)', () => {
    const marks = [['none', 'none'], ['none', 'none']]; // leer: Zeile 0 Ziel 1, Zelle (0,1)=5 > 1
    const step = findTrainingStep(tinyPuzzle, marks);
    assert.equal(step.reason, 'tooLarge');
    assert.equal(step.rem, 1);
  });

  test('reports the remaining sum when all open values are needed (allRemainingNeeded)', () => {
    // Zeile 0 (Ziel 1): (0,1) bereits removed -> es bleibt nur (0,0)=1, das exakt 1 ergibt.
    const marks = [['none', 'removed'], ['none', 'none']];
    const step = findTrainingStep(tinyPuzzle, marks);
    assert.equal(step.reason, 'allRemainingNeeded');
    assert.equal(step.action, 'kept');
    assert.equal(step.rem, 1);
  });
});

describe('training.isFullyTier1Solvable on real generated puzzles', () => {
  test('a sehrleicht puzzle is either fully tier-1-solvable or not, without throwing', () => {
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht' });
    assert.equal(typeof isFullyTier1Solvable(puzzle), 'boolean');
  });
});
