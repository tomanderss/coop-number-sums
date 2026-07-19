import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENDLESS_CFG, endlessDiffIndex, endlessDiffId, endlessGrantsLife,
  endlessLivesAfter, endlessRunCoins, endlessIsRecord,
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

describe('endless.coins', () => {
  const base = (i) => [10, 20, 30, 40][i] || 0;
  test('sums the difficulty base of every cleared level', () => {
    assert.equal(endlessRunCoins(0, 4, base), 0);
    assert.equal(endlessRunCoins(1, 4, base), 10);
    assert.equal(endlessRunCoins(3, 4, base), 10 + 20 + 30);
    // Level 5 wickelt auf Index 0 zurück (Basis 10) → 10+20+30+40 + 10
    assert.equal(endlessRunCoins(5, 4, base), 10 + 20 + 30 + 40 + 10);
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
