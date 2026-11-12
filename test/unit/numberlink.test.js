import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validPath, pathComplete, isSolved, progressPct, connectedCount, sanitizeLinks,
  validPuzzleShape, normalizePuzzle, normalizeLinks, endsOf,
} from '../../js/games/numberlink/model.js';
import { solveLogic, countSolutions, pathsFromState, nextDeduction } from '../../js/games/numberlink/solver.js';
import { generatePuzzle, chordFreeCuts, randomHamiltonPath, mulberry32, assignColors, PALETTE_SIZE } from '../../js/games/numberlink/generator.js';
import { DIFFICULTIES, genOptionsFor, bigNumbersAllowed } from '../../js/games/numberlink/difficulty.js';
import { snapshotSolved, snapshotProgress, healSnapshot } from '../../js/games/numberlink/snapshot.js';

// 3×3 (Zellen r*3+c):
//   [1 1 1]     Paar 1: 0-1-2
//   [2 2 2]     Paar 2: 3-4-5
//   [3 3 3]     Paar 3: 6-7-8
const P = {
  rows: 3, cols: 3,
  ends: [{ r: 0, c: 0, k: 1 }, { r: 0, c: 2, k: 1 }, { r: 1, c: 0, k: 2 }, { r: 1, c: 2, k: 2 }, { r: 2, c: 0, k: 3 }, { r: 2, c: 2, k: 3 }],
  solution: [1, 1, 1, 2, 2, 2, 3, 3, 3],
};
const SOL = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];

describe('Number Link: Regeln', () => {
  test('eine Linie beginnt auf ihrem Ende, läuft benachbart und endet am zweiten Ende', () => {
    assert.equal(validPath(P, 1, [0, 1]), true);
    assert.equal(validPath(P, 1, [2, 1, 0]), true);         // von beiden Enden aus
    assert.equal(validPath(P, 1, [1, 2]), false);           // kein Ende als Start
    assert.equal(validPath(P, 1, [0, 4]), false);           // nicht benachbart
    assert.equal(validPath(P, 1, [0, 3]), false);           // fremdes Ende
    assert.equal(validPath(P, 1, [0, 1, 0]), false);        // Zelle doppelt
    assert.equal(validPath(P, 2, [3, 4, 5, 8]), false);     // nach dem zweiten Ende geht nichts weiter
    assert.equal(pathComplete(P, 1, [0, 1, 2]), true);
    assert.equal(pathComplete(P, 1, [0, 1]), false);
  });

  test('gelöst nur mit allen Paaren verbunden UND jeder Zelle bedeckt', () => {
    assert.equal(isSolved(P, SOL), true);
    assert.equal(isSolved(P, [[0, 1, 2], [3, 4, 5], []]), false);
    assert.equal(connectedCount(P, [[0, 1, 2], [3, 4, 5], [6]]), 2);
    assert.equal(progressPct(P, [[0, 1, 2], [], []]), 33);
    // Andere, aber regelgerechte Lösung zählt ebenfalls (Prüfung über die Regeln).
    const Q = { rows: 2, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 1, c: 0, k: 1 }], solution: [1, 1, 1, 1, 1, 1] };
    assert.equal(isSolved(Q, [[0, 1, 2, 5, 4, 3]]), true);
    assert.equal(isSolved(Q, [[0, 3]]), false);             // verbunden, aber nicht alles bedeckt
  });

  test('sanitizeLinks kappt ungültige Linien an der ersten falschen Stelle und bei Überschneidung', () => {
    assert.deepEqual(sanitizeLinks(P, [[0, 1, 5], [3, 4, 1], [6, 7]]), [[0, 1], [3, 4], [6, 7]]);
    assert.deepEqual(sanitizeLinks(P, null), [[], [], []]);
  });

  test('Struktur-Prüfung und RTDB-Heilung', () => {
    assert.equal(validPuzzleShape(P), true);
    assert.equal(validPuzzleShape({ ...P, ends: P.ends.slice(0, 5) }), false);
    assert.equal(validPuzzleShape({ ...P, solution: [] }), false);
    const obj = { ...P, ends: Object.fromEntries(P.ends.map((e, i) => [i, e])) };
    assert.deepEqual(normalizePuzzle(obj).ends, P.ends);
    assert.deepEqual(normalizeLinks({ 0: { 0: 0, 1: 1 }, 2: [6] }, 3), [[0, 1], [], [6]]);
    assert.equal(normalizeLinks(SOL, 3), SOL);
    assert.deepEqual(normalizeLinks(undefined, 2), [[], []]);
  });

  test('Spielstand: gelöst/Fortschritt/Heilung', () => {
    assert.equal(snapshotSolved({ puzzle: P, links: SOL }), true);
    assert.equal(snapshotSolved({ puzzle: P, links: [[0, 1, 2]] }), false);
    assert.equal(snapshotProgress({ puzzle: P, links: [[0, 1, 2]] }), 33);
    const healed = healSnapshot({ puzzle: P, links: { 0: { 0: 0, 1: 1 } } });
    assert.deepEqual(healed.links, [[0, 1], [], []]);
  });
});

