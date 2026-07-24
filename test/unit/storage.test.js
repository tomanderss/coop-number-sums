import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
  clear() { this.#map.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const {
  loadSettings, saveSettings, loadActiveGame, saveActiveGame,
  loadActiveGameCoop, saveActiveGameCoop,
  saveCoopSession, loadCoopSession, clearCoopSession,
  loadStats, recordResult, applyEndlessBackfill, loadSeenVersion, saveSeenVersion,
  importFromFile, generateId,
  loadStreak, recordStreakResult, loadAchievements, unlockAchievements,
  loadRace, recordRaceWin, recordRaceLoss,
  loadInventory, inventoryHas, grantInventory, revokeInventory, mergeInventory,
  reconcileInventoryFromCloud, applyCloudWallet,
  loadWallet, grantCurrency, spendCurrency, loadProfile, saveProfile,
  collectExportData, pickActiveGame, snapshotSolved, loadActiveGameBackup,
  loadWalletLog, mergeWalletLogs, unexplainedWalletDelta,
} = await import('../../js/storage.js');
const { DEFAULT_SETTINGS } = await import('../../js/config.js');
const { todayDateStr } = await import('../../js/streak.js');

describe('storage.settings', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadSettings returns defaults when nothing is stored', () => {
    assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  });

  test('saveSettings persists and merges with defaults on load', () => {
    saveSettings({ darkMode: false });
    const loaded = loadSettings();
    assert.equal(loaded.darkMode, false);
    assert.equal(loaded.errorReveal, DEFAULT_SETTINGS.errorReveal); // untouched default preserved
  });

  // Theme-Migration: der frühere boolesche Dunkelmodus wird als EXPLIZITE Wahl
  // beibehalten; ohne gespeicherte Wahl gilt 'auto' (folgt dem System-Theme).
  test('themeMode migrates from a stored darkMode boolean, defaults to auto', () => {
    assert.equal(loadSettings().themeMode, 'auto');            // frische Installation
    saveSettings({ darkMode: true });
    assert.equal(loadSettings().themeMode, 'dark');            // alte Dunkel-Wahl bleibt dunkel
    saveSettings({ darkMode: false });
    assert.equal(loadSettings().themeMode, 'light');           // alte Hell-Wahl bleibt hell
    saveSettings({ darkMode: false, themeMode: 'auto' });
    assert.equal(loadSettings().themeMode, 'auto');            // explizite neue Wahl gewinnt
  });
});

describe('storage.activeGame', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadActiveGame is null when nothing saved', () => {
    assert.equal(loadActiveGame(), null);
  });

  test('saveActiveGame round-trips an object, and null removes it', () => {
    const game = { difficulty: 'mittel', elapsed: 1234 };
    saveActiveGame(game);
    assert.deepEqual(loadActiveGame(), game);
    saveActiveGame(null);
    assert.equal(loadActiveGame(), null);
  });
});

describe('storage.activeGameCoop', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadActiveGameCoop is null when nothing saved', () => {
    assert.equal(loadActiveGameCoop(), null);
  });

  test('saveActiveGameCoop round-trips an object, and null removes it', () => {
    const game = { difficulty: 'schwer', elapsed: 4321 };
    saveActiveGameCoop(game);
    assert.deepEqual(loadActiveGameCoop(), game);
    saveActiveGameCoop(null);
    assert.equal(loadActiveGameCoop(), null);
  });

  test('solo and coop active-game slots do not overwrite each other', () => {
    saveActiveGame({ difficulty: 'leicht' });
    saveActiveGameCoop({ difficulty: 'schwer' });
    assert.deepEqual(loadActiveGame(), { difficulty: 'leicht' });
    assert.deepEqual(loadActiveGameCoop(), { difficulty: 'schwer' });
    saveActiveGame(null);
    assert.equal(loadActiveGame(), null);
    assert.deepEqual(loadActiveGameCoop(), { difficulty: 'schwer' }); // untouched
  });
});

