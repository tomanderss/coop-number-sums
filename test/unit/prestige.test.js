import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESTIGE, allPrestige, categoryProgress, tierForValue,
  isUnlocked, encodeBadge, decodeBadge, prestigeBySym, isPrestigeSym,
  MASTER_BADGE, isMasterBadge, masterProgress, hasMasterBadge,
  unlockedTierCodes, newlyUnlockedTiers, headlineUnlock,
} from '../../js/prestige.js';
import { hasBadgeMedal, masterMedalMarkup } from '../../js/badgeart.js';

// Kontext, der ALLE 12 Kategorien auf Stufe 4 (Legendär) bringt.
function fullyMasteredCtx() {
  const diffs = Array.from({ length: 9 }, (_, i) => 'd' + i);
  const bd = {}; diffs.forEach(id => { bd[id] = { won: 200, coopWon: 20, bestTimeMs: 30000 }; });
  return {
    stats: { won: 1000, coopWon: 200, perfectWins: 200, coopPerfectWins: 90, played: 800, coopPlayed: 300, byDifficulty: bd },
    streak: { bestStreak: 40 },
    race: { '1v1': { racesWon: 120 }, '2v2': { racesWon: 120 } },
    difficulties: diffs,
  };
}

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
    const cat = prestigeBySym('trophae'); // soloWins, [10,40,80,180]
    const ctx = { stats: { won: 30 } };
    const p = categoryProgress(cat, ctx);
    assert.equal(p.value, 30);
    assert.equal(p.tier, 1);           // 30 ≥ 10, < 40
    assert.equal(p.next, 40);
    // Balken relativ zur NÄCHSTEN Schwelle: 30 von 40 = 75%
    assert.equal(p.frac, 30 / 40);
    // legendary reached ⇒ next null, frac 1
    const maxed = categoryProgress(cat, { stats: { won: 600 } });
    assert.equal(maxed.tier, 4);
    assert.equal(maxed.next, null);
    assert.equal(maxed.frac, 1);
  });

  test('frac deckt sich mit der „Noch n"-Anzeige — 8/9 ist fast voll, nicht 50%', () => {
    const cat = prestigeBySym('alien'); // explorer, [3,5,7,9]
    const p = categoryProgress(cat, { stats: { byDifficulty: Object.fromEntries(
      ['a','b','c','d','e','f','g','h'].map(id => [id, { won: 1 }])
    ) } });
    assert.equal(p.value, 8);
    assert.equal(p.next, 9);
    assert.equal(p.frac, 8 / 9);       // vorher: (8−7)/(9−7) = 50% — der Bug
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

  test('master badge unlocks only when ALL categories are at tier 4', () => {
    const empty = { stats: {}, streak: {}, race: {}, difficulties: [] };
    assert.equal(masterProgress(empty).maxed, 0);
    assert.equal(masterProgress(empty).unlocked, false);
    assert.equal(hasMasterBadge(empty), false);

    const full = fullyMasteredCtx();
    const mp = masterProgress(full);
    assert.equal(mp.total, PRESTIGE.length);
    assert.equal(mp.maxed, PRESTIGE.length);
    assert.equal(mp.unlocked, true);
    assert.equal(hasMasterBadge(full), true);
    // Alle Kategorien wirklich auf Stufe 4?
    assert.ok(allPrestige(full).every(p => p.tier === 4));

    // Eine Kategorie knapp unter Legendär ⇒ Master bleibt gesperrt.
    const oneShort = fullyMasteredCtx();
    oneShort.streak = { bestStreak: 24 }; // flamme t4 = 25
    assert.equal(hasMasterBadge(oneShort), false);
    assert.equal(masterProgress(oneShort).maxed, PRESTIGE.length - 1);
  });

  test('isMasterBadge + masterMedalMarkup', () => {
    assert.ok(isMasterBadge(MASTER_BADGE));
    assert.ok(!isMasterBadge('drache-4'));
    assert.ok(!isMasterBadge('none'));
    const svg = masterMedalMarkup({ size: 40 });
    assert.match(svg, /^<svg/);
    assert.match(svg, /bmm-halo/);
  });
});

describe('prestige.newlyUnlockedTiers / headlineUnlock (Aufstiegs-Feier)', () => {
  // trophae = soloMaster, thresholds [10,50,150,500]; flamme = streak [3,7,14,30].
  const ctx = (won, best) => ({ stats: { won }, streak: { bestStreak: best }, race: {}, difficulties: [] });

  test('unlockedTierCodes listet Stufen 1..tier je Kategorie', () => {
    const codes = unlockedTierCodes(ctx(60, 0));   // soloMaster tier 2 (≥50)
    assert.ok(codes.includes('trophae-1'));
    assert.ok(codes.includes('trophae-2'));
    assert.ok(!codes.includes('trophae-3'));
  });
  test('newlyUnlockedTiers: nur noch nicht gefeierte Stufen', () => {
    const already = unlockedTierCodes(ctx(10, 0));   // soloMaster tier 1
    const fresh = newlyUnlockedTiers(ctx(60, 0), already);  // jetzt tier 2
    const codes = fresh.map(f => f.code);
    assert.ok(codes.includes('trophae-2'), 'neue Stufe 2 muss dabei sein');
    assert.ok(!codes.includes('trophae-1'), 'bereits gefeierte Stufe 1 nicht mehr');
    const tro = fresh.find(f => f.code === 'trophae-2');
    assert.equal(tro.tier, 2);
    assert.equal(tro.key, 'soloMaster');
  });
  test('nichts Neues → leere Liste', () => {
    const seen = unlockedTierCodes(ctx(60, 0));
    assert.deepEqual(newlyUnlockedTiers(ctx(60, 0), seen), []);
  });
  test('headlineUnlock nimmt die höchste Stufe (mehrere gleichzeitig)', () => {
    // Frischer Account (nichts gefeiert): soloMaster t1 + streak-Legendär t1..4.
    const fresh = newlyUnlockedTiers(ctx(10, 30), []);
    const head = headlineUnlock(fresh);
    assert.equal(head.tier, 4);       // Legendär gewinnt
    assert.equal(head.sym, prestigeBySym('flamme').sym);
  });
  test('headlineUnlock: leere Liste → null', () => {
    assert.equal(headlineUnlock([]), null);
    assert.equal(headlineUnlock(null), null);
  });
  test('Set wird als celebrated akzeptiert (nicht nur Array)', () => {
    const fresh = newlyUnlockedTiers(ctx(60, 0), new Set(['trophae-1']));
    const codes = fresh.map(f => f.code);
    assert.ok(codes.includes('trophae-2') && !codes.includes('trophae-1'));
  });
});
