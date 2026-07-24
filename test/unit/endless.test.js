import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENDLESS_CFG, endlessDiffIndex, endlessDiffId, endlessGrantsLife,
  endlessLivesAfter, endlessIsRecord, reconstructEndlessRuns,
} from '../../js/endless.js';

const IDS = ['a', 'b', 'c', 'd']; // 4-stufige Leiter zum Testen

describe('endless.diffIndex/diffId', () => {
  test('climbs one step per level and WRAPS after the top back to the easiest', () => {
    assert.equal(endlessDiffIndex(1, 4), 0);
    assert.equal(endlessDiffIndex(2, 4), 1);
    assert.equal(endlessDiffIndex(4, 4), 3);
    assert.equal(endlessDiffIndex(5, 4), 0);   // nach der höchsten wieder ganz unten
    assert.equal(endlessDiffIndex(6, 4), 1);
    assert.equal(endlessDiffIndex(8, 4), 3);
    assert.equal(endlessDiffIndex(9, 4), 0);   // zweite Umrundung
  });
  test('level below 1 clamps to the easiest; guards ladderLen 0', () => {
    assert.equal(endlessDiffIndex(0, 4), 0);
    assert.equal(endlessDiffIndex(-3, 4), 0);
    assert.equal(endlessDiffIndex(5, 0), 0);   // keine Division durch 0 → NaN
  });
  test('diffId maps through the ladder (wrapping)', () => {
    assert.equal(endlessDiffId(1, IDS), 'a');
    assert.equal(endlessDiffId(3, IDS), 'c');
    assert.equal(endlessDiffId(5, IDS), 'a');   // nach 'd' wieder 'a'
    assert.equal(endlessDiffId(1, []), null);
  });
});

describe('endless.lives', () => {
  test('default config grants NO extra lives (no refill, like coop)', () => {
    assert.equal(endlessGrantsLife(3), false);
    assert.equal(endlessGrantsLife(6), false);
    assert.equal(endlessGrantsLife(1), false);
    assert.equal(endlessLivesAfter(2, 3), 2);   // kein Refill
    assert.equal(endlessLivesAfter(3, 6), 3);
    assert.equal(ENDLESS_CFG.lifeRefillEvery, 0);
    assert.equal(ENDLESS_CFG.maxLives, 3);
  });
  test('an explicit refill config still works (mechanism intact)', () => {
    const cfg = { maxLives: 5, lifeRefillEvery: 3 };
    assert.equal(endlessGrantsLife(3, cfg), true);
    assert.equal(endlessGrantsLife(4, cfg), false);
    assert.equal(endlessLivesAfter(2, 3, cfg), 3);       // +1 auf Level 3
    assert.equal(endlessLivesAfter(5, 6, cfg), 5);       // auf maxLives gedeckelt
  });
});

// (endlessRunCoins-Tests entfernt: Münzen fließen seit dem Einzelspiel-Umbau je
// Level direkt über die normale Sieg-Belohnung in app.js, nicht mehr als Summe.)

describe('endless.reconstructEndlessRuns (rückwirkende Nachbuchung)', () => {
  test('decomposes a run into per-difficulty wins plus a final-level loss', () => {
    const log = [{ id: 'a', ts: 1, amount: 60, reason: 'endless', meta: { mode: 'endless', score: 3 } }];
    const r = reconstructEndlessRuns(log, IDS);
    assert.equal(r.runCount, 1);
    assert.equal(r.wins, 3);
    assert.equal(r.losses, 1);   // Lauf endete durch Leben-Aus → Level 4 verloren
    assert.deepEqual(r.perDiff.a, { won: 1, coopWon: 0, lost: 0, coopLost: 0 });
    assert.deepEqual(r.perDiff.b, { won: 1, coopWon: 0, lost: 0, coopLost: 0 });
    assert.deepEqual(r.perDiff.c, { won: 1, coopWon: 0, lost: 0, coopLost: 0 });
    assert.deepEqual(r.perDiff.d, { won: 0, coopWon: 0, lost: 1, coopLost: 0 });
  });
  test('aborted runs credit their wins but NO final-level loss', () => {
    const log = [{ id: 'a', ts: 1, amount: 20, reason: 'endless', meta: { mode: 'endless', score: 1, aborted: true } }];
    const r = reconstructEndlessRuns(log, IDS);
    assert.equal(r.wins, 1);
    assert.equal(r.losses, 0);
  });
  test('coop runs land in the coop counters, capped at the top difficulty (pre-wrap semantics)', () => {
    const log = [{ id: 'a', ts: 1, amount: 99, reason: 'endless', meta: { mode: 'endlessCoop', score: 6 } }];
    const r = reconstructEndlessRuns(log, IDS);
    assert.equal(r.coopWins, 6);
    assert.equal(r.wins, 0);
    // Level 4,5,6 liegen alle auf der obersten Stufe 'd' (Deckel, kein Wrap) …
    assert.equal(r.perDiff.d.coopWon, 3);
    // … und die Schluss-Niederlage (Level 7) ebenso.
    assert.equal(r.perDiff.d.coopLost, 1);
    assert.equal(r.coopLosses, 1);
  });
  test('ignores non-endless entries, score 0 and malformed input', () => {
    const log = [
      { id: 'w', ts: 1, amount: 40, reason: 'win', meta: { mode: 'solo' } },
      { id: 'z', ts: 2, amount: 0, reason: 'endless', meta: { mode: 'endless', score: 0 } },
      null,
      { id: 'n', ts: 3, amount: 5, reason: 'endless' },   // ohne meta
    ];
    const r = reconstructEndlessRuns(log, IDS);
    assert.equal(r.runCount, 0);
    assert.equal(r.wins + r.coopWins + r.losses + r.coopLosses, 0);
    assert.deepEqual(reconstructEndlessRuns(null, IDS).runCount, 0);
    assert.deepEqual(reconstructEndlessRuns([], []).runCount, 0);
  });
});

describe('endless.isRecord', () => {
  test('true only when the score beats the previous best', () => {
    assert.equal(endlessIsRecord(5, 4), true);
    assert.equal(endlessIsRecord(4, 4), false);
    assert.equal(endlessIsRecord(3, 4), false);
    assert.equal(endlessIsRecord(1, 0), true);
    assert.equal(endlessIsRecord(0, 0), false);   // 0 Level ist kein Rekord
  });
});