describe('storage.coopSession', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadCoopSession is null when nothing saved', () => {
    assert.equal(loadCoopSession(), null);
  });

  test('saveCoopSession round-trips the payload plus a timestamp', () => {
    saveCoopSession({ code: '123456', role: 'host' });
    const s = loadCoopSession();
    assert.equal(s.code, '123456');
    assert.equal(s.role, 'host');
    assert.ok(s.ts > 0);
  });

  test('clearCoopSession removes it', () => {
    saveCoopSession({ code: '123456', role: 'guest' });
    clearCoopSession();
    assert.equal(loadCoopSession(), null);
  });

  test('a session older than the 12-hour TTL expires and is removed on read', () => {
    saveCoopSession({ code: '123456', role: 'host' });
    const raw = JSON.parse(globalThis.localStorage.getItem('cns_coop_session'));
    raw.ts = Date.now() - 13 * 60 * 60 * 1000; // 13 hours ago, past the 12-hour TTL
    globalThis.localStorage.setItem('cns_coop_session', JSON.stringify(raw));
    assert.equal(loadCoopSession(), null);
    assert.equal(globalThis.localStorage.getItem('cns_coop_session'), null); // self-cleaned up
  });

  test('a session just inside the 12-hour TTL is still valid (e.g. hours after backgrounding)', () => {
    saveCoopSession({ code: '123456', role: 'host' });
    const raw = JSON.parse(globalThis.localStorage.getItem('cns_coop_session'));
    raw.ts = Date.now() - 11 * 60 * 60 * 1000; // 11 hours ago, still inside the TTL
    globalThis.localStorage.setItem('cns_coop_session', JSON.stringify(raw));
    assert.ok(loadCoopSession());
  });

  test('saveCoopSession preserves the rejoin event anchor (lastEventKey)', () => {
    saveCoopSession({ code: '123456', role: 'host', lastEventKey: '-OabcDEF123' });
    assert.equal(loadCoopSession().lastEventKey, '-OabcDEF123');
  });
});

describe('storage.recordResult', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('a perfect win sets a new highscore', () => {
    const { stats, newHighscore } = recordResult({
      difficulty: 'mittel', outcome: 'won', timeMs: 5000, hintsUsed: 0, mistakes: 0,
    });
    assert.equal(newHighscore, true);
    assert.equal(stats.won, 1);
    assert.equal(stats.currentStreak, 1);
    assert.equal(stats.byDifficulty.mittel.bestTimeMs, 5000);
  });

  test('a win with mistakes never sets a highscore', () => {
    const { newHighscore, stats } = recordResult({
      difficulty: 'mittel', outcome: 'won', timeMs: 1000, hintsUsed: 0, mistakes: 1,
    });
    assert.equal(newHighscore, false);
    assert.equal(stats.byDifficulty.mittel.bestTimeMs, null);
  });

  test('a faster perfect win overwrites a slower highscore', () => {
    recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 9000, hintsUsed: 0, mistakes: 0 });
    const { newHighscore, stats } = recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 3000, hintsUsed: 0, mistakes: 0 });
    assert.equal(newHighscore, true);
    assert.equal(stats.byDifficulty.mittel.bestTimeMs, 3000);
  });

  test('a slower perfect win does not overwrite an existing highscore', () => {
    recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 3000, hintsUsed: 0, mistakes: 0 });
    const { newHighscore, stats } = recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 9000, hintsUsed: 0, mistakes: 0 });
    assert.equal(newHighscore, false);
    assert.equal(stats.byDifficulty.mittel.bestTimeMs, 3000);
  });

  test('losing resets the current streak', () => {
    recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 1000, hintsUsed: 0, mistakes: 0 });
    const { stats } = recordResult({ difficulty: 'mittel', outcome: 'lost', timeMs: 1000, hintsUsed: 0, mistakes: 0 });
    assert.equal(stats.currentStreak, 0);
    assert.equal(stats.lost, 1);
    assert.equal(stats.bestStreak, 1); // best streak survives the reset
  });

  test('coop results are tallied separately from solo results', () => {
    recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 1000, hintsUsed: 0, mistakes: 0, coop: true });
    const stats = loadStats();
    assert.equal(stats.coopWon, 1);
    assert.equal(stats.won, 0);
    assert.equal(stats.byDifficulty.mittel.coopWon, 1);
    assert.equal(stats.byDifficulty.mittel.won, 0);
  });
});

// Endlos-Level laufen seit dem Einzelspiel-Umbau über recordResult (voller Sieg/
// volle Niederlage je Level — Zähler, Zeiten, Bestzeit) — die per-Level-Semantik
// („perfekt gilt pro Level") deckt die recordResult-Suite oben ab; das frühere
// recordEndlessLevelBest (nur-Bestzeit ohne Zähler) ist entfernt.

