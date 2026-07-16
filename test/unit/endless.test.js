import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENDLESS_CFG, endlessDiffIndex, endlessDiffId, endlessGrantsLife,
  endlessLivesAfter, endlessRunCoins, endlessIsRecord,
} from '../../js/endless.js';

const IDS = ['a', 'b', 'c', 'd']; // 4-stufige Leiter zum Testen

describe('endless.diffIndex/diffId', () => {
  test('climbs one step per level and caps at the top', () => {
    assert.equal(endlessDiffIndex(1, 4), 0);
    assert.equal(endlessDiffIndex(2, 4), 1);
    assert.equal(endlessDiffIndex(4, 4), 3);
    assert.equal(endlessDiffIndex(5, 4), 3);   // gedeckelt
    assert.equal(endlessDiffIndex(99, 4), 3);
  });
  test('level below 1 clamps to the easiest', () => {
    assert.equal(endlessDiffIndex(0, 4), 0);
    assert.equal(endlessDiffIndex(-3, 4), 0);
  });
  test('diffId maps through the ladder', () => {
    assert.equal(endlessDiffId(1, IDS), 'a');
    assert.equal(endlessDiffId(3, IDS), 'c');
    assert.equal(endlessDiffId(10, IDS), 'd');
    assert.equal(endlessDiffId(1, []), null);
  });
});

describe('endless.lives', () => {
  test('grants a life every lifeRefillEvery levels', () => {
    assert.equal(endlessGrantsLife(3), true);
    assert.equal(endlessGrantsLife(6), true);
    assert.equal(endlessGrantsLife(1), false);
    assert.equal(endlessGrantsLife(4), false);
    assert.equal(endlessGrantsLife(0), false);
  });
  test('livesAfter refills but never exceeds maxLives', () => {
    assert.equal(endlessLivesAfter(2, 3), 3);       // +1 auf Level 3
    assert.equal(endlessLivesAfter(2, 2), 2);       // kein Refill
    assert.equal(endlessLivesAfter(ENDLESS_CFG.maxLives, 3), ENDLESS_CFG.maxLives); // gedeckelt
    assert.equal(endlessLivesAfter(5, 6, { maxLives: 5, lifeRefillEvery: 3 }), 5);
  });
});

describe('endless.coins', () => {
  const base = (i) => [10, 20, 30, 40][i] || 0;
  test('sums the difficulty base of every cleared level', () => {
    assert.equal(endlessRunCoins(0, 4, base), 0);
    assert.equal(endlessRunCoins(1, 4, base), 10);
    assert.equal(endlessRunCoins(3, 4, base), 10 + 20 + 30);
    // Level 5 liegt auf der gedeckelten Top-Stufe (Index 3 = 40)
    assert.equal(endlessRunCoins(5, 4, base), 10 + 20 + 30 + 40 + 40);
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
