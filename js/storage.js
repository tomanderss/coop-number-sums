// storage.js — Persistenz via localStorage (Einstellungen, laufendes Spiel,
// Statistik, rollende Backups, Datei-Export/Import). Struktur analog werwolf-app.

import { DEFAULT_SETTINGS } from './config.js';
import { log, clearLog } from './debuglog.js';
import { todayDateStr } from './streak.js';

const KEYS = {
  SETTINGS: 'cns_settings',
  ACTIVE_GAME: 'cns_active_game',
  ACTIVE_GAME_COOP: 'cns_active_game_coop',
  COOP_SESSION: 'cns_coop_session',
  STATS: 'cns_stats',
  SEEN_VERSION: 'cns_seen_version',
  DAILY: 'cns_daily',
  HISTORY: 'cns_history',
  ACHIEVEMENTS: 'cns_achievements',
  RACE: 'cns_race',
  // ── Account-/Ökonomie-Fundament (vorwärtskompatibel) ──
  // Lokal-zuerst: für anonyme Nutzer ist localStorage die Quelle der Wahrheit;
  // bei Login werden diese Strukturen 1:1 nach /users/{uid} gespiegelt (siehe
  // js/account.js). Bewusst dieselbe Form wie der spätere RTDB-Knoten.
  INVENTORY: 'cns_inventory',   // { itemId: { acquiredAt, source } } — Besitz von Cosmetics (z.B. Skin 'dynamicColor')
  WALLET: 'cns_wallet',         // { balance, updatedAt } — In-Game-Währung (nicht auszahlbar)
  PROFILE: 'cns_profile',       // { displayName, username, role, accountId, createdAt } — lokales Profil (role für Admin)
  DATA_REV: 'cns_data_rev',     // Zeitstempel der letzten lokalen Nutzdaten-Änderung (für Cloud-Konfliktcheck)
  SYNCED_REV: 'cns_synced_rev', // DATA_REV beim letzten erfolgreichen Sync (Basislinie für decideSync)
  LAST_SYNC: 'cns_last_sync',   // Zeitpunkt der letzten erfolgreichen Cloud-Sicherung (nur UI; NICHT nutzdaten-getrackt)
};
// Schlüssel, deren Änderung als „Nutzdaten geändert" zählt (⇒ DATA_REV hochzählen).
// Bewusst OHNE SEEN_VERSION/COOP_SESSION/Backups/DATA_REV/SYNCED_REV.
const USER_DATA_KEYS = new Set([
  'cns_settings', 'cns_active_game', 'cns_active_game_coop', 'cns_stats', 'cns_daily',
  'cns_history', 'cns_achievements', 'cns_race', 'cns_inventory', 'cns_wallet', 'cns_profile',
]);
// Wie lange „Coop fortsetzen" nach der letzten Sicherung angeboten wird. Der
// Raum lebt in der RTDB weiter, solange ihn niemand aktiv verlässt (Präsenz-
// Einträge verschwinden zwar per onDisconnect, meta/events bleiben) — beide
// Spieler können also auch deutlich später unabhängig zurückkehren. Die
// früheren 5 Minuten waren der Hauptgrund, warum der Fortsetzen-Button
// praktisch nie funktionierte (Klick lief in eine bereits verfallene Session).
const COOP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const HISTORY_MAX = 20;

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { log('storage', `Laden von "${key}" fehlgeschlagen`, e); return fallback; }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Jede Nutzdaten-Änderung stempelt die lokale Daten-Revision (für den
    // Cloud-Konfliktcheck). DATA_REV selbst ist kein Nutzdaten-Key → keine Rekursion.
    if (USER_DATA_KEYS.has(key)) localStorage.setItem(KEYS.DATA_REV, JSON.stringify(Date.now()));
  }
  catch (e) { log('storage', `Speichern von "${key}" fehlgeschlagen`, e); }
}
// ─── Daten-Revision (für Cloud-Sync-Konfliktauflösung) ────────────────────────
export function dataRev() { return load(KEYS.DATA_REV, 0); }
export function setDataRev(v) { localStorage.setItem(KEYS.DATA_REV, JSON.stringify(v || 0)); }
export function syncedRev() { return load(KEYS.SYNCED_REV, null); }
export function setSyncedRev(v) { save(KEYS.SYNCED_REV, v); }
export function loadLastSync() { return load(KEYS.LAST_SYNC, 0); }
export function saveLastSync(ts) { save(KEYS.LAST_SYNC, ts); }
// Gibt es lokal überhaupt nennenswerte Nutzerdaten? (Steuert, ob bei Erst-Login
// mit vorhandenen Cloud-Daten gefragt werden muss statt still die Cloud zu nehmen.)
export function hasLocalData() {
  const s = load(KEYS.STATS, {});
  if ((s.played || 0) + (s.coopPlayed || 0) > 0) return true;
  if (Object.keys(load(KEYS.INVENTORY, {})).length) return true;
  if ((load(KEYS.WALLET, {}).balance || 0) > 0) return true;
  if ((load(KEYS.HISTORY, [])).length) return true;
  return false;
}
function remove(key) {
  try { localStorage.removeItem(key); }
  catch (e) { log('storage', `Entfernen von "${key}" fehlgeschlagen`, e); }
}