describe('storage.applyEndlessBackfill', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('books reconstructed wins/losses into global and per-difficulty counters', () => {
    // Vorbestand: 1 normaler Solo-Sieg (darf nicht überschrieben werden).
    recordResult({ difficulty: 'mittel', outcome: 'won', timeMs: 5000, hintsUsed: 0, mistakes: 0 });
    const s = applyEndlessBackfill({
      runCount: 2, wins: 3, coopWins: 2, losses: 1, coopLosses: 1,
      perDiff: {
        sehrleicht: { won: 2, coopWon: 1, lost: 0, coopLost: 0 },
        leicht: { won: 1, coopWon: 1, lost: 1, coopLost: 1 },
      },
    });
    assert.equal(s.won, 1 + 3);
    assert.equal(s.lost, 1);
    assert.equal(s.played, 1 + 4);        // 3 Siege + 1 Niederlage nachgebucht
    assert.equal(s.coopWon, 2);
    assert.equal(s.coopLost, 1);
    assert.equal(s.coopPlayed, 3);
    assert.equal(s.byDifficulty.sehrleicht.won, 2);
    assert.equal(s.byDifficulty.sehrleicht.coopWon, 1);
    assert.equal(s.byDifficulty.leicht.won, 1);
    assert.equal(s.byDifficulty.leicht.lost, 1);
    assert.equal(s.byDifficulty.leicht.played, 2);
    assert.equal(s.byDifficulty.leicht.coopPlayed, 2);
    // Bestehendes bleibt unangetastet: Bestzeit + mittel-Sieg.
    assert.equal(s.byDifficulty.mittel.won, 1);
    assert.equal(s.byDifficulty.mittel.bestTimeMs, 5000);
    // Keine erfundenen Werte: Streaks/Perfekt bleiben unberührt.
    assert.equal(s.perfectWins, 1);       // nur der echte perfekte Vorbestand
    assert.equal(s.currentStreak, 1);
  });
});

describe('storage.seenVersion', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('round-trips a version string', () => {
    assert.equal(loadSeenVersion(), null);
    saveSeenVersion('0.38');
    assert.equal(loadSeenVersion(), '0.38');
  });
});


describe('storage.importFromFile', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('imports settings, stats and active game from a JSON payload', () => {
    // activeGame wie ein echter Snapshot (mit puzzle) — Stände ohne puzzle sind
    // nicht fortsetzbar und werden vom konservativen Slot-Merge wie leer behandelt.
    const payload = JSON.stringify({
      ts: Date.now(), v: 1, label: 'manual',
      settings: { darkMode: false },
      activeGame: { difficulty: 'leicht', puzzle: { rows: 5 }, ts: 1 },
      stats: { played: 5 },
    });
    const data = importFromFile(payload);
    assert.equal(data.settings.darkMode, false);
    assert.equal(loadSettings().darkMode, false);
    assert.deepEqual(loadActiveGame(), { difficulty: 'leicht', puzzle: { rows: 5 }, ts: 1 });
    assert.equal(loadStats().played, 5);
  });
});

describe('storage.recordStreakResult', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadStreak returns empty defaults when nothing is stored', () => {
    assert.deepEqual(loadStreak(), {
      lastCompletedDate: null, currentStreak: 0, bestStreak: 0, totalCompleted: 0,
      lossNoticeShown: false, justLost: false,
    });
  });

  test('a first completion starts a streak of 1', () => {
    const d = recordStreakResult('2026-06-18');
    assert.equal(d.currentStreak, 1);
    assert.equal(d.bestStreak, 1);
    assert.equal(d.totalCompleted, 1);
    assert.equal(d.lastCompletedDate, '2026-06-18');
  });

  test('completing the next calendar day continues the streak', () => {
    recordStreakResult('2026-06-18');
    const d = recordStreakResult('2026-06-19');
    assert.equal(d.currentStreak, 2);
    assert.equal(d.bestStreak, 2);
  });

  test('skipping a day resets the streak to 1, but keeps bestStreak', () => {
    recordStreakResult('2026-06-18');
    recordStreakResult('2026-06-19');
    const d = recordStreakResult('2026-06-25');
    assert.equal(d.currentStreak, 1);
    assert.equal(d.bestStreak, 2);
  });

  test('replaying the same day again is idempotent (no double count)', () => {
    recordStreakResult('2026-06-18');
    const d = recordStreakResult('2026-06-18');
    assert.equal(d.currentStreak, 1);
    assert.equal(d.totalCompleted, 1);
  });

  test('flags: a first completion counts, is not a continuation, and is a new record', () => {
    const d = recordStreakResult('2026-06-18');
    assert.equal(d.justCounted, true);
    assert.equal(d.continued, false);
    assert.equal(d.isNewRecord, true); // 1 > previous best of 0
  });

  test('flags: continuing the next day counts, is a continuation, and sets a new record', () => {
    recordStreakResult('2026-06-18');
    const d = recordStreakResult('2026-06-19');
    assert.equal(d.justCounted, true);
    assert.equal(d.continued, true);
    assert.equal(d.isNewRecord, true); // 2 > previous best of 1
  });

  test('flags: a same-day replay does not count again', () => {
    recordStreakResult('2026-06-18');
    const d = recordStreakResult('2026-06-18');
    assert.equal(d.justCounted, false);
  });

  test('flags: restarting after a gap counts but is neither a continuation nor a record', () => {
    recordStreakResult('2026-06-18');
    recordStreakResult('2026-06-19'); // best becomes 2
    const d = recordStreakResult('2026-06-25'); // gap -> restart at 1
    assert.equal(d.justCounted, true);
    assert.equal(d.continued, false);
    assert.equal(d.isNewRecord, false); // 1 is not > best of 2
  });

  test('loadStreak resets a stale streak once a day was skipped, without waiting for the next completion', () => {
    recordStreakResult('2026-06-18'); // long in the past relative to any real "today" this test runs on
    const d = loadStreak();
    assert.equal(d.currentStreak, 0);
    assert.equal(d.bestStreak, 1);
    assert.equal(d.totalCompleted, 1);
    assert.equal(d.lastCompletedDate, '2026-06-18');
  });

  test('loadStreak flags justLost exactly once after a streak breaks', () => {
    recordStreakResult('2026-06-18');
    const first = loadStreak();
    assert.equal(first.justLost, true);
    const second = loadStreak();
    assert.equal(second.justLost, false);
  });

  test('loadStreak keeps a streak alive when the last completion was today', () => {
    recordStreakResult(todayDateStr());
    const d = loadStreak();
    assert.equal(d.currentStreak, 1);
  });
});

