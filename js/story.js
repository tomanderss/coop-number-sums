// js/story.js — der STORY-MODUS (reine Logik, unit-getestet).
//
// Je Spiel (und für den Mix) 500 FESTE Level, für ALLE Nutzer identisch: „Ich
// komme bei Level 34 nicht weiter" meint bei jedem dasselbe Rätsel (Nutzer-
// wunsch, Community-Charakter). Die Rätsel werden deshalb NICHT auf dem Gerät
// erzeugt (jede Änderung am Generator würde die Level verändern), sondern
// einmal vorab (scripts/gen-story.mjs) und als Daten ausgeliefert:
//   data/story/<schlüssel>/<paket>.json = { v, key, from, to, levels: [{ level, game, difficulty, puzzle }] }
// in Paketen zu STORY_CHUNK Leveln, geladen nur bei Bedarf. Diese Dateien werden
// NIE umgeschrieben — neue Level kommen nur hinten dazu.
//
// Kurve (Nutzerwunsch): schnell aus dem ganz Leichten heraus (Mittel ab ~Level
// 11, spätestens 25), dann ein langer, ganz langsam steigender Mittelteil, die
// schwerste Stufe erst ab Level 251. Innerhalb einer Stufe sind die Level nach
// der Härte des Lösungswegs sortiert (storyScore) — es wird stetig schwerer.

export const STORY_LEVELS = 500;
export const STORY_CHUNK = 50;
export const MIX_KEY = 'mix';

// [bis-Level] je Stufe der Leiter (Index 0 = leichteste). Das letzte Band läuft bis STORY_LEVELS.
export const STORY_BANDS = [4, 10, 25, 70, 120, 170, 210, 250, STORY_LEVELS];

/** Stufen-Index (0..8) für ein Level. */
export function storyBandIndex(level) {
  const L = Math.max(1, Math.min(STORY_LEVELS, Math.floor(level) || 1));
  return STORY_BANDS.findIndex((to) => L <= to);
}
/** Erstes und letztes Level eines Bandes. */
export function storyBandRange(i) {
  return { from: i === 0 ? 1 : STORY_BANDS[i - 1] + 1, to: STORY_BANDS[i] };
}
/** Stufen-ID eines Levels für eine Leiter (Liste der Stufen-IDs des Spiels). */
export function storyDifficulty(level, ladderIds) {
  const i = storyBandIndex(level);
  return ladderIds[Math.min(i, ladderIds.length - 1)];
}

/** Paket-Nummer (0-basiert) und Dateipfad eines Levels. */
export const storyChunkOf = (level) => Math.floor((Math.max(1, level) - 1) / STORY_CHUNK);
export const storyChunkPath = (key, chunk) => `data/story/${key}/${String(chunk).padStart(2, '0')}.json`;

/**
 * Härte eines Lösungswegs (nur zum SORTIEREN innerhalb einer Stufe): schwerere
 * Schlussarten zählen mehr. Jedes Spiel liefert andere Kennzahlen.
 */
export function storyScore(game, p) {
  if (!p) return 0;
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const t = p.tiers || p.tierCounts;
  if (t) return n(t.t2) + 2 * n(t.t25) + 4 * n(t.t3) + 0.01 * n(t.t1);
  const cells = n(p.rows) * n(p.cols);
  switch (game) {
    case 'rectangles': return n(p.tier2) + 5 * n(p.tier3) + 0.3 * (p.clues || []).filter((k) => k.hide).length;
    case 'gems': return 4 * n(p.tier2) + n(p.blocks);
    case 'numberlink': return n(p.tier2) + (p.ends ? cells / (p.ends.length / 2) : 0);
    case 'numberpath': return n(p.tier2) + (p.clues ? cells / p.clues.length / 4 : 0);
    default: return n(p.tier2) + 5 * n(p.tier3);
  }
}

/** Für die Daten unnötige, je Lauf wechselnde Felder. */
const VOLATILE = ['genMs', 'genTries', 'attempts'];
export function cleanPuzzle(p) {
  const out = { ...p };
  for (const k of VOLATILE) delete out[k];
  return out;
}

// ── Sterne ───────────────────────────────────────────────────────────────────
// Nutzerwunsch: Fehler kosten Sterne. Die Zeit zählt nur in Spielen OHNE Leben
// (dort gibt es keine Fehler) — mit einer groben Skala nach Brettgröße.
//   mit Leben:  0 Fehler/Tipps = 3★, 1 = 2★, mehr = 1★ (gelöst ist immer ≥ 1★)
//   ohne Leben: bis Richtzeit 3★, bis doppelte Richtzeit 2★, sonst 1★
export const PAR_MS_PER_CELL = 2500;
export function storyParMs(cells, bandIndex = 4) {
  // Schwerere Stufen bekommen mehr Zeit je Zelle (Faktor 1 … 3).
  return Math.round(Math.max(1, cells) * PAR_MS_PER_CELL * (1 + bandIndex / 4));
}
export function storyStars({ lives = true, mistakes = 0, hints = 0, elapsedMs = 0, cells = 0, bandIndex = 0 } = {}) {
  if (lives) {
    const slips = Math.max(0, mistakes) + Math.max(0, hints);
    return slips === 0 ? 3 : slips === 1 ? 2 : 1;
  }
  const par = storyParMs(cells, bandIndex);
  return elapsedMs <= par ? 3 : elapsedMs <= par * 2 ? 2 : 1;
}

