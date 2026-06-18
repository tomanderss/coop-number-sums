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
  loadStats, recordResult, loadSeenVersion, saveSeenVersion,
  createBackup, loadBackups, restoreBackup, importFromFile, generateId,
} = await import('../../js/storage.js');
const { DEFAULT_SETTINGS } = await import('../../js/config.js');

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

  test('giving up is tallied separately from losing', () => {
    const { stats } = recordResult({ difficulty: 'mittel', outcome: 'gaveup', timeMs: 1000, hintsUsed: 0, mistakes: 0 });
    assert.equal(stats.gaveup, 1);
    assert.equal(stats.lost, 0);
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

describe('storage.backups', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  // createBackup throttles repeat calls to once per 3s via a module-level
  // timestamp shared across this whole test file, so all backup-creation
  // assertions live in one test to avoid later calls being silently skipped.
  test('createBackup stores a restorable snapshot, restoreBackup applies it', () => {
    saveSettings({ darkMode: false });
    createBackup('manual');
    const backups = loadBackups();
    assert.equal(backups.length, 1);
    assert.equal(backups[0].label, 'manual');

    saveSettings({ darkMode: true }); // mutate after backup
    const ok = restoreBackup(backups[0].slot);
    assert.equal(ok, true);
    assert.equal(loadSettings().darkMode, false); // restored from backup
  });

  test('restoreBackup returns false for an empty slot', () => {
    assert.equal(restoreBackup(2), false);
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

describe('storage.generateId', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('produces unique-looking ids', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()));
    assert.equal(ids.size, 20);
  });
});
