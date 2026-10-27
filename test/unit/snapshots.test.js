import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { snapshotRules, SNAPSHOT_GAME_IDS } from '../../js/games/snapshots.js';
import { GAME_IDS, DEFAULT_GAME_ID } from '../../js/games/registry.js';
import { generatePuzzle as genMC } from '../../js/games/mathcross/generator.js';

// storage.js entscheidet ueber gespeicherte Staende (gelöst? Fortschritt?),
// OHNE das jeweilige Spiel zu laden. Die Regeln sind je Spiel verschieden —
// diese Tests halten fest, dass jedes Spiel seine eigenen bekommt und die
// Number-Sums-Regeln (bis zur Trennung fest in storage.js) unveraendert sind.

describe('Spielstand-Regeln je Spiel', () => {
  test('jedes registrierte Spiel hat Regeln', () => {
    for (const id of GAME_IDS) assert.ok(SNAPSHOT_GAME_IDS.includes(id), `${id} ohne Spielstand-Regeln`);
  });

  test('jede Regel-Sammlung hat dieselbe Form', () => {
    for (const id of SNAPSHOT_GAME_IDS) {
      const r = snapshotRules(id);
      for (const fn of ['snapshotSolved', 'snapshotProgress', 'healSnapshot']) {
        assert.equal(typeof r[fn], 'function', `${id}.${fn} fehlt`);
      }
    }
  });

  test('unbekannte Kennung faellt auf das Standardspiel zurueck', () => {
    assert.equal(snapshotRules('gibtsnicht'), snapshotRules(DEFAULT_GAME_ID));
  });

  test('Number Sums: gelöst nur bei vollstaendig korrekter Markierung', () => {
    const r = snapshotRules('numbersums');
    const p = { rows: 1, cols: 2, solution: [[true, false]] };
    assert.equal(r.snapshotSolved({ puzzle: p, marks: [['kept', 'removed']] }), true);
    assert.equal(r.snapshotSolved({ puzzle: p, marks: [['kept', 'none']] }), false);
    assert.equal(r.snapshotProgress({ puzzle: p, marks: [['kept', 'none']] }), 50);
    const g = { puzzle: p, marks: [] };
    assert.equal(r.healSnapshot(g), g, 'Number Sums heilt nichts');
  });

  test('Math Cross: gelöst, wenn jedes offene Feld seine Zahl traegt', () => {
    const r = snapshotRules('mathcross');
    const p = genMC({ difficulty: 'sehrleicht', seed: 11 });
    const leer = p.slots.map((row) => row.map(() => null));
    const loesung = p.slots.map((row) => row.map((sl) => (sl && !sl.given ? sl.v : null)));
    assert.equal(r.snapshotSolved({ puzzle: p, placed: leer }), false);
    assert.equal(r.snapshotProgress({ puzzle: p, placed: leer }), 0);
    assert.equal(r.snapshotSolved({ puzzle: p, placed: loesung }), true);
    assert.equal(r.snapshotProgress({ puzzle: p, placed: loesung }), 100);
    // Ein Number-Sums-Stand ist fuer Math Cross nie „gelöst" (falsche Form).
    assert.equal(r.snapshotSolved({ puzzle: { rows: 1, cols: 1, solution: [[true]] }, marks: [['kept']] }), false);
  });

  test('Math Cross: ein loechriges Raetsel aus der RTDB wird wieder dicht', () => {
    const r = snapshotRules('mathcross');
    const p = genMC({ difficulty: 'sehrleicht', seed: 12 });
    // So kommt es aus der RTDB: Zeilen als Objekte mit Zahlen-Schluesseln, null fehlt.
    const holey = {};
    p.slots.forEach((row, ri) => {
      const o = {};
      row.forEach((sl, ci) => { if (sl) o[ci] = sl; });
      if (Object.keys(o).length) holey[ri] = o;
    });
    const healed = r.healSnapshot({ puzzle: { ...p, slots: holey, equations: { ...p.equations } }, placed: [] });
    assert.ok(Array.isArray(healed.puzzle.slots) && healed.puzzle.slots.length === p.rows);
    assert.ok(healed.puzzle.slots.every((row) => Array.isArray(row) && row.length === p.cols));
    assert.ok(Array.isArray(healed.puzzle.equations));
  });
});

describe('storage nutzt die Regeln des AKTIVEN Spiels', () => {
  test('snapshotSolved/snapshotProgress nehmen die Spiel-Kennung', async () => {
    globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
    const { snapshotSolved, snapshotProgress } = await import('../../js/storage.js');
    const p = genMC({ difficulty: 'sehrleicht', seed: 13 });
    const loesung = p.slots.map((row) => row.map((sl) => (sl && !sl.given ? sl.v : null)));
    assert.equal(snapshotSolved({ puzzle: p, placed: loesung }, 'mathcross'), true);
    assert.equal(snapshotProgress({ puzzle: p, placed: loesung }, 'mathcross'), 100);
    // Ohne Kennung: das aktive Spiel (Standard = Number Sums) — der MC-Stand passt nicht.
    assert.equal(snapshotSolved({ puzzle: p, placed: loesung }), false);
  });
});
