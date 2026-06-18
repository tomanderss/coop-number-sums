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
globalThis.URL.createObjectURL = () => 'blob:test';
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement: () => ({ click() {} }),
  body: { appendChild() {}, removeChild() {} },
};

const { log, getLog, clearLog, exportLogToFile } = await import('../../js/debuglog.js');

describe('debuglog', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  test('log appends entries persisted across calls', () => {
    log('coop', 'a');
    log('coop', 'b');
    const entries = getLog();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].message, 'a');
    assert.equal(entries[1].message, 'b');
  });

  test('log captures error code/message from extra without leaking full objects', () => {
    log('firebase', 'failed', { code: 'PERMISSION_DENIED', message: 'nope', name: 'FirebaseError', secret: 'x' });
    const [entry] = getLog();
    assert.deepEqual(entry.extra, { code: 'PERMISSION_DENIED', message: 'nope', name: 'FirebaseError' });
  });

  test('log trims to the most recent 200 entries', () => {
    for (let i = 0; i < 250; i++) log('coop', `msg${i}`);
    const entries = getLog();
    assert.equal(entries.length, 200);
    assert.equal(entries[0].message, 'msg50');
    assert.equal(entries[199].message, 'msg249');
  });

  test('clearLog empties the log', () => {
    log('coop', 'a');
    clearLog();
    assert.deepEqual(getLog(), []);
  });

  test('exportLogToFile does not throw when the log is empty', async () => {
    await assert.doesNotReject(() => exportLogToFile());
  });
});