// ─── Einstellungen ────────────────────────────────────────────────────────────
export function loadSettings() {
  const stored = load(KEYS.SETTINGS, {});
  const s = { ...DEFAULT_SETTINGS, ...stored };
  // Migration: der frühere boolesche Dunkelmodus wird als EXPLIZITE Wahl
  // beibehalten (wer hell/dunkel gespeichert hatte, behält es) — nur ohne
  // gespeicherte Wahl gilt 'auto' (folgt dem System-Theme).
  if (!stored.themeMode && typeof stored.darkMode === 'boolean') s.themeMode = stored.darkMode ? 'dark' : 'light';
  return s;
}
export function saveSettings(s) { save(KEYS.SETTINGS, s); }

// ─── Laufendes Spiel (Resume) ─────────────────────────────────────────────────
// Solo und Coop liegen in getrennten Slots, damit ein laufendes Coop-Spiel nie
// den Solo-Spielstand überschreibt (und umgekehrt) -- siehe persistGame() in
// app.js, das je nach state.coop.active in den passenden Slot schreibt.
export function loadActiveGame() { return load(KEYS.ACTIVE_GAME, null); }
export function saveActiveGame(g) { if (g) save(KEYS.ACTIVE_GAME, g); else remove(KEYS.ACTIVE_GAME); }
export function loadActiveGameCoop() { return load(KEYS.ACTIVE_GAME_COOP, null); }
export function saveActiveGameCoop(g) { if (g) save(KEYS.ACTIVE_GAME_COOP, g); else remove(KEYS.ACTIVE_GAME_COOP); }

// ─── Kurzlebige Coop-Sitzungsdaten (Auto-Reconnect nach Hintergrund) ─────────
// Wird beim Verstecken der App (visibilitychange) geschrieben, solange eine
// Coop-Runde aktiv ist, und beim Zurückkehren gelesen, um den Raum innerhalb
// eines 5-Minuten-Fensters automatisch wieder zu betreten. Bewusst NICHT Teil
// von Backup/Export/deleteAllData-Snapshots -- es handelt sich um ein
// kurzlebiges, selbst-verfallendes Wiederverbindungs-Token, kein Nutzerdatum.
export function saveCoopSession(sess) { save(KEYS.COOP_SESSION, { ...sess, ts: Date.now() }); }
export function loadCoopSession() {
  const s = load(KEYS.COOP_SESSION, null);
  if (!s) return null;
  if (Date.now() - s.ts > COOP_SESSION_TTL_MS) { remove(KEYS.COOP_SESSION); return null; }
  return s;
}
export function clearCoopSession() { remove(KEYS.COOP_SESSION); }

