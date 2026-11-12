// games/numberlink/generator.js — Rätsel für „Number Link" erzeugen.
//
// 1. Ein zufälliger Weg über JEDE Zelle (Hamilton-Pfad per Backbite, wie in
//    Number Path).
// 2. Der Weg wird in `pairs` Stücke geschnitten (je mindestens 3 Zellen); jedes
//    Stück ist eine Linie, seine beiden Enden bekommen dieselbe Zahl.
// 3. Der Logik-Löser (solver.js) muss das Brett komplett festlegen — dann ist
//    es eindeutig und ohne Raten lösbar. Bleibt er hängen, wird die Linie, in
//    der er hängt, dort noch einmal geteilt (ein Paar mehr), höchstens bis
//    `maxPairs`. Sonst neuer Versuch.
//
// Deterministisch aus dem Seed (Wettkampf/Team/Verlauf): abgebrochen wird nur
// nach einer festen Versuchszahl, nie nach Zeit.

import { solveLogic, MAX_PAIRS } from './solver.js';
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
    const head2 = path.slice(0, i).reverse();
    for (let k = 0; k < i; k++) { path[k] = head2[k]; pos[path[k]] = k; }
  }
  return path;
}

/**
 * Schnitte so, dass KEINE Linie sich selbst berührt: läuft der Weg an eine
 * Zelle seines eigenen Stücks heran (eine „Sehne"), beginnt dort ein neues
 * Stück. Eine Linie, die sich selbst berührt, ließe sich fast immer abkürzen
 * oder umlegen — das Rätsel hätte mehrere Lösungen. Rückgabe: Startindizes.
 */
export function chordFreeCuts(path, rows, cols) {
  const N = path.length, pos = new Int32Array(N);
  path.forEach((id, i) => { pos[id] = i; });
  const cuts = [0];
  let s = 0;
  for (let i = 1; i < N; i++) {
    const id = path[i], r = Math.floor(id / cols), c = id % cols;
    const nb = [];
    if (r > 0) nb.push(id - cols); if (r < rows - 1) nb.push(id + cols);
    if (c > 0) nb.push(id - 1); if (c < cols - 1) nb.push(id + 1);
    if (nb.some((n) => pos[n] >= s && pos[n] <= i - 2)) { cuts.push(i); s = i; }
  }
  return cuts;
}
const segLens = (cuts, N) => cuts.map((c, i) => (i + 1 < cuts.length ? cuts[i + 1] : N) - c);

function buildPuzzle(o, path, cuts) {
  const N = path.length;
  const ends = [], solution = new Array(N).fill(0);
  cuts.forEach((start, i) => {
    const end = (i + 1 < cuts.length ? cuts[i + 1] : N) - 1;
    const k = i + 1;
    for (let j = start; j <= end; j++) solution[path[j]] = k;
    for (const j of [start, end]) ends.push({ r: Math.floor(path[j] / o.cols), c: path[j] % o.cols, k });
  });
  return { rows: o.rows, cols: o.cols, ends, solution };
}

/** Zahlen neu vergeben: von oben links nach unten rechts aufsteigend (ruhiger zu lesen). */
function renumber(p) {
  const first = new Map();
  for (const e of p.ends) { const id = e.r * p.cols + e.c; if (!first.has(e.k) || id < first.get(e.k)) first.set(e.k, id); }
  const order = [...first.keys()].sort((a, b) => first.get(a) - first.get(b));
  const map = new Map(order.map((k, i) => [k, i + 1]));
  return {
    ...p,
    ends: p.ends.map((e) => ({ ...e, k: map.get(e.k) })).sort((a, b) => a.k - b.k || (a.r * p.cols + a.c) - (b.r * p.cols + b.c)),
    solution: p.solution.map((k) => map.get(k)),
  };
}

/**
 * Farbe je Paar (Index in die 12er-Palette des Bretts): Paar k bekommt nach
 * Möglichkeit Farbe k−1, aber nie die eines Paares, dessen Linie seine eigene
 * berührt — so bleiben auch bei mehr als 12 Paaren alle Nachbarn unterscheidbar.
 */
