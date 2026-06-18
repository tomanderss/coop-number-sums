import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { todayDateStr, getDailyChallenge } from '../../js/daily.js';
import { DIFFICULTIES } from '../../js/config.js';

describe('daily.todayDateStr', () => {
  test('formats as YYYY-MM-DD with zero-padding', () => {
    assert.equal(todayDateStr(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(todayDateStr(new Date(2026, 10, 23)), '2026-11-23');
  });
});

describe('daily.getDailyChallenge', () => {
  test('is fully deterministic for a given date', () => {
    const a = getDailyChallenge('2026-06-18');
    const b = getDailyChallenge('2026-06-18');
    assert.deepEqual(a, b);
  });

  test('difficulty is always one of the three easiest tiers', () => {
    const allowed = new Set(DIFFICULTIES.slice(0, 3).map(d => d.id));
    for (let day = 1; day <= 28; day++) {
      const dateStr = `2026-01-${String(day).padStart(2, '0')}`;
      assert.ok(allowed.has(getDailyChallenge(dateStr).difficulty));
    }
  });

  test('different dates yield different seeds', () => {
    const a = getDailyChallenge('2026-06-18');
    const b = getDailyChallenge('2026-06-19');
    assert.notEqual(a.seed, b.seed);
  });
});