describe('Number Link: Löser', () => {
  test('legt das Beispiel komplett fest und liefert die Linien', () => {
    const res = solveLogic(P, { maxTier: 1 });
    assert.equal(res.solved, true);
    assert.deepEqual(pathsFromState(P, res), SOL);
  });

  test('erkennt mehrdeutige Bretter (nicht gelöst) und zählt Lösungen', () => {
    // 2×3, ein Paar in den linken Ecken: genau ein Weg über alle sechs Zellen.
    const Q = { rows: 2, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 1, c: 0, k: 1 }], solution: [1, 1, 1, 1, 1, 1] };
    assert.equal(countSolutions(Q), 1);
    assert.equal(solveLogic(Q, { maxTier: 1 }).solved, true);
    // 3×3, ein Paar in gegenüberliegenden Ecken: mehrere Wege über alle Zellen.
    const R = { rows: 3, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 2, c: 2, k: 1 }], solution: new Array(9).fill(1) };
    assert.equal(countSolutions(R), 2);
    assert.equal(solveLogic(R, { maxTier: 2 }).solved, false);
  });

  test('Training: nächster erzwungener Schritt ab den gezogenen Linien', () => {
    const first = nextDeduction(P, [[], [], []]);
    assert.ok(first && SOL[first.k - 1].join() === first.path.join());
    const after = nextDeduction(P, [SOL[0], [], []]);
    assert.notEqual(after.k, 1);
    assert.equal(nextDeduction(P, SOL), null);
  });
});

describe('Number Link: Generator', () => {
  test('Schnitte erzeugen Linien, die sich nie selbst berühren', () => {
    const R = 7, path = randomHamiltonPath(R, R, mulberry32(5));
    const cuts = chordFreeCuts(path, R, R);
    const seg = new Array(R * R);
    cuts.forEach((s, i) => { const e = i + 1 < cuts.length ? cuts[i + 1] : R * R; for (let j = s; j < e; j++) seg[path[j]] = [i, j]; });
    for (let id = 0; id < R * R; id++) for (const n of [id + 1, id + R]) {
      if ((n === id + 1 && id % R === R - 1) || n >= R * R) continue;
      const [a, i] = seg[id], [b, j] = seg[n];
      if (a === b) assert.equal(Math.abs(i - j), 1, `Sehne ${id}-${n}`);
    }
  });

  for (const d of DIFFICULTIES.slice(0, 4)) {
    test(`${d.id}: eindeutig, ohne Raten lösbar, gültige Struktur`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const p = generatePuzzle({ difficulty: d.id, seed });
        assert.equal(p.rows, d.dim.r);
        assert.equal(validPuzzleShape(p), true);
        const K = p.ends.length / 2;
        assert.ok(K >= 3, 'mindestens drei Paare');
        // Lösung = Linien aus dem Löser, gültig nach den Regeln, deckt sich mit p.solution.
        const res = solveLogic(p, { maxTier: genOptionsFor(d.id).maxTier, probeBudget: genOptionsFor(d.id).probeBudget });
        assert.equal(res.solved, true);
        const paths = pathsFromState(p, res);
        assert.equal(isSolved(p, paths), true);
        paths.forEach((path, i) => path.forEach((id) => assert.equal(p.solution[id], i + 1)));
        // Jede Linie hat mindestens drei Zellen, Zahlen von oben links aufsteigend.
        for (const path of paths) assert.ok(path.length >= 3);
        const ends = endsOf(p);
        for (let k = 2; k <= K; k++) assert.ok(Math.min(...ends[k]) > Math.min(...ends[k - 1]));
        // Farben: berührende Linien unterscheiden sich.
        assert.equal(p.colors.length, K);
        assert.ok(p.colors.every((c) => c >= 0 && c < PALETTE_SIZE));
      }
    });
  }

  test('kleine Bretter: Rückverfolgung findet genau eine Lösung', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const p = generatePuzzle({ difficulty: 'sehrleicht', seed });
      assert.equal(countSolutions(p, 2), 1);
    }
  });

  test('Farben: Nachbarlinien nie gleich', () => {
    const p = generatePuzzle({ difficulty: 'schwer', seed: 9 });
    const col = assignColors(p);
    for (let id = 0; id < p.rows * p.cols; id++) {
      const k = p.solution[id];
      for (const n of [id + 1, id + p.cols]) {
        if ((n === id + 1 && id % p.cols === p.cols - 1) || n >= p.rows * p.cols) continue;
        const m = p.solution[n];
        if (m !== k) assert.notEqual(col[k - 1], col[m - 1]);
      }
    }
  });

  test('deterministisch aus dem Seed; Bretter wachsen mit der Stufe; keine Großen Zahlen', () => {
    const a = generatePuzzle({ difficulty: 'mittel', seed: 42 });
    const b = generatePuzzle({ difficulty: 'mittel', seed: 42 });
    assert.deepEqual(a.ends, b.ends);
    const sizes = DIFFICULTIES.map((d) => d.dim.r);
    assert.deepEqual(sizes, [...sizes].sort((x, y) => x - y));
    assert.equal(bigNumbersAllowed(), false);
  });
});

