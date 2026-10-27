import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalExpr, eqCells, eqIds, equationHolds, validPuzzleShape, countMap } from '../../js/games/mathcross/equations.js';

test('evalExpr rechnet Punkt vor Strich', () => {
  assert.equal(evalExpr([2, 3, 4], ['+', '*']), 14);
  assert.equal(evalExpr([2, 3, 4], ['*', '+']), 10);
  assert.equal(evalExpr([20, 4, 2], ['/', '+']), 7);
  assert.equal(evalExpr([7, 5], ['-']), 2);
});

test('evalExpr verbietet Kommazahlen und negative ERGEBNISSE', () => {
  assert.equal(evalExpr([7, 2], ['/']), null, 'Division mit Rest');
  assert.equal(evalExpr([7, 0], ['/']), null, 'Division durch 0');
  assert.equal(evalExpr([3, 8], ['-']), null, 'negatives Ergebnis');
  assert.equal(evalExpr([1, 8, 2], ['-', '*']), null, '1 − 16 wäre negativ');
  assert.equal(evalExpr([8, 2, 3], ['-', '-']), 3);
});

test('evalExpr erlaubt negative ZWISCHENSTÄNDE der Plus/Minus-Kette', () => {
  // Nutzerbeispiel: 4 − 42 ist unterwegs negativ, das Ergebnis aber nicht.
  assert.equal(evalExpr([4, 42, 67], ['-', '+']), 29);
  assert.equal(evalExpr([2, 30, 40], ['-', '+']), 12);
  // Bleibt es am Ende negativ, ist die Rechnung trotzdem ungültig.
  assert.equal(evalExpr([2, 30, 5], ['-', '+']), null);
});

test('eqCells/eqIds folgen der Richtung', () => {
  assert.deepEqual(eqCells({ dir: 'h', r: 1, c: 2, n: 2 }), [[1, 2], [1, 3], [1, 4]]);
  assert.deepEqual(eqCells({ dir: 'v', r: 1, c: 2, n: 2 }), [[1, 2], [2, 2], [3, 2]]);
  assert.deepEqual(eqIds({ dir: 'h', r: 1, c: 0, n: 2 }, 4), [4, 5, 6]);
});

test('equationHolds urteilt erst bei vollständiger Belegung', () => {
  const eq = { dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] };
  assert.equal(equationHolds(eq, [3, 4, null], 3), null);
  assert.equal(equationHolds(eq, [3, 4, 7], 3), true);
  assert.equal(equationHolds(eq, [3, 4, 8], 3), false);
});

test('countMap zählt Multimengen', () => {
  assert.deepEqual([...countMap([2, 2, 5])], [[2, 2], [5, 1]]);
});

const okPuzzle = {
  rows: 1, cols: 3,
  slots: [[{ v: 3, given: true }, { v: 4, given: false }, { v: 7, given: true }]],
  equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
  tray: [4],
};

test('validPuzzleShape akzeptiert gültige und verwirft kaputte Rätsel', () => {
  assert.equal(validPuzzleShape(okPuzzle), true);
  assert.equal(validPuzzleShape(null), false);
  assert.equal(validPuzzleShape({ ...okPuzzle, equations: [] }), false);
  assert.equal(validPuzzleShape({ ...okPuzzle, tray: [Infinity] }), false);
  assert.equal(validPuzzleShape({ ...okPuzzle, equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['?'] }] }), false);
  assert.equal(validPuzzleShape({ ...okPuzzle, equations: [{ dir: 'h', r: 0, c: 2, n: 2, ops: ['+'] }] }), false, 'ragt aus dem Brett');
});
