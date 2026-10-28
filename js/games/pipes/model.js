// games/pipes/model.js — die REGELN von „Pipes" (rein, unit-getestet).
//
// Jede Zelle trägt ein Rohrstück: seine Öffnungen sind eine Bitmaske
// N=1, E=2, S=4, W=8. Gerade (N|S), Bogen (N|E), T-Stück (N|E|S) und Endstück
// (eine Öffnung). Der Spieler dreht Stücke in 90°-Schritten; `rot[i]` zählt die
// Drehungen im Uhrzeigersinn (fortlaufend — nur `mod 4` zählt für die Regeln,
// die volle Zahl lässt die Animation immer vorwärts drehen).
//
// Gelöst ist das Brett, wenn KEINE Öffnung ins Leere oder an eine geschlossene
// Seite zeigt und das Wasser von der Quelle JEDE Zelle erreicht. Weil die Zahl
// der Öffnungen fest ist (Baum: 2·(n−1)), ist ein solches Netz automatisch
// kreisfrei — es braucht keinen Abgleich mit einer gespeicherten Lösung.

export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [N, E, S, W];
export const DR = [-1, 0, 1, 0];
export const DC = [0, 1, 0, -1];
export const opp = (d) => (d + 2) % 4;
export const mod4 = (x) => (((Number(x) || 0) % 4) + 4) % 4;

/** Maske um k Viertel im Uhrzeigersinn drehen. */
export function rotMask(m, k) {
  const q = mod4(k);
  let out = 0;
  for (let d = 0; d < 4; d++) if (m & (1 << d)) out |= 1 << ((d + q) % 4);
  return out;
}
export const degree = (m) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1));
export const has = (m, d) => !!(m & (1 << d));
/** Die verschiedenen Lagen eines Stücks: [{ k, m }] (eine Gerade hat nur zwei). */
export function orientations(m) {
  const out = [];
  for (let k = 0; k < 4; k++) { const r = rotMask(m, k); if (!out.some((o) => o.m === r)) out.push({ k, m: r }); }
  return out;
}
export function neighbor(p, i, d) {
  const r = Math.floor(i / p.cols) + DR[d], c = (i % p.cols) + DC[d];
  return r < 0 || c < 0 || r >= p.rows || c >= p.cols ? -1 : r * p.cols + c;
}
export const maskAt = (p, rot, i) => rotMask(p.tiles[i], rot[i]);

/**
 * Wasserlauf: von der Quelle über BEIDSEITIG offene Verbindungen.
 * `reached` = erreichte Zellen, `depth[i]` = Schritte ab Quelle (für die
 * Fluss-Animation), `from[i]` = Richtung, aus der das Wasser kommt (-1 Quelle),
 * `leaks` = Zellen mit einer Öffnung, die nirgends anschließt.
 */
export function flow(p, rot) {
  const n = p.rows * p.cols;
  const depth = new Array(n).fill(-1), from = new Array(n).fill(-1);
  const masks = p.tiles.map((_, i) => maskAt(p, rot, i));
  const q = [p.source];
  depth[p.source] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (let d = 0; d < 4; d++) {
      if (!has(masks[i], d)) continue;
      const j = neighbor(p, i, d);
      if (j < 0 || depth[j] >= 0 || !has(masks[j], opp(d))) continue;
      depth[j] = depth[i] + 1; from[j] = opp(d); q.push(j);
    }
  }
  const leaks = new Set();
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < 4; d++) {
      if (!has(masks[i], d)) continue;
      const j = neighbor(p, i, d);
      if (j < 0 || !has(masks[j], opp(d))) { leaks.add(i); break; }
    }
  }
  return { reached: q.length, cells: q, depth, from, leaks, masks };
}

export function isSolved(p, rot) {
  const f = flow(p, rot);
  return f.leaks.size === 0 && f.reached === p.rows * p.cols;
}
/** Fortschritt = versorgte Zellen; 100 nur, wenn wirklich gelöst. */
export function progressPct(p, rot) {
  const f = flow(p, rot);
  const n = p.rows * p.cols;
  if (f.leaks.size === 0 && f.reached === n) return 100;
  return Math.min(99, Math.round((f.reached / n) * 100));
}

// ── Form & Heilung (RTDB: Arrays als Objekte, leere fehlen) ──
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
export function normalizePuzzle(p) {
  if (!p || typeof p !== 'object') return p;
  const tiles = arr(p.tiles).map(Number), sol = arr(p.solRot).map(Number);
  if (Array.isArray(p.tiles) && Array.isArray(p.solRot) && tiles.every((x, i) => x === p.tiles[i])) return p;
  return { ...p, tiles, solRot: sol };
}
export function normalizeRot(v, n) {
  const a = arr(v);
  if (Array.isArray(v) && v.length === n && v.every((x) => Number.isInteger(x))) return v;
  const out = new Array(n).fill(0);
  if (v && typeof v === 'object') for (const k of Object.keys(v)) { const i = Number(k); if (i >= 0 && i < n) out[i] = Number(v[k]) || 0; }
  else a.forEach((x, i) => { if (i < n) out[i] = Number(x) || 0; });
  return out;
}
export function validPuzzleShape(p) {
  if (!p || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || p.rows < 2 || p.cols < 2 || p.rows > 16 || p.cols > 16) return false;
  const n = p.rows * p.cols;
  if (!Array.isArray(p.tiles) || p.tiles.length !== n) return false;
  if (!p.tiles.every((m) => Number.isInteger(m) && m > 0 && m < 16)) return false;
  return Number.isInteger(p.source) && p.source >= 0 && p.source < n;
}