describe('storage.generateId', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('produces unique-looking ids', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()));
    assert.equal(ids.size, 20);
  });
});

describe('storage.achievements', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadAchievements is empty when nothing unlocked', () => {
    assert.deepEqual(loadAchievements(), {});
  });

  test('unlockAchievements records a timestamp per id and persists it', () => {
    const a = unlockAchievements(['firstWin']);
    assert.ok(a.firstWin > 0);
    assert.deepEqual(loadAchievements(), a);
  });

  test('unlockAchievements does not overwrite an already-unlocked timestamp', () => {
    const first = unlockAchievements(['firstWin']);
    const ts = first.firstWin;
    const second = unlockAchievements(['firstWin']);
    assert.equal(second.firstWin, ts);
  });

  test('unlockAchievements merges new ids with previously unlocked ones', () => {
    unlockAchievements(['firstWin']);
    const a = unlockAchievements(['tenWins']);
    assert.ok(a.firstWin > 0);
    assert.ok(a.tenWins > 0);
  });
});

describe('storage.race', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  const EMPTY_MODE = { racesPlayed: 0, racesWon: 0, racesLost: 0, fastestWinMs: null };

  test('loadRace returns empty defaults for all modes when nothing is stored', () => {
    assert.deepEqual(loadRace(), { '1v1': EMPTY_MODE, '2v2': EMPTY_MODE, 'ffa': EMPTY_MODE });
  });

  test('recordRaceWin/Loss track the ffa (free-for-all) bucket independently', () => {
    recordRaceWin('ffa', 4200);
    const r = recordRaceLoss('ffa');
    assert.equal(r['ffa'].racesPlayed, 2);
    assert.equal(r['ffa'].racesWon, 1);
    assert.equal(r['ffa'].racesLost, 1);
    assert.equal(r['ffa'].fastestWinMs, 4200);
    assert.deepEqual(r['1v1'], EMPTY_MODE);
    assert.deepEqual(r['2v2'], EMPTY_MODE);
  });

  test('recordRaceWin increments played/won and sets fastestWinMs for the given mode', () => {
    const r = recordRaceWin('1v1', 5000);
    assert.equal(r['1v1'].racesPlayed, 1);
    assert.equal(r['1v1'].racesWon, 1);
    assert.equal(r['1v1'].racesLost, 0);
    assert.equal(r['1v1'].fastestWinMs, 5000);
    assert.deepEqual(r['2v2'], EMPTY_MODE);
    assert.deepEqual(loadRace(), r);
  });

  test('a faster win lowers fastestWinMs', () => {
    recordRaceWin('1v1', 9000);
    const r = recordRaceWin('1v1', 3000);
    assert.equal(r['1v1'].fastestWinMs, 3000);
    assert.equal(r['1v1'].racesPlayed, 2);
    assert.equal(r['1v1'].racesWon, 2);
  });

  test('a slower win does not raise fastestWinMs', () => {
    recordRaceWin('1v1', 3000);
    const r = recordRaceWin('1v1', 9000);
    assert.equal(r['1v1'].fastestWinMs, 3000);
  });

  test('recordRaceLoss increments played/lost and leaves fastestWinMs untouched', () => {
    recordRaceWin('1v1', 4000);
    const r = recordRaceLoss('1v1');
    assert.equal(r['1v1'].racesPlayed, 2);
    assert.equal(r['1v1'].racesWon, 1);
    assert.equal(r['1v1'].racesLost, 1);
    assert.equal(r['1v1'].fastestWinMs, 4000);
  });

  test('recordRaceLoss without a prior win keeps fastestWinMs null', () => {
    const r = recordRaceLoss('1v1');
    assert.equal(r['1v1'].racesPlayed, 1);
    assert.equal(r['1v1'].racesLost, 1);
    assert.equal(r['1v1'].fastestWinMs, null);
  });

  test('1v1 and 2v2 stats are tracked independently', () => {
    recordRaceWin('1v1', 5000);
    recordRaceLoss('2v2');
    const r = loadRace();
    assert.equal(r['1v1'].racesWon, 1);
    assert.equal(r['1v1'].racesLost, 0);
    assert.equal(r['2v2'].racesWon, 0);
    assert.equal(r['2v2'].racesLost, 1);
  });
});

