import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mixCatalog, normalizeMixPool, mixDiffsOn, mixGameOn, mixCombos, mixSummary,
  toggleMixGame, toggleMixDiff, applyMixPreset, activeMixPreset, pickMixLevel, mixReel, mergeMixStats,
} from '../../js/mix.js';
import { GAMES } from '../../js/games/index.js';
import { DIFFICULTY_LADDER } from '../../js/config.js';

const CAT = [
  { id: 'a', diffs: ['d1', 'd2', 'd3'] },
  { id: 'b', diffs: ['d1', 'd2', 'd3'] },
  { id: 'c', diffs: ['d2', 'd3'] },
];
const LADDER = ['d1', 'd2', 'd3'];
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('Mix: Pool', () => {
  test('leerer Pool = alles an, auch für neu hinzukommende Spiele und Stufen', () => {
    assert.equal(mixCombos({}, CAT).length, 8);
    const mehr = CAT.concat([{ id: 'neu', diffs: ['d1'] }]);
    assert.equal(mixCombos({ off: { a: ['d1'] } }, mehr).length, 8);   // 8 - 1 + 1
    assert.ok(mixGameOn({}, 'neu', mehr));
  });
  test('ganzes Spiel aus und wieder an — kommt mit allen Stufen zurück', () => {
    let p = toggleMixDiff({}, 'a', 'd2', CAT);
    assert.deepEqual(mixDiffsOn(p, 'a', CAT), ['d1', 'd3']);
    p = toggleMixGame(p, 'a', CAT);
    assert.deepEqual(mixDiffsOn(p, 'a', CAT), []);
    assert.equal(mixGameOn(p, 'a', CAT), false);
    p = toggleMixGame(p, 'a', CAT);
    assert.deepEqual(mixDiffsOn(p, 'a', CAT), ['d1', 'd2', 'd3']);
  });
  test('die letzte Stufe eines Spiels ausschalten = Spiel aus; normalisieren räumt Unbekanntes', () => {
    let p = {};
    for (const d of ['d2', 'd3']) p = toggleMixDiff(p, 'c', d, CAT);
    assert.equal(p.off.c, true);
    assert.deepEqual(normalizeMixPool({ off: { zz: true, a: ['dX', 'd1'] } }, CAT), { off: { a: ['d1'] } });
    assert.deepEqual(normalizeMixPool(null, CAT), { off: {} });
  });
  test('Zusammenfassung', () => {
    assert.deepEqual(mixSummary({ off: { b: true } }, CAT), { games: 2, combos: 5, totalGames: 3 });
  });
  test('Schnellwahl betrifft die Stufen aller Spiele, abgewählte Spiele bleiben aus', () => {
    const p = applyMixPreset({ off: { b: true } }, 'easy', LADDER, CAT);
    assert.deepEqual(mixDiffsOn(p, 'a', CAT), ['d1']);
    assert.deepEqual(mixDiffsOn(p, 'b', CAT), []);
    assert.deepEqual(mixDiffsOn(p, 'c', CAT), []);   // c hat keine leichte Stufe
    assert.equal(activeMixPreset(applyMixPreset({}, 'hard', LADDER, CAT), LADDER, CAT), 'hard');
    assert.equal(activeMixPreset({}, LADDER, CAT), 'all');
    assert.equal(activeMixPreset(toggleMixDiff({}, 'a', 'd1', CAT), LADDER, CAT), null);
  });
});

describe('Mix: Ziehen', () => {
  test('erst das Spiel (gleich wahrscheinlich), dann die Stufe; nie zweimal dasselbe Spiel hintereinander', () => {
    assert.deepEqual(pickMixLevel({}, CAT, null, seq(0, 0)), { game: 'a', diff: 'd1' });
    // Vorher war a: gezogen wird nur aus b und c.
    assert.deepEqual(pickMixLevel({}, CAT, 'a', seq(0, 0.99)), { game: 'b', diff: 'd3' });
    for (let i = 0; i < 200; i++) {
      const prev = ['a', 'b', 'c'][i % 3];
      assert.notEqual(pickMixLevel({}, CAT, prev).game, prev);
    }
  });
  test('nur ein Spiel im Pool → darf sich wiederholen; leerer Pool → null', () => {
    const p = { off: { a: true, b: true } };
    assert.equal(pickMixLevel(p, CAT, 'c').game, 'c');
    assert.equal(pickMixLevel({ off: { a: true, b: true, c: true } }, CAT), null);
  });
  test('Walze endet auf dem Ziel, Nachbarn nie gleich', () => {
    const r = mixReel(['a', 'b', 'c'], 'b', 14);
    assert.equal(r.length, 14);
    assert.equal(r[13], 'b');
    for (let i = 1; i < r.length; i++) assert.notEqual(r[i], r[i - 1]);
    assert.deepEqual(mixReel([], 'x', 3), ['x', 'x', 'x']);
  });
});

describe('Mix: echte Spiele', () => {
  test('jedes registrierte Spiel steht im Katalog — mit Stufen der gemeinsamen Leiter', () => {
    const cat = mixCatalog(GAMES);
    assert.equal(cat.length, GAMES.length);
    const ladder = DIFFICULTY_LADDER.map((d) => d.id);
    for (const g of cat) for (const d of g.diffs) assert.ok(ladder.includes(d), `${g.id}: ${d}`);
  });
  test('Bestwerte mergen per Maximum', () => {
    assert.deepEqual(mergeMixStats({ best: 4, runs: 2 }, { best: 7, levels: 9 }), { best: 7, runs: 2, levels: 9 });
  });
});
