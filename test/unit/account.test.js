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
  isSignedIn, lastSyncAt, decideSync,
} = await import('../../js/account.js');

describe('account.decideSync (never silently overwrites local)', () => {
  test('empty cloud → upload local (first ever backup)', () => {
    assert.equal(decideSync({ cloudExists: false, localRev: 5, cloudRev: 0, syncedRev: null, hasLocalData: true }), 'uploadLocal');
    // even with no local data, an empty cloud just gets whatever local is
    assert.equal(decideSync({ cloudExists: false, localRev: 0, cloudRev: 0, syncedRev: null, hasLocalData: false }), 'uploadLocal');
  });
  test('first contact + local has data + differing revs → conflict (ask, never overwrite)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 4, syncedRev: null, hasLocalData: true }), 'conflict');
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
  test('with a baseline: both changed → conflict', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 8, syncedRev: 4, hasLocalData: true }), 'conflict');
  });
  test('with a baseline: nothing changed → in sync', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 4, cloudRev: 4, syncedRev: 4, hasLocalData: true }), 'inSync');
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
