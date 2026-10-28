// games/rectangles/model.js — die Spielregeln von „Rectangles" (Shikaku).
//
// Das Brett wird vollständig in Rechtecke (auch Quadrate) zerlegt. Jedes
// Rechteck enthält GENAU EINE Zahl, und diese Zahl ist seine Fläche (Anzahl
// Zellen). Keine Zelle bleibt frei, keine gehört zwei Rechtecken.
//
// Rein und unit-getestet: alle Funktionen nehmen `puzzle` und die gezogenen
// Rechtecke ausdrücklich als Argumente.
//
// Rätsel:    { rows, cols, clues: [{ r, c, n }], solution: [{ r, c, h, w }] }
//            solution[i] ist das Rechteck der Zahl clues[i].
// Rechteck:  { r, c, h, w } — obere linke Zelle, Höhe (Zeilen), Breite (Spalten);
//            gezogene Rechtecke tragen zusätzlich eine `id` (und `by`).

/** Rechteck aus zwei beliebigen Eckzellen (Start und Ende des Ziehens). */
export function rectFromCorners(r0, c0, r1, c1) {
  const r = Math.min(r0, r1), c = Math.min(c0, c1);
  return { r, c, h: Math.abs(r1 - r0) + 1, w: Math.abs(c1 - c0) + 1 };
}

export const rectArea = (q) => q.h * q.w;
export const rectContains = (q, r, c) => r >= q.r && r < q.r + q.h && c >= q.c && c < q.c + q.w;
export function rectsOverlap(a, b) {
  return a.r < b.r + b.h && b.r < a.r + a.h && a.c < b.c + b.w && b.c < a.c + a.w;
}
export const sameRect = (a, b) => !!a && !!b && a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;

/** Liegt das Rechteck vollständig auf dem Brett? */
export function rectInBounds(p, q) {
  return Number.isInteger(q.r) && Number.isInteger(q.c) && q.h >= 1 && q.w >= 1
    && q.r >= 0 && q.c >= 0 && q.r + q.h <= p.rows && q.c + q.w <= p.cols;
}

/** Indizes der Zahlen, die im Rechteck liegen. */
export function cluesIn(p, q) {
  const out = [];
  for (let i = 0; i < p.clues.length; i++) if (rectContains(q, p.clues[i].r, p.clues[i].c)) out.push(i);
  return out;
}

/**
 * Ist dieses EINE Rechteck regelkonform? Genau eine Zahl darin, Fläche = Zahl.
 * Sagt nichts darüber, ob es zur Lösung gehört (das zeigt erst das volle Brett).
 */
export function rectValid(p, q) {
  const inside = cluesIn(p, q);
  return inside.length === 1 && p.clues[inside[0]].n === rectArea(q);
}

/**
 * Wem gehört welche Zelle? 2D-Raster mit dem Index des Rechtecks in `rects`
 * oder -1. Bei (regelwidriger) Überlappung gewinnt das spätere Rechteck.
 */
export function ownerGrid(p, rects) {
  const g = Array.from({ length: p.rows }, () => new Array(p.cols).fill(-1));
  rects.forEach((q, i) => {
    for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) {
      if (r >= 0 && r < p.rows && c >= 0 && c < p.cols) g[r][c] = i;
    }
  });
  return g;
}

/** Wie viele Zellen sind bedeckt? */
export function coveredCount(p, rects) {
  let n = 0;
  for (const row of ownerGrid(p, rects)) for (const v of row) if (v >= 0) n++;
  return n;
}

/** Jede Zelle bedeckt? (Erst dann wird geprüft, ob es aufgeht.) */
export function isFull(p, rects) { return coveredCount(p, rects) === p.rows * p.cols; }

/** Fortschritt in Prozent = bedeckte Zellen (wie Math Cross: Belegen ist Fortschritt). */
export function progressPct(p, rects) {
  const total = p.rows * p.cols;
  return total ? Math.round((coveredCount(p, rects) / total) * 100) : 0;
}

/**
 * Gelöst = jede Zelle genau einmal bedeckt und jedes Rechteck regelkonform.
 * Bewusst über die REGELN statt über den Vergleich mit der gespeicherten
 * Lösung: der Generator garantiert ohnehin genau eine Lösung.
 */
