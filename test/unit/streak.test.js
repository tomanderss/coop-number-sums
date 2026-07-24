import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { todayDateStr, isValidDateStr, shiftDateStr, sanitizeLastCompleted } from '../../js/streak.js';

describe('streak.todayDateStr', () => {
  test('formats as YYYY-MM-DD with zero-padding', () => {
    assert.equal(todayDateStr(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(todayDateStr(new Date(2026, 10, 23)), '2026-11-23');
  });
});

describe('streak.isValidDateStr', () => {
  test('accepts strict YYYY-MM-DD only', () => {
    assert.equal(isValidDateStr('2026-07-24'), true);
    assert.equal(isValidDateStr('24.07.2026'), false);   // deutsches Format
    assert.equal(isValidDateStr('2026-7-4'), false);     // ohne Nullen
    assert.equal(isValidDateStr('2026-07-24T00:00'), false);
    assert.equal(isValidDateStr(''), false);
    assert.equal(isValidDateStr(null), false);
    assert.equal(isValidDateStr(1753000000000), false);  // Timestamp-Zahl
  });
});

describe('streak.shiftDateStr', () => {
  test('shifts across month and year boundaries', () => {
    assert.equal(shiftDateStr('2026-07-24', -1), '2026-07-23');
    assert.equal(shiftDateStr('2026-08-01', -1), '2026-07-31');
    assert.equal(shiftDateStr('2026-01-01', -1), '2025-12-31');
    assert.equal(shiftDateStr('2026-02-28', 1), '2026-03-01');
  });
});

describe('streak.sanitizeLastCompleted (Selbstheilung vergifteter Daten)', () => {
  const today = '2026-07-24';
  test('valid past/today dates pass through unchanged', () => {
    assert.equal(sanitizeLastCompleted('2026-07-24', today), '2026-07-24');
    assert.equal(sanitizeLastCompleted('2026-07-23', today), '2026-07-23');
    assert.equal(sanitizeLastCompleted('2025-01-01', today), '2025-01-01');
  });
  test('empty stays empty (no invented activity)', () => {
    assert.equal(sanitizeLastCompleted(null, today), null);
    assert.equal(sanitizeLastCompleted('', today), null);
  });
  test('malformed (e.g. German format) heals to YESTERDAY so today counts +1', () => {
    assert.equal(sanitizeLastCompleted('24.07.2026', today), '2026-07-23');
    assert.equal(sanitizeLastCompleted('kaputt', today), '2026-07-23');
  });
  test('future dates heal to YESTERDAY (poisoned clock/admin input)', () => {
    assert.equal(sanitizeLastCompleted('2026-08-01', today), '2026-07-23');
    assert.equal(sanitizeLastCompleted('2999-01-01', today), '2026-07-23');
  });
});
