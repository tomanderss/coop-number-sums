import { test, describe } from 'node:test';
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
  normalizeUsername, isValidUsername, isValidEmail, passwordIssue, usernameKey, errKey,
  isSignedIn, lastSyncAt, decideSync, friendActivityRank, sortFriends, sortLeaderboard,
} = await import('../../js/account.js');

describe('account.sortLeaderboard', () => {
  test('fastest time first; invalid/missing times sink to the end', () => {
    const entries = [
      { uid: 'a', username: 'ann', timeMs: 5000 },
      { uid: 'b', username: 'bob', timeMs: 2000 },
      { uid: 'c', username: 'cyl', timeMs: 0 },        // ungültig
      { uid: 'd', username: 'dan' },                    // fehlt
      { uid: 'e', username: 'eve', timeMs: 3500 },
    ];
    assert.deepEqual(sortLeaderboard(entries).map(e => e.uid), ['b', 'e', 'a', 'c', 'd']);
  });
  test('ties break alphabetically by username; input not mutated', () => {
    const entries = [{ uid: 'x', username: 'zoe', timeMs: 1000 }, { uid: 'y', username: 'amy', timeMs: 1000 }];
    const copy = [...entries];
    assert.deepEqual(sortLeaderboard(entries).map(e => e.username), ['amy', 'zoe']);
    assert.deepEqual(entries, copy);
  });
});

describe('account.friendActivityRank', () => {
  test('in-game > online > offline/none', () => {
    assert.equal(friendActivityRank({ online: true, game: { pct: 40 } }), 2);
    assert.equal(friendActivityRank({ online: true, game: null }), 1);
    assert.equal(friendActivityRank({ online: false }), 0);
    assert.equal(friendActivityRank(null), 0);
    // Offline mit veralteter game-Info zählt NICHT als „im Spiel".
    assert.equal(friendActivityRank({ online: false, game: { pct: 40 } }), 0);
  });
});

describe('account.sortFriends', () => {
  test('sorts by activity desc, then username asc', () => {
    const friends = [
      { uid: 'a', username: 'zoe' },
      { uid: 'b', username: 'bob' },
      { uid: 'c', username: 'ann' },
    ];
    const presence = {
      a: { online: false },                    // offline
      b: { online: true, game: { pct: 10 } },  // in-game
      c: { online: true, game: null },         // online
    };
    assert.deepEqual(sortFriends(friends, presence).map(f => f.uid), ['b', 'c', 'a']);
  });
  test('stable alphabetical among equal activity', () => {
    const friends = [{ uid: 'x', username: 'carla' }, { uid: 'y', username: 'anna' }];
    assert.deepEqual(sortFriends(friends, {}).map(f => f.username), ['anna', 'carla']);
  });
  test('does not mutate input', () => {
    const friends = [{ uid: 'x', username: 'b' }, { uid: 'y', username: 'a' }];
    const copy = [...friends];
    sortFriends(friends, {});
    assert.deepEqual(friends, copy);
  });
});

describe('account.decideSync (online always wins on divergence)', () => {
  test('empty cloud → upload local (first ever backup)', () => {
    assert.equal(decideSync({ cloudExists: false, localRev: 5, cloudRev: 0, syncedRev: null, hasLocalData: true }), 'uploadLocal');
    // even with no local data, an empty cloud just gets whatever local is
    assert.equal(decideSync({ cloudExists: false, localRev: 0, cloudRev: 0, syncedRev: null, hasLocalData: false }), 'uploadLocal');
  });
  test('first contact + local has data + differing revs → take cloud (online always wins)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 4, syncedRev: null, hasLocalData: true }), 'takeCloud');
  });
  test('first contact + no local data → take cloud silently', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 0, cloudRev: 4, syncedRev: null, hasLocalData: false }), 'takeCloud');
  });
  test('first contact but identical revisions → in sync (no false prompt on re-login)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 7, cloudRev: 7, syncedRev: null, hasLocalData: true }), 'inSync');
  });
  test('with a baseline: only local changed → upload; only cloud changed → take cloud', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 4, syncedRev: 4, hasLocalData: true }), 'uploadLocal');
    assert.equal(decideSync({ cloudExists: true, localRev: 4, cloudRev: 9, syncedRev: 4, hasLocalData: true }), 'takeCloud');
  });
  test('with a baseline: both changed → take cloud (online always wins, no prompt)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 8, syncedRev: 4, hasLocalData: true }), 'takeCloud');
  });
  test('with a baseline: nothing changed → in sync', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 4, cloudRev: 4, syncedRev: 4, hasLocalData: true }), 'inSync');
  });

  test('no reload loop: after takeCloud, baseline matches cloudRev → in sync', () => {
    // Regression (Reload-Schleife): applyCloud MUSS syncedRev == (snap.rev || 0)
    // setzen. Tat es das nicht (syncedRev blieb auf einem durch den Import frisch
    // hochgezählten, von cloudRev abweichenden Wert), sah der nächste reconcile
    // cloudChanged → 'takeCloud' → safeReload → Endlos-Reload. Konsistente
    // Basislinie = derselbe Wert wie cloudRev → 'inSync', kein weiterer Reload.
    assert.equal(decideSync({ cloudExists: true, localRev: 0, cloudRev: 0, syncedRev: 0, hasLocalData: true }), 'inSync');
    // Die alte Fehlsituation (Basislinie != cloudRev) hätte endlos 'takeCloud' geliefert:
    assert.equal(decideSync({ cloudExists: true, localRev: 7, cloudRev: 0, syncedRev: 7, hasLocalData: true }), 'takeCloud');
  });
});
const { saveProfile, saveLastSync } = await import('../../js/storage.js');

