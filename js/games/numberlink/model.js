// games/numberlink/model.js — die Spielregeln von „Number Link" (Prinzip wie
// „Flow"/Numberlink, Nikoli).
//
// Auf dem Brett steht jede Zahl genau ZWEIMAL, jede in ihrer eigenen Farbe.
// Gleiche Zahlen werden mit EINER Linie verbunden (waagerecht/senkrecht, Zelle
// für Zelle). Linien kreuzen sich nie und teilen keine Zelle; am Ende ist JEDE
// Zelle bedeckt.
//
// Rein und unit-getestet. Zellen werden als Index `id = r * cols + c` geführt.
//
// Rätsel: { rows, cols, ends: [{ r, c, k }] (k = 1..K, je k genau zwei),
//           solution: [k je Zelle], walls?: [{ r, c, d }] (obere Stufen:
//           Wände auf Zellgrenzen, durch die keine Linie führt) }
// Stand:  links = [Pfad je Zahl] — links[k-1] = [id, …], beginnt an einem der
//         beiden Enden der Zahl k (leer = noch nicht gezogen).

export const idOf = (p, r, c) => r * p.cols + c;
export const rcOf = (p, id) => [Math.floor(id / p.cols), id % p.cols];

/** Anzahl der Paare. */
export const pairCount = (p) => p.ends.reduce((m, e) => Math.max(m, e.k), 0);

/** Zahl je Endzelle (Map id → k). */
export function endMap(p) {
  const m = new Map();
  for (const e of p.ends) m.set(idOf(p, e.r, e.c), e.k);
  return m;
}

/** Die beiden Endzellen je Zahl: ends[k] = [a, b]. */
export function endsOf(p) {
  const out = [];
  for (const e of p.ends) (out[e.k] ||= []).push(idOf(p, e.r, e.c));
  return out;
}

export function neighbors(p, id) {
  const r = Math.floor(id / p.cols), c = id % p.cols, out = [];
  if (r > 0) out.push(id - p.cols);
  if (r < p.rows - 1) out.push(id + p.cols);
  if (c > 0) out.push(id - 1);
  if (c < p.cols - 1) out.push(id + 1);
  return out;
}
/** Wände ({ r, c, d: 'r' = rechts der Zelle, 'd' = darunter }) als Menge „kleiner-größer“. */
export const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function wallSet(p) {
  const s = new Set();
  for (const w of (p && p.walls) || []) {
    const a = w.r * p.cols + w.c;
    s.add(edgeKey(a, w.d === 'r' ? a + 1 : a + p.cols));
  }
  return s;
}
export const adjacent = (p, a, b) => {
  const d = Math.abs(a - b);
  return (d === p.cols) || (d === 1 && Math.floor(a / p.cols) === Math.floor(b / p.cols));
};

/** Zell-Belegung aller Linien: owner[id] = k (0 = frei). Bei Überschneidung gewinnt die zuerst gefundene. */
export function ownerGrid(p, links) {
  const N = p.rows * p.cols, own = new Int16Array(N);
  (links || []).forEach((path, i) => { for (const id of path || []) if (id >= 0 && id < N && !own[id]) own[id] = i + 1; });
  return own;
}

/**
 * Ist `path` eine gültige (auch unfertige) Linie der Zahl k? Beginnt auf einem
 * Ende von k, Schritt für Schritt benachbart, keine Zelle doppelt, kein fremdes
 * Ende, und nach dem Erreichen des zweiten Endes geht es nicht weiter.
 */
export function validPath(p, k, path, ctx = null) {
  if (!Array.isArray(path) || !path.length) return true;
  const ends = ctx ? ctx.ends : endMap(p);
  const walls = ctx && ctx.walls ? ctx.walls : wallSet(p);
  const N = p.rows * p.cols;
  if (ends.get(path[0]) !== k) return false;
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const id = path[i];
    if (!Number.isInteger(id) || id < 0 || id >= N || seen.has(id)) return false;
    seen.add(id);
    if (i > 0 && (!adjacent(p, path[i - 1], id) || walls.has(edgeKey(path[i - 1], id)))) return false;
    const e = ends.get(id);
    if (i > 0 && e != null) {
      if (e !== k) return false;
      if (i !== path.length - 1) return false;          // das zweite Ende beendet die Linie
    }
  }
  return true;
}

/** Linie verbindet beide Enden ihrer Zahl. */
export function pathComplete(p, k, path, ctx = null) {
  if (!Array.isArray(path) || path.length < 2) return false;
  const ends = ctx ? ctx.ends : endMap(p);
  return ends.get(path[0]) === k && ends.get(path[path.length - 1]) === k && path[0] !== path[path.length - 1];
}

