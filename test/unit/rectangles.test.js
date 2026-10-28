import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rectFromCorners, rectValid, isSolved, isFull, progressPct, addRect, rectAt, ownerGrid,
  validPuzzleShape, normalizePuzzle, normalizeRects, cluesIn,
} from '../../js/games/rectangles/model.js';
import { candidates, solveLogic, countSolutions } from '../../js/games/rectangles/solver.js';
import { generatePuzzle, partition, mulberry32 } from '../../js/games/rectangles/generator.js';
import { DIFFICULTIES, genOptionsFor, bigNumbersAllowed } from '../../js/games/rectangles/difficulty.js';
import { snapshotSolved, snapshotProgress, healSnapshot } from '../../js/games/rectangles/snapshot.js';

// 3×3, eindeutig:  [. . 3]   Lösung: Zeile 0 (1×3), Spalte 0..1 der Zeilen 1–2 (2×2)
//                  [. 4 .]           und rechts unten 2×1
//                  [. . 2]   (mit der 3 links oben gäbe es ZWEI Lösungen — der
//                            Löser erkennt das, s. unten)
const P = {
  rows: 3, cols: 3,
  clues: [{ r: 0, c: 2, n: 3 }, { r: 1, c: 1, n: 4 }, { r: 2, c: 2, n: 2 }],
  solution: [{ r: 0, c: 0, h: 1, w: 3 }, { r: 1, c: 0, h: 2, w: 2 }, { r: 1, c: 2, h: 2, w: 1 }],
};

describe('Rectangles: Regeln', () => {
  test('Rechteck aus zwei Ecken, egal in welche Richtung gezogen', () => {
    assert.deepEqual(rectFromCorners(2, 3, 0, 1), { r: 0, c: 1, h: 3, w: 3 });
    assert.deepEqual(rectFromCorners(1, 1, 1, 1), { r: 1, c: 1, h: 1, w: 1 });
  });

  test('ein Rechteck braucht genau eine Zahl, und die Zahl ist seine Fläche', () => {
    assert.equal(rectValid(P, { r: 0, c: 0, h: 1, w: 3 }), true);
    assert.equal(rectValid(P, { r: 0, c: 1, h: 1, w: 2 }), false);   // zu klein
    assert.equal(rectValid(P, { r: 0, c: 1, h: 2, w: 2 }), false);   // zwei Zahlen
    assert.equal(rectValid(P, { r: 0, c: 0, h: 1, w: 2 }), false);   // keine Zahl
    assert.deepEqual(cluesIn(P, { r: 0, c: 0, h: 3, w: 3 }), [0, 1, 2]);
  });

  test('gelöst nur, wenn alles bedeckt und jedes Rechteck stimmt', () => {
    assert.equal(isSolved(P, P.solution), true);
    assert.equal(isSolved(P, P.solution.slice(0, 2)), false);
    // voll bedeckt, aber falsch zerlegt
    const wrong = [{ r: 0, c: 0, h: 3, w: 1 }, { r: 0, c: 1, h: 2, w: 2 }, { r: 2, c: 1, h: 1, w: 2 }];
    assert.equal(isFull(P, wrong), true);
    assert.equal(isSolved(P, wrong), false);
  });

  test('Fortschritt = bedeckte Zellen', () => {
    assert.equal(progressPct(P, []), 0);
    assert.equal(progressPct(P, [P.solution[0]]), 33);
    assert.equal(progressPct(P, P.solution), 100);
  });

  test('Überziehen ersetzt die überdeckten Rechtecke', () => {
    const a = { id: 'a', r: 0, c: 0, h: 1, w: 3 }, b = { id: 'b', r: 1, c: 2, h: 2, w: 1 };
    const { rects, removed } = addRect([a, b], { id: 'c', r: 0, c: 2, h: 2, w: 1 });
    assert.deepEqual(rects.map((q) => q.id), ['c']);
    assert.deepEqual(removed.map((q) => q.id), ['a', 'b']);
    assert.equal(rectAt(rects, 1, 2).id, 'c');
    assert.equal(rectAt(rects, 2, 0), null);
    assert.equal(ownerGrid(P, rects)[0][2], 0);
  });

  test('Struktur-Prüfung und Heilung nach der RTDB', () => {
    assert.equal(validPuzzleShape(P), true);
    assert.equal(validPuzzleShape({ ...P, clues: [] }), false);
    assert.equal(validPuzzleShape({ ...P, solution: [{ r: 0, c: 0, h: 9, w: 1 }, ...P.solution.slice(1)] }), false);
    const fromDb = { ...P, clues: { 0: P.clues[0], 1: P.clues[1], 2: P.clues[2] } };
    assert.deepEqual(normalizePuzzle(fromDb).clues, P.clues);
    assert.equal(normalizePuzzle(P), P);
    assert.deepEqual(normalizeRects({ 1: P.solution[1], 0: P.solution[0], 2: null }), [P.solution[0], P.solution[1]]);
  });
});

