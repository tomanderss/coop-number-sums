// Umzug aus der alten App „Coop Math Cross" in diese App.
//
// Beide Apps liegen unter DERSELBEN Herkunft (tomanderss.github.io/…), teilen
// sich also den localStorage: die alte App schreibt ihre Daten unter `cmc_*`.
// Beim ersten Start nach dem Update werden sie hier EINMALIG übernommen — die
// Alt-Daten bleiben dabei unangetastet stehen (Sicherheitsnetz; die alte App
// läuft weiter).
//
// Regeln (mit dem Nutzer abgestimmt):
// - Spieldaten (Statistik, Spielstände, Verlauf, Erfolge, Missionen, Duelle) →
//   die Math-Cross-Schlüssel dieser App (`cns_*__mathcross`), aber NUR, wo dort
//   noch nichts liegt: wer Math Cross hier schon gespielt hat, verliert nichts.
// - Guthaben wird ADDIERT — aber nur, wenn die alte App nie mit einem Konto
//   verbunden war. Sonst liegt dasselbe Geld in der Cloud und wird beim
//   Konto-Umzug gutgeschrieben; hier zusätzlich gebucht wäre es doppelt.
// - Gekaufte Artikel: Vereinigung (niemand verliert etwas).
// - Einstellungen: diese App gewinnt; nur was hier noch gar nicht gesetzt ist
//   (oder Math-Cross-eigene Einstellungen) kommt aus der alten App.
// - Tages-Serie und Profil nur, wenn hier noch keine existieren.
import {
  gameScopedKey, mergeInventory, grantCurrency, saveSettings, saveProfile, setDataRev,
} from './storage.js';
import { log } from './debuglog.js';

export const MC_LOCAL_FLAG = 'cns_mc_local_migrated';
export const MC_GAME_ID = 'mathcross';
// Spieleigene Schlüssel (ohne Präfix). Die Spielstil-Stichproben fehlen bewusst:
// das KI-Duell gibt es nicht mehr.
export const MC_GAME_KEYS = [
  'active_game', 'active_game_coop', 'active_game_endless', 'saves', 'saves_gone',
  'stats', 'history', 'achievements', 'missions', 'race', 'completed_games',
];
// Einstellungen, die es nur durch Math Cross gibt — sie übernimmt diese App auch
// dann, wenn hier schon Einstellungen liegen (sofern hier noch nicht gesetzt).
export const MC_ONLY_SETTINGS = ['markColor', 'divStyle', 'dragScale'];
// Woran man erkennt, dass die alte App auf diesem Gerät überhaupt Daten hat.
const MARKERS = ['cmc_settings', 'cmc_stats', 'cmc_wallet', 'cmc_inventory', 'cmc_profile', 'cmc_saves', 'cmc_active_game'];

function parse(raw) {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

/**
 * Was übernommen werden soll — rein, damit der Test jede Regel festhalten kann.
 * `read(key)` liefert den ROHEN localStorage-Wert (String) oder null.
 * Liefert null, wenn die alte App auf diesem Gerät keine Daten hat.
 */
export function planLocalMcMigration(read) {
  if (!MARKERS.some((k) => read(k) != null)) return null;
  const mcProfile = parse(read('cmc_profile')) || {};
  const linked = !!(mcProfile.accountId || mcProfile.username);

  const copies = [];
  for (const s of MC_GAME_KEYS) {
    const from = `cmc_${s}`;
    const to = gameScopedKey(`cns_${s}`, MC_GAME_ID);
    if (read(from) != null && parse(read(from)) != null && read(to) == null) copies.push({ from, to });
  }
  if (read('cmc_daily') != null && read('cns_daily') == null) copies.push({ from: 'cmc_daily', to: 'cns_daily' });

  const inv = parse(read('cmc_inventory'));
  const inventory = inv && typeof inv === 'object' && !Array.isArray(inv) && Object.keys(inv).length ? inv : null;

  const w = parse(read('cmc_wallet'));
  const wallet = !linked && w && Number.isFinite(Number(w.balance)) ? Math.max(0, Math.floor(Number(w.balance))) : 0;

  let settings = null;
  const mcSet = parse(read('cmc_settings'));
  const nsSet = parse(read('cns_settings'));
  if (mcSet && typeof mcSet === 'object') {
    if (!nsSet) {
      const { updatedAt, ...rest } = mcSet;
      settings = rest;
    } else {
      const fill = {};
      for (const key of MC_ONLY_SETTINGS) if (nsSet[key] == null && mcSet[key] != null) fill[key] = mcSet[key];
      if (Object.keys(fill).length) settings = { ...nsSet, ...fill };
    }
  }

  let profile = null;
  const nsProfile = parse(read('cns_profile')) || {};
  if (!nsProfile.accountId && mcProfile.accountId) {
    // Die Anmeldung selbst teilen sich beide Apps ohnehin (gleiche Herkunft,
    // gleiches Firebase-Projekt) — ohne die accountId zeigte diese App das
    // bereits angemeldete Konto aber als „nicht angemeldet".
    profile = { accountId: mcProfile.accountId, role: 'user' };
    if (mcProfile.username) profile.username = mcProfile.username;
    if (mcProfile.displayName) profile.displayName = mcProfile.displayName;
  } else if (!nsProfile.displayName && mcProfile.displayName && !nsProfile.accountId) {
    profile = { displayName: mcProfile.displayName };
  }

  return { linked, copies, inventory, wallet, settings, profile };
}

/**
 * Den Plan ausführen. Einmalig je Gerät (Flag `cns_mc_local_migrated`, NIE
 * synchronisiert — es beschreibt den localStorage dieses Geräts). Läuft in
 * app.js vor dem Anlegen von `state`, damit die übernommenen Daten sofort
 * gelesen werden. Liefert eine Zusammenfassung oder null.
 */
export function runLocalMcMigration(storage = globalThis.localStorage) {
  const t0 = Date.now();
  try {
    if (!storage || storage.getItem(MC_LOCAL_FLAG)) return null;
    const plan = planLocalMcMigration((key) => storage.getItem(key));
    if (!plan) return null;
    for (const c of plan.copies) storage.setItem(c.to, storage.getItem(c.from));
    let items = 0;
    if (plan.inventory) {
      const before = Object.keys(parse(storage.getItem('cns_inventory')) || {}).length;
      items = Object.keys(mergeInventory(plan.inventory)).length - before;
    }
    if (plan.settings) saveSettings(plan.settings);
    if (plan.profile) saveProfile(plan.profile);
    if (plan.wallet > 0) grantCurrency(plan.wallet, 'migration', { from: MC_GAME_ID });
    // Die kopierten Schlüssel liefen an save() vorbei — als Änderung stempeln,
    // damit der nächste Sync sie in die Cloud trägt.
    setDataRev(Date.now());
    const summary = { copies: plan.copies.length, coins: plan.wallet, items, linked: plan.linked, settings: !!plan.settings, profile: !!plan.profile };
    storage.setItem(MC_LOCAL_FLAG, JSON.stringify({ ts: Date.now(), ...summary }));
    log('storage', 'Math-Cross-Daten lokal uebernommen', { ...summary, tookMs: Date.now() - t0 });
    return summary;
  } catch (e) {
    log('error', 'Lokaler Math-Cross-Umzug fehlgeschlagen', e);
    return null;
  }
}
