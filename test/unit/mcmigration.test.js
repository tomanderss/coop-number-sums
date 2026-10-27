import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #map = new Map();
  get length() { return this.#map.size; }
  key(i) { return [...this.#map.keys()][i] ?? null; }
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
  clear() { this.#map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const { planLocalMcMigration, runLocalMcMigration, MC_LOCAL_FLAG } = await import('../../js/mcmigration.js');
const { loadWallet, loadInventory, loadSettings, loadProfile, loadWalletLog } = await import('../../js/storage.js');

const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const get = (k) => JSON.parse(localStorage.getItem(k));
const read = (k) => localStorage.getItem(k);

// Beide Apps teilen sich den localStorage (gleiche Herkunft). Die alte App
// „Coop Math Cross" schreibt unter cmc_*; diese App übernimmt das einmalig.
describe('Lokaler Umzug aus Coop Math Cross', () => {
  beforeEach(() => localStorage.clear());

  test('ohne Alt-Daten passiert nichts', () => {
    assert.equal(planLocalMcMigration(read), null);
    assert.equal(runLocalMcMigration(localStorage), null);
    assert.equal(localStorage.getItem(MC_LOCAL_FLAG), null);
  });

  test('Spieldaten landen bei Math Cross, Number Sums bleibt unberuehrt', () => {
    set('cmc_stats', { won: 7 });
    set('cmc_saves', [{ id: 'a' }]);
    set('cns_stats', { won: 99 });   // Number-Sums-Statistik
    runLocalMcMigration(localStorage);
    assert.deepEqual(get('cns_stats__mathcross'), { won: 7 });
    assert.deepEqual(get('cns_saves__mathcross'), [{ id: 'a' }]);
    assert.deepEqual(get('cns_stats'), { won: 99 });
  });

  test('vorhandene Math-Cross-Daten dieser App werden nicht ueberschrieben', () => {
    set('cmc_stats', { won: 7 });
    set('cns_stats__mathcross', { won: 3 });
    runLocalMcMigration(localStorage);
    assert.deepEqual(get('cns_stats__mathcross'), { won: 3 });
  });

  test('Guthaben wird addiert und im Geldverlauf gebucht (nie verbundene alte App)', () => {
    set('cns_wallet', { balance: 100, updatedAt: 1 });
    set('cmc_wallet', { balance: 250, updatedAt: 1 });
    const r = runLocalMcMigration(localStorage);
    assert.equal(r.coins, 250);
    assert.equal(loadWallet().balance, 350);
    assert.equal(loadWalletLog()[0].reason, 'migration');
  });

  test('war die alte App mit einem Konto verbunden, kommt das Geld ueber die Cloud — hier nicht doppelt', () => {
    set('cns_wallet', { balance: 100, updatedAt: 1 });
    set('cmc_wallet', { balance: 250, updatedAt: 1 });
    set('cmc_profile', { username: 'anna', accountId: null });   // abgemeldet, aber verbunden gewesen
    runLocalMcMigration(localStorage);
    assert.equal(loadWallet().balance, 100);
  });

  test('gekaufte Artikel werden vereinigt', () => {
    set('cns_inventory', { a: { acquiredAt: 5, source: 'buy' } });
    set('cmc_inventory', { a: { acquiredAt: 9, source: 'buy' }, b: { acquiredAt: 7, source: 'buy' } });
    runLocalMcMigration(localStorage);
    assert.deepEqual(Object.keys(loadInventory()).sort(), ['a', 'b']);
    assert.equal(loadInventory().a.acquiredAt, 5);
  });

  test('Einstellungen: diese App gewinnt, nur Math-Cross-eigene Luecken werden gefuellt', () => {
    set('cns_settings', { themeMode: 'dark', divStyle: null });
    set('cmc_settings', { themeMode: 'light', divStyle: 'colon', dragScale: 1.5 });
    runLocalMcMigration(localStorage);
    const s = loadSettings();
    assert.equal(s.themeMode, 'dark');
    assert.equal(s.divStyle, 'colon');
    assert.equal(s.dragScale, 1.5);
  });

  test('ohne eigene Einstellungen werden die der alten App uebernommen', () => {
    set('cmc_settings', { themeMode: 'light', updatedAt: 3 });
    runLocalMcMigration(localStorage);
    assert.equal(loadSettings().themeMode, 'light');
  });

  test('ein in der alten App angemeldetes Konto gilt auch hier als angemeldet', () => {
    set('cmc_profile', { accountId: 'u1', username: 'anna', displayName: 'anna', role: 'admin' });
    const plan = planLocalMcMigration(read);
    assert.equal(plan.profile.accountId, 'u1');
    assert.equal(plan.profile.role, 'user');   // Rolle kommt nur aus der Cloud
    runLocalMcMigration(localStorage);
    assert.equal(loadProfile().accountId, 'u1');
  });

  test('ein hier schon angemeldetes Konto wird nicht ersetzt', () => {
    set('cns_profile', { accountId: 'u9', displayName: 'ben' });
    set('cmc_profile', { accountId: 'u1', username: 'anna' });
    runLocalMcMigration(localStorage);
    assert.equal(loadProfile().accountId, 'u9');
    assert.equal(loadProfile().displayName, 'ben');
  });

  test('Tages-Serie nur, wenn hier noch keine existiert', () => {
    set('cmc_daily', { currentStreak: 4 });
    set('cns_daily', { currentStreak: 2 });
    runLocalMcMigration(localStorage);
    assert.equal(get('cns_daily').currentStreak, 2);
  });

  test('laeuft nur einmal und laesst die Alt-Daten stehen', () => {
    set('cmc_wallet', { balance: 50 });
    runLocalMcMigration(localStorage);
    assert.equal(runLocalMcMigration(localStorage), null);
    assert.equal(loadWallet().balance, 50);
    assert.deepEqual(get('cmc_wallet'), { balance: 50 });
  });

  test('kaputte Alt-Werte werden uebersprungen statt kopiert', () => {
    localStorage.setItem('cmc_stats', '{kaputt');
    set('cmc_wallet', { balance: 'viel' });
    const r = runLocalMcMigration(localStorage);
    assert.equal(localStorage.getItem('cns_stats__mathcross'), null);
    assert.equal(r.coins, 0);
  });
});
