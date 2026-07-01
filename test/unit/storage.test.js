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
  loadStats, recordResult, loadSeenVersion, saveSeenVersion,
  importFromFile, generateId,
  loadStreak, recordStreakResult, loadAchievements, unlockAchievements,
  loadRace, recordRaceWin, recordRaceLoss,
  loadInventory, inventoryHas, grantInventory, revokeInventory, mergeInventory,
  loadWallet, grantCurrency, spendCurrency, loadProfile, saveProfile,
  collectExportData,
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

  test('a session older than the 5-minute TTL expires and is removed on read', () => {
    saveCoopSession({ code: '123456', role: 'host' });
    const raw = JSON.parse(globalThis.localStorage.getItem('cns_coop_session'));
    raw.ts = Date.now() - 6 * 60 * 1000; // 6 minutes ago, past the 5-minute TTL
    globalThis.localStorage.setItem('cns_coop_session', JSON.stringify(raw));
    assert.equal(loadCoopSession(), null);
    assert.equal(globalThis.localStorage.getItem('cns_coop_session'), null); // self-cleaned up
  });

  test('a session just inside the 5-minute TTL is still valid', () => {
    saveCoopSession({ code: '123456', role: 'host' });
    const raw = JSON.parse(globalThis.localStorage.getItem('cns_coop_session'));
    raw.ts = Date.now() - 4 * 60 * 1000; // 4 minutes ago, still inside the TTL
    globalThis.localStorage.setItem('cns_coop_session', JSON.stringify(raw));
    assert.ok(loadCoopSession());
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
    const payload = JSON.stringify({
      ts: Date.now(), v: 1, label: 'manual',
      settings: { darkMode: false },
      activeGame: { difficulty: 'leicht' },
      stats: { played: 5 },
    });
    const data = importFromFile(payload);
    assert.equal(data.settings.darkMode, false);
    assert.equal(loadSettings().darkMode, false);
    assert.deepEqual(loadActiveGame(), { difficulty: 'leicht' });
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

  test('loadRace returns empty defaults for both modes when nothing is stored', () => {
    assert.deepEqual(loadRace(), { '1v1': EMPTY_MODE, '2v2': EMPTY_MODE });
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