describe('storage.inventory', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadInventory is empty and inventoryHas is false when nothing owned', () => {
    assert.deepEqual(loadInventory(), {});
    assert.equal(inventoryHas('dynamicColor'), false);
  });

  test('grantInventory records acquiredAt + source and persists', () => {
    const inv = grantInventory('dynamicColor', 'code');
    assert.ok(inv.dynamicColor.acquiredAt > 0);
    assert.equal(inv.dynamicColor.source, 'code');
    assert.equal(inventoryHas('dynamicColor'), true);
    assert.deepEqual(loadInventory(), inv);
  });

  test('grantInventory is idempotent (keeps original acquiredAt + source)', () => {
    const first = grantInventory('dynamicColor', 'version');
    const ts = first.dynamicColor.acquiredAt;
    const second = grantInventory('dynamicColor', 'code');
    assert.equal(second.dynamicColor.acquiredAt, ts);
    assert.equal(second.dynamicColor.source, 'version'); // first source wins
  });

  test('revokeInventory removes an item', () => {
    grantInventory('dynamicColor', 'gift');
    revokeInventory('dynamicColor');
    assert.equal(inventoryHas('dynamicColor'), false);
  });

  test('mergeInventory adds missing items and keeps the earlier acquiredAt', () => {
    grantInventory('dynamicColor', 'code'); // local, "now"
    const localTs = loadInventory().dynamicColor.acquiredAt;
    mergeInventory({
      dynamicColor: { acquiredAt: 1, source: 'version' }, // earlier than local
      otherSkin: { acquiredAt: 50, source: 'gift' },      // not present locally
    });
    const inv = loadInventory();
    assert.equal(inv.dynamicColor.acquiredAt, 1); // earlier wins
    assert.ok(localTs > 1);
    assert.equal(inv.otherSkin.acquiredAt, 50);
    assert.equal(inv.otherSkin.source, 'gift');
  });
});

describe('storage.reconcileInventoryFromCloud', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('cloud gifts appear immediately, self-unlocks survive missing from cloud', () => {
    grantInventory('winfx_stars', 'shop');           // lokaler Kauf, noch nicht hochgesynct
    const inv = reconcileInventoryFromCloud({ winfx_dragon: { acquiredAt: 5, source: 'gift' } });
    assert.equal(inventoryHas('winfx_dragon'), true);  // Geschenk sofort da
    assert.equal(inventoryHas('winfx_stars'), true);   // Kauf bleibt erhalten
    assert.equal(inv.winfx_dragon.source, 'gift');
  });

  test('admin revoke removes gift-sourced items that vanished from cloud', () => {
    grantInventory('winfx_dragon', 'gift');
    grantInventory('dynamicColor', 'code');
    reconcileInventoryFromCloud({});                  // Cloud: alles entzogen
    assert.equal(inventoryHas('winfx_dragon'), false); // Geschenk weg
    assert.equal(inventoryHas('dynamicColor'), true);  // Selbst-Unlock bleibt
  });

  test('keeps the earlier acquiredAt when both sides own an item', () => {
    grantInventory('winfx_stars', 'shop');
    const inv = reconcileInventoryFromCloud({ winfx_stars: { acquiredAt: 3, source: 'sync' } });
    assert.equal(inv.winfx_stars.acquiredAt, 3);
  });

  test('tolerates null/garbage cloud values', () => {
    grantInventory('winfx_stars', 'shop');
    assert.equal(reconcileInventoryFromCloud(null).winfx_stars.source, 'shop');
    assert.equal(inventoryHas('winfx_stars'), true);
  });
});

