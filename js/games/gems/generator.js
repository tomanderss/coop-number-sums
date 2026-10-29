// games/gems/generator.js — erzeugt „Gem Hunt"-Rätsel: genau eine Lösung,
// lösbar OHNE Raten (der logische Löser muss sie bis zum Ende finden).
//
// 1. Lösung: je Zeile ein Stein, Spalten paarweise verschieden, Nachbarzeilen
//    mindestens zwei Spalten auseinander (kein Berühren) — zufällig mit
//    Rücksetzen gesucht.
// 2. Käfige: jeder Stein ist Keim eines Käfigs; die Käfige wachsen zufällig
//    Zelle für Zelle (waagerecht/senkrecht), kleinere bevorzugt, bis das Feld
//    voll ist. So enthält jeder Käfig genau einen Stein der Lösung.
// 3. Prüfung mit dem Löser (bis `maxTier`, ggf. ohne „blockiert"); bei Bedarf
//    werden genug Schlüsse der Stufe 2 verlangt, und IMMER ein Einstieg: so
//    viele Steine (`entry`), wie man am Anfang allein mit Blick-Schlüsseln
//    findet. Sonst neuer Versuch — deterministisch aus dem Seed.

import { solveLogic, entryInfo } from './solver.js';
import { genOptionsFor } from './difficulty.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Zufällige Lösung: solution[r] = Spalte. */
export function randomSolution(n, rnd) {
  const pick = [], used = new Array(n).fill(false);
  function go(r) {
    if (r === n) return true;
    for (const c of shuffle([...Array(n).keys()], rnd)) {
      if (used[c] || (r > 0 && Math.abs(pick[r - 1] - c) <= 1)) continue;
      used[c] = true; pick[r] = c;
      if (go(r + 1)) return true;
      used[c] = false;
    }
    return false;
  }
  return go(0) ? pick.slice() : null;
}

/** Käfige um die Steine wachsen lassen. Liefert regions[] (Käfig je Zelle). */
export function growRegions(n, cols, rnd) {
  const N = n * n;
  const reg = new Array(N).fill(-1);
  const size = new Array(n).fill(1);
  const ids = shuffle([...Array(n).keys()], rnd);
  for (let r = 0; r < n; r++) reg[r * n + cols[r]] = ids[r];
  let left = N - n;
  const nb4 = (i) => {
    const r = Math.floor(i / n), c = i % n, out = [];
    if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
    return out;
  };
  for (let guard = 0; left > 0 && guard < N * 40; guard++) {
    // Kleinere Käfige wachsen bevorzugt (Gewicht 1/Größe²), aber nicht nur sie.
    const weights = size.map((s) => 1 / (s * s));
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rnd() * total, k = 0;
    while (k < n - 1 && x > weights[k]) { x -= weights[k]; k++; }
    const frontier = [];
    for (let i = 0; i < N; i++) if (reg[i] === k) for (const j of nb4(i)) if (reg[j] === -1) frontier.push(j);
    if (!frontier.length) { size[k] = 1e6; continue; }   // eingeschlossen: nicht mehr wählen
    const j = frontier[Math.floor(rnd() * frontier.length)];
    reg[j] = k; size[k]++; left--;
  }
  if (left > 0) {
    // Reste (sehr selten): an einen beliebigen Nachbar-Käfig hängen.
    for (let pass = 0; pass < N && left > 0; pass++) {
      for (let i = 0; i < N; i++) if (reg[i] === -1) {
        const o = nb4(i).find((j) => reg[j] >= 0);
        if (o != null) { reg[i] = reg[o]; left--; }
      }
    }
  }
  return reg;
}

