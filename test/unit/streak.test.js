import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { todayDateStr } from '../../js/streak.js';

describe('streak.todayDateStr', () => {
  test('formats as YYYY-MM-DD with zero-padding', () => {
    assert.equal(todayDateStr(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(todayDateStr(new Date(2026, 10, 23)), '2026-11-23');
  });
});
