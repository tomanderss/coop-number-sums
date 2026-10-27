import { test, describe } from 'node:test';
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

const {
  gameScopedKey, STORAGE_KEYS, ACCOUNT_FIELDS, GAME_FIELDS,
  restoreGameChoice, chooseGame, gameId, collectExportData,
} = await import('../../js/storage.js');
const { DEFAULT_GAME_ID } = await import('../../js/games/registry.js');

// Sobald mehr als EIN Spiel in der App steckt, duerfen sich ihre Statistiken,
// Spielstaende, Erfolge und Missionen nicht denselben localStorage-Platz teilen
// — genau derselbe Fehler, der in der Cloud unter `users/{uid}/data` schon
// passiert war. Welche Schluessel zu welcher Seite gehoeren, haelt dieser Test
// fest: ein neues Datenfeld, das keiner Seite zugeordnet ist, landet sonst
// still im falschen Topf.
describe('Spielspezifische vs. kontoweite Speicher-Schluessel', () => {
  // Der logische Schluessel je Snapshot-Feld. Alles, was in einer der beiden
  // Feldlisten steht, MUSS hier auftauchen — der letzte Test erzwingt das.
  const KEY_OF = {
    settings: 'cns_settings', wallet: 'cns_wallet', walletLog: 'cns_wallet_log',
    daily: 'cns_daily', inventory: 'cns_inventory', profile: 'cns_profile',
    activeGame: 'cns_active_game', activeGameCoop: 'cns_active_game_coop',
    activeGameEndless: 'cns_active_game_endless', saves: 'cns_saves',
    savesGone: 'cns_saves_gone', stats: 'cns_stats', history: 'cns_history',
    achievements: 'cns_achievements', missions: 'cns_missions', race: 'cns_race',
    playSamples: 'cns_play_samples', completedGames: 'cns_completed_games',
  };

  test('das Standardspiel behaelt seine Schluessel unveraendert', () => {
    // Der Bestand darf keine Migration brauchen: wer heute spielt, muss nach
    // dem Update genau seine Daten vorfinden.
    for (const key of Object.values(KEY_OF)) {
      assert.equal(gameScopedKey(key, DEFAULT_GAME_ID), key, `${key} darf sich fuer das Standardspiel nicht aendern`);
    }
  });

  test('jedes SPIEL-Feld bekommt bei einem weiteren Spiel einen eigenen Platz', () => {
    for (const feld of GAME_FIELDS) {
      const key = KEY_OF[feld];
      assert.ok(key, `kein Schluessel fuer das Spiel-Feld "${feld}" bekannt`);
      assert.equal(gameScopedKey(key, 'zweitspiel'), `${key}__zweitspiel`,
        `${feld} muesste sich sonst den Platz mit dem anderen Spiel teilen`);
    }
  });

  test('jedes KONTO-Feld bleibt fuer alle Spiele dasselbe', () => {
    // Ein Konto, ein Name, ein Guthaben, ein Shop, eine Tagesserie —
    // ausdruecklicher Nutzerwunsch.
    for (const feld of ACCOUNT_FIELDS) {
      const key = KEY_OF[feld];
      assert.ok(key, `kein Schluessel fuer das Konto-Feld "${feld}" bekannt`);
      assert.equal(gameScopedKey(key, 'zweitspiel'), key, `${feld} darf sich nicht je Spiel aufspalten`);
    }
  });

  test('Buchhaltung folgt dem, woran sie haengt', () => {
    // Die Sync-Basislinie gehoert zur SPIEL-Haelfte des Snapshots, ein
    // Coop-Raum und ein verdraengter Spielstand genau einem Spiel.
    for (const key of ['cns_synced_rev', 'cns_coop_session', 'cns_active_game_backup']) {
      assert.equal(gameScopedKey(key, 'zweitspiel'), `${key}__zweitspiel`, `${key} gehoert zum Spiel`);
    }
    // Geraete-Identitaet, Revisionszaehler, letzte Sync-Zeit, gesehene Version
    // und die Spielauswahl selbst sind geraete- bzw. kontoweit.
    for (const key of ['cns_device_id', 'cns_data_rev', 'cns_last_sync', 'cns_seen_version', 'cns_game']) {
      assert.equal(gameScopedKey(key, 'zweitspiel'), key, `${key} darf sich nicht je Spiel aufspalten`);
    }
  });

  test('jedes Snapshot-Feld ist einer Seite zugeordnet', () => {
    // Zusammen mit dem Test in storage.test.js (jedes collectExportData-Feld
    // steht in genau einer Feldliste) schliesst das die Luecke: ein neues Feld
    // braucht eine Feldliste UND einen Schluessel-Eintrag hier.
    const kopf = new Set(['ts', 'v', 'label', 'rev']);
    for (const feld of Object.keys(collectExportData('test'))) {
      if (kopf.has(feld)) continue;
      assert.ok(KEY_OF[feld], `Feld "${feld}" hat hier keinen Schluessel — spielspezifisch oder kontoweit?`);
    }
  });
});

describe('Spielauswahl ueberlebt den Neustart', () => {
  test('ohne gespeicherte Wahl laeuft das Standardspiel', () => {
    localStorage.clear();
    assert.equal(restoreGameChoice(), DEFAULT_GAME_ID);
    assert.equal(gameId(), DEFAULT_GAME_ID);
  });

  test('eine unbekannte gespeicherte Wahl wird ignoriert', () => {
    // Ein alter oder manipulierter Wert darf die App nie ohne Spiel starten.
    localStorage.clear();
    localStorage.setItem('cns_game', JSON.stringify('gibtsnicht'));
    assert.equal(restoreGameChoice(), DEFAULT_GAME_ID);
  });

  test('chooseGame sichert die Wahl geraetelokal', () => {
    localStorage.clear();
    chooseGame(DEFAULT_GAME_ID);
    assert.equal(JSON.parse(localStorage.getItem('cns_game')), DEFAULT_GAME_ID);
    // Die Wahl ist KEIN Nutzdaten-Key: sie darf die Daten-Revision nicht
    // hochzaehlen (sonst sieht jeder Spielwechsel wie eine Datenaenderung aus
    // und loest einen Cloud-Upload aus).
    assert.equal(localStorage.getItem('cns_data_rev'), null);
  });
});

describe('Beitritt nach Spielwechsel (cns_pending_join)', () => {
  test('ein gemerkter Beitritt kommt genau EINMAL zurueck', async () => {
    const { savePendingJoin, takePendingJoin } = await import('../../js/storage.js');
    localStorage.clear();
    savePendingJoin({ code: '123456', mode: 'coop', game: 'mathcross' });
    const job = takePendingJoin();
    assert.equal(job.code, '123456');
    assert.equal(job.game, 'mathcross');
    assert.equal(takePendingJoin(), null, 'ein zweiter Start tritt nicht ungefragt erneut bei');
  });

  test('ein alter Auftrag verfaellt', async () => {
    const { savePendingJoin, takePendingJoin, PENDING_JOIN_TTL_MS } = await import('../../js/storage.js');
    localStorage.clear();
    savePendingJoin({ code: '123456', mode: 'coop', game: 'mathcross' });
    assert.equal(takePendingJoin(Date.now() + PENDING_JOIN_TTL_MS + 1), null);
  });

  test('der Auftrag ist geraetelokal und spielunabhaengig (kein Spiel-Zusatz)', () => {
    assert.equal(gameScopedKey('cns_pending_join', 'zweitspiel'), 'cns_pending_join');
  });
});
