// games/rectangles/generator.js — Rätsel für „Rectangles" erzeugen.
//
// 1. Das Brett zufällig in Rechtecke zerlegen (Fläche minArea..maxArea).
// 2. In jedes Rechteck an eine zufällige Stelle seine Fläche als Zahl setzen.
// 3. Mit dem Löser prüfen: das Rätsel muss sich mit den erlaubten Schlüssen
//    VOLLSTÄNDIG lösen lassen (= genau eine Lösung, kein Raten). Sonst die
//    Zahlen der offenen Rechtecke umsetzen; hilft das nicht, neu zerlegen.
//
// Deterministisch aus dem Seed: Wettkampf/Team erzeugen dasselbe Rätsel auf
// jedem Gerät, der Verlauf baut das Endbrett aus dem Seed nach.

import { solveLogic } from './solver.js';
import { genOptionsFor } from './difficulty.js';

// ─── Seedbarer Zufall (mulberry32) ────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/**
 * Brett zerlegen. Läuft die Zellen zeilenweise ab: die erste freie Zelle ist
 * zwingend die obere linke Ecke des Rechtecks, das sie bedeckt (alles davor ist
 * schon belegt) — so entsteht jede Zerlegung ohne Rücksetzen. Liefert null,
 * wenn eine Lücke kleiner als minArea übrig bliebe.
 */
export function partition(rows, cols, rng, { minArea = 2, maxArea = 9, maxAspect = 5 } = {}) {
  const used = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const rects = [];
  const free = (r, c, h, w) => {
    if (r + h > rows || c + w > cols) return false;
    for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) if (used[rr][cc]) return false;
    return true;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (used[r][c]) continue;
    // Alle passenden Formen sammeln und gewichtet ziehen: kleine bis mittlere
    // Flächen häufiger, sehr lange dünne Streifen seltener.
    const opts = [];
    for (let h = 1; h <= rows - r; h++) for (let w = 1; w <= cols - c; w++) {
      const a = h * w;
      if (a < minArea || a > maxArea) continue;
      if (Math.max(h, w) / Math.min(h, w) > maxAspect) continue;
      if (!free(r, c, h, w)) continue;
      const aspect = Math.max(h, w) / Math.min(h, w);
      // Viele „2"en machen ein Rätsel trivial (fast überall nur zwei Formen):
      // kleine Flächen deutlich seltener, die Mitte bevorzugt.
      const sizeW = a === 2 ? 0.25 : a === 3 ? 0.6 : a > maxArea * 0.75 ? 0.7 : 1;
      const shapeW = aspect <= 2 ? 1.6 : aspect <= 3 ? 1 : 0.5;
      opts.push({ h, w, wt: sizeW * shapeW });
    }
    if (!opts.length) return null;
    let x = rng() * opts.reduce((s, o) => s + o.wt, 0);
    let pick = opts[opts.length - 1];
    for (const o of opts) { x -= o.wt; if (x <= 0) { pick = o; break; } }
    for (let rr = r; rr < r + pick.h; rr++) for (let cc = c; cc < c + pick.w; cc++) used[rr][cc] = true;
    rects.push({ r, c, h: pick.h, w: pick.w });
  }
  return rects;
}

function placeClue(q, rng) {
  return { r: q.r + randInt(rng, 0, q.h - 1), c: q.c + randInt(rng, 0, q.w - 1), n: q.h * q.w };
}

// Zahlen und Lösung in Lesereihenfolge sortieren (stabile Indizes für Coop/Verlauf).
function sortPuzzle(clues, rects) {
  const idx = clues.map((_, i) => i).sort((a, b) => (clues[a].r - clues[b].r) || (clues[a].c - clues[b].c));
  return { clues: idx.map((i) => clues[i]), solution: idx.map((i) => rects[i]) };
}

/**
 * Ein Rätsel erzeugen. `opts` = Generator-Optionen (s. genOptionsFor) oder nur
 * `{ difficulty, seed }`.
 */
export function generatePuzzle(opts = {}) {
  const o = opts.rows ? opts : { ...genOptionsFor(opts.difficulty), ...opts };
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const rng = mulberry32(seed);
  const t0 = Date.now();
  const deadline = t0 + (o.maxMs || 4000);
  let tries = 0;
  for (; tries < (o.tries || 400); tries++) {
    const rects = partition(o.rows, o.cols, rng, o);
    if (!rects) continue;
    let clues = rects.map((q) => placeClue(q, rng));
    // Reparatur: Zahlen der noch offenen Rechtecke umsetzen.
    for (let fix = 0; fix <= (o.repairs ?? 25); fix++) {
      const res = solveLogic({ rows: o.rows, cols: o.cols, clues }, { maxTier: o.maxTier });
      if (res.solved && res.tier2Steps >= (o.minTier2 || 0)) {
        const { clues: cs, solution } = sortPuzzle(clues, rects);
        return {
          game: 'rectangles', difficulty: o.difficulty, seed, rows: o.rows, cols: o.cols,
          clues: cs, solution, genTries: tries + 1, genMs: Date.now() - t0, tier2: res.tier2Steps,
          ...(opts.__fallback ? { fallback: true } : {}),
        };
      }
      if (res.solved) break;   // eindeutig, aber zu leicht für diese Stufe → neu zerlegen
      const open = res.rects.map((q, i) => (q ? -1 : i)).filter((i) => i >= 0);
      if (!open.length) break;
      clues = clues.slice();
      for (const i of open) if (rng() < 0.6) clues[i] = placeClue(rects[i], rng);
    }
    if (Date.now() > deadline && tries > 5) break;
  }
  // Notausgang (sollte nie greifen): die einfachste Stufe ohne Härte-Vorgabe.
  if (!opts.__fallback) {
    return generatePuzzle({ ...o, seed: (seed + 1) >>> 0, minTier2: 0, maxTier: 2, maxArea: Math.min(o.maxArea, 8), __fallback: true, tries: 2000, maxMs: 8000 });
  }
  throw new Error('Rectangles: kein Rätsel gefunden');
}