export const PALETTE_SIZE = 12;
export function assignColors(p) {
  const K = p.ends.length / 2, N = p.rows * p.cols;
  const touch = Array.from({ length: K + 1 }, () => new Set());
  for (let id = 0; id < N; id++) {
    const k = p.solution[id];
    const right = (id % p.cols) < p.cols - 1 ? p.solution[id + 1] : 0;
    const down = id + p.cols < N ? p.solution[id + p.cols] : 0;
    for (const n of [right, down]) if (n && n !== k) { touch[k].add(n); touch[n].add(k); }
  }
  const col = new Array(K + 1).fill(-1);
  for (let k = 1; k <= K; k++) {
    const used = new Set([...touch[k]].map((n) => col[n]));
    let c = (k - 1) % PALETTE_SIZE;
    for (let j = 0; j < PALETTE_SIZE && used.has(c); j++) c = (k - 1 + j + 1) % PALETTE_SIZE;
    col[k] = c;
  }
  return col.slice(1);
}

export function generatePuzzle(opts = {}) {
  const o = opts.rows ? opts : { ...genOptionsFor(opts.difficulty), ...opts };
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  if (o.walls) {
    const wp = generateWalled(o, seed);
    if (wp) return wp;
  }
  const rng = mulberry32(seed);
  const t0 = Date.now();
  const N = o.rows * o.cols;
  const minLen = o.minLen || 3;
  const tries = o.tries || 40;
  let path = null;
  const solves = (cuts, maxTier) => solveLogic(buildPuzzle(o, path, cuts), { maxTier, probeBudget: o.probeBudget });
  // Erst der schnelle Ein-Blick-Löser, nur wenn der nicht reicht die Vorausschau.
  const solvesUpTo = (cuts) => { const r = solves(cuts, 1); return r.solved || o.maxTier < 2 ? r : solves(cuts, 2); };
  for (let attempt = 0; attempt < tries; attempt++) {
    path = randomHamiltonPath(o.rows, o.cols, rng);
    let cuts = chordFreeCuts(path, o.rows, o.cols);
    // Zu kurze Stücke (zwei Nachbarn mit derselben Zahl wären geschenkt) mit
    // einem Nachbarstück verschmelzen.
    let lens = segLens(cuts, N);
    for (let i = lens.findIndex((l) => l < minLen); i >= 0; i = lens.findIndex((l) => l < minLen)) {
      const drop = i === 0 ? 1 : i === cuts.length - 1 ? i : (rng() < 0.5 ? i : i + 1);
      cuts = cuts.filter((_, j) => j !== drop);
      lens = segLens(cuts, N);
    }
    // Mehr Zahlen, als der Löser darstellen kann: neuer Versuch.
    if (cuts.length > MAX_PAIRS) continue;
    let res = solvesUpTo(cuts);
    if (!res.solved) continue;
    // Ausdünnen: Paare verschmelzen (einen Schnitt weglassen), solange das Brett
    // eindeutig lösbar bleibt. Erst mit dem schnellen Ein-Blick-Löser, dann
    // (obere Stufen) noch eine feste Zahl von Versuchen mit Vorausschau — die
    // machen das Rätsel härter.
    const order = cuts.slice(1);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const failed = [];
    for (const cut of order) {
      const next = cuts.filter((c) => c !== cut);
      const r = solves(next, 1);
      if (r.solved) { cuts = next; res = r; } else failed.push(cut);
    }
    if (o.maxTier >= 2) {
      for (const cut of failed.slice(0, o.t2Merges || 0)) {
        const next = cuts.filter((c) => c !== cut);
        const r = solves(next, 2);
        if (r.solved) { cuts = next; res = r; }
      }
    }
    const p = renumber(buildPuzzle(o, path, cuts));
    return {
      game: 'numberlink', difficulty: o.difficulty, seed,
      ...p, colors: assignColors(p),
      genTries: attempt + 1, genMs: Date.now() - t0, tier2: res.tier2Steps,
    };
  }
  throw new Error('Number Link: kein Rätsel gefunden');
}

