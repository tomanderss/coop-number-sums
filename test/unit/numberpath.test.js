import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canStep, isSolved, progressPct, wallSet, neighbors, validPuzzleShape, normalizePuzzle, normalizePath, reachedClue } from '../../js/games/numberpath/model.js';
import { solveEdges, countSolutions, nextEdgeStep, forcedNext } from '../../js/games/numberpath/solver.js';
import { generatePuzzle, randomHamiltonPath, mulberry32 } from '../../js/games/numberpath/generator.js';
import { DIFFICULTIES, genOptionsFor, bigNumbersAllowed } from '../../js/games/numberpath/difficulty.js';
import { snapshotSolved, snapshotProgress, healSnapshot } from '../../js/games/numberpath/snapshot.js';

// 3×3, Weg als Schlange 0-1-2 / 5-4-3 / 6-7-8 (Zellen r*3+c):
//   [1 . 2]
//   [3 . .]
//   [. . 4]
// Mit nur drei Zahlen (1 und Ende in den Ecken) gäbe es immer eine gespiegelte
// zweite Lösung — die vierte Zahl macht es eindeutig.
const SOL = [0, 1, 2, 5, 4, 3, 6, 7, 8];
const P = {
  rows: 3, cols: 3,
  clues: [{ r: 0, c: 0, n: 1 }, { r: 0, c: 2, n: 2 }, { r: 1, c: 0, n: 3 }, { r: 2, c: 2, n: 4 }],
  walls: [], solution: SOL,
};

describe('Number Path: Regeln', () => {
  test('Start nur auf der 1, dann nur Nachbarn, keine Zelle doppelt', () => {
    assert.equal(canStep(P, [], 0), true);
    assert.equal(canStep(P, [], 4), false);
    assert.equal(canStep(P, [0], 1), true);
    assert.equal(canStep(P, [0], 4), false);        // nicht benachbart (diagonal)
    assert.equal(canStep(P, [0, 1], 0), false);     // schon belegt
  });

  test('Zahlen nur in Reihenfolge, die letzte nur als letztes Feld', () => {
    assert.equal(canStep(P, [0, 1], 2), true);       // die 2 ist die nächste
    assert.equal(canStep(P, [0], 3), false);         // die 3 vor der 2 → gesperrt
    assert.equal(canStep(P, [0, 1, 2, 5, 4, 3, 6, 7], 8), true);
    assert.equal(canStep(P, [0, 1, 2, 5, 4, 3, 6, 7].slice(0, 7), 8), false);
    assert.equal(reachedClue(P, [0, 1, 2, 5]), 2);
  });

  test('Wände sperren', () => {
    const W = { ...P, walls: [{ r: 0, c: 0, d: 'r' }] };
    assert.equal(canStep(W, [0], 1), false);
    assert.ok(wallSet(W).has('0-1'));
    assert.deepEqual(neighbors(W, 0).sort(), [3]);
  });

  test('gelöst nur bei vollem, regelkonformem Weg; Fortschritt = belegte Zellen', () => {
    assert.equal(isSolved(P, SOL), true);
    assert.equal(isSolved(P, SOL.slice(0, 8)), false);
    assert.equal(progressPct(P, SOL.slice(0, 3)), 33);
  });

  test('Struktur-Prüfung und Heilung nach der RTDB', () => {
    assert.equal(validPuzzleShape(P), true);
    assert.equal(validPuzzleShape({ ...P, clues: [{ r: 0, c: 0, n: 2 }, { r: 1, c: 1, n: 3 }] }), false);
    const fromDb = { rows: 3, cols: 3, clues: { ...P.clues }, solution: { ...SOL } };
    const h = normalizePuzzle(fromDb);
    assert.deepEqual(h.clues, P.clues); assert.deepEqual(h.walls, []); assert.deepEqual(h.solution, SOL);
    assert.deepEqual(normalizePath({ 1: 1, 0: 0 }), [0, 1]);
  });
});

describe('Number Path: Löser', () => {
  test('das kleine Rätsel ist eindeutig und ohne Raten lösbar', () => {
    assert.equal(countSolutions(P), 1);
    const res = solveEdges(P);
    assert.equal(res.solved, true);
    assert.deepEqual(res.path, SOL);
  });

  test('mit nur Anfang und Ende gibt es mehrere Wege — der Löser legt sich dann nicht fest', () => {
    const Q = { ...P, clues: [{ r: 0, c: 0, n: 1 }, { r: 2, c: 2, n: 2 }] };
    assert.ok(countSolutions(Q, 5) > 1);
    assert.equal(solveEdges(Q).solved, false);
  });

  test('Training: der nächste erzwungene Schritt ab der Linie', () => {
    assert.equal(nextEdgeStep(P, []).cell, 0);
    let path = [0];
    while (path.length < 9) { const s = nextEdgeStep(P, path); assert.ok(s); path = path.concat(s.cell); }
    assert.deepEqual(path, SOL);
    assert.equal(forcedNext(P, []).cell, 0);
  });
});

describe('Number Path: Generator', () => {
  test('zufälliger Weg über jede Zelle, nur Nachbarschritte', () => {
    const path = randomHamiltonPath(6, 7, mulberry32(5));
    assert.equal(new Set(path).size, 42);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      assert.equal(Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) + Math.abs((a % 7) - (b % 7)), 1);
    }
  });

  test('jede Stufe: eindeutig, ohne Raten lösbar, Wände nur auf ungenutzten Kanten', () => {
    for (const d of DIFFICULTIES) {
      const o = genOptionsFor(d.id);
      const p = generatePuzzle({ difficulty: d.id, seed: 11 });
      assert.equal(p.rows, d.dim.r);
      assert.equal(isSolved(p, p.solution), true, d.id);
      const res = solveEdges(p, { maxTier: o.maxTier });
      assert.equal(res.solved, true, d.id);
      assert.deepEqual(res.path, p.solution, d.id);
      assert.equal(p.walls.length, d.walls, d.id);
      if (d.dim.r <= 6) assert.equal(countSolutions(p), 1, d.id);
      assert.ok(p.clues.length >= 2 && p.clues.length <= p.rows * p.cols / 2, d.id);
    }
  });

  test('derselbe Seed liefert dasselbe Rätsel', () => {
    const a = generatePuzzle({ difficulty: 'schwer', seed: 4 }), b = generatePuzzle({ difficulty: 'schwer', seed: 4 });
    assert.deepEqual(a.clues, b.clues); assert.deepEqual(a.walls, b.walls); assert.deepEqual(a.solution, b.solution);
  });

  test('„Große Zahlen" gibt es hier nicht', () => { assert.equal(bigNumbersAllowed('mittel'), false); });
});

describe('Number Path: Spielstand', () => {
  test('gelöst, Fortschritt, Heilung', () => {
    assert.equal(snapshotSolved({ puzzle: P, path: SOL }), true);
    assert.equal(snapshotSolved({ puzzle: P, path: [0, 1] }), false);
    assert.equal(snapshotProgress({ puzzle: P, path: [0, 1, 2] }), 33);
    const h = healSnapshot({ puzzle: { ...P, walls: undefined }, path: { 0: 0, 1: 1 } });
    assert.deepEqual(h.path, [0, 1]); assert.deepEqual(h.puzzle.walls, []);
    assert.equal(healSnapshot(h), h);
  });
});