describe('account.session flags', () => {
  test('isSignedIn reflects the persisted accountId; lastSyncAt its own key', () => {
    globalThis.localStorage.clear();
    assert.equal(isSignedIn(), false);
    assert.equal(lastSyncAt(), 0);
    saveProfile({ accountId: 'uid123' });
    saveLastSync(42);
    assert.equal(isSignedIn(), true);
    assert.equal(lastSyncAt(), 42);
    saveProfile({ accountId: null });
    assert.equal(isSignedIn(), false);
  });
});

describe('account.username', () => {
  test('normalizeUsername trims and lowercases', () => {
    assert.equal(normalizeUsername('  Tom_Anders  '), 'tom_anders');
  });

  test('isValidUsername accepts 3–20 chars of [a-z0-9_.]', () => {
    assert.equal(isValidUsername('tom'), true);
    assert.equal(isValidUsername('Tom.Anders_1'), true); // normalized before test
    assert.equal(isValidUsername('a'.repeat(20)), true);
  });

  test('isValidUsername rejects too short/long and bad chars', () => {
    assert.equal(isValidUsername('ab'), false);
    assert.equal(isValidUsername('a'.repeat(21)), false);
    assert.equal(isValidUsername('has space'), false);
    assert.equal(isValidUsername('emoji😀'), false);
    assert.equal(isValidUsername('a-b'), false); // hyphen not allowed
  });

  test('usernameKey replaces RTDB-illegal key chars', () => {
    assert.equal(usernameKey('a.b'), 'a_b');
    assert.equal(usernameKey('Tom'), 'tom');
  });
});

describe('account.email', () => {
  test('accepts plausible addresses, rejects malformed', () => {
    assert.equal(isValidEmail('a@b.de'), true);
    assert.equal(isValidEmail('tom-anders@gmx.net'), true);
    assert.equal(isValidEmail('nope'), false);
    assert.equal(isValidEmail('a@b'), false);
    assert.equal(isValidEmail('a b@c.de'), false);
  });
});

describe('account.password', () => {
  test('flags passwords shorter than 6, accepts ≥6', () => {
    assert.equal(passwordIssue('12345'), 'tooShort');
    assert.equal(passwordIssue(''), 'tooShort');
    assert.equal(passwordIssue('123456'), null);
  });
});

describe('account.errKey', () => {
  test('maps known Firebase codes to short i18n suffixes', () => {
    assert.equal(errKey({ code: 'auth/email-already-in-use' }), 'emailInUse');
    assert.equal(errKey({ code: 'auth/wrong-password' }), 'wrongPassword');
    assert.equal(errKey({ code: 'auth/operation-not-allowed' }), 'notEnabled');
    assert.equal(errKey({ code: 'PERMISSION_DENIED', message: 'permission_denied at /users' }), 'permissionDenied');
    assert.equal(errKey({ message: 'PERMISSION_DENIED: Permission denied' }), 'permissionDenied');
    assert.equal(errKey({ code: 'auth/too-many-requests' }), 'tooMany');
    assert.equal(errKey({ code: 'auth/requires-recent-login' }), 'reauth');
    assert.equal(errKey({}), 'generic');
  });
});
