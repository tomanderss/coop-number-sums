// games/numberpath/generator.js — Rätsel für „Number Path" erzeugen.
//
// 1. Ein zufälliger Weg über JEDE Zelle (Hamilton-Pfad): Start mit einer
//    Schlangenlinie, dann viele „Backbite"-Züge — ein Ende beißt sich an einen
//    Nachbarn, das Stück davor dreht sich um. Jeder Zwischenstand ist wieder ein
//    gültiger Weg; nach genug Zügen ist er gut durchmischt.
// 2. Wände auf Kanten, die der Weg NICHT benutzt (ab mittleren Stufen).
// 3. Zahlen: Anfang (1) und Ende (K) immer. Der Kanten-Löser (nur erzwungene
//    Schlüsse über das ganze Brett, s. solver.js) läuft; wo er auf dem echten
//    Weg zuerst hängen bleibt, kommt kurz dahinter eine Zahl dazu. Danach
//    werden überflüssige Zahlen wieder entfernt, solange es lösbar bleibt — so
//    entstehen wenige, aber genügende Zahlen. Lösbar ohne Raten ⇒ eindeutig.
//
// Deterministisch aus dem Seed (Wettkampf/Team/Verlauf).

import { solveEdges, edgeStuckIndex } from './solver.js';
import { genOptionsFor } from './difficulty.js';

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

/** Zufälliger Hamilton-Pfad über ein rows×cols-Gitter (Liste von Zell-Indizes). */
export function randomHamiltonPath(rows, cols, rng, moves = null) {
  const path = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) path.push(r * cols + (r % 2 ? cols - 1 - i : i));
  const N = rows * cols;
  const nbs = (id) => {
    const r = Math.floor(id / cols), c = id % cols, o = [];
    if (r > 0) o.push(id - cols); if (r < rows - 1) o.push(id + cols);
    if (c > 0) o.push(id - 1); if (c < cols - 1) o.push(id + 1);
    return o;
  };
  const pos = new Int32Array(N);
  const reindex = () => { for (let i = 0; i < N; i++) pos[path[i]] = i; };
  reindex();
  const total = moves ?? N * 30;
  for (let m = 0; m < total; m++) {
    if (rng() < 0.5) path.reverse(), reindex();
    const head = path[0];
    const cand = nbs(head).filter((n) => pos[n] > 1);
    if (!cand.length) continue;
    const n = cand[Math.floor(rng() * cand.length)];
    const i = pos[n];
    // Kante head–n dazu, Kante path[i-1]–n weg: das Stück 0..i-1 umdrehen.
    const head2 = path.slice(0, i).reverse();
    for (let k = 0; k < i; k++) { path[k] = head2[k]; pos[path[k]] = k; }
  }
  return path;
}

function buildPuzzle(o, path, walls, idxs) {
  const sorted = [...idxs].sort((a, b) => a - b);
  const clues = sorted.map((i, n) => ({ r: Math.floor(path[i] / o.cols), c: path[i] % o.cols, n: n + 1 }));
  return { rows: o.rows, cols: o.cols, clues, walls, solution: path };
}

/** Wände auf zufälligen, vom Weg NICHT benutzten Kanten. */
function placeWalls(o, path, rng) {
  if (!o.walls) return [];
  const used = new Set();
  for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i]; used.add(a < b ? `${a}-${b}` : `${b}-${a}`); }
  const free = [];
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
    const a = r * o.cols + c;
    if (c < o.cols - 1 && !used.has(`${a}-${a + 1}`)) free.push({ r, c, d: 'r' });
    if (r < o.rows - 1 && !used.has(`${a}-${a + o.cols}`)) free.push({ r, c, d: 'd' });
  }
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  return free.slice(0, Math.min(free.length, o.walls));
}

const TIER2_TRIES = 6;   // gemessen: praktisch immer 1–2 Versuche
export function generatePuzzle(opts = {}) {
  const o = opts.rows ? opts : { ...genOptionsFor(opts.difficulty), ...opts };
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const rng = mulberry32(seed);
  const t0 = Date.now();
  const N = o.rows * o.cols;
  for (let attempt = 0; attempt < (o.tries || 40); attempt++) {
    const path = randomHamiltonPath(o.rows, o.cols, rng);
    const walls = placeWalls(o, path, rng);
    // Startbesetzung: Anfang, Ende und ein paar gleichmäßig verteilte Zahlen.
    const idxs = new Set([0, N - 1]);
    const seedN = Math.max(0, Math.round(N * (o.seedDensity || 0.08)));
    for (let k = 1; k <= seedN; k++) idxs.add(Math.min(N - 2, Math.round((k * N) / (seedN + 1)) + Math.floor(rng() * 3) - 1));
    // Ergänzen, bis lösbar.
    let ok = false;
    for (let guard = 0; guard < N; guard++) {
      const res = solveEdges(buildPuzzle(o, path, walls, idxs), { maxTier: o.maxTier });
      if (res.solved) { ok = true; break; }
      const stuck = res.contradiction ? 1 : Math.max(1, edgeStuckIndex(res, path));
      const at = Math.min(N - 2, stuck + Math.floor(rng() * 3));
      if (idxs.has(at)) { let a = at; while (idxs.has(a) && a < N - 1) a++; idxs.add(Math.min(a, N - 2)); } else idxs.add(at);
    }
    if (!ok) continue;
    // Ausdünnen: Zahlen in zufälliger Reihenfolge weglassen, solange lösbar.
    const inner = [...idxs].filter((i) => i !== 0 && i !== N - 1);
    for (let i = inner.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [inner[i], inner[j]] = [inner[j], inner[i]]; }
    for (const i of inner) {
      if (idxs.size <= (o.minClues || 2)) break;
      idxs.delete(i);
      if (!solveEdges(buildPuzzle(o, path, walls, idxs), { maxTier: o.maxTier }).solved) idxs.add(i);
    }
    const res = solveEdges(buildPuzzle(o, path, walls, idxs), { maxTier: o.maxTier });
    if (!res.solved) continue;
    // Zu leicht für die Stufe → noch ein Versuch, aber nach einer festen ZAHL von
    // Versuchen, nie nach Zeit: Wettkampf/Mix-Duell erzeugen aus demselben Seed auf
    // jedem Gerät, ein Zeitlimit gab auf einem langsamen Gerät ein anderes Rätsel.
    if ((o.minTier2 || 0) > res.tier2Steps && attempt < Math.min(o.tries || 40, TIER2_TRIES) - 1) continue;
    return {
      game: 'numberpath', difficulty: o.difficulty, seed,
      ...buildPuzzle(o, path, walls, idxs),
      genTries: attempt + 1, genMs: Date.now() - t0, tier2: res.tier2Steps,
    };
  }
  throw new Error('Number Path: kein Rätsel gefunden');
}
