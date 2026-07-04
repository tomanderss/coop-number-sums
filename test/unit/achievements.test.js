import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, evaluate } from '../../js/achievements.js';
import { hasIcon } from '../../js/icons.js';

describe('achievements.evaluate', () => {

  test('every achievement has a drawn custom icon (no emoji)', () => {
    for (const a of ACHIEVEMENTS) {
      assert.ok(a.icon && hasIcon(a.icon), `achievement '${a.id}' needs a drawn icon, got '${a.icon}'`);
    }
  });
  test('unlocks firstWin on a won game with no other ids previously unlocked', () => {
    const newly = evaluate({ outcome: 'won' }, []);
    assert.ok(newly.includes('firstWin'));
  });

  test('does not re-unlock an id that is already in unlockedIds', () => {
    const newly = evaluate({ outcome: 'won' }, ['firstWin']);
    assert.ok(!newly.includes('firstWin'));
  });

  test('does not unlock anything on a lost game with no other qualifying context', () => {
    const newly = evaluate({ outcome: 'lost' }, []);
    assert.deepEqual(newly, []);
  });

  test('every achievement id is unique', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('can unlock multiple ids at once', () => {
    const newly = evaluate({ outcome: 'won', perfect: true, totalWon: 10 }, []);
    assert.ok(newly.includes('firstWin'));
    assert.ok(newly.includes('perfectWin'));
    assert.ok(newly.includes('tenWins'));
  });
});