// ─── Statistik ────────────────────────────────────────────────────────────────
const EMPTY_STATS = {
  played: 0, won: 0, lost: 0, currentStreak: 0, bestStreak: 0,
  totalTimeMs: 0, hintsUsed: 0,
  // Coop-Pendants der obigen Top-Level-Felder — komplett getrennt von den
  // Solo-Feldern gezählt, damit z.B. eine Coop-Serie nie die Solo-Serie
  // verfälscht (und umgekehrt).
  coopPlayed: 0, coopWon: 0, coopLost: 0,
  coopCurrentStreak: 0, coopBestStreak: 0, coopTotalTimeMs: 0, coopHintsUsed: 0,
  // Gesamtzähler perfekter Siege (0 Fehler, 0 Hinweise) — getrennt von der
  // Bestzeit-Logik unten, da hier jeder perfekte Sieg zählt, nicht nur der
  // schnellste je Schwierigkeit.
  perfectWins: 0, coopPerfectWins: 0,
  // id -> { played, won, lost, sumTimeMs, bestTimeMs,
  //         coopPlayed, coopWon, coopLost, coopSumTimeMs, coopBestTimeMs }
  // Die coop*-Felder zählen ausschließlich Coop-Partien getrennt von den
  // ursprünglichen (Solo-)Feldern, damit eine schnellere Coop-Zeit nie die
  // Solo-Bestzeit/den Solo-Schnitt verfälscht.
  byDifficulty: {},
};
export function loadStats() {
  const loaded = load(KEYS.STATS, {});
  // byDifficulty muss IMMER ein frisches Objekt sein -- sonst würde das geteilte
  // EMPTY_STATS.byDifficulty-Template selbst mutiert (Referenz statt Kopie),
  // sobald noch nichts in localStorage steht.
  return { ...EMPTY_STATS, ...loaded, byDifficulty: { ...(loaded.byDifficulty || {}) } };
}
function saveStats(s) { save(KEYS.STATS, s); }

// outcome: 'won' | 'lost' (alle Leben verloren)
// Highscore (bestTimeMs je Schwierigkeit) gilt NUR für perfekte Spiele: keine
// Fehler und keine Hinweise — sonst wäre die Bestzeit nicht vergleichbar.
// coop: true, wenn die Partie in einer aktiven Coop-Session gespielt wurde —
// fließt dann in die coop*-Felder statt die Solo-Felder ein.
export function recordResult({ difficulty, outcome, timeMs, hintsUsed, mistakes, coop = false }) {
  const s = loadStats();
  if (coop) { s.coopPlayed++; s.coopHintsUsed += hintsUsed || 0; }
  else { s.played++; s.hintsUsed += hintsUsed || 0; }
  // Bereits vorhandene Einträge (aus älteren Versionen ohne coop*-Felder) per
  // Merge ergänzen, statt sie zu überschreiben — keine Datenverluste.
  s.byDifficulty[difficulty] = {
    played: 0, won: 0, lost: 0, sumTimeMs: 0, bestTimeMs: null,
    coopPlayed: 0, coopWon: 0, coopLost: 0, coopSumTimeMs: 0, coopBestTimeMs: null,
    ...s.byDifficulty[difficulty],
  };
  const d = s.byDifficulty[difficulty];
  let newHighscore = false;
  if (coop) d.coopPlayed++; else d.played++;
  if (outcome === 'won') {
    const perfect = (mistakes || 0) === 0 && (hintsUsed || 0) === 0;
    if (coop) {
      s.coopWon++; s.coopCurrentStreak++; s.coopBestStreak = Math.max(s.coopBestStreak, s.coopCurrentStreak);
      s.coopTotalTimeMs += timeMs || 0;
      if (perfect) s.coopPerfectWins++;
      d.coopWon++; d.coopSumTimeMs += timeMs || 0;
      if (perfect && (d.coopBestTimeMs == null || timeMs < d.coopBestTimeMs)) { d.coopBestTimeMs = timeMs; newHighscore = true; }
    } else {
      s.won++; s.currentStreak++; s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      s.totalTimeMs += timeMs || 0;
      if (perfect) s.perfectWins++;
      d.won++; d.sumTimeMs += timeMs || 0;
      if (perfect && (d.bestTimeMs == null || timeMs < d.bestTimeMs)) { d.bestTimeMs = timeMs; newHighscore = true; }
    }
  } else {
    if (coop) s.coopCurrentStreak = 0; else s.currentStreak = 0;
    if (coop) { d.coopLost++; s.coopLost++; } else { d.lost++; s.lost++; }
  }
  saveStats(s);
  return { stats: s, newHighscore };
}

