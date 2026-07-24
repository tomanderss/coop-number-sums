// storage.js — Persistenz via localStorage (Einstellungen, laufendes Spiel,
// Statistik, rollende Backups, Datei-Export/Import). Struktur analog werwolf-app.

import { DEFAULT_SETTINGS } from './config.js';
import { log, clearLog } from './debuglog.js';
import { todayDateStr, sanitizeLastCompleted } from './streak.js';

const KEYS = {
  SETTINGS: 'cns_settings',
  ACTIVE_GAME: 'cns_active_game',
  ACTIVE_GAME_COOP: 'cns_active_game_coop',
  ACTIVE_GAME_ENDLESS: 'cns_active_game_endless',  // fortsetzbarer Solo-Endlos-Lauf (gerätelokal, nie synct)
  COOP_SESSION: 'cns_coop_session',
  STATS: 'cns_stats',
  SEEN_VERSION: 'cns_seen_version',
  DAILY: 'cns_daily',
  HISTORY: 'cns_history',
  ACHIEVEMENTS: 'cns_achievements',
  MISSIONS: 'cns_missions', // { weekKey, progress:{id:n}, claimed:{id:true} } — Wochen-Missionen (js/missions.js)
  RACE: 'cns_race',
  // ── Account-/Ökonomie-Fundament (vorwärtskompatibel) ──
  // Lokal-zuerst: für anonyme Nutzer ist localStorage die Quelle der Wahrheit;
  // bei Login werden diese Strukturen 1:1 nach /users/{uid} gespiegelt (siehe
  // js/account.js). Bewusst dieselbe Form wie der spätere RTDB-Knoten.
  INVENTORY: 'cns_inventory',   // { itemId: { acquiredAt, source } } — Besitz von Cosmetics (z.B. Skin 'dynamicColor')
  WALLET: 'cns_wallet',         // { balance, updatedAt } — In-Game-Währung (nicht auszahlbar)
  WALLET_LOG: 'cns_wallet_log', // [{ id, ts, amount(±), reason, meta }] — Geldverlauf (FIFO, SYNCT als Teil des Snapshots, Union-Merge nach id)
  PROFILE: 'cns_profile',       // { displayName, username, role, accountId, createdAt } — lokales Profil (role für Admin)
  DATA_REV: 'cns_data_rev',     // Zeitstempel der letzten lokalen Nutzdaten-Änderung (für Cloud-Konfliktcheck)
  SYNCED_REV: 'cns_synced_rev', // DATA_REV beim letzten erfolgreichen Sync (Basislinie für decideSync)
  LAST_SYNC: 'cns_last_sync',   // Zeitpunkt der letzten erfolgreichen Cloud-Sicherung (nur UI; NICHT nutzdaten-getrackt)
  DEVICE_ID: 'cns_device_id',   // stabile Geräte-Kennung (Multi-Device-Handoff); PER GERÄT, wird NIE synct/als Nutzdaten gezählt
  COMPLETED_GAMES: 'cns_completed_games', // [gameId,…] bereits abgerechnete Partien (Belohnungs-Idempotenz über Geräte), FIFO
  ACTIVE_GAME_BACKUP: 'cns_active_game_backup', // letzter durch Divergenz verdrängter Solo-Stand (nie still gelöscht)
};
// Schlüssel, deren Änderung als „Nutzdaten geändert" zählt (⇒ DATA_REV hochzählen).
// Bewusst OHNE SEEN_VERSION/COOP_SESSION/Backups/DATA_REV/SYNCED_REV.
const USER_DATA_KEYS = new Set([
  'cns_settings', 'cns_active_game', 'cns_active_game_coop', 'cns_stats', 'cns_daily',
  'cns_history', 'cns_achievements', 'cns_missions', 'cns_race', 'cns_inventory', 'cns_wallet', 'cns_profile',
  'cns_completed_games', 'cns_wallet_log',
]);
// Wie lange „Coop fortsetzen" nach der letzten Sicherung angeboten wird. Der
// Raum lebt in der RTDB weiter, solange ihn niemand aktiv verlässt (Präsenz-
// Einträge verschwinden zwar per onDisconnect, meta/events bleiben) — beide
// Spieler können also auch deutlich später unabhängig zurückkehren. Die
// früheren 5 Minuten waren der Hauptgrund, warum der Fortsetzen-Button
// praktisch nie funktionierte (Klick lief in eine bereits verfallene Session).
const COOP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const HISTORY_MAX = 20;

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
// Backup des durch echte Cross-Device-Divergenz verdrängten Solo-Stands. Rein
// lokal, NICHT synct (kein Nutzdaten-Key) — dient nur dem „nie still gelöscht"-Prinzip.
export function loadActiveGameBackup() { return load(KEYS.ACTIVE_GAME_BACKUP, null); }
export function saveActiveGameBackup(g) { if (g) localStorage.setItem(KEYS.ACTIVE_GAME_BACKUP, JSON.stringify(g)); else remove(KEYS.ACTIVE_GAME_BACKUP); }
// Backup der beim Versions-Mismatch UNTERLEGENEN Seite (lokal ODER Cloud) — nie
// still gelöscht. Rein lokal, NICHT synct (kein Nutzdaten-Key).
export function saveConflictBackup(data) { try { localStorage.setItem('cns_conflict_backup', JSON.stringify({ ts: Date.now(), data })); } catch (_) {} }
export function loadConflictBackup() { return load('cns_conflict_backup', null); }

