// games/numberpath/model.js — die Spielregeln von „Number Path" (Prinzip wie
// „Zip" von LinkedIn, verwandt mit Numbrix/Hidato).
//
// Eine durchgehende Linie läuft über JEDE Zelle genau einmal, nur waagerecht
// und senkrecht, ohne sich zu kreuzen. Sie beginnt auf der 1 und erreicht die
// Zahlen streng in Reihenfolge; die höchste Zahl ist ihr letztes Feld. Wände
// zwischen zwei Zellen darf sie nicht überqueren.
//
// Rein und unit-getestet. Zellen werden als Index `id = r * cols + c` geführt.
//
// Rätsel: { rows, cols, clues: [{ r, c, n }] (n = 1..K), walls: [{ r, c, d }]
//           (d = 'r': Wand rechts von (r,c); d = 'd': Wand unter (r,c)),
//           solution: [id, …] (der Pfad in Reihenfolge) }
// Stand:  path = [id, …] — die gezogene Linie ab der 1.

export const idOf = (p, r, c) => r * p.cols + c;
export const rcOf = (p, id) => [Math.floor(id / p.cols), id % p.cols];

/** Wände als Menge „kleinerer-größerer Index". */
export function wallSet(p) {
  const s = new Set();
  for (const w of p.walls || []) {
    const a = idOf(p, w.r, w.c);
    const b = w.d === 'r' ? a + 1 : a + p.cols;
    s.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  return s;
}
const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Zahl je Zelle (Map id → n). */
export function clueMap(p) {
  const m = new Map();
  for (const k of p.clues) m.set(idOf(p, k.r, k.c), k.n);
  return m;
}
export const lastClue = (p) => p.clues.reduce((m, k) => Math.max(m, k.n), 0);

/** Nachbarn einer Zelle, die keine Wand trennt. */
export function neighbors(p, id, walls = wallSet(p)) {
  const [r, c] = rcOf(p, id);
  const out = [];
  if (r > 0) out.push(id - p.cols);
  if (r < p.rows - 1) out.push(id + p.cols);
  if (c > 0) out.push(id - 1);
  if (c < p.cols - 1) out.push(id + 1);
  return out.filter((n) => !walls.has(edgeKey(id, n)));
}

/** Die zuletzt erreichte Zahl auf dem Pfad (0 = noch keine). */
export function reachedClue(p, path, clues = clueMap(p)) {
  let best = 0;
  for (const id of path) { const n = clues.get(id); if (n && n > best) best = n; }
  return best;
}

/**
 * Darf die Linie von ihrem Ende auf `next` weiter? Ja, wenn benachbart, keine
 * Wand dazwischen, noch nicht belegt, und eine Zahl dort genau die nächste ist.
 * Die letzte Zahl darf nur als ALLERLETZTES Feld betreten werden.
 * Ein leerer Pfad darf nur auf der 1 beginnen.
 */
export function canStep(p, path, next, ctx = null) {
  const N = p.rows * p.cols;
  if (!Number.isInteger(next) || next < 0 || next >= N) return false;
  const clues = ctx ? ctx.clues : clueMap(p);
  const walls = ctx ? ctx.walls : wallSet(p);
  if (!path.length) return clues.get(next) === 1;
  if (path.includes(next)) return false;
  const end = path[path.length - 1];
  if (!neighbors(p, end, walls).includes(next)) return false;
  const n = clues.get(next);
  if (n) {
    if (n !== reachedClue(p, path, clues) + 1) return false;
    if (n === (ctx ? ctx.K : lastClue(p)) && path.length + 1 !== N) return false;
  }
  return true;
}

/** Gelöst = jede Zelle genau einmal, gültige Schritte, Zahlen in Reihenfolge, Ende auf der letzten Zahl. */
export function isSolved(p, path) {
  if (!p || !Array.isArray(path) || path.length !== p.rows * p.cols) return false;
  const ctx = { clues: clueMap(p), walls: wallSet(p), K: lastClue(p) };
  for (let i = 0; i < path.length; i++) if (!canStep(p, path.slice(0, i), path[i], ctx)) return false;
  return ctx.clues.get(path[path.length - 1]) === ctx.K;
}

/** Fortschritt = belegte Zellen. */
export function progressPct(p, path) {
  const N = p.rows * p.cols;
  return N ? Math.round(((path ? path.length : 0) / N) * 100) : 0;
}

/** Struktur-Prüfung eines empfangenen Rätsels (Blackscreen-Schutz der Schale). */
export function validPuzzleShape(p) {
  if (!p || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || p.rows < 2 || p.cols < 2 || p.rows > 20 || p.cols > 20) return false;
  if (!Array.isArray(p.clues) || p.clues.length < 2) return false;
  for (const k of p.clues) if (!k || !Number.isInteger(k.r) || !Number.isInteger(k.c) || !Number.isInteger(k.n) || k.r < 0 || k.c < 0 || k.r >= p.rows || k.c >= p.cols) return false;
  if (!p.clues.some((k) => k.n === 1)) return false;
  if (p.walls != null && !Array.isArray(p.walls)) return false;
  return Array.isArray(p.solution) && p.solution.length === p.rows * p.cols;
}

// Über die RTDB gereiste Arrays kommen als Objekt mit numerischen Schlüsseln
// zurück; leere Arrays (keine Wände) fehlen ganz.
const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
export function normalizePuzzle(p) {
  if (!p) return p;
  const clues = arr(p.clues), solution = arr(p.solution), walls = arr(p.walls);
  if (clues === p.clues && solution === p.solution && walls === p.walls) return p;
  return { ...p, clues, solution, walls };
}
export function normalizePath(v) {
  if (Array.isArray(v) && v.every(Number.isInteger)) return v;
  return arr(v).filter(Number.isInteger);
}