// ─── "Was ist neu"-Tracking ───────────────────────────────────────────────────
export function loadSeenVersion() { return load(KEYS.SEEN_VERSION, null); }
export function saveSeenVersion(v) { save(KEYS.SEEN_VERSION, v); }

// ─── Tägliche Spiel-Streak ─────────────────────────────────────────────────────
// KEYS.DAILY/"daily" (Name/Backup-Feld) bewusst unverändert gelassen, obwohl es
// inzwischen jede Partie (Solo/Coop/Race, kein Trainingsmodus) zählt statt nur
// das frühere Tagesrätsel — so bleiben bereits gespeicherte/exportierte Daten
// kompatibel.
const EMPTY_DAILY = { lastCompletedDate: null, currentStreak: 0, bestStreak: 0, totalCompleted: 0, lossNoticeShown: false };
function loadRawStreak() { return { ...EMPTY_DAILY, ...load(KEYS.DAILY, {}) }; }

// Ein Streak gilt nur als "noch lebendig", solange die letzte gespielte Partie
// heute oder gestern war — wurde mindestens ein ganzer Kalendertag ausgelassen,
// ist der Streak gerissen. justLost wird genau einmal pro Riss true (per
// lossNoticeShown persistiert), damit der Verlust-Hinweis beim App-Start nicht
// bei jedem Öffnen erneut erscheint.
export function loadStreak() {
  const d = loadRawStreak();
  const today = todayDateStr();
  let justLost = false;
  if (d.currentStreak > 0 && d.lastCompletedDate !== today && !isNextCalendarDay(d.lastCompletedDate, today)) {
    d.currentStreak = 0;
    if (!d.lossNoticeShown) {
      d.lossNoticeShown = true;
      justLost = true;
    }
    saveStreak(d);
  }
  return { ...d, justLost };
}
function saveStreak(d) { save(KEYS.DAILY, d); }

function isNextCalendarDay(prevDateStr, dateStr) {
  if (!prevDateStr) return false;
  const prev = new Date(`${prevDateStr}T00:00:00`);
  const cur = new Date(`${dateStr}T00:00:00`);
  return Math.round((cur - prev) / 86400000) === 1;
}

// Wird nach jeder abgeschlossenen Partie (Solo/Coop/Race, kein Trainingsmodus)
// aufgerufen. Idempotent: mehrere Partien am selben Tag zählen den Streak nur
// einmal. Nutzt bewusst den rohen, ungekürzten Stand statt loadStreak() — hier
// ist dateStr die maßgebliche "Quelle der Wahrheit" für den aktuellen Tag, nicht
// die echte Systemzeit.
// Rückgabe zusätzlich mit Hinweis-Flags fürs UI:
//  • justCounted  – dieser Aufruf hat den Streak für einen neuen Tag gezählt
//    (erstes abgeschlossenes Spiel des Tages) -> Anlass für den "Streak
//    verlängert"-Screen. Bei Mehrfach-Partien am selben Tag false (idempotent).
//  • continued    – der Streak lief nahtlos weiter (gestern gespielt) statt neu
//    bei 1 zu starten -> Unterscheidung "verlängert" vs. "gestartet".
//  • isNewRecord  – der aktuelle Streak hat die bisherige Bestmarke übertroffen.
export function recordStreakResult(dateStr = todayDateStr()) {
  const d = loadRawStreak();
  if (d.lastCompletedDate === dateStr) return { ...d, justCounted: false, continued: false, isNewRecord: false };
  const prevBest = d.bestStreak;
  const continued = isNextCalendarDay(d.lastCompletedDate, dateStr);
  d.currentStreak = continued ? d.currentStreak + 1 : 1;
  d.bestStreak = Math.max(d.bestStreak, d.currentStreak);
  d.lastCompletedDate = dateStr;
  d.totalCompleted++;
  d.lossNoticeShown = false;
  saveStreak(d);
  return { ...d, justCounted: true, continued, isNewRecord: d.currentStreak > prevBest };
}

// ─── Race-/Duell-Modus (1v1 und 2v2, einfache Zähler ohne Periodenbindung) ───
const EMPTY_RACE_MODE = { racesPlayed: 0, racesWon: 0, racesLost: 0, fastestWinMs: null };
const EMPTY_RACE = { '1v1': { ...EMPTY_RACE_MODE }, '2v2': { ...EMPTY_RACE_MODE } };