describe('storage.applyCloudWallet', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('applies a valid cloud wallet (floored, non-negative)', () => {
    const w = applyCloudWallet({ balance: 123.9, updatedAt: 99 });
    assert.equal(w.balance, 123);
    assert.equal(loadWallet().updatedAt, 99);
  });

  test('ignores invalid payloads and keeps the local wallet', () => {
    grantCurrency(50);
    assert.equal(applyCloudWallet(null).balance, 50);
    assert.equal(applyCloudWallet({ balance: 'x' }).balance, 50);
  });
});

describe('storage.wallet', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadWallet starts at zero balance', () => {
    assert.equal(loadWallet().balance, 0);
  });

  test('grantCurrency adds (floored, non-negative) and persists', () => {
    grantCurrency(10.9, 'win');
    assert.equal(loadWallet().balance, 10);
    grantCurrency(-5, 'bug'); // negatives never subtract via grant
    assert.equal(loadWallet().balance, 10);
  });

  test('spendCurrency deducts when affordable and reports ok', () => {
    grantCurrency(30);
    const r = spendCurrency(12, 'buy');
    assert.equal(r.ok, true);
    assert.equal(r.balance, 18);
    assert.equal(loadWallet().balance, 18);
  });

  test('spendCurrency refuses when balance is insufficient and leaves it unchanged', () => {
    grantCurrency(5);
    const r = spendCurrency(99, 'buy');
    assert.equal(r.ok, false);
    assert.equal(r.balance, 5);
    assert.equal(loadWallet().balance, 5);
  });
});

describe('storage.profile', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('loadProfile returns role=user default when nothing stored', () => {
    const p = loadProfile();
    assert.equal(p.role, 'user');
    assert.equal(p.accountId, null);
    assert.equal(p.displayName, '');
  });

  test('saveProfile merges partial updates over existing fields', () => {
    saveProfile({ displayName: 'Tom' });
    saveProfile({ role: 'admin' });
    const p = loadProfile();
    assert.equal(p.displayName, 'Tom'); // preserved across the second partial save
    assert.equal(p.role, 'admin');
  });
});

describe('storage.collectExportData', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('export payload includes inventory/wallet/profile but NEVER the role', () => {
    grantInventory('dynamicColor', 'version');
    grantCurrency(7);
    saveProfile({ displayName: 'Tom', role: 'admin' });

    const json = collectExportData('manual');
    assert.ok(json.inventory.dynamicColor);
    assert.equal(json.wallet.balance, 7);
    assert.equal(json.profile.displayName, 'Tom');
    // Rolle ist serverseitig autoritativ und darf NIE in den Sync-Snapshot wandern.
    assert.equal(json.profile.role, undefined);
  });

  test('importFromFile restores inventory/wallet/profile but PRESERVES the local role', () => {
    saveProfile({ role: 'admin' });   // serverseitig gesetzte Admin-Rolle lokal
    importFromFile(JSON.stringify({
      inventory: { dynamicColor: { acquiredAt: 5, source: 'gift' } },
      wallet: { balance: 42, updatedAt: 1 },
      profile: { displayName: 'Mara', role: 'user', accountId: null, createdAt: 1 },
    }));
    assert.equal(inventoryHas('dynamicColor'), true);
    assert.equal(loadWallet().balance, 42);
    assert.equal(loadProfile().displayName, 'Mara');
    // Ein veraltetes 'user' aus dem Snapshot darf die Admin-Rolle NICHT überschreiben.
    assert.equal(loadProfile().role, 'admin');
  });
});

