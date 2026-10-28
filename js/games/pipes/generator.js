// games/pipes/generator.js — erzeugt ein „Pipes"-Rätsel (rein, deterministisch
// aus dem Seed).
//
// 1. Ein zufälliger Spannbaum über das Brett, kein Knoten mit vier Rohren
//    (nur Endstück, Gerade, Bogen und T-Stück). Er wächst von der Quelle aus;
//    `branchy` mischt Breiten- und Tiefensuche (mehr T-Stücke ⇔ mehr Verzweigung).
// 2. Jedes Stück wird zufällig verdreht.
// 3. Angenommen wird nur, was der Logik-Löser bis zur gewünschten Stufe
//    komplett festlegt (eindeutig + ohne Raten); sonst neuer Versuch.

import { DR, DC, N, E, S, W, rotMask, orientations, degree } from './model.js';
import { solveLogic } from './solver.js';
import { genOptionsFor } from './difficulty.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BIT = [N, E, S, W];

function spanningTree(rows, cols, rnd, branchy) {
  const n = rows * cols;
  const mask = new Array(n).fill(0);
  const inTree = new Uint8Array(n);
  const source = Math.floor(rows / 2) * cols + Math.floor(cols / 2) + (rnd() < 0.5 ? 0 : -1 + Math.floor(rnd() * 3));
  const src = Math.max(0, Math.min(n - 1, source));
  inTree[src] = 1;
  const front = [src];
  let count = 1;
  while (count < n) {
    if (!front.length) return null;
    // Neuester (Tiefe, lange Gänge) oder zufälliger (Breite, Verzweigung) Knoten.
    const fi = rnd() < branchy ? Math.floor(rnd() * front.length) : front.length - 1;
    const i = front[fi];
    const r = Math.floor(i / cols), c = i % cols;
    const opts = [];
    if (degree(mask[i]) < 3) {
      for (let d = 0; d < 4; d++) {
        const rr = r + DR[d], cc = c + DC[d];
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const j = rr * cols + cc;
        if (!inTree[j]) opts.push([d, j]);
      }
    }
    if (!opts.length) { front.splice(fi, 1); continue; }
    const [d, j] = opts[Math.floor(rnd() * opts.length)];
    mask[i] |= BIT[d]; mask[j] |= BIT[(d + 2) % 4];
    inTree[j] = 1; count++;
    front.push(j);
  }
  return { mask, source: src };
}

export function generatePuzzle(input = {}) {
  const opts = input.rows ? input : { ...genOptionsFor(input.difficulty), ...input };
  const { rows, cols, maxTier = 2, branchy = 0.5, minTier2 = 0, tries = 300, maxMs = 4000 } = opts;
  const seed = Number.isFinite(input.seed) ? input.seed : Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(seed);
  const t0 = Date.now();
  let best = null;
  for (let t = 0; t < tries; t++) {
    const tree = spanningTree(rows, cols, rnd, branchy);
    if (!tree) continue;
    const solRot = [], tiles = [];
    for (let i = 0; i < tree.mask.length; i++) {
      const k = Math.floor(rnd() * 4);
      tiles.push(rotMask(tree.mask[i], k));
      solRot.push((4 - k) % 4);
    }
    // Kein Stück darf schon richtig liegen, das sich drehen lässt (sonst wirkt das Brett halb fertig).
    for (let i = 0; i < tiles.length; i++) {
      if (orientations(tiles[i]).length > 1 && tiles[i] === tree.mask[i]) { tiles[i] = rotMask(tiles[i], 1); solRot[i] = (solRot[i] + 3) % 4; }
    }
    const p = { rows, cols, tiles, source: tree.source, solRot };
    const res = solveLogic(p, { maxTier });
    const score = res.decided + (res.tier2 >= minTier2 ? n2(rows, cols) : 0);
    if (!best || score > best.score) best = { p, res, score };
    if (res.solved && res.tier2 >= minTier2) break;
    if (Date.now() - t0 > maxMs) break;
  }
  const { p, res } = best;
  return { ...p, difficulty: opts.difficulty || null, seed, tier2: res.tier2, logic: res.solved };
}
const n2 = (r, c) => r * c * 10;