// Ältere Speicherstände hatten eine flache Form ({racesPlayed,...} ohne
// Modus-Aufteilung) — wird hier transparent als "1v1"-Daten übernommen, statt
// beim Umstieg auf die Modus-Aufteilung verloren zu gehen.
function migrateRace(loaded) {
  if (loaded && typeof loaded.racesPlayed === 'number') {
    return { '1v1': { ...EMPTY_RACE_MODE, ...loaded }, '2v2': { ...EMPTY_RACE_MODE } };
  }
  return {
    '1v1': { ...EMPTY_RACE_MODE, ...(loaded?.['1v1'] || {}) },
    '2v2': { ...EMPTY_RACE_MODE, ...(loaded?.['2v2'] || {}) },
  };
}
export function loadRace() { return migrateRace(load(KEYS.RACE, {})); }
function saveRace(r) { save(KEYS.RACE, r); }

export function recordRaceWin(mode, timeMs) {
  const r = loadRace();
  const m = r[mode];
  m.racesPlayed++; m.racesWon++;
  if (m.fastestWinMs == null || timeMs < m.fastestWinMs) m.fastestWinMs = timeMs;
  saveRace(r);
  return r;
}

export function recordRaceLoss(mode) {
  const r = loadRace();
  r[mode].racesPlayed++; r[mode].racesLost++;
  saveRace(r);
  return r;
}

// ─── Verlauf gelöster Rätsel (Ringpuffer, neueste zuerst) ─────────────────────
// Speichert je Partie den Seed statt des vollen Puzzles — generatePuzzle({
// difficulty, seed, dim }) reproduziert das exakte Rätsel für "erneut spielen".
// marks ist der Endstand (für "Endboard ansehen"), keine Zugfolge (kein
// zugweises Playback in v1, siehe ROADMAP/Plan).
export function loadHistory() { return load(KEYS.HISTORY, []); }
export function recordHistory(entry) {
  const h = loadHistory();
  h.unshift({ ...entry, ts: Date.now() });
  if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
  save(KEYS.HISTORY, h);
  return h;
}

// ─── Achievements/Badges (id -> Freischalt-Zeitstempel) ───────────────────────
export function loadAchievements() { return load(KEYS.ACHIEVEMENTS, {}); }
export function unlockAchievements(ids) {
  const a = loadAchievements();
  const now = Date.now();
  for (const id of ids) if (!a[id]) a[id] = now;
  save(KEYS.ACHIEVEMENTS, a);
  return a;
}

// ─── Inventar (Besitz von Cosmetics/Items, id -> { acquiredAt, source }) ──────
// Idempotent wie unlockAchievements: ein bereits besessenes Item behält seinen
// ursprünglichen acquiredAt-Zeitstempel + source. 'source' dokumentiert die
// Herkunft (z.B. 'version' = 1.0-Sprung, 'code' = Redeem-Code, 'gift' = Admin).
export function loadInventory() { return load(KEYS.INVENTORY, {}); }
export function inventoryHas(id) { return !!loadInventory()[id]; }
export function grantInventory(id, source = 'unknown') {
  const inv = loadInventory();
  if (!inv[id]) { inv[id] = { acquiredAt: Date.now(), source }; save(KEYS.INVENTORY, inv); }
  return inv;
}
export function revokeInventory(id) {
  const inv = loadInventory();
  if (inv[id]) { delete inv[id]; save(KEYS.INVENTORY, inv); }
  return inv;
}
// Merge eines fremden Inventars (z.B. Cloud bei Login) in das lokale — behält je
// Item den FRÜHEREN acquiredAt (Erstbesitz gewinnt), nimmt fehlende Items auf.
export function mergeInventory(other) {
  if (!other || typeof other !== 'object') return loadInventory();
  const inv = loadInventory();
  for (const [id, meta] of Object.entries(other)) {
    if (!meta) continue;
    if (!inv[id]) inv[id] = { acquiredAt: meta.acquiredAt || Date.now(), source: meta.source || 'sync' };
    else if (meta.acquiredAt && meta.acquiredAt < inv[id].acquiredAt) inv[id].acquiredAt = meta.acquiredAt;
  }
  save(KEYS.INVENTORY, inv);
  return inv;
}

