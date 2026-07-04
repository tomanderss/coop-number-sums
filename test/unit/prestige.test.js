import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESTIGE, allPrestige, categoryProgress, tierForValue,
  isUnlocked, encodeBadge, decodeBadge, prestigeBySym, isPrestigeSym,
} from '../../js/prestige.js';
import { hasBadgeMedal } from '../../js/badgeart.js';

describe('prestige', () => {
  test('exactly 12 categories, each with a drawable medal symbol and 4 ascending thresholds', () => {
    assert.equal(PRESTIGE.length, 12);
    const syms = new Set();
    for (const p of PRESTIGE) {
      assert.ok(!syms.has(p.sym), `duplicate symbol ${p.sym}`); syms.add(p.sym);
      assert.ok(hasBadgeMedal(p.sym), `no medal art for ${p.sym}`);
      assert.equal(p.thresholds.length, 4);
      for (let i = 1; i < 4; i++) assert.ok(p.thresholds[i] > p.thresholds[i - 1], `${p.sym} thresholds must ascend`);
      assert.equal(typeof p.metric, 'function');
    }
  });

  test('tierForValue maps a value to 0..4 by ascending thresholds', () => {
    const th = [5, 15, 40, 100];
    assert.equal(tierForValue(0, th), 0);
    assert.equal(tierForValue(4, th), 0);
    assert.equal(tierForValue(5, th), 1);
    assert.equal(tierForValue(14, th), 1);
    assert.equal(tierForValue(15, th), 2);
    assert.equal(tierForValue(99, th), 3);
    assert.equal(tierForValue(100, th), 4);
    assert.equal(tierForValue(9999, th), 4);
  });

  test('categoryProgress reports tier, next threshold and a clamped fraction', () => {
    const cat = prestigeBySym('trophae'); // soloWins, [10,50,150,500]
    const ctx = { stats: { won: 30 } };
    const p = categoryProgress(cat, ctx);
    assert.equal(p.value, 30);
    assert.equal(p.tier, 1);           // 30 ≥ 10, < 50
    assert.equal(p.next, 50);
    assert.ok(p.frac > 0 && p.frac < 1);
    // legendary reached ⇒ next null, frac 1
    const maxed = categoryProgress(cat, { stats: { won: 600 } });
    assert.equal(maxed.tier, 4);
    assert.equal(maxed.next, null);
    assert.equal(maxed.frac, 1);
  });

  test('metrics read the right stat sources', () => {
    const ctx = {
      difficulties: ['a', 'b', 'c'],
      streak: { bestStreak: 8 },
      race: { '1v1': { racesWon: 12 }, '2v2': { racesWon: 3 } },
      stats: {
        won: 40, coopWon: 10, played: 60, coopPlayed: 15, perfectWins: 20, coopPerfectWins: 6,
        byDifficulty: {
          a: { won: 20, bestTimeMs: 1000 },
          b: { coopWon: 5, coopBestTimeMs: 2000 },
          c: { won: 15 }, // top difficulty, no best time
        },
      },
    };
    const get = key => allPrestige(ctx).find(p => p.key === key).value;
    assert.equal(get('soloMaster'), 40);
    assert.equal(get('teamSpirit'), 10);
    assert.equal(get('duelist'), 12);
    assert.equal(get('teamDuel'), 3);
    assert.equal(get('streak'), 8);
    assert.equal(get('flawless'), 26);       // 20 + 6
    assert.equal(get('perfectTeam'), 6);
    assert.equal(get('thinker'), 50);        // 40 + 10
    assert.equal(get('endurance'), 75);      // 60 + 15
    assert.equal(get('recordHunter'), 2);    // a + b have best times
    assert.equal(get('topClass'), 15);       // top difficulty 'c' wins
    assert.equal(get('explorer'), 3);        // a, b, c all have ≥1 win
  });

  test('isUnlocked gates a (symbol, tier) by the category metric', () => {
    const ctx = { stats: { won: 60 } }; // trophae tier 2 (≥50)
    assert.equal(isUnlocked('trophae', 1, ctx), true);
    assert.equal(isUnlocked('trophae', 2, ctx), true);
    assert.equal(isUnlocked('trophae', 3, ctx), false);
    assert.equal(isUnlocked('nonsense', 1, ctx), false);
    assert.equal(isUnlocked('trophae', 5, ctx), false);
  });

  test('encode/decode badge round-trips and accepts the legacy symbol-only format', () => {
    assert.equal(encodeBadge('drache', 3), 'drache-3');
    assert.deepEqual(decodeBadge('drache-3'), { sym: 'drache', tier: 3 });
    assert.deepEqual(decodeBadge('stern'), { sym: 'stern', tier: 1 }); // legacy
    assert.equal(decodeBadge('drache-9'), null);
    assert.equal(decodeBadge('bogus'), null);
    assert.equal(decodeBadge(''), null);
    assert.equal(decodeBadge(null), null);
    assert.equal(decodeBadge('<script>'), null);
  });

  test('isPrestigeSym only accepts the 12 catalog symbols', () => {
    assert.ok(isPrestigeSym('krone'));
    assert.ok(!isPrestigeSym('confetti'));
    assert.ok(!isPrestigeSym(''));
  });
});
