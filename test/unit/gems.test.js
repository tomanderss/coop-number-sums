import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY, CROSS, GEM, neighbors8, clash, conflicts, isFull, isSolved, progressPct,
  validPuzzleShape, normalizePuzzle, normalizeCells,
} from '../../js/games/gems/model.js';
import { solveLogic, countSolutions, nextDeduction } from '../../js/games/gems/solver.js';
import { generatePuzzle, randomSolution, mulberry32 } from '../../js/games/gems/generator.js';
import { DIFFICULTIES, genOptionsFor, bigNumbersAllowed } from '../../js/games/gems/difficulty.js';
import { snapshotSolved, snapshotProgress, healSnapshot } from '../../js/games/gems/snapshot.js';

// Ein kleines eindeutiges 5×5-Rätsel (vom Generator, festgehalten).
const P5 = generatePuzzle({ size: 5, maxTier: 1, seed: 7 });
const solvedCells = (p) => { const c = new Array(p.rows * p.rows).fill(EMPTY); for (const i of p.solution) c[i] = GEM; return c; };

describe('Gem Hunt: Regeln', () => {
  test('Nachbarn und Konflikte (Zeile, Spalte, Käfig, Berührung über Eck)', () => {
    assert.deepEqual(neighbors8(5, 0).sort((a, b) => a - b), [1, 5, 6]);
    const p = { rows: 5, cols: 5, regions: Array.from({ length: 25 }, (_, i) => Math.floor(i / 5)) };
    assert.ok(clash(p, 0, 4));        // gleiche Zeile
    assert.ok(clash(p, 0, 20));       // gleiche Spalte
    assert.ok(clash(p, 0, 6));        // über Eck
    assert.ok(!clash(p, 0, 7));       // weit genug weg, andere Zeile/Spalte/Käfig
  });
  test('gelöst = n Steine ohne Konflikt; voll ab n Steinen; Fortschritt = Steine', () => {
    const c = solvedCells(P5);
    assert.ok(isSolved(P5, c));
    assert.ok(isFull(P5, c));
    assert.equal(progressPct(P5, c), 100);
    const wrong = c.slice(); wrong[P5.solution[0]] = EMPTY; wrong[P5.solution[0] + (P5.solution[0] % 5 < 4 ? 1 : -1)] = GEM;
    assert.ok(!isSolved(P5, wrong));
    assert.ok(conflicts(P5, wrong).size > 0);
    assert.equal(progressPct(P5, new Array(25).fill(CROSS)), 0);
  });
  test('Struktur-Prüfung und Heilen von RTDB-Objekten', () => {
    assert.ok(validPuzzleShape(P5));
    assert.ok(!validPuzzleShape({ ...P5, regions: P5.regions.slice(1) }));
    const obj = { ...P5, regions: Object.fromEntries(P5.regions.map((v, i) => [i, v])), solution: { 0: P5.solution[0], 1: P5.solution[1], 2: P5.solution[2], 3: P5.solution[3], 4: P5.solution[4] } };
    assert.deepEqual(normalizePuzzle(obj).regions, P5.regions);
    assert.equal(normalizePuzzle(P5), P5);
    assert.deepEqual(normalizeCells({ 3: 2, 7: 1 }, 3), [0, 0, 0, 2, 0, 0, 0, 1, 0]);
    assert.equal(normalizeCells(null, 2).length, 4);
  });
});

describe('Gem Hunt: Löser und Generator', () => {
  test('Lösungen berühren sich nie und nutzen jede Spalte einmal', () => {
    const rnd = mulberry32(3);
    for (let n = 5; n <= 11; n++) {
      const s = randomSolution(n, rnd);
      assert.equal(new Set(s).size, n);
      for (let r = 1; r < n; r++) assert.ok(Math.abs(s[r] - s[r - 1]) > 1);
    }
  });
  test('jede Stufe: eindeutig, ohne Raten lösbar, Lösung passt', () => {
    for (const d of DIFFICULTIES) {
      const p = generatePuzzle({ difficulty: d.id, seed: 11 });
      assert.equal(p.rows, d.size, d.id);
      assert.equal(countSolutions(p, 2), 1, d.id + ' eindeutig');
      const res = solveLogic(p, { maxTier: d.maxTier });
      assert.ok(res.solved, d.id + ' ohne Raten');
      assert.deepEqual(res.stars.slice().sort((a, b) => a - b), p.solution.slice().sort((a, b) => a - b));
      assert.ok(isSolved(p, solvedCells(p)));
    }
  });
  test('deterministisch aus dem Seed (Wettkampf/Team erzeugen dasselbe Rätsel)', () => {
    const a = generatePuzzle({ difficulty: 'mittel', seed: 99 }), b = generatePuzzle({ difficulty: 'mittel', seed: 99 });
    assert.deepEqual(a.regions, b.regions);
    assert.deepEqual(a.solution, b.solution);
  });
  test('Training: nächster Stein ab den richtig gesetzten', () => {
    const st = nextDeduction(P5, [], 1);
    assert.ok(st && P5.solution.includes(st.place));
    assert.ok(['row', 'col', 'reg'].includes(st.unit.type));
    const all = nextDeduction(P5, P5.solution, 1);
    assert.equal(all, null);
  });
  test('Leiter: 5×5 bis 11×11, keine Großen Zahlen', () => {
    assert.equal(DIFFICULTIES.length, 9);
    assert.equal(DIFFICULTIES[0].size, 5);
    assert.equal(DIFFICULTIES[8].size, 11);
    assert.equal(bigNumbersAllowed('rip'), false);
    assert.equal(genOptionsFor('unbekannt').size, 5);
  });
});

describe('Gem Hunt: Spielstand', () => {
  test('gelöst/Fortschritt/heilen', () => {
    assert.ok(snapshotSolved({ puzzle: P5, gemCells: solvedCells(P5) }));
    assert.equal(snapshotProgress({ puzzle: P5, gemCells: [GEM] }), 20);
    const healed = healSnapshot({ puzzle: P5, gemCells: { 0: 2 } });
    assert.equal(healed.gemCells.length, 25);
    assert.ok(!snapshotSolved({ puzzle: P5 }));
  });
});