// ─── Multi-Device: stabile Geräte-Kennung + Belohnungs-Idempotenz ─────────────
// Stabile, zufällige Geräte-ID (einmal erzeugt, dann persistent). PER GERÄT —
// bewusst KEIN Nutzdaten-Key und NICHT in der Cloud, sonst wären alle Geräte
// „dasselbe Gerät" und der Handoff-Besitz (deviceId) würde nie wechseln.
export function deviceId() {
  let id = load(KEYS.DEVICE_ID, null);
  if (!id) {
    id = 'd-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem(KEYS.DEVICE_ID, JSON.stringify(id));
  }
  return id;
}
const COMPLETED_GAMES_MAX = 200;
export function loadCompletedGames() { const a = load(KEYS.COMPLETED_GAMES, []); return Array.isArray(a) ? a : []; }
export function isGameCompleted(gameId) { return !!gameId && loadCompletedGames().includes(gameId); }
// Markiert eine Partie als abgerechnet (Sieg/Verlust gebucht). Idempotent, FIFO-
// gekappt. Nutzdaten-Key ⇒ synct (Union beim Sync), damit alle Geräte wissen,
// dass gameId X schon gezählt wurde → keine Doppel-Coins bei Beenden auf 2 Geräten.
export function markGameCompleted(gameId) {
  if (!gameId) return;
  const a = loadCompletedGames();
  if (a.includes(gameId)) return;
  a.push(gameId);
  while (a.length > COMPLETED_GAMES_MAX) a.shift();
  save(KEYS.COMPLETED_GAMES, a);
}
// Union-Merge der abgerechneten gameIds aus der Cloud (wie mergeInventory: nie
// verlieren, nur ergänzen).
export function mergeCompletedGames(cloudList) {
  if (!Array.isArray(cloudList) || !cloudList.length) return loadCompletedGames();
  const set = new Set(loadCompletedGames());
  for (const id of cloudList) if (id) set.add(id);
  let a = [...set];
  if (a.length > COMPLETED_GAMES_MAX) a = a.slice(a.length - COMPLETED_GAMES_MAX);
  save(KEYS.COMPLETED_GAMES, a);
  return a;
}
export function loadActiveGameCoop() { return load(KEYS.ACTIVE_GAME_COOP, null); }
export function saveActiveGameCoop(g) { if (g) save(KEYS.ACTIVE_GAME_COOP, g); else remove(KEYS.ACTIVE_GAME_COOP); }
// Fortsetzbarer Solo-Endlos-Lauf (eigener Slot, damit ein Endlos-Lauf und ein
// klassisches Solo-Spiel parallel fortsetzbar bleiben). Gerätelokal, nie synct.
export function loadActiveGameEndless() { return load(KEYS.ACTIVE_GAME_ENDLESS, null); }
export function saveActiveGameEndless(g) { if (g) save(KEYS.ACTIVE_GAME_ENDLESS, g); else remove(KEYS.ACTIVE_GAME_ENDLESS); }

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
  // „Endlos-Aufstieg"-Solo-Modus (js/endless.js): höchstes je erreichtes Level
  // (Score) + Anzahl Läufe. endlessBest merged geräteübergreifend als MAXIMUM
  // (mergeNumericDeep), endlessRuns als Maximum (kein exaktes Summieren nötig).
  // Coop-Endlos getrennt gezählt (anderes Spielgefühl: geteilte Leben, kein Refill).
  endlessBest: 0, endlessRuns: 0, endlessCoopBest: 0, endlessCoopRuns: 0,
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