describe('storage.pickActiveGame (Import darf laufendes Spiel nie still löschen)', () => {
  const game = (ts) => ({ puzzle: { rows: 5 }, marks: [], elapsed: 1, ts });

  test('Import ohne Aktivspiel (null) → lokales laufendes Spiel bleibt', () => {
    const local = game(100);
    assert.equal(pickActiveGame(local, null), local);
    assert.equal(pickActiveGame(local, undefined), local);
  });
  test('kein lokales Spiel → Import übernehmen (auch null bleibt null)', () => {
    const imp = game(50);
    assert.equal(pickActiveGame(null, imp), imp);
    assert.equal(pickActiveGame(null, null), null);
  });
  test('beide vorhanden → der jüngere Stand (ts) gewinnt, bei Gleichstand lokal', () => {
    const oldG = game(100), newG = game(200);
    assert.equal(pickActiveGame(oldG, newG), newG);
    assert.equal(pickActiveGame(newG, oldG), newG);
    const a = game(100), b = game(100);
    assert.equal(pickActiveGame(a, b), a);
  });
  test('Stand ohne puzzle zählt wie kein Stand', () => {
    const local = game(100);
    assert.equal(pickActiveGame(local, { ts: 999 }), local);
    assert.equal(pickActiveGame({ ts: 999 }, local), local);
  });
  // Ein bereits gelöster Stand darf nie als „Fortsetzen" gewinnen (Bug: fertiges
  // Spiel tauchte als fortsetzbar auf, lud ein interaktionsloses 100%-Brett).
  const solvedGame = (ts) => ({
    ts, elapsed: 1,
    puzzle: { rows: 2, cols: 2, solution: [[true, false], [false, true]] },
    marks: [['kept', 'removed'], ['removed', 'kept']],
  });
  test('gelöster Import wird verworfen, lokales laufendes Spiel bleibt', () => {
    const local = game(100);
    assert.equal(pickActiveGame(local, solvedGame(999)), local); // trotz jüngerem ts
  });
  test('gelöster lokaler Stand wird verworfen zugunsten eines laufenden Imports', () => {
    const imp = game(50);
    assert.equal(pickActiveGame(solvedGame(999), imp), imp);
  });
  test('beide gelöst → null (nichts fortzusetzen)', () => {
    assert.equal(pickActiveGame(solvedGame(1), solvedGame(2)), null);
  });
});

describe('storage.snapshotSolved', () => {
  const p = { rows: 2, cols: 2, solution: [[true, false], [false, true]] };
  test('vollständig korrekt gelöstes Brett → true', () => {
    assert.equal(snapshotSolved({ puzzle: p, marks: [['kept', 'removed'], ['removed', 'kept']] }), true);
  });
  test('ein falscher/offener Zug → false', () => {
    assert.equal(snapshotSolved({ puzzle: p, marks: [['kept', 'removed'], ['removed', 'none']] }), false);
    assert.equal(snapshotSolved({ puzzle: p, marks: [['removed', 'removed'], ['removed', 'kept']] }), false);
  });
  test('fehlende Daten → false (kein Absturz)', () => {
    assert.equal(snapshotSolved(null), false);
    assert.equal(snapshotSolved({}), false);
    assert.equal(snapshotSolved({ puzzle: p }), false);
    assert.equal(snapshotSolved({ puzzle: { rows: 2, cols: 2 }, marks: [] }), false);
  });
});

describe('storage.importFromFile bewahrt Aktivspiel-Slots', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });
  const game = (ts) => ({ puzzle: { rows: 5 }, marks: [], elapsed: 1, ts });

  test('Cloud-Snapshot mit activeGame:null löscht das lokale Spiel NICHT (Update-Szenario)', () => {
    saveActiveGame(game(500));
    importFromFile(JSON.stringify({ activeGame: null, activeGameCoop: null }));
    assert.ok(loadActiveGame(), 'lokales Solo-Spiel muss den Import überleben');
    assert.equal(loadActiveGame().ts, 500);
  });
  test('jüngeres Cloud-Spiel ersetzt das lokale — verdrängter Stand landet im Backup', () => {
    saveActiveGame(game(100));
    importFromFile(JSON.stringify({ activeGame: game(900) }));
    assert.equal(loadActiveGame().ts, 900);
    assert.equal(loadActiveGameBackup().ts, 100, 'verdrängter Stand nie still gelöscht');
  });
  test('älteres Cloud-Spiel verdrängt das lokale nicht', () => {
    saveActiveGame(game(900));
    importFromFile(JSON.stringify({ activeGame: game(100) }));
    assert.equal(loadActiveGame().ts, 900);
  });
  test('Coop-Slot: Import mit null bewahrt lokales Coop-Spiel', () => {
    saveActiveGameCoop(game(300));
    importFromFile(JSON.stringify({ activeGameCoop: null }));
    assert.ok(loadActiveGameCoop());
  });
  test('leerer lokaler Slot übernimmt das importierte Spiel weiterhin', () => {
    importFromFile(JSON.stringify({ activeGame: game(700) }));
    assert.equal(loadActiveGame().ts, 700);
  });
});