// ── Fortschritt ──────────────────────────────────────────────────────────────
// progress = { [schlüssel]: { [level]: { s: Sterne 1–3, t: beste Zeit ms } } }
// Konto-weit (ein Fortschritt für alle Geräte), gemergt per Bestwert.
export function storyEntry(progress, key, level) {
  const g = progress && progress[key];
  return (g && g[level]) || null;
}
/** Höchstes geschafftes Level + 1 (= das nächste spielbare). */
export function storyNext(progress, key) {
  const g = (progress && progress[key]) || {};
  let n = 1;
  while (g[n] && n < STORY_LEVELS) n++;
  return g[n] ? STORY_LEVELS : n;
}
export const storyUnlocked = (progress, key, level) => level >= 1 && level <= storyNext(progress, key);
export function storyStarsTotal(progress, key) {
  const g = (progress && progress[key]) || {};
  return Object.values(g).reduce((a, e) => a + (e && e.s ? e.s : 0), 0);
}
/** Ergebnis eintragen (bessere Sterne / schnellere Zeit gewinnen). Rein: liefert ein neues Objekt. */
export function recordStoryResult(progress, key, level, { stars, ms }) {
  const out = { ...(progress || {}) };
  const g = { ...(out[key] || {}) };
  const old = g[level];
  g[level] = {
    s: Math.max(old ? old.s || 0 : 0, Math.max(1, Math.min(3, stars | 0))),
    t: old && old.t ? Math.min(old.t, ms) : ms,
  };
  out[key] = g;
  return out;
}
/** Zwei Stände zusammenführen (Geräte-Abgleich): je Level die besseren Werte. */
export function mergeStory(a, b) {
  const out = {};
  for (const src of [a || {}, b || {}]) {
    for (const [key, levels] of Object.entries(src)) {
      if (!levels || typeof levels !== 'object') continue;
      const g = (out[key] ||= {});
      for (const [lv, e] of Object.entries(levels)) {
        if (!e || !e.s) continue;
        const cur = g[lv];
        g[lv] = cur
          ? { s: Math.max(cur.s, e.s), t: Math.min(cur.t || Infinity, e.t || Infinity) }
          : { s: e.s, t: e.t };
        if (!Number.isFinite(g[lv].t)) g[lv].t = 0;
      }
    }
  }
  return out;
}

// ── Mix-Story ────────────────────────────────────────────────────────────────
/**
 * Welches Spiel trägt Mix-Level L? Feste Folge (für alle gleich): je Runde
 * jedes Spiel einmal in gemischter Reihenfolge, nie zweimal hintereinander.
 */
export function mixStoryGames(gameIds, n = STORY_LEVELS, seed = 0x5713) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [];
  while (out.length < n) {
    const round = gameIds.slice();
    for (let i = round.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [round[i], round[j]] = [round[j], round[i]]; }
    if (out.length && round[0] === out[out.length - 1]) round.push(round.shift());
    out.push(...round);
  }
  return out.slice(0, n);
}

// ── Laden (nur im Browser) ───────────────────────────────────────────────────
const chunkCache = new Map();
/** Ein Paket laden (je Sitzung einmal; der Service Worker hält es offline vor). */
export function loadStoryChunk(key, chunk) {
  const id = `${key}/${chunk}`;
  if (!chunkCache.has(id)) {
    const url = new URL(`../${storyChunkPath(key, chunk)}`, import.meta.url).href;
    const pr = fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
    pr.catch(() => chunkCache.delete(id));   // Fehlschlag nicht merken
    chunkCache.set(id, pr);
  }
  return chunkCache.get(id);
}
/** Ein Level: { level, game, difficulty, puzzle }. */
export async function loadStoryLevel(key, level) {
  const file = await loadStoryChunk(key, storyChunkOf(level));
  const e = file.levels.find((x) => x && x.level === level);
  if (!e) throw new Error(`Story ${key} Level ${level} fehlt`);
  return e;
}

// ── Bestenliste je Level ─────────────────────────────────────────────────────
// Firebase: storyboard/{schlüssel}/{level}/{uid} = { username, stars, timeMs, badge, ts }.
// Nur allein gelöste Level (mit Hilfe zählt nicht). Rang: mehr Sterne vor
// schnellerer Zeit — 3★ in 5 min schlägt 2★ in 1 min.
const validMs = (v) => Number.isFinite(v) && v > 0;
/** Ist Ergebnis a besser als b? (b fehlt = a ist besser) */
export function storyBoardBetter(a, b) {
  if (!a || !(a.stars > 0) || !validMs(a.timeMs)) return false;
  if (!b || !(b.stars > 0) || !validMs(b.timeMs)) return true;
  if (a.stars !== b.stars) return a.stars > b.stars;
  return a.timeMs < b.timeMs;
}
export function sortStoryBoard(entries) {
  return [...(entries || [])]
    .filter((e) => e && e.stars > 0 && validMs(e.timeMs))
    .sort((a, b) => (b.stars - a.stars) || (a.timeMs - b.timeMs) || String(a.username || '').localeCompare(String(b.username || '')));
}
/** Anzeige: die ersten `top` Plätze + der eigene Platz, falls weiter hinten. */
export function storyBoardView(entries, uid, top = 3) {
  const sorted = sortStoryBoard(entries).map((e, i) => ({ ...e, rank: i + 1, me: !!uid && e.uid === uid }));
  const rows = sorted.slice(0, top);
  const mine = sorted.find((e) => e.me) || null;
  return { rows, mine: mine && mine.rank > top ? mine : null, total: sorted.length };
}
