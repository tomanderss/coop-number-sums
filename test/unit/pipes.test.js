import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { N, E, S, W, rotMask, orientations, flow, isSolved, progressPct, normalizePuzzle, normalizeRot, validPuzzleShape, degree } from '../../js/games/pipes/model.js';
import { solveLogic, nextDeduction } from '../../js/games/pipes/solver.js';
import { generatePuzzle } from '../../js/games/pipes/generator.js';
import { DIFFICULTIES } from '../../js/games/pipes/difficulty.js';
import { snapshotSolved, snapshotProgress, healSnapshot } from '../../js/games/pipes/snapshot.js';

// Ein 2×2-Netz: Quelle oben links (E|S), oben rechts Endstück (W), unten links
// Bogen (N|E), unten rechts Endstück (W).
const tiny = () => ({ rows: 2, cols: 2, source: 0, tiles: [E | S, W, N | E, W], solRot: [0, 0, 0, 0] });

describe('Pipes: Regeln', () => {
  test('Drehen: im Uhrzeigersinn, vier Viertel = einmal herum', () => {
    assert.equal(rotMask(N, 1), E);
    assert.equal(rotMask(N | E, 1), E | S);
    assert.equal(rotMask(N | E | S, 4), N | E | S);
    assert.equal(rotMask(W, -1), S);
    assert.equal(orientations(N | S).length, 2);     // eine Gerade hat nur zwei Lagen
    assert.equal(orientations(N | E).length, 4);
  });
  test('gelöst = kein offenes Ende und das Wasser erreicht alles', () => {
    const p = tiny();
    assert.equal(isSolved(p, [0, 0, 0, 0]), true);
    assert.equal(progressPct(p, [0, 0, 0, 0]), 100);
    const f = flow(p, [0, 1, 0, 0]);                    // oben rechts zeigt nach Norden ins Leere
    assert.equal(f.leaks.has(1), true);
    assert.equal(isSolved(p, [0, 1, 0, 0]), false);
    assert.ok(progressPct(p, [0, 1, 0, 0]) < 100);
    // Fluss-Tiefe: die Quelle 0, die Nachbarn 1.
    assert.deepEqual(flow(p, [0, 0, 0, 0]).depth, [0, 1, 1, 2]);
  });
  test('Form & Heilung aus der RTDB', () => {
    const p = tiny();
    assert.ok(validPuzzleShape(p));
    assert.ok(!validPuzzleShape({ ...p, tiles: [1, 2] }));
    const healed = normalizePuzzle({ ...p, tiles: { 0: 6, 1: 8, 2: 3, 3: 8 }, solRot: { 0: 0, 3: 0 } });
    assert.deepEqual(healed.tiles, [6, 8, 3, 8]);
    assert.deepEqual(normalizeRot({ 1: 3 }, 4), [0, 3, 0, 0]);
    assert.deepEqual(normalizeRot(null, 3), [0, 0, 0]);
  });
});

describe('Pipes: Generator & Löser', () => {
  test('jede Stufe: ein Baum ohne Kreuzungen, die Lösung geht auf, der Löser findet sie ohne Raten', () => {
    for (const d of DIFFICULTIES) {
      for (const seed of [3, 41]) {
        const p = generatePuzzle({ difficulty: d.id, seed });
        assert.equal(p.rows, d.dim.r);
        assert.ok(validPuzzleShape(p));
        assert.ok(p.tiles.every((m) => degree(m) >= 1 && degree(m) <= 3), 'nur Endstück/Gerade/Bogen/T');
        assert.ok(isSolved(p, p.solRot), `${d.id}: die Lösung muss aufgehen`);
        const res = solveLogic(p, { maxTier: d.maxTier });
        assert.ok(res.solved, `${d.id}/${seed}: logisch lösbar`);
        // Die Schlüsse des Lösers stimmen mit der Lösung überein (eindeutig).
        res.masks.forEach((m, i) => assert.equal(m, rotMask(p.tiles[i], p.solRot[i])));
        // Zu Beginn liegt kein drehbares Stück schon richtig.
        assert.ok(!isSolved(p, p.tiles.map(() => 0)));
      }
    }
  });
  test('derselbe Seed liefert dasselbe Rätsel', () => {
    const a = generatePuzzle({ difficulty: 'mittel', seed: 7 }), b = generatePuzzle({ difficulty: 'mittel', seed: 7 });
    assert.deepEqual(a.tiles, b.tiles);
    assert.equal(a.source, b.source);
  });
  test('Training: der nächste Schritt ist ein erzwungenes, noch nicht bekanntes Stück', () => {
    const p = generatePuzzle({ difficulty: 'sehrleicht', seed: 5 });
    const known = [];
    for (let guard = 0; guard < 40; guard++) {
      const st = nextDeduction(p, known, 1);
      if (!st) break;
      assert.equal(st.m, rotMask(p.tiles[st.i], p.solRot[st.i]));
      assert.ok(!known.some((k) => k.i === st.i));
      known.push({ i: st.i, m: st.m });
    }
    assert.equal(known.length, p.rows * p.cols);
  });
});

describe('Pipes: Spielstand', () => {
  test('gelöst/Fortschritt/Heilung', () => {
    const p = tiny();
    assert.equal(snapshotSolved({ puzzle: p, pipeRot: [0, 0, 0, 0] }), true);
    assert.equal(snapshotSolved({ puzzle: p, pipeRot: { 1: 1 } }), false);
    assert.ok(snapshotProgress({ puzzle: p, pipeRot: [0, 1, 0, 0] }) < 100);
    const h = healSnapshot({ puzzle: { ...p, tiles: { 0: 6, 1: 8, 2: 3, 3: 8 } }, pipeRot: { 2: 4 } });
    assert.deepEqual(h.pipeRot, [0, 0, 4, 0]);
  });
});
