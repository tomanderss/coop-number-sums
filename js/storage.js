// storage.js — Persistenz via localStorage (Einstellungen, laufendes Spiel,
// Statistik, rollende Backups, Datei-Export/Import). Struktur analog werwolf-app.

import { DEFAULT_SETTINGS } from './config.js';

const KEYS = {
  SETTINGS: 'cns_settings',
  ACTIVE_GAME: 'cns_active_game',
  STATS: 'cns_stats',
  BACKUP_SLOT: 'cns_bk_slot',
  SEEN_VERSION: 'cns_seen_version',
};
const BACKUP_COUNT = 3;
const bk = (i) => `cns_bk_${i}`;

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function remove(key) { try { localStorage.removeItem(key); } catch {} }

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
  // id -> { played, won, lost, gaveup, sumTimeMs, bestTimeMs,
  //         coopPlayed, coopWon, coopLost, coopGaveup, coopSumTimeMs, coopBestTimeMs }
  // Die coop*-Felder zählen ausschließlich Coop-Partien getrennt von den
  // ursprünglichen (Solo-)Feldern, damit eine schnellere Coop-Zeit nie die
  // Solo-Bestzeit/den Solo-Schnitt verfälscht.
  byDifficulty: {},
};
export function loadStats() { return { ...EMPTY_STATS, ...load(KEYS.STATS, {}) }; }
export function saveStats(s) { save(KEYS.STATS, s); }

// outcome: 'won' | 'lost' (alle Leben verloren) | 'gaveup' (Aufgeben-Button)
// Highscore (bestTimeMs je Schwierigkeit) gilt NUR für perfekte Spiele: keine
// Fehler und keine Hinweise — sonst wäre die Bestzeit nicht vergleichbar.
// coop: true, wenn die Partie in einer aktiven Coop-Session gespielt wurde —
// fließt dann in die coop*-Felder statt die Solo-Felder ein.
export function recordResult({ difficulty, outcome, timeMs, hintsUsed, mistakes, coop = false }) {
  const s = loadStats();
  s.played++;
  s.hintsUsed += hintsUsed || 0;
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
    s.won++; s.currentStreak++; s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    s.totalTimeMs += timeMs || 0;
    const perfect = (mistakes || 0) === 0 && (hintsUsed || 0) === 0;
    if (coop) {
      d.coopWon++; d.coopSumTimeMs += timeMs || 0;
      if (perfect && (d.coopBestTimeMs == null || timeMs < d.coopBestTimeMs)) { d.coopBestTimeMs = timeMs; newHighscore = true; }
    } else {
      d.won++; d.sumTimeMs += timeMs || 0;
      if (perfect && (d.bestTimeMs == null || timeMs < d.bestTimeMs)) { d.bestTimeMs = timeMs; newHighscore = true; }
    }
  } else {
    s.currentStreak = 0;
    if (outcome === 'gaveup') { if (coop) d.coopGaveup++; else d.gaveup++; s.gaveup++; }
    else { if (coop) d.coopLost++; else d.lost++; s.lost++; }
  }
  saveStats(s);
  return { stats: s, newHighscore };
}

// ─── "Was ist neu"-Tracking ───────────────────────────────────────────────────
export function loadSeenVersion() { return load(KEYS.SEEN_VERSION, null); }
export function saveSeenVersion(v) { save(KEYS.SEEN_VERSION, v); }

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
    };
    localStorage.setItem(bk(slot), JSON.stringify(snapshot));
    localStorage.setItem(KEYS.BACKUP_SLOT, String((slot + 1) % BACKUP_COUNT));
  } catch {}
}
export function loadBackups() {
  const nextSlot = parseInt(localStorage.getItem(KEYS.BACKUP_SLOT) || '0');
  const result = [];
  for (let i = 0; i < BACKUP_COUNT; i++) {
    const idx = (nextSlot - 1 - i + BACKUP_COUNT) % BACKUP_COUNT;
    const raw = localStorage.getItem(bk(idx));
    if (!raw) continue;
    try { result.push({ slot: idx, ...JSON.parse(raw) }); } catch {}
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
    if (data.activeGame !== undefined) saveActiveGame(data.activeGame);
    return true;
  } catch { return false; }
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
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Coop Number Sums Backup' });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
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
  if (data.activeGame !== undefined) saveActiveGame(data.activeGame);
  return data;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