describe('storage.walletLog (geräteübergreifende Herkunft des Guthabens)', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });
  const entry = (id, amount, reason, ts, meta) => ({ id, ts, amount, reason, ...(meta ? { meta } : {}) });

  test('grantCurrency schreibt Eintrag mit eindeutiger id + meta', () => {
    grantCurrency(120, 'win', { difficulty: 'mittel', mode: 'solo', mult: 2 });
    const l = loadWalletLog();
    assert.equal(l.length, 1);
    assert.ok(l[0].id, 'id fehlt');
    assert.equal(l[0].amount, 120);
    assert.equal(l[0].meta.difficulty, 'mittel');
  });
  test('mergeWalletLogs: Union nach id, jüngste zuerst, keine Duplikate', () => {
    const a = [entry('x', 100, 'win', 300), entry('y', -50, 'shop:frame_gold', 200)];
    const b = [entry('x', 100, 'win', 300), entry('z', 80, 'win', 400)];
    const m = mergeWalletLogs(a, b);
    assert.deepEqual(m.map(e => e.id), ['z', 'x', 'y']);
  });
  test('mergeWalletLogs: Alt-Einträge ohne id werden über Felder dedupliziert', () => {
    const legacy = { ts: 100, amount: 500, reason: 'win' };
    const m = mergeWalletLogs([legacy], [{ ...legacy }]);
    assert.equal(m.length, 1);
  });
  test('unexplainedWalletDelta: durch fremde Einträge erklärte Differenz ⇒ 0 (kein falsches Geschenk)', () => {
    const prev = [entry('a', 100, 'win', 100)];
    const merged = [entry('b', 8000, 'win', 300), entry('c', -2000, 'shop:x', 200), ...prev];
    // Cloud-Saldo lag 6000 über lokal — exakt durch +8000 Sieg und −2000 Kauf erklärt.
    assert.equal(unexplainedWalletDelta(prev, merged, 6000), 0);
  });
  test('unexplainedWalletDelta: unerklärter Rest bleibt übrig (echtes Admin-Geschenk)', () => {
    const prev = [];
    const merged = [entry('b', 1000, 'win', 300)];
    assert.equal(unexplainedWalletDelta(prev, merged, 3500), 2500);
  });
  test('applyCloudWallet bucht NUR den unerklärten Rest als gift', () => {
    grantCurrency(100, 'win');                     // lokal: 100
    const cloudLog = [entry('c1', 100, 'win', 1), entry('c2', 900, 'win', 2, { difficulty: 'rip' })];
    // Hmm: c1 entspricht nicht dem lokalen Eintrag (andere id) — bewusst NUR c2 als fremd rechnen:
    const local = loadWalletLog();
    const merged = mergeWalletLogs(local, [entry('c2', 900, 'win', 2)]);
    assert.equal(unexplainedWalletDelta(local, merged, 900), 0);
    // Voller Pfad: Cloud-Saldo 1500 = lokal 100 + 900 erspielt (erklärt) + 500 Geschenk (unerklärt)
    applyCloudWallet({ balance: 1500, updatedAt: Date.now() + 1000 }, [entry('c2', 900, 'win', 2)]);
    const l = loadWalletLog();
    assert.equal(loadWallet().balance, 1500);
    const gift = l.find(e => e.reason === 'gift');
    assert.ok(gift, 'Geschenk-Eintrag fehlt');
    assert.equal(gift.amount, 500);
    assert.ok(l.find(e => e.id === 'c2'), 'fremder win-Eintrag muss übernommen sein');
  });
  test('applyCloudWallet ohne unerklärten Rest bucht KEIN Geschenk', () => {
    grantCurrency(100, 'win');
    applyCloudWallet({ balance: 1100, updatedAt: Date.now() + 1000 }, [{ id: 'w9', ts: 5, amount: 1000, reason: 'win' }]);
    assert.equal(loadWallet().balance, 1100);
    assert.equal(loadWalletLog().filter(e => e.reason === 'gift').length, 0);
  });
  test('collectExportData/importFromFile nehmen den Verlauf mit (Union, nie schrumpfen)', () => {
    grantCurrency(100, 'win');
    const snap = collectExportData('sync');
    assert.equal(snap.walletLog.length, 1);
    globalThis.localStorage.clear();
    grantCurrency(50, 'win');
    importFromFile(JSON.stringify(snap));
    assert.equal(loadWalletLog().length, 2);   // eigener + importierter Eintrag
  });
});