/** Gelöst = jede Linie gültig und fertig, keine Zelle doppelt, jede Zelle bedeckt. */
export function isSolved(p, links) {
  if (!p || !Array.isArray(links)) return false;
  const K = pairCount(p), N = p.rows * p.cols;
  const ctx = { ends: endMap(p), walls: wallSet(p) };
  const used = new Uint8Array(N);
  let count = 0;
  for (let k = 1; k <= K; k++) {
    const path = links[k - 1];
    if (!validPath(p, k, path, ctx) || !pathComplete(p, k, path, ctx)) return false;
    for (const id of path) { if (used[id]) return false; used[id] = 1; count++; }
  }
  return count === N;
}

/** Wie viele Paare sind verbunden? */
export function connectedCount(p, links) {
  const K = pairCount(p), ctx = { ends: endMap(p) };
  let n = 0;
  for (let k = 1; k <= K; k++) if (pathComplete(p, k, (links || [])[k - 1], ctx)) n++;
  return n;
}

/** Fortschritt = bedeckte Zellen. */
export function progressPct(p, links) {
  const N = p.rows * p.cols;
  if (!N) return 0;
  let n = 0;
  for (const path of links || []) n += (path || []).length;
  return Math.min(100, Math.round((n / N) * 100));
}

/**
 * Eine empfangene/gespeicherte Belegung bereinigen: jede Linie endet an der
 * ersten ungültigen Stelle, Zellen, die schon eine andere Linie belegt, kappen
 * die spätere Linie dort.
 */
export function sanitizeLinks(p, links) {
  const K = pairCount(p), N = p.rows * p.cols;
  const ctx = { ends: endMap(p), walls: wallSet(p) };
  const out = [], used = new Uint8Array(N);
  for (let k = 1; k <= K; k++) {
    const src = Array.isArray(links && links[k - 1]) ? links[k - 1] : [];
    const path = [];
    for (const id of src) {
      const next = [...path, id];
      if (used[id] || !validPath(p, k, next, ctx)) break;
      path.push(id);
    }
    for (const id of path) used[id] = 1;
    out.push(path);
  }
  return out;
}

/** Struktur-Prüfung eines empfangenen Rätsels (Blackscreen-Schutz der Schale). */
export function validPuzzleShape(p) {
  if (!p || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || p.rows < 2 || p.cols < 2 || p.rows > 20 || p.cols > 20) return false;
  if (!Array.isArray(p.ends) || p.ends.length < 2 || p.ends.length % 2) return false;
  const count = {};
  for (const e of p.ends) {
    if (!e || !Number.isInteger(e.r) || !Number.isInteger(e.c) || !Number.isInteger(e.k) || e.k < 1 || e.r < 0 || e.c < 0 || e.r >= p.rows || e.c >= p.cols) return false;
    count[e.k] = (count[e.k] || 0) + 1;
  }
  const K = p.ends.length / 2;
  for (let k = 1; k <= K; k++) if (count[k] !== 2) return false;
  if (p.walls != null && !Array.isArray(p.walls)) return false;
  for (const w of p.walls || []) if (!w || !Number.isInteger(w.r) || !Number.isInteger(w.c) || (w.d !== 'r' && w.d !== 'd')) return false;
  return Array.isArray(p.solution) && p.solution.length === p.rows * p.cols;
}

// Über die RTDB gereiste Arrays kommen als Objekt mit numerischen Schlüsseln
// zurück; leere Arrays fehlen ganz.
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
export function normalizePuzzle(p) {
  if (!p) return p;
  const ends = arr(p.ends), solution = arr(p.solution), walls = arr(p.walls);
  if (ends === p.ends && solution === p.solution && (walls === p.walls || (!p.walls && !walls.length))) return p;
  return { ...p, ends, solution, walls };
}
/** Linien heilen: fehlende/leere Linien werden zu [], Objekte zu Arrays. */
export function normalizeLinks(v, K) {
  const src = v == null ? [] : Array.isArray(v) ? v : (() => { const o = []; for (const key of Object.keys(v)) o[+key] = v[key]; return o; })();
  const out = [];
  let same = Array.isArray(v) && v.length === K;
  for (let i = 0; i < K; i++) {
    const raw = src[i];
    const path = Array.isArray(raw) && raw.every(Number.isInteger) ? raw : arr(raw).filter(Number.isInteger);
    if (path !== raw) same = false;
    out.push(path);
  }
  return same ? v : out;
}
