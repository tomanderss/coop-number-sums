import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekStr, getBossChallenge } from '../../js/boss.js';
import { DIFFICULTIES } from '../../js/config.js';

describe('boss.isoWeekStr', () => {
  test('Monday and Thursday of the same ISO week match', () => {
    assert.equal(isoWeekStr(new Date(2025, 11, 29)), isoWeekStr(new Date(2026, 0, 1)));
  });

  test('the following week differs', () => {
    assert.notEqual(isoWeekStr(new Date(2026, 0, 1)), isoWeekStr(new Date(2026, 0, 5)));
  });

  test('the year-boundary week is attributed to the Thursday-owning year', () => {
    assert.equal(isoWeekStr(new Date(2026, 11, 31)), isoWeekStr(new Date(2027, 0, 1)));
    assert.equal(isoWeekStr(new Date(2026, 11, 31)), '2026-W53');
  });
});

describe('boss.getBossChallenge', () => {
  test('is fully deterministic for a given week', () => {
    const a = getBossChallenge('2026-W25');
    const b = getBossChallenge('2026-W25');
    assert.deepEqual(a, b);
  });

  test('difficulty is always one of the three hardest tiers', () => {
    const allowed = new Set(DIFFICULTIES.slice(-3).map(d => d.id));
    for (let week = 1; week <= 52; week++) {
      const weekStr = `2026-W${String(week).padStart(2, '0')}`;
      assert.ok(allowed.has(getBossChallenge(weekStr).difficulty));
    }
  });

  test('different weeks yield different seeds', () => {
    const a = getBossChallenge('2026-W25');
    const b = getBossChallenge('2026-W26');
    assert.notEqual(a.seed, b.seed);
  });
});