// Rückwirkende Endlos-Nachbuchung anwenden (einmalige Migration, s.
// reconstructEndlessRuns in endless.js): bucht die rekonstruierten Einzelspiele
// alter Läufe in die Zähler — Siege/Niederlagen/gespielt, global + je
// Schwierigkeit, Solo und Coop getrennt. FASST BEWUSST NICHTS AN, was nicht
// rekonstruierbar ist: keine Zeiten/Bestzeiten, keine perfectWins, keine
// Sieg-Streaks (currentStreak/bestStreak), kein Tages-Streak. Rückgabe: stats.
export function applyEndlessBackfill(recon) {
  const s = loadStats();
  const per = (recon && recon.perDiff) || {};
  for (const [id, d] of Object.entries(per)) {
    s.byDifficulty[id] = {
      played: 0, won: 0, lost: 0, sumTimeMs: 0, bestTimeMs: null,
      coopPlayed: 0, coopWon: 0, coopLost: 0, coopSumTimeMs: 0, coopBestTimeMs: null,
      ...s.byDifficulty[id],
    };
    const b = s.byDifficulty[id];
    b.won += d.won || 0; b.lost += d.lost || 0; b.played += (d.won || 0) + (d.lost || 0);
    b.coopWon += d.coopWon || 0; b.coopLost += d.coopLost || 0; b.coopPlayed += (d.coopWon || 0) + (d.coopLost || 0);
  }
  s.won += recon.wins || 0; s.lost += recon.losses || 0; s.played += (recon.wins || 0) + (recon.losses || 0);
  s.coopWon += recon.coopWins || 0; s.coopLost += recon.coopLosses || 0; s.coopPlayed += (recon.coopWins || 0) + (recon.coopLosses || 0);
  saveStats(s);
  return s;
}

// „Endlos-Aufstieg" abschließen: Score (erreichtes Level) verbuchen. Bestwert
// = Maximum, Laufzähler +1. Rückgabe: { stats, newBest }.
export function recordEndlessRun(score, { coop = false } = {}) {
  const s = loadStats();
  const bestKey = coop ? 'endlessCoopBest' : 'endlessBest';
  const runsKey = coop ? 'endlessCoopRuns' : 'endlessRuns';
  s[runsKey] = (s[runsKey] || 0) + 1;
  const prev = s[bestKey] || 0;
  const newBest = score > prev;
  if (newBest) s[bestKey] = score;
  saveStats(s);
  return { stats: s, newBest };
}

// ─── Wochen-Missionen (js/missions.js) ────────────────────────────────────────
export function loadMissions() { return load(KEYS.MISSIONS, { weekKey: null, progress: {}, claimed: {} }); }
export function saveMissions(s) { save(KEYS.MISSIONS, s); }