describe('Rectangles: Löser', () => {
  test('Kandidaten: Fläche stimmt, Zahl liegt darin, keine fremde Zahl', () => {
    const cands = candidates(P);
    for (const [k, list] of cands.entries()) for (const q of list) {
      assert.equal(q.h * q.w, P.clues[k].n);
      assert.deepEqual(cluesIn(P, q), [k]);
    }
  });

  test('löst das kleine Rätsel ohne Raten und findet die Lösung', () => {
    const res = solveLogic(P);
    assert.equal(res.solved, true);
    assert.deepEqual(res.rects, P.solution);
    assert.ok(res.steps.length > 0);
    assert.ok(res.steps.every((s) => s.tier === 1 || s.tier === 2));
  });

  test('genau eine Lösung', () => {
    assert.equal(countSolutions(P), 1);
    // Die 3 links oben: zwei Zerlegungen — der Löser darf das nicht „lösen".
    const twice = { ...P, clues: [{ r: 0, c: 0, n: 3 }, ...P.clues.slice(1)] };
    assert.equal(countSolutions(twice), 2);
    assert.equal(solveLogic(twice).solved, false);
    // Ohne die 2 rechts unten gibt es keine Zerlegung mehr.
    assert.equal(countSolutions({ ...P, clues: P.clues.slice(0, 2), solution: P.solution.slice(0, 2) }), 0);
  });

  test('bekannte Rechtecke gelten als Ausgangslage', () => {
    const res = solveLogic(P, { known: [{ k: 0, ...P.solution[0] }] });
    assert.equal(res.solved, true);
    const bad = solveLogic(P, { known: [{ k: 0, r: 0, c: 0, h: 3, w: 1 }] });
    assert.equal(bad.solved, false);
  });
});

describe('Rectangles: Generator', () => {
  test('Zerlegung bedeckt das Brett lückenlos, Flächen im Rahmen', () => {
    const rng = mulberry32(42);
    let rects = null;
    while (!rects) rects = partition(8, 8, rng, { minArea: 2, maxArea: 10 });
    const seen = new Set();
    for (const q of rects) {
      assert.ok(q.h * q.w >= 2 && q.h * q.w <= 10);
      for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) {
        assert.ok(!seen.has(r * 8 + c)); seen.add(r * 8 + c);
      }
    }
    assert.equal(seen.size, 64);
  });

  test('jede Stufe: eindeutig, ohne Raten lösbar, Härte-Vorgabe erfüllt', () => {
    for (const d of DIFFICULTIES) {
      const o = genOptionsFor(d.id);
      for (const seed of [1, 2]) {
        const p = generatePuzzle({ difficulty: d.id, seed });
        assert.equal(p.rows, d.dim.r); assert.equal(p.cols, d.dim.c);
        assert.equal(isSolved(p, p.solution), true, d.id);
        const res = solveLogic(p, { maxTier: o.maxTier });
        assert.equal(res.solved, true, d.id);
        assert.ok(res.tier2Steps >= o.minTier2, d.id);
        assert.ok(p.clues.every((k) => k.n >= 2 && k.n <= o.maxArea), d.id);
        if (d.dim.r <= 8) assert.equal(countSolutions(p), 1, d.id);
      }
    }
  });

  test('derselbe Seed liefert dasselbe Rätsel (Wettkampf, Verlauf)', () => {
    const a = generatePuzzle({ difficulty: 'schwer', seed: 777 });
    const b = generatePuzzle({ difficulty: 'schwer', seed: 777 });
    assert.deepEqual(a.clues, b.clues);
    assert.deepEqual(a.solution, b.solution);
    assert.notDeepEqual(generatePuzzle({ difficulty: 'schwer', seed: 778 }).clues, a.clues);
  });

  test('„Große Zahlen" gibt es hier nicht', () => {
    assert.equal(bigNumbersAllowed('mittel'), false);
  });
});

describe('Rectangles: Spielstand', () => {
  test('gelöst, Fortschritt und Heilung', () => {
    assert.equal(snapshotSolved({ puzzle: P, rects: P.solution }), true);
    assert.equal(snapshotSolved({ puzzle: P, rects: [P.solution[0]] }), false);
    assert.equal(snapshotSolved({ puzzle: P }), false);
    assert.equal(snapshotProgress({ puzzle: P, rects: [P.solution[1]] }), 44);
    const g = { puzzle: { ...P, clues: { ...P.clues } }, rects: { 0: P.solution[0] } };
    const h = healSnapshot(g);
    assert.ok(Array.isArray(h.puzzle.clues) && Array.isArray(h.rects));
    assert.equal(healSnapshot(h), h);
  });
});