// Käfig `k` ohne Zelle `i` noch zusammenhängend?
function stillConnected(n, reg, k, without) {
  const cells = [];
  for (let i = 0; i < n * n; i++) if (reg[i] === k && i !== without) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / n), c = i % n;
    for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1]) {
      if (j >= 0 && j !== without && reg[j] === k && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === cells.length;
}

/**
 * Käfige nachschärfen, bis der Löser das Feld komplett entscheidet: eine
 * Randzelle wandert in einen Nachbarkäfig, wenn der Löser danach mindestens so
 * viel entscheiden kann (Bergsteigen mit Seitwärtsschritten). Die Steine der
 * Lösung bleiben dabei in ihren Käfigen — die Lösung bleibt gültig.
 */
export function refineRegions(n, cols, regions, rnd, { maxTier = 2, blocks = true, budget = 400 } = {}) {
  const reg = regions.slice();
  const stars = new Set(cols.map((c, r) => r * n + c));
  const solve = () => solveLogic({ rows: n, cols: n, regions: reg }, { maxTier, blocks });
  let res = solve();
  let cur = res.solved ? Infinity : res.decided;
  for (let it = 0; it < budget && cur !== Infinity; it++) {
    // Bevorzugt dort umbauen, wo der Löser noch nichts weiß: eine noch offene
    // Zelle (oder ihr Nachbar) wechselt in einen angrenzenden Käfig.
    const pool = res.undecided && res.undecided.length ? res.undecided : null;
    let i = pool && rnd() < 0.85 ? pool[Math.floor(rnd() * pool.length)] : Math.floor(rnd() * n * n);
    if (stars.has(i)) continue;
    const r = Math.floor(i / n), c = i % n;
    const opts = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1]
      .filter((j) => j >= 0 && reg[j] !== reg[i]).map((j) => reg[j]);
    if (!opts.length) continue;
    const to = opts[Math.floor(rnd() * opts.length)], from = reg[i];
    if (!stillConnected(n, reg, from, i)) continue;
    reg[i] = to;
    const next = solve();
    const s = next.solved ? Infinity : next.decided;
    if (s >= cur) { cur = s; res = next; } else reg[i] = from;
  }
  return cur === Infinity ? reg : null;
}

/**
 * opts: { difficulty, size, maxTier, blocks, minBlocks, minTier2, entry, seed, maxMs, tries }
 * Liefert { rows, cols, regions, solution, difficulty, seed, tier2 }.
 */
export function generatePuzzle(input = {}) {
  // Die Schale schickt nur { difficulty, seed? } — Größe und Stufe kommen dann aus der Leiter.
  const opts = input.size ? input : { ...genOptionsFor(input.difficulty), ...input };
  const n = opts.size || 6;
  const maxTier = opts.maxTier ?? 2;
  const minTier2 = opts.minTier2 ?? 0;
  const blocks = opts.blocks ?? true;
  const minBlocks = blocks ? (opts.minBlocks ?? 0) : 0;
  const entry = opts.entry ?? 1;
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const rnd = mulberry32(seed);
  const deadline = Date.now() + (opts.maxMs ?? 6000);
  const tries = opts.tries ?? 400;
  let best = null;
  for (let t = 0; t < tries; t++) {
    const cols = randomSolution(n, rnd);
    if (!cols) continue;
    const regions = refineRegions(n, cols, growRegions(n, cols, rnd), rnd, { maxTier, blocks, budget: opts.budget ?? 250 * n });
    if (!regions) { if (Date.now() > deadline && best) break; continue; }
    const p = { rows: n, cols: n, regions };
    const res = solveLogic(p, { maxTier, blocks });
    const tier2 = res.steps.filter((s) => s.tier === 2).length;
    const nBlocks = res.steps.filter((s) => s.kind === 'blocks').length;
    const ent = entryInfo(p).gems;
    const cand = { ...p, solution: cols.map((c, r) => r * n + c), difficulty: opts.difficulty || null, seed, tier2, blocks: nBlocks, entry: ent };
    if (tier2 >= minTier2 && nBlocks >= minBlocks && ent >= entry) return cand;
    // Bester Ersatz: der Einstieg zählt vor der Schwere.
    const score = (x) => Math.min(x.entry, entry) * 100 + Math.min(x.tier2, minTier2) * 10 + Math.min(x.blocks, minBlocks);
    if (ent >= 1 && (!best || score(cand) > score(best))) best = cand;
    if (Date.now() > deadline) break;
  }
  if (best) return best;
  // Notausgang (praktisch nie): ohne Zusatzforderung, Stufe 2 erlaubt — der
  // Einstieg (mindestens ein Stein) bleibt.
  return generatePuzzle({ ...opts, size: n, minTier2: 0, minBlocks: 0, maxTier: 2, blocks: true, entry: 1, seed: seed + 1, maxMs: 4000 });
}
