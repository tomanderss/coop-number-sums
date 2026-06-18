// storage.js — Persistenz via localStorage (Einstellungen, laufendes Spiel,
// Statistik, rollende Backups, Datei-Export/Import). Struktur analog werwolf-app.

import { DEFAULT_SETTINGS } from './config.js';
import { log, clearLog } from './debuglog.js';

const KEYS = {
  SETTINGS: 'cns_settings',
  ACTIVE_GAME: 'cns_active_game',
  STATS: 'cns_stats',
  BACKUP_SLOT: 'cns_bk_slot',
  SEEN_VERSION: 'cns_seen_version',
  DAILY: 'cns_daily',
};
const BACKUP_COUNT = 3;
const bk = (i) => `cns_bk_${i}`;

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { log('storage', `Laden von "${key}" fehlgeschlagen`, e); return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { log('storage', `Speichern von "${key}" fehlgeschlagen`, e); }
}
function remove(key) {
  try { localStorage.removeItem(key); }
  catch (e) { log('storage', `Entfernen von "${key}" fehlgeschlagen`, e); }
}

// ─── Einstellungen ────────────────────────────────────────────────────────────
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load(KEYS.SETTINGS, {}) };
}
export function saveSettings(s) { save(KEYS.SETTINGS, s); }

// ─── Laufendes Spiel (Resume) ─────────────────────────────────────────────────
export function loadActiveGame() { return load(KEYS.ACTIVE_GAME, null); }
export function saveActiveGame(g) { if (g) save(KEYS.ACTIVE_GAME, g); else remove(KEYS.ACTIVE_GAME); }

// ─── Statistik ────────────────────────────────────────────────────────────────
const EMPTY_STATS = {
  played: 0, won: 0, lost: 0, gaveup: 0, currentStreak: 0, bestStreak: 0,
  totalTimeMs: 0, hintsUsed: 0,
  // Coop-Pendants der obigen Top-Level-Felder — komplett getrennt von den
  // Solo-Feldern gezählt, damit z.B. eine Coop-Serie nie die Solo-Serie
  // verfälscht (und umgekehrt).
  coopPlayed: 0, coopWon: 0, coopLost: 0, coopGaveup: 0,
  coopCurrentStreak: 0, coopBestStreak: 0, coopTotalTimeMs: 0, coopHintsUsed: 0,
  // id -> { played, won, lost, gaveup, sumTimeMs, bestTimeMs,
  //         coopPlayed, coopWon, coopLost, coopGaveup, coopSumTimeMs, coopBestTimeMs }
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
export function saveStats(s) { save(KEYS.STATS, s); }

// outcome: 'won' | 'lost' (alle Leben verloren) | 'gaveup' (Aufgeben-Button)
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
    played: 0, won: 0, lost: 0, gaveup: 0, sumTimeMs: 0, bestTimeMs: null,
    coopPlayed: 0, coopWon: 0, coopLost: 0, coopGaveup: 0, coopSumTimeMs: 0, coopBestTimeMs: null,
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
      d.coopWon++; d.coopSumTimeMs += timeMs || 0;
      if (perfect && (d.coopBestTimeMs == null || timeMs < d.coopBestTimeMs)) { d.coopBestTimeMs = timeMs; newHighscore = true; }
    } else {
      s.won++; s.currentStreak++; s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      s.totalTimeMs += timeMs || 0;
      d.won++; d.sumTimeMs += timeMs || 0;
      if (perfect && (d.bestTimeMs == null || timeMs < d.bestTimeMs)) { d.bestTimeMs = timeMs; newHighscore = true; }
    }
  } else {
    if (coop) s.coopCurrentStreak = 0; else s.currentStreak = 0;
    if (outcome === 'gaveup') { if (coop) { d.coopGaveup++; s.coopGaveup++; } else { d.gaveup++; s.gaveup++; } }
    else { if (coop) { d.coopLost++; s.coopLost++; } else { d.lost++; s.lost++; } }
  }
  saveStats(s);
  return { stats: s, newHighscore };
}

// ─── "Was ist neu"-Tracking ───────────────────────────────────────────────────
export function loadSeenVersion() { return load(KEYS.SEEN_VERSION, null); }
export function saveSeenVersion(v) { save(KEYS.SEEN_VERSION, v); }

// ─── Tagesrätsel-Streak ────────────────────────────────────────────────────────
const EMPTY_DAILY = { lastCompletedDate: null, currentStreak: 0, bestStreak: 0, totalCompleted: 0 };
export function loadDaily() { return { ...EMPTY_DAILY, ...load(KEYS.DAILY, {}) }; }
export function saveDaily(d) { save(KEYS.DAILY, d); }