// Live-Abgleich mit dem Cloud-Inventar (/users/{uid}/inventory, s. watchGifts in
// account.js): Cloud-Einträge werden übernommen (Geschenke sofort nutzbar, ohne
// Neustart), lokale SELBST-Unlocks (Kauf/Code/Versions-Skin) bleiben erhalten,
// auch wenn sie noch nicht hochgesynct sind. Admin-vergebene Einträge (source
// 'gift') existieren nur, solange sie in der Cloud stehen — so wirkt auch ein
// Entzug sofort. Einschränkung: den Entzug eines KAUF-Items sieht ein gerade
// aktiver Client erst beim nächsten Start (Selbst-Unlocks sind clientautoritativ).
export function reconcileInventoryFromCloud(cloud) {
  if (!cloud || typeof cloud !== 'object') cloud = {};
  const local = loadInventory();
  const inv = {};
  for (const [id, meta] of Object.entries(cloud)) {
    if (meta) inv[id] = { acquiredAt: meta.acquiredAt || Date.now(), source: meta.source || 'sync' };
  }
  for (const [id, meta] of Object.entries(local)) {
    if (!meta) continue;
    if (inv[id]) { if (meta.acquiredAt && meta.acquiredAt < inv[id].acquiredAt) inv[id].acquiredAt = meta.acquiredAt; continue; }
    if (meta.source !== 'gift') inv[id] = meta;
  }
  save(KEYS.INVENTORY, inv);
  return inv;
}

// ─── Wallet (In-Game-Währung) ─────────────────────────────────────────────────
// Modular gehalten: ALLE Guthaben-Änderungen laufen über grant-/spendCurrency,
// damit später eine serverautoritative Quelle (Cloud Function für Käufe) ergänzt
// werden kann, ohne die Aufrufer zu ändern. Vorerst nur in-game verdienbar.
const EMPTY_WALLET = { balance: 0, updatedAt: 0 };
export function loadWallet() { return { ...EMPTY_WALLET, ...load(KEYS.WALLET, {}) }; }
function saveWallet(w) { save(KEYS.WALLET, w); }
export function grantCurrency(amount, reason = 'earn') {
  const n = Math.max(0, Math.floor(amount || 0));
  const w = loadWallet();
  w.balance += n; w.updatedAt = Date.now();
  saveWallet(w);
  log('storage', 'Währung gutgeschrieben', { amount: n, reason, balance: w.balance });
  return w;
}
// Gibt { ok, balance } zurück; lehnt ab (ok:false), wenn das Guthaben nicht reicht.
export function spendCurrency(amount, reason = 'spend') {
  const n = Math.max(0, Math.floor(amount || 0));
  const w = loadWallet();
  if (w.balance < n) return { ok: false, balance: w.balance };
  w.balance -= n; w.updatedAt = Date.now();
  saveWallet(w);
  log('storage', 'Währung ausgegeben', { amount: n, reason, balance: w.balance });
  return { ok: true, balance: w.balance };
}
// Cloud-Wallet übernehmen (watchGifts): nur aufrufen, wenn die Cloud NEUER ist
// als der lokale Stand — lokale Käufe zwischen zwei Sync-ups gewinnen sonst.
export function applyCloudWallet(w) {
  if (w && typeof w.balance === 'number') {
    saveWallet({ balance: Math.max(0, Math.floor(w.balance)), updatedAt: w.updatedAt || Date.now() });
    log('storage', 'Cloud-Guthaben übernommen', { balance: w.balance });
  }
  return loadWallet();
}

// ─── Lokales Profil (displayName, role, accountId) ────────────────────────────
// role: 'user' (Default) | 'admin'. accountId = Firebase-uid sobald eingeloggt,
// sonst null (anonym/lokal). Wird bei Login mit dem Cloud-Profil abgeglichen.
const EMPTY_PROFILE = { displayName: '', role: 'user', accountId: null, createdAt: 0 };
export function loadProfile() { return { ...EMPTY_PROFILE, ...load(KEYS.PROFILE, {}) }; }
export function saveProfile(p) { save(KEYS.PROFILE, { ...loadProfile(), ...p }); return loadProfile(); }

