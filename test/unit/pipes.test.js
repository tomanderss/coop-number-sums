import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { N, E, S, W, rotMask, orientations, flow, isSolved, progressPct, progressCells, normalizePuzzle, normalizeRot, validPuzzleShape, degree, neighbor, has, opp } from '../../js/games/pipes/model.js';
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

describe('Pipes: schwerere obere Stufen', () => {
  test('ohne Rand: Nachbar über den Rand hinweg', async () => {
    const { neighbor } = await import('../../js/games/pipes/model.js');
    const p = { rows: 3, cols: 4 };
    assert.equal(neighbor(p, 3, 1), -1);
    assert.equal(neighbor({ ...p, wrap: true }, 3, 1), 0);      // rechts → links
    assert.equal(neighbor({ ...p, wrap: true }, 1, 0), 9);      // oben → unten
  });
  for (const id of ['mittel', 'extrem', 'rip']) {
    test(`${id}: logisch lösbar, Lösungsdrehung löst das Brett`, async () => {
      const { generatePuzzle } = await import('../../js/games/pipes/generator.js');
      const { solveLogic } = await import('../../js/games/pipes/solver.js');
      const { isSolved } = await import('../../js/games/pipes/model.js');
      for (const seed of [3, 4]) {
        const p = generatePuzzle({ difficulty: id, seed });
        assert.equal(p.logic, true);
        assert.equal(!!p.wrap, id !== 'mittel');
        assert.ok(solveLogic(p, { maxTier: 2 }).solved, 'nicht ohne Raten lösbar');
        assert.ok(isSolved(p, p.solRot), 'Lösungsdrehung löst nicht');
        if (id === 'rip') assert.ok(p.tier2 >= 20, `zu wenige Netz-Schlüsse: ${p.tier2}`);
      }
    });
  }
});

describe('Pipes: Fortschritt zählt durchströmte UND gesperrte Felder je einmal', () => {
  test('Vereinigung statt Summe, nie über 99 % ohne Lösung', async () => {
    const { generatePuzzle } = await import('../../js/games/pipes/generator.js');
    const p = generatePuzzle({ difficulty: 'mittel', seed: 7 });
    const n = p.rows * p.cols;
    const rot = p.tiles.map(() => 0);
    const wet = flow(p, rot).cells;
    // Alle durchströmten Felder zusätzlich sperren: kein doppeltes Zählen.
    const lockWet = Array.from({ length: n }, (_, i) => wet.includes(i));
    assert.equal(progressCells(p, rot, lockWet).count, wet.length);
    // Alles gesperrt, aber nicht gelöst: 99 %, nicht 100 oder 200.
    const all = Array(n).fill(true);
    if (!isSolved(p, rot)) assert.equal(progressPct(p, rot, all), 99);
    // Ohne Wasser zählen nur die gesperrten.
    const some = Array.from({ length: n }, (_, i) => i < 5);
    assert.equal(progressCells(p, rot, some, false).count, 5);
    // Gelöst bleibt 100.
    assert.equal(progressPct(p, p.solRot, all), 100);
  });
});

// Unabhängige Gegenprobe (Nutzerwunsch „nur einzigartig und immer“): Lösungen per
// Backtracking zählen — nur Kanten-Konsistenz + Kreisverbot, ohne den Logik-Löser.
function countSolutionsBrute(p, limit = 2) {
  const n = p.rows * p.cols;
  let count = 0;
  const propagate = (dom) => {
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < n; i++) {
        const before = dom[i].length;
        dom[i] = dom[i].filter((m) => {
          for (let d = 0; d < 4; d++) {
            const j = neighbor(p, i, d);
            if (j < 0) { if (has(m, d)) return false; continue; }
            if (!dom[j].some((mj) => has(mj, opp(d)) === has(m, d))) return false;
          }
          return true;
        });
        if (!dom[i].length) return false;
        if (dom[i].length !== before) changed = true;
      }
    }
    return true;
  };
  const rec = (dom) => {
    if (count >= limit || !propagate(dom)) return;
    let best = -1;
    for (let i = 0; i < n; i++) if (dom[i].length > 1 && (best < 0 || dom[i].length < dom[best].length)) best = i;
    if (best < 0) {
      const rot = p.tiles.map((t, i) => [0, 1, 2, 3].find((k) => rotMask(t, k) === dom[i][0]));
      if (isSolved(p, rot)) count++;
      return;
    }
    for (const m of dom[best]) { const d2 = dom.map((x) => x.slice()); d2[best] = [m]; rec(d2); }
  };
  rec(p.tiles.map((m) => orientations(m).map((o) => o.m)));
  return count;
}

describe('Pipes: jedes Rätsel hat GENAU eine Lösung (unabhängig gezählt)', () => {
  test('der Gegen-Zähler erkennt mehrdeutige Bretter', async () => {
    const { generatePuzzle } = await import('../../js/games/pipes/generator.js');
    const { solveLogic } = await import('../../js/games/pipes/solver.js');
    let multi = 0;
    for (let s = 1; s <= 40; s++) {
      const p = generatePuzzle({ rows: 6, cols: 6, wrap: s % 2 === 0, tries: 1, seed: s });
      const c = countSolutionsBrute(p);
      if (c > 1) { multi++; assert.equal(solveLogic(p, { maxTier: 2 }).solved, false, 'Löser hält ein mehrdeutiges Brett für gelöst'); }
    }
    assert.ok(multi > 0, 'Gegenprobe ohne Aussagekraft');
  });
  for (const id of ['mittel', 'extrem', 'mashallah', 'dikkawas', 'bismillah', 'rip']) {
    test(`${id}: eindeutig`, async () => {
      const { generatePuzzle } = await import('../../js/games/pipes/generator.js');
      for (const seed of [11, 12, 13]) {
        const p = generatePuzzle({ difficulty: id, seed });
        assert.equal(countSolutionsBrute(p), 1, `Seed ${seed}`);
      }
    });
  }
  test('Story-Level (Pipes + Mix): eindeutig, ohne Raten lösbar, Lösung stimmt', async () => {
    const fs = await import('node:fs');
    const { solveLogic } = await import('../../js/games/pipes/solver.js');
    let checked = 0;
    for (const dir of ['pipes', 'mix']) {
      const base = new URL(`../../data/story/${dir}/`, import.meta.url);
      for (const f of fs.readdirSync(base).sort()) {
        for (const L of JSON.parse(fs.readFileSync(new URL(f, base), 'utf8')).levels) {
          if (L.game !== 'pipes') continue;
          const p = L.puzzle;
          assert.ok(isSolved(p, p.solRot), `${dir} ${L.level}: Lösung ungültig`);
          const lg = solveLogic(p, { maxTier: 2 });
          assert.ok(lg.solved, `${dir} ${L.level}: nicht ohne Raten lösbar`);
          assert.ok(lg.masks.every((m, i) => m === rotMask(p.tiles[i], p.solRot[i])), `${dir} ${L.level}: Löser ≠ Lösung`);
          if (L.level % 25 === 0) assert.equal(countSolutionsBrute(p), 1, `${dir} ${L.level}: mehrdeutig`);
          checked++;
        }
      }
    }
    assert.ok(checked >= 500);
  });
});
