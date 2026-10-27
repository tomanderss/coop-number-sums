import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logicalSolve, countSolutions, enumEquation, createSolveState, TIER } from '../../js/games/mathcross/solver.js';
import { solutionValues, blankIds } from '../../js/games/mathcross/equations.js';

// 3 + □ = 7  (waagerecht), Vorrat [4]
function tiny() {
  return {
    rows: 1, cols: 3,
    slots: [[{ v: 3, given: true }, { v: 4, given: false }, { v: 7, given: true }]],
    equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
    tray: [4],
  };
}

// Kreuz: waagerecht  □ + 5 = 12 ; senkrecht  □ - 2 = □
// Das geteilte Feld (0,0) gehört zu beiden Gleichungen — Vorrat [7,5].
function cross() {
  const slots = [
    [{ v: 7, given: false }, { v: 5, given: true }, { v: 12, given: true }],
    [{ v: 2, given: true }, null, null],
    [{ v: 5, given: false }, null, null],
  ];
  return {
    rows: 3, cols: 3, slots,
    equations: [
      { dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] },
      { dir: 'v', r: 0, c: 0, n: 2, ops: ['-'] },
    ],
    tray: [5, 7],
  };
}

test('T1: eine Lücke wird direkt ausgerechnet', () => {
  const res = logicalSolve(tiny());
  assert.equal(res.solved, true);
  assert.equal(res.steps[0].tier, TIER.DIRECT);
  assert.deepEqual(res.values, [3, 4, 7]);
});

test('Kreuzung wird eindeutig gelöst', () => {
  const p = cross();
  const res = logicalSolve(p);
  assert.equal(res.solved, true);
  assert.equal(res.values.filter(v => v != null).length, 5);
  assert.equal(countSolutions(p, 3), 1);
});

test('Widerspruch wird erkannt', () => {
  const p = tiny();
  p.tray = [5]; // 3 + 5 ≠ 7
  const res = logicalSolve(p);
  assert.equal(res.solved, false);
  assert.equal(res.contradiction, true);
});

test('nicht-kommutative Mehrdeutigkeit wird ebenfalls verworfen', () => {
  // 7 - □ = □ mit Vorrat [5,2]: 7-5=2 UND 7-2=5 — zwei gültige Lösungen.
  const p = {
    rows: 1, cols: 3,
    slots: [[{ v: 7, given: true }, { v: 5, given: false }, { v: 2, given: false }]],
    equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['-'] }],
    tray: [5, 2],
  };
  assert.equal(logicalSolve(p).solved, false);
  assert.equal(countSolutions(p, 3), 2);
});

test('mehrdeutiges Rätsel bleibt ungelöst und hat mehrere Lösungen', () => {
  // □ + □ = 9 mit Vorrat [4,5] — 4+5 und 5+4 sind zwei Belegungen.
  const p = {
    rows: 1, cols: 3,
    slots: [[{ v: 4, given: false }, { v: 5, given: false }, { v: 9, given: true }]],
    equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
    tray: [4, 5],
  };
  assert.equal(logicalSolve(p).solved, false);
  assert.equal(countSolutions(p, 3), 2);
});

test('enumEquation berücksichtigt Vorrats-Vielfachheiten', () => {
  // □ + □ = 8, Vorrat enthält die 4 nur EINMAL → 4+4 ist unmöglich.
  const p = {
    rows: 1, cols: 3,
    slots: [[{ v: 2, given: false }, { v: 6, given: false }, { v: 8, given: true }]],
    equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
    tray: [2, 6, 4],
  };
  const st = createSolveState(p);
  const r = enumEquation(p.equations[0], st);
  const pairs = new Set();
  assert.ok(r.total > 0);
  assert.equal(r.cand[0].has(4) && r.cand[1].has(4), false);
  assert.equal(pairs.size, 0);
});

test('Vorrats-Zählargument (T3) löst, wo Gleichungen allein nicht reichen', () => {
  // Zwei getrennte Gleichungen: □ + 1 = 4 und □ + 2 = 5, Vorrat [3,3]
  const p = {
    rows: 3, cols: 3,
    slots: [
      [{ v: 3, given: false }, { v: 1, given: true }, { v: 4, given: true }],
      [null, null, null],
      [{ v: 3, given: false }, { v: 2, given: true }, { v: 5, given: true }],
    ],
    equations: [
      { dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] },
      { dir: 'h', r: 2, c: 0, n: 2, ops: ['+'] },
    ],
    tray: [3, 3],
  };
  const res = logicalSolve(p);
  assert.equal(res.solved, true);
  assert.equal(blankIds(p).length, 2);
  assert.deepEqual(res.values, solutionValues(p));
});

test('maxTier begrenzt die erlaubten Schlussweisen', () => {
  const p = cross();
  const res = logicalSolve(p, { maxTier: 1 });
  assert.ok(res.steps.every(s => s.tier <= 1));
});