export function isSolved(p, rects) {
  if (!p || !Array.isArray(rects)) return false;
  let area = 0;
  for (const q of rects) {
    if (!rectInBounds(p, q) || !rectValid(p, q)) return false;
    area += rectArea(q);
  }
  // Fläche passt und keine Überlappung ⇒ jede Zelle genau einmal.
  return area === p.rows * p.cols && coveredCount(p, rects) === area;
}

/**
 * Ein neues Rechteck einfügen: alle Rechtecke, die es überdeckt, werden ersetzt
 * („Überziehen ersetzt"). Liefert die neue Liste und die entfernten Rechtecke.
 */
export function addRect(rects, q) {
  const removed = rects.filter((x) => rectsOverlap(x, q));
  return { rects: rects.filter((x) => !rectsOverlap(x, q)).concat([q]), removed };
}

/**
 * Die „Barriere" beim Ziehen: das größte Rechteck von der Ankerzelle (ar, ac)
 * in Richtung der Zielzelle (tr, tc), das KEIN Rechteck aus `rects` berührt,
 * außer denen, deren id in `pass` steht (schon durchbrochen bzw. das, in dem
 * das Ziehen begann). Bei gleicher Fläche gewinnt das, dessen Ecke näher am
 * Ziel liegt. Liefert null, wenn schon die Ankerzelle blockiert ist.
 */
export function clampToFree(rects, ar, ac, tr, tc, pass = null) {
  const block = rects.filter((x) => !(pass && pass.has(x.id)));
  const sr = tr >= ar ? 1 : -1, sc = tc >= ac ? 1 : -1;
  let best = null, bestArea = 0, bestDist = Infinity;
  for (let r = ar; sr > 0 ? r <= tr : r >= tr; r += sr) {
    for (let c = ac; sc > 0 ? c <= tc : c >= tc; c += sc) {
      const q = rectFromCorners(ar, ac, r, c);
      const area = rectArea(q);
      const dist = Math.abs(tr - r) + Math.abs(tc - c);
      if (area < bestArea || (area === bestArea && dist >= bestDist)) continue;
      if (block.some((x) => rectsOverlap(x, q))) {
        // Wächst die Spalte weiter, bleibt die Überlappung: Zeile abbrechen.
        break;
      }
      best = q; bestArea = area; bestDist = dist;
    }
  }
  return best;
}

/** Das Rechteck, das eine Zelle bedeckt (oder null). */
export function rectAt(rects, r, c) {
  for (let i = rects.length - 1; i >= 0; i--) if (rectContains(rects[i], r, c)) return rects[i];
  return null;
}

/** Struktur-Prüfung eines empfangenen Rätsels (Blackscreen-Schutz der Schale). */
export function validPuzzleShape(p) {
  if (!p || !Number.isInteger(p.rows) || !Number.isInteger(p.cols) || p.rows < 2 || p.cols < 2 || p.rows > 30 || p.cols > 30) return false;
  if (!Array.isArray(p.clues) || !p.clues.length) return false;
  for (const k of p.clues) {
    if (!k || !Number.isInteger(k.r) || !Number.isInteger(k.c) || !Number.isInteger(k.n)) return false;
    if (k.r < 0 || k.c < 0 || k.r >= p.rows || k.c >= p.cols || k.n < 1) return false;
  }
  if (!Array.isArray(p.solution) || p.solution.length !== p.clues.length) return false;
  return p.solution.every((q) => q && rectInBounds(p, q));
}

/**
 * Ein über die RTDB gereistes Rätsel heilen: Arrays können als Objekt mit
 * numerischen Schlüsseln zurückkommen (s. normalizeGrid in coop.js).
 */
export function normalizePuzzle(p) {
  if (!p) return p;
  const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : v);
  const clues = arr(p.clues), solution = arr(p.solution);
  if (clues === p.clues && solution === p.solution) return p;
  return { ...p, clues, solution };
}

/** Gezogene Rechtecke aus einem Spielstand/einer Nachricht heilen (wie oben). */
const rectOk = (q) => !!q && Number.isInteger(q.r) && Number.isInteger(q.c) && q.h >= 1 && q.w >= 1;
export function normalizeRects(v) {
  if (Array.isArray(v) && v.every(rectOk)) return v;   // schon sauber: dieselbe Referenz (idempotent)
  const a = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((x, y) => x - y).map((k) => v[k]) : [];
  return a.filter(rectOk);
}
