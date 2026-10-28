// games/gems/model.js — die Spielregeln von „Gem Hunt" (im Original „Star
// Battle"/„Two Not Touch", bekannt als „Queens" von LinkedIn).
//
// Ein n×n-Feld ist in n farbige Käfige geteilt. In jeder ZEILE, jeder SPALTE und
// jedem KÄFIG liegt genau EIN Edelstein, und zwei Edelsteine berühren sich nie —
// auch nicht über Eck.
//
// Rein und unit-getestet. Zellen werden als Index `i = r * n + c` geführt.
//
// Rätsel: { rows: n, cols: n, regions: [käfig je Zelle, 0..n-1], solution: [zelle je Zeile] }
// Stand:  cells = [0 leer | 1 Kreuz (Notiz) | 2 Edelstein] je Zelle.

export const EMPTY = 0, CROSS = 1, GEM = 2;

export const rcOf = (n, i) => [Math.floor(i / n), i % n];

/** Die 8 Nachbarn einer Zelle (innerhalb des Feldes). */
export function neighbors8(n, i) {
  const [r, c] = rcOf(n, i);
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
  }
  return out;
}

/** Stehen zwei Edelsteine in Konflikt (Zeile, Spalte, Käfig oder Berührung)? */
export function clash(p, a, b) {
  const n = p.rows;
  if (a === b) return false;
  const [ra, ca] = rcOf(n, a), [rb, cb] = rcOf(n, b);
  return ra === rb || ca === cb || p.regions[a] === p.regions[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
}

export function gemsOf(cells) {
  const out = [];
  (cells || []).forEach((v, i) => { if (v === GEM) out.push(i); });
  return out;
}

/** Alle Edelsteine, die mit einem anderen in Konflikt stehen (für die rote Markierung). */
export function conflicts(p, cells) {
  const gems = gemsOf(cells);
  const bad = new Set();
  for (let x = 0; x < gems.length; x++) for (let y = x + 1; y < gems.length; y++) {
    if (clash(p, gems[x], gems[y])) { bad.add(gems[x]); bad.add(gems[y]); }
  }
  return bad;
}

/** Brett voll = so viele Edelsteine wie Zeilen. Erst dann zählt ein Fehler. */
export function isFull(p, cells) { return gemsOf(cells).length >= p.rows; }

/** Gelöst = genau n Edelsteine, keiner in Konflikt (⇒ je Zeile/Spalte/Käfig einer). */
export function isSolved(p, cells) {
  if (!p || !Array.isArray(cells)) return false;
  const gems = gemsOf(cells);
  return gems.length === p.rows && conflicts(p, cells).size === 0;
}

/** Fortschritt = gesetzte Edelsteine (gedeckelt). */
export function progressPct(p, cells) {
  const n = p && p.rows;
  if (!n) return 0;
  return Math.round((Math.min(n, gemsOf(cells).length) / n) * 100);
}

/** Struktur-Prüfung eines empfangenen Rätsels (Blackscreen-Schutz der Schale). */
export function validPuzzleShape(p) {
  if (!p || !Number.isInteger(p.rows) || p.rows < 4 || p.rows > 16 || p.cols !== p.rows) return false;
  const n = p.rows;
  if (!Array.isArray(p.regions) || p.regions.length !== n * n) return false;
  if (!p.regions.every((v) => Number.isInteger(v) && v >= 0 && v < n)) return false;
  if (!Array.isArray(p.solution) || p.solution.length !== n) return false;
  return p.solution.every((v) => Number.isInteger(v) && v >= 0 && v < n * n);
}

// Über die RTDB gereiste Arrays kommen als Objekt mit numerischen Schlüsseln zurück.
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
export function normalizePuzzle(p) {
  if (!p) return p;
  const regions = arr(p.regions), solution = arr(p.solution);
  if (regions === p.regions && solution === p.solution) return p;
  return { ...p, regions, solution };
}
/** Ein Brett-Stand (auch löchrig aus der RTDB) auf genau n·n Felder bringen. */
export function normalizeCells(v, n) {
  if (Array.isArray(v) && v.length === n * n && v.every((x) => x === 0 || x === 1 || x === 2)) return v;
  const out = new Array(n * n).fill(EMPTY);
  // Ein Objekt aus der RTDB behält die Feldnummer als SCHLÜSSEL (Lücken möglich).
  const src = v && typeof v === 'object' ? v : {};
  for (const k of Object.keys(src)) {
    const i = Number(k), x = Number(src[k]);
    if (Number.isInteger(i) && i >= 0 && i < n * n && (x === CROSS || x === GEM)) out[i] = x;
  }
  return out;
}