// ─── OBERE STUFEN: LANGE LINIEN + WÄNDE ───────────────────────────────────────
//
// Die sehnenfreien Schnitte oben liefern auf jeder Brettgröße ~6,5 Zellen je
// Linie — viele kurze Linien, nie wirklich schwer. Hier wird der Weg in LANGE
// Stücke geschnitten (Ziel `lineLen` Zellen). Solche Linien ließen sich meist
// auf mehrere Arten legen; eindeutig werden sie durch WÄNDE auf Zellgrenzen,
// durch die keine Linie führt:
//   1. Löser (Stufe 1) laufen lassen; bleibt er hängen, kommt eine Wand auf eine
//      noch offene Grenze, über die die Lösung NICHT läuft — bis alles feststeht.
//   2. Überflüssige Wände wieder entfernen (Stufe 1 muss weiter alles festlegen).
//   3. Obere Stufen: weitere Wände entfernen, solange der Löser mit Vorausblick
//      (Stufe 2) das Rätsel noch vollständig festlegt — höchstens `t2Prune`
//      Versuche, damit die Erzeugung auf dem Gerät schnell bleibt.
// Jedes Ergebnis ist vom Löser komplett OHNE Raten gelöst, also eindeutig.
// Deterministisch aus dem Seed, nur feste Versuchszahlen, nie Zeit.
export function generateWalled(o, seed) {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const { rows, cols } = o, N = rows * cols;
  const minLen = o.minLen || 3, target = o.lineLen || 10;
  const probeBudget = N * 2;
  for (let attempt = 0; attempt < (o.wallTries || 6); attempt++) {
    const path = randomHamiltonPath(rows, cols, rng);
    const cuts = [0];
    for (let i = 0; ;) {
      i += Math.max(minLen, Math.round(target * (0.6 + 0.8 * rng())));
      if (i > N - minLen) break;
      cuts.push(i);
    }
    if (cuts.length > MAX_PAIRS) continue;
    const base = buildPuzzle(o, path, cuts);
    const onSol = new Set();
    for (let j = 1; j < N; j++) {
      if (base.solution[path[j]] !== base.solution[path[j - 1]]) continue;
      const a = Math.min(path[j], path[j - 1]), b = Math.max(path[j], path[j - 1]);
      onSol.add(`${a}-${b}`);
    }
    const walls = [];
    const solve = (w, tier) => solveLogic({ ...base, walls: w }, { maxTier: tier, probeBudget });
    let res = null;
    for (let guard = 0; guard <= N; guard++) {
      res = solve(walls, 1);
      if (res.solved || res.contradiction) break;
      const cand = [];
      for (let e = 0; e < res.st.length; e++) {
        if (res.st[e] !== 2) continue;                    // nur noch offene Grenzen
        const [a, b] = res.g.edges[e];
        if (!onSol.has(`${a}-${b}`)) cand.push([a, b]);
      }
      if (!cand.length) break;
      const [a, b] = cand[Math.floor(rng() * cand.length)];
      walls.push({ r: Math.floor(a / cols), c: a % cols, d: b === a + 1 ? 'r' : 'd' });
    }
    if (!res || !res.solved) continue;
    for (let k = walls.length - 1; k >= 0; k--) {
      const w2 = walls.filter((_, x) => x !== k);
      if (solve(w2, 1).solved) walls.splice(k, 1);
    }
    let t2 = 0;
    if ((o.maxTier || 1) >= 2 && o.t2Prune) {
      const order = walls.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const drop = new Set();
      for (const k of order.slice(0, o.t2Prune)) {
        const w2 = walls.filter((_, x) => x !== k && !drop.has(x));
        const r = solve(w2, 2);
        if (r.solved) { drop.add(k); t2 = r.tier2Steps; }
      }
      for (const k of [...drop].sort((a, b) => b - a)) walls.splice(k, 1);
    }
    const p = renumber(base);
    p.walls = walls;
    return {
      game: 'numberlink', difficulty: o.difficulty, seed,
      ...p, colors: assignColors(p),
      genTries: attempt + 1, tier2: t2,
    };
  }
  return null;
}