// ─── "Was ist neu"-Tracking ───────────────────────────────────────────────────
export function loadSeenVersion() { return load(KEYS.SEEN_VERSION, null); }
export function saveSeenVersion(v) { save(KEYS.SEEN_VERSION, v); }

// ─── Tägliche Spiel-Streak ─────────────────────────────────────────────────────
// KEYS.DAILY/"daily" (Name/Backup-Feld) bewusst unverändert gelassen, obwohl es
// inzwischen jede Partie (Solo/Coop/Race, kein Trainingsmodus) zählt statt nur
// das frühere Tagesrätsel — so bleiben bereits gespeicherte/exportierte Daten
// kompatibel.
const EMPTY_DAILY = { lastCompletedDate: null, currentStreak: 0, bestStreak: 0, totalCompleted: 0, lossNoticeShown: false };
// Beim Laden IMMER das „zuletzt gespielt"-Datum heilen (sanitizeLastCompleted in
// streak.js): ein via Admin-Editor/Fremddaten vergiftetes Datum (falsches Format
// oder Zukunft) ließ die Serie sonst bei jedem Start reißen und nie mehr zählen.
// Die Heilung wird sofort persistiert, damit auch Export/Cloud-Upload den
// reparierten Stand tragen (und der Log-Eintrag nur einmal erscheint).
function loadRawStreak() {
  const d = { ...EMPTY_DAILY, ...load(KEYS.DAILY, {}) };
  const healed = sanitizeLastCompleted(d.lastCompletedDate);
  if (healed !== d.lastCompletedDate) {
    log('storage', 'Streak-Datum geheilt (ungültig/zukünftig)', { von: d.lastCompletedDate, zu: healed });
    d.lastCompletedDate = healed;
    saveStreak(d);
  }
  return d;
}

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
const EMPTY_RACE = { '1v1': { ...EMPTY_RACE_MODE }, '2v2': { ...EMPTY_RACE_MODE }, 'ffa': { ...EMPTY_RACE_MODE } };