function isNextCalendarDay(prevDateStr, dateStr) {
  if (!prevDateStr) return false;
  const prev = new Date(`${prevDateStr}T00:00:00`);
  const cur = new Date(`${dateStr}T00:00:00`);
  return Math.round((cur - prev) / 86400000) === 1;
}

// Wird nur bei einem GEWONNENEN Tagesrätsel aufgerufen. Idempotent: ein
// erneutes Lösen desselben Tages (z.B. nach Neuladen der Seite) zählt den
// Streak nicht doppelt.
export function recordDailyResult(dateStr) {
  const d = loadDaily();
  if (d.lastCompletedDate === dateStr) return d;
  d.currentStreak = isNextCalendarDay(d.lastCompletedDate, dateStr) ? d.currentStreak + 1 : 1;
  d.bestStreak = Math.max(d.bestStreak, d.currentStreak);
  d.lastCompletedDate = dateStr;
  d.totalCompleted++;
  saveDaily(d);
  return d;
}

// ─── Rollende Backups (3 Slots) ───────────────────────────────────────────────
let _lastBackupTs = 0;
export function createBackup(label = 'auto') {
  const now = Date.now();
  if (now - _lastBackupTs < 3000) return;
  _lastBackupTs = now;
  try {
    const slot = (parseInt(localStorage.getItem(KEYS.BACKUP_SLOT) || '0')) % BACKUP_COUNT;
    const snapshot = {
      ts: now, label, v: 1,
      settings: load(KEYS.SETTINGS, {}),
      activeGame: load(KEYS.ACTIVE_GAME, null),
      stats: load(KEYS.STATS, {}),
      daily: load(KEYS.DAILY, {}),
    };
    localStorage.setItem(bk(slot), JSON.stringify(snapshot));
    localStorage.setItem(KEYS.BACKUP_SLOT, String((slot + 1) % BACKUP_COUNT));
  } catch (e) { log('storage', 'Backup erstellen fehlgeschlagen', e); }
}
export function loadBackups() {
  const nextSlot = parseInt(localStorage.getItem(KEYS.BACKUP_SLOT) || '0');
  const result = [];
  for (let i = 0; i < BACKUP_COUNT; i++) {
    const idx = (nextSlot - 1 - i + BACKUP_COUNT) % BACKUP_COUNT;
    const raw = localStorage.getItem(bk(idx));
    if (!raw) continue;
    try { result.push({ slot: idx, ...JSON.parse(raw) }); }
    catch (e) { log('storage', `Backup-Slot ${idx} laden fehlgeschlagen`, e); }
  }
  return result;
}
export function restoreBackup(slotIdx) {
  const raw = localStorage.getItem(bk(slotIdx));
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.settings) save(KEYS.SETTINGS, data.settings);
    if (data.stats) save(KEYS.STATS, data.stats);
    if (data.daily) save(KEYS.DAILY, data.daily);
    if (data.activeGame !== undefined) saveActiveGame(data.activeGame);
    return true;
  } catch (e) { log('storage', `Backup-Slot ${slotIdx} wiederherstellen fehlgeschlagen`, e); return false; }
}

// ─── Datei-Export / Import ────────────────────────────────────────────────────
function buildTimestamp() {
  const d = new Date(); const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
export async function exportToFile(type = 'manual') {
  const filename = `${type}-coop-number-sums-${buildTimestamp()}.json`;
  const payload = JSON.stringify({
    ts: Date.now(), v: 1, label: type,
    settings: load(KEYS.SETTINGS, {}),
    activeGame: load(KEYS.ACTIVE_GAME, null),
    stats: load(KEYS.STATS, {}),
    daily: load(KEYS.DAILY, {}),
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Coop Number Sums Backup' });
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
  if (data.activeGame !== undefined) saveActiveGame(data.activeGame);
  return data;
}

// ─── Alle lokalen Daten löschen ───────────────────────────────────────────────
export function deleteAllData() {
  remove(KEYS.SETTINGS);
  remove(KEYS.ACTIVE_GAME);
  remove(KEYS.STATS);
  remove(KEYS.SEEN_VERSION);
  remove(KEYS.BACKUP_SLOT);
  remove(KEYS.DAILY);
  for (let i = 0; i < BACKUP_COUNT; i++) remove(bk(i));
  clearLog();
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