// ─── Datei-Export / Import ────────────────────────────────────────────────────
function buildTimestamp() {
  const d = new Date(); const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
// Reines Sammeln aller persistenten Nutzerdaten (testbar, ohne DOM). Wird vom
// Datei-Export UND (gleiche Felder) vom Cloud-Sync genutzt.
export function collectExportData(type = 'manual') {
  return {
    ts: Date.now(), v: 1, label: type,
    rev: load(KEYS.DATA_REV, 0),   // Änderungszeit der Daten (für Cloud-Konfliktcheck)
    settings: load(KEYS.SETTINGS, {}),
    activeGame: load(KEYS.ACTIVE_GAME, null),
    activeGameCoop: load(KEYS.ACTIVE_GAME_COOP, null),
    stats: load(KEYS.STATS, {}),
    daily: load(KEYS.DAILY, {}),
    history: load(KEYS.HISTORY, []),
    achievements: load(KEYS.ACHIEVEMENTS, {}),
    race: load(KEYS.RACE, {}),
    inventory: load(KEYS.INVENTORY, {}),
    wallet: load(KEYS.WALLET, {}),
    // Rolle NICHT mitsynchronisieren — sie ist serverseitig autoritativ
    // (/users/{uid}/profile/role) und darf nie über den Datensnapshot reisen.
    profile: (() => { const { role, ...rest } = load(KEYS.PROFILE, {}); return rest; })(),
  };
}
export async function exportToFile(type = 'manual') {
  const filename = `${type}-coop-number-sums-${buildTimestamp()}.json`;
  const payload = JSON.stringify(collectExportData(type), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        // NUR die Datei teilen — kein title/text: iOS würde sonst einen leeren
        // Text-Anhang als zweite .txt-Datei mit exportieren (siehe debuglog.js).
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; log('storage', 'Exportieren fehlgeschlagen', e); }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
export function importFromFile(jsonText) {
  const data = JSON.parse(jsonText);
  if (data.settings) save(KEYS.SETTINGS, data.settings);
  if (data.stats) save(KEYS.STATS, data.stats);
  if (data.daily) save(KEYS.DAILY, data.daily);
  if (data.history) save(KEYS.HISTORY, data.history);
  if (data.achievements) save(KEYS.ACHIEVEMENTS, data.achievements);
  if (data.race) save(KEYS.RACE, data.race);
  if (data.inventory) save(KEYS.INVENTORY, data.inventory);
  if (data.wallet) save(KEYS.WALLET, data.wallet);
  if (data.profile) {
    // Die Rolle (Admin) ist SERVERSEITIG autoritativ (/users/{uid}/profile/role)
    // und darf NIE aus einem synchronisierten Datensnapshot überschrieben werden
    // — sonst überschreibt eine veraltete „user"-Rolle den in der DB gesetzten
    // Admin-Status. accountId ist zudem geräte-lokal. Beide lokal bewahren.
    const cur = loadProfile();
    save(KEYS.PROFILE, { ...data.profile, role: cur.role, accountId: cur.accountId });
  }
  if (data.activeGame !== undefined) saveActiveGame(data.activeGame);
  if (data.activeGameCoop !== undefined) saveActiveGameCoop(data.activeGameCoop);
  return data;
}

// ─── Alle lokalen Daten löschen ───────────────────────────────────────────────
export function deleteAllData() {
  remove(KEYS.SETTINGS);
  remove(KEYS.ACTIVE_GAME);
  remove(KEYS.ACTIVE_GAME_COOP);
  remove(KEYS.COOP_SESSION);
  remove(KEYS.STATS);
  remove(KEYS.SEEN_VERSION);
  remove(KEYS.DAILY);
  remove(KEYS.HISTORY);
  remove(KEYS.ACHIEVEMENTS);
  remove(KEYS.RACE);
  remove(KEYS.INVENTORY);
  remove(KEYS.WALLET);
  remove(KEYS.PROFILE);
  remove(KEYS.DATA_REV);
  remove(KEYS.SYNCED_REV);
  remove(KEYS.LAST_SYNC);
  clearLog();
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