// Ältere Speicherstände hatten eine flache Form ({racesPlayed,...} ohne
// Modus-Aufteilung) — wird hier transparent als "1v1"-Daten übernommen, statt
// beim Umstieg auf die Modus-Aufteilung verloren zu gehen. Der 'ffa'-Bucket
// (jeder-gegen-jeden, 3–4 Spieler) kam später dazu und wird für alte Stände
// leer ergänzt.
function migrateRace(loaded) {
  if (loaded && typeof loaded.racesPlayed === 'number') {
    return { '1v1': { ...EMPTY_RACE_MODE, ...loaded }, '2v2': { ...EMPTY_RACE_MODE }, 'ffa': { ...EMPTY_RACE_MODE } };
  }
  return {
    '1v1': { ...EMPTY_RACE_MODE, ...(loaded?.['1v1'] || {}) },
    '2v2': { ...EMPTY_RACE_MODE, ...(loaded?.['2v2'] || {}) },
    'ffa': { ...EMPTY_RACE_MODE, ...(loaded?.['ffa'] || {}) },
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

// ─── Geldverlauf (Transaktionshistorie) ───────────────────────────────────────
// Rein lokal/UI (kein USER_DATA_KEY → wird nicht in den Cloud-Konfliktcheck
// gezogen; die maßgebliche Größe bleibt der Kontostand selbst). FIFO-begrenzt,
// damit localStorage nicht unbegrenzt wächst — analog zum Debug-Log.
const WALLET_LOG_MAX = 120;
export function loadWalletLog() { const l = load(KEYS.WALLET_LOG, []); return Array.isArray(l) ? l : []; }
// Stabiler Vergleichs-Key eines Eintrags: neue Einträge haben eine eindeutige id;
// Alt-Einträge (vor dem Sync des Verlaufs) werden über ihre Felder identifiziert.
function walletEntryKey(e) { return e.id || `${e.ts}|${e.amount}|${e.reason || ''}`; }
// Zwei Geldverläufe verlustfrei vereinigen (Union nach Key, jüngste zuerst,
// FIFO-gekappt). Rein & unit-getestet — Grundlage dafür, dass die HERKUNFT des
// Guthabens geräteübergreifend mitreist, statt dass ein fremdes Gerät die
// Saldo-Differenz fälschlich als „Admin-Geschenk" interpretiert.
export function mergeWalletLogs(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const e of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!e || typeof e.amount !== 'number') continue;
    const k = walletEntryKey(e);
    if (seen.has(k)) continue;
    seen.add(k); out.push(e);
  }
  out.sort((x, y) => (y.ts || 0) - (x.ts || 0));
  if (out.length > WALLET_LOG_MAX) out.length = WALLET_LOG_MAX;
  return out;
}
// Welcher Teil einer Saldo-Differenz ist durch NEU hinzugekommene (fremde)
// Verlaufs-Einträge NICHT erklärt? Nur dieser Rest ist eine echte externe
// Änderung (Admin-Geschenk/-Entzug) — erspieltes Geld eines anderen Geräts
// bringt seine 'win'-Einträge selbst mit und erklärt sich damit von allein.
export function unexplainedWalletDelta(prevLog, mergedLog, deltaBalance) {
  const known = new Set((prevLog || []).map(walletEntryKey));
  let foreign = 0;
  for (const e of (mergedLog || [])) if (!known.has(walletEntryKey(e))) foreign += (Number(e.amount) || 0);
  return Math.round((Number(deltaBalance) || 0) - foreign);
}
export function clearWalletLog() { save(KEYS.WALLET_LOG, []); }
// amount ist VORZEICHENBEHAFTET (+ = Einnahme, − = Ausgabe). Neueste Einträge
// stehen vorne. balance = Kontostand NACH der Buchung.
function pushWalletLog(amount, reason, balance, meta = null) {
  if (!amount) return; // 0-Buchungen (z.B. Cloud-Sync ohne Änderung) nicht protokollieren
  const l = loadWalletLog();
  // id macht den Eintrag geräteübergreifend eindeutig (Union-Merge beim Sync);
  // meta trägt die Herkunfts-Details (Schwierigkeit, Modus, Multiplikatoren, gameId).
  const entry = { id: generateId(), ts: Date.now(), amount, reason, balance };
  if (meta) entry.meta = meta;
  l.unshift(entry);
  if (l.length > WALLET_LOG_MAX) l.length = WALLET_LOG_MAX;
  save(KEYS.WALLET_LOG, l);
}
// Reine Protokoll-Buchung OHNE Saldo-Änderung: für Fälle, in denen der Kontostand
// bereits anderweitig gesetzt wurde (z.B. Admin-Selbstbearbeitung via Snapshot-
// Import) und die Änderung nur noch im Geldverlauf erscheinen soll. `amount` ist
// vorzeichenbehaftet; die Buchung nutzt den AKTUELLEN Kontostand.
export function noteWalletTransaction(amount, reason = 'admin', meta = null) {
  pushWalletLog(Math.round(amount || 0), reason, loadWallet().balance, meta);
}

