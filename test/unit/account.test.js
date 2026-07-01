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
  isSignedIn, lastSyncAt,
} = await import('../../js/account.js');
const { saveProfile } = await import('../../js/storage.js');

describe('account.session flags', () => {
  test('isSignedIn/lastSyncAt reflect the persisted local profile', () => {
    globalThis.localStorage.clear();
    assert.equal(isSignedIn(), false);
    assert.equal(lastSyncAt(), 0);
    saveProfile({ accountId: 'uid123', lastSyncAt: 42 });
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
    assert.equal(errKey({ code: 'auth/too-many-requests' }), 'tooMany');
    assert.equal(errKey({ code: 'auth/requires-recent-login' }), 'reauth');
    assert.equal(errKey({}), 'generic');
  });
});
