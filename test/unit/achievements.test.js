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

  test('big-numbers achievements only unlock in big-numbers mode', () => {
    // Klassisch (kein bigNumbers) → keine Big-Zahlen-Abzeichen
    const classic = evaluate({ outcome: 'won', bigNumbers: false, perfect: true, difficulty: 'rip' }, []);
    assert.ok(!classic.includes('bigFirstWin'));
    assert.ok(!classic.includes('bigPerfect'));
    assert.ok(!classic.includes('bigRip'));
    assert.ok(classic.includes('ripWin')); // R.I.P.-Sieg zählt aber
    // Big-Numbers-Sieg → erstes Big-Abzeichen
    const big = evaluate({ outcome: 'won', bigNumbers: true }, []);
    assert.ok(big.includes('bigFirstWin'));
    assert.ok(!big.includes('bigPerfect'));   // nicht perfekt
    // Perfekter Big-Numbers-Sieg auf R.I.P. → alle drei
    const bigPerfectRip = evaluate({ outcome: 'won', bigNumbers: true, perfect: true, difficulty: 'rip' }, []);
    assert.ok(bigPerfectRip.includes('bigFirstWin'));
    assert.ok(bigPerfectRip.includes('bigPerfect'));
    assert.ok(bigPerfectRip.includes('bigRip'));
    assert.ok(bigPerfectRip.includes('ripWin'));
  });

  test('ripWin only unlocks on the R.I.P. difficulty', () => {
    assert.ok(!evaluate({ outcome: 'won', difficulty: 'mashallah' }, []).includes('ripWin'));
    assert.ok(evaluate({ outcome: 'won', difficulty: 'rip' }, []).includes('ripWin'));
  });
});