// Farben sind 32-Bit-Masken: mit mehr als 31 Zahlen darf der Löser nie ein
// (womöglich falsches) „gelöst“ melden.
test('mehr als 31 Paare gelten nie als gelöst', async () => {
  const { solveLogic, MAX_PAIRS } = await import('../../js/games/numberlink/solver.js');
  const mk = (pairs) => {
    const cols = 2, rows = pairs, ends = [], solution = [];
    for (let r = 0; r < rows; r++) { ends.push({ r, c: 0, k: r + 1 }, { r, c: 1, k: r + 1 }); solution.push(r + 1, r + 1); }
    return { rows, cols, ends, solution };
  };
  assert.equal(solveLogic(mk(MAX_PAIRS), { maxTier: 1 }).solved, true);
  assert.equal(solveLogic(mk(MAX_PAIRS + 1), { maxTier: 1 }).solved, false);
});

describe('Number Link: Wände (obere Stufen)', () => {
  test('eine Linie darf nicht durch eine Wand', async () => {
    const { validPath } = await import('../../js/games/numberlink/model.js');
    const p = { rows: 2, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 0, c: 2, k: 1 }, { r: 1, c: 0, k: 2 }, { r: 1, c: 2, k: 2 }], solution: [1, 1, 1, 2, 2, 2] };
    assert.equal(validPath(p, 1, [0, 1, 2]), true);
    assert.equal(validPath({ ...p, walls: [{ r: 0, c: 0, d: 'r' }] }, 1, [0, 1, 2]), false);
  });
  for (const id of ['mittel', 'extrem', 'rip']) {
    test(`${id}: lange Linien, Wände nie auf der Lösung, ohne Raten lösbar`, () => {
      for (const seed of [11, 22]) {
        const p = generatePuzzle({ difficulty: id, seed });
        const N = p.rows * p.cols;
        assert.ok(p.walls.length > 0, 'Wände vorhanden');
        assert.ok(N / (p.ends.length / 2) >= 7, `Linien zu kurz: ${N / (p.ends.length / 2)}`);
        for (const w of p.walls) {
          const a = w.r * p.cols + w.c, b = w.d === 'r' ? a + 1 : a + p.cols;
          // Die Lösung läuft nie über eine Wand: beide Seiten gehören nicht zu
          // derselben Linie ODER sind auf ihr nicht benachbart.
          const k = p.solution[a];
          if (k === p.solution[b]) {
            const res = solveLogic(p, { maxTier: 2, probeBudget: N * 4 });
            const path = pathsFromState(p, res)[k - 1];
            const ia = path.indexOf(a), ib = path.indexOf(b);
            assert.ok(Math.abs(ia - ib) !== 1, 'Wand liegt auf der Lösung');
          }
        }
        assert.ok(solveLogic(p, { maxTier: 2, probeBudget: N * 4 }).solved, 'nicht ohne Raten lösbar');
      }
    });
  }
});