export function grantCurrency(amount, reason = 'earn', meta = null) {
  const n = Math.max(0, Math.floor(amount || 0));
  const w = loadWallet();
  w.balance += n; w.updatedAt = Date.now();
  saveWallet(w);
  pushWalletLog(n, reason, w.balance, meta);
  log('storage', 'Währung gutgeschrieben', { amount: n, reason, balance: w.balance });
  return w;
}
// Gibt { ok, balance } zurück; lehnt ab (ok:false), wenn das Guthaben nicht reicht.
export function spendCurrency(amount, reason = 'spend', meta = null) {
  const n = Math.max(0, Math.floor(amount || 0));
  const w = loadWallet();
  if (w.balance < n) return { ok: false, balance: w.balance };
  w.balance -= n; w.updatedAt = Date.now();
  saveWallet(w);
  pushWalletLog(-n, reason, w.balance, meta);
  log('storage', 'Währung ausgegeben', { amount: n, reason, balance: w.balance });
  return { ok: true, balance: w.balance };
}
// Cloud-Wallet übernehmen (watchGifts): nur aufrufen, wenn die Cloud NEUER ist
// als der lokale Stand — lokale Käufe zwischen zwei Sync-ups gewinnen sonst.
export function applyCloudWallet(w, cloudLog = null) {
  if (w && typeof w.balance === 'number') {
    const prevLog = loadWalletLog();
    const prev = loadWallet().balance;
    const next = Math.max(0, Math.floor(w.balance));
    saveWallet({ balance: next, updatedAt: w.updatedAt || Date.now() });
    // Den Cloud-Verlauf ZUERST vereinigen: erspieltes/ausgegebenes Geld eines
    // anderen Geräts bringt seine Einträge selbst mit. Nur der davon NICHT
    // erklärte Rest der Saldo-Differenz ist eine echte externe Änderung
    // (Admin-Geschenk/-Entzug) und wird als solche gebucht — vorher wurde die
    // KOMPLETTE Differenz pauschal als „Admin-Geschenk" fehletikettiert.
    if (Array.isArray(cloudLog) && cloudLog.length) save(KEYS.WALLET_LOG, mergeWalletLogs(prevLog, cloudLog));
    const residual = unexplainedWalletDelta(prevLog, loadWalletLog(), next - prev);
    if (residual !== 0) pushWalletLog(residual, residual > 0 ? 'gift' : 'adminRevoke', next);
    log('storage', 'Cloud-Guthaben übernommen', { balance: next, delta: next - prev, residual });
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
    missions: load(KEYS.MISSIONS, {}),
    race: load(KEYS.RACE, {}),
    inventory: load(KEYS.INVENTORY, {}),
    wallet: load(KEYS.WALLET, {}),
    walletLog: loadWalletLog(),   // Geldverlauf reist mit (Union-Merge beim Import — Herkunft bleibt geräteübergreifend erhalten)
    completedGames: load(KEYS.COMPLETED_GAMES, []),  // Belohnungs-Idempotenz (Union-Merge beim Import)
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
// Aktivspiel-Slot konservativ mergen: Ein vorhandenes LOKALES laufendes Spiel
// darf ein Cloud-/Datei-Import NIE stillschweigend löschen oder durch einen
// älteren Stand ersetzen. Symptom vorher: „Nach einem Update ist mein Spiel
// weg" — der Kaltstart-Reconcile (applyCloud → importFromFile) übernahm den
// Snapshot des zuletzt hochladenden Geräts, und stand dort activeGame:null
// (z.B. Zweitgerät ohne offene Partie), wurde der lokale Spielstand mit null
// überschrieben. Regel: der jüngere Stand (ts) gewinnt; fehlt eine Seite,
// bleibt die vorhandene. Rein (unit-getestet), Seiteneffekte beim Aufrufer.
// Ein Spielstand, dessen Brett bereits VOLLSTÄNDIG korrekt gelöst ist, ist
// faktisch abgeschlossen und darf NICHT als „Fortsetzen" wiederauftauchen
// (Symptom: fertiges Spiel erscheint fortsetzbar, lädt ein 100%-Brett, das
// keine Interaktion mehr zulässt — die Win-Erkennung feuert nur auf einen Zug,
// nicht beim bloßen Laden). Kann entstehen, wenn ein „done"-Upload einmal
// scheiterte (z.B. der frühere Infinity-Bug) und ein alter „playing"-Cloud-Stand
// mit gelöstem Brett wieder übernommen wird. Rein, unit-getestet.
export function snapshotSolved(g) {
  const p = g && g.puzzle;
  if (!p || !Array.isArray(p.solution) || !Array.isArray(g.marks)) return false;
  for (let r = 0; r < p.rows; r++) {
    const sol = p.solution[r], m = g.marks[r];
    if (!sol || !m) return false;
    for (let c = 0; c < p.cols; c++) {
      if (m[c] !== (sol[c] ? 'kept' : 'removed')) return false;
    }
  }
  return true;
}
export function pickActiveGame(localG, importedG) {
  // Bereits gelöste Stände wie „nicht vorhanden" behandeln (s. snapshotSolved).
  const l = localG && localG.puzzle && !snapshotSolved(localG) ? localG : null;
  const i = importedG && importedG.puzzle && !snapshotSolved(importedG) ? importedG : null;
  if (!l) return i;
  if (!i) return l;
  return (Number(i.ts) || 0) > (Number(l.ts) || 0) ? i : l;
}
export function importFromFile(jsonText) {
  const data = JSON.parse(jsonText);
  if (data.settings) save(KEYS.SETTINGS, data.settings);
  if (data.stats) save(KEYS.STATS, data.stats);
  if (data.daily) save(KEYS.DAILY, data.daily);
  if (data.history) save(KEYS.HISTORY, data.history);
  if (data.achievements) save(KEYS.ACHIEVEMENTS, data.achievements);
  if (data.missions) save(KEYS.MISSIONS, data.missions);
  if (data.race) save(KEYS.RACE, data.race);
  if (data.inventory) save(KEYS.INVENTORY, data.inventory);
  if (data.wallet) save(KEYS.WALLET, data.wallet);
  // Geldverlauf: Union (nie schrumpfen) — Einträge beider Seiten bleiben erhalten.
  if (Array.isArray(data.walletLog)) save(KEYS.WALLET_LOG, mergeWalletLogs(loadWalletLog(), data.walletLog));
  // Union-Merge (nie schrumpfen): abgerechnete Partien beider Seiten behalten.
  if (data.completedGames) mergeCompletedGames(data.completedGames);
  if (data.profile) {
    // Die Rolle (Admin) ist SERVERSEITIG autoritativ (/users/{uid}/profile/role)
    // und darf NIE aus einem synchronisierten Datensnapshot überschrieben werden
    // — sonst überschreibt eine veraltete „user"-Rolle den in der DB gesetzten
    // Admin-Status. accountId ist zudem geräte-lokal. Beide lokal bewahren.
    const cur = loadProfile();
    save(KEYS.PROFILE, { ...data.profile, role: cur.role, accountId: cur.accountId });
  }
  if (data.activeGame !== undefined) {
    const local = loadActiveGame();
    const keep = pickActiveGame(local, data.activeGame);
    // Wird ein lokaler Stand durch einen jüngeren Import verdrängt: als Backup
    // sichern (Prinzip „nie still gelöscht", wie beim Session-defunct).
    if (local && local.puzzle && keep !== local) saveActiveGameBackup(local);
    if (local && local.puzzle && keep === local && !(data.activeGame && data.activeGame.puzzle)) {
      log('storage', 'Import ohne Aktivspiel — lokales laufendes Spiel bewahrt');
    }
    saveActiveGame(keep);
  }
  if (data.activeGameCoop !== undefined) {
    saveActiveGameCoop(pickActiveGame(loadActiveGameCoop(), data.activeGameCoop));
  }
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
  remove(KEYS.MISSIONS);
  remove(KEYS.RACE);
  remove(KEYS.INVENTORY);
  remove(KEYS.WALLET);
  remove(KEYS.WALLET_LOG);
  remove(KEYS.PROFILE);
  remove(KEYS.DATA_REV);
  remove(KEYS.SYNCED_REV);
  remove(KEYS.LAST_SYNC);
  remove(KEYS.COMPLETED_GAMES);
  remove(KEYS.ACTIVE_GAME_BACKUP);
  // DEVICE_ID bewusst behalten: es ist die Geräte-Identität (Handoff), keine Nutzdaten.
  clearLog();
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
