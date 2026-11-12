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

function spanningTree(rows, cols, rnd, branchy, wrap = false) {
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
        let rr = r + DR[d], cc = c + DC[d];
        if (wrap) { rr = (rr + rows) % rows; cc = (cc + cols) % cols; }
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
  // Nur eine feste Versuchszahl, kein Zeitlimit: derselbe Seed muss auf jedem Gerät
  // dasselbe Rätsel geben (Wettkampf/Mix-Duell).
  const { rows, cols, maxTier = 2, branchy = 0.5, minTier2 = 0, tries = 300, climb = 0 } = opts;
  const wrap = !!opts.wrap;
  const seed = Number.isFinite(input.seed) ? input.seed : Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(seed);
  let best = null;
  for (let t = 0; t < tries; t++) {
    const tree = spanningTree(rows, cols, rnd, branchy, wrap);
    if (!tree) continue;
    const shape = { rows, cols, tiles: tree.mask, source: tree.source, ...(wrap ? { wrap: true } : {}) };
    const res = solveLogic(shape, { maxTier });
    const score = res.decided + (res.tier2 >= minTier2 ? n2(rows, cols) : 0);
    if (!best || score > best.score) best = { mask: tree.mask, source: tree.source, res, score };
    if (res.solved && res.tier2 >= minTier2) break;
  }
  let { mask, res } = best;
  // Klettern: mehr Netz-Schlüsse verlangen (s. climbTree). Nur die FORM der
  // Stücke zählt für die Logik — verdreht wird erst danach.
  if (res.solved && climb > 0) ({ mask, res } = climbTree({ rows, cols, wrap, source: best.source }, mask, res, rnd, climb, maxTier));
  const solRot = [], tiles = [];
  for (let i = 0; i < mask.length; i++) {
    let k = Math.floor(rnd() * 4);
    // Kein Stück darf schon richtig liegen, das sich drehen lässt (sonst wirkt das Brett halb fertig).
    if (orientations(mask[i]).length > 1 && rotMask(mask[i], k) === mask[i]) k = (k + 1) % 4;
    tiles.push(rotMask(mask[i], k));
    solRot.push((4 - k) % 4);
  }
  const p = { rows, cols, tiles, source: best.source, solRot, ...(wrap ? { wrap: true } : {}) };
  return { ...p, difficulty: opts.difficulty || null, seed, tier2: res.tier2, logic: res.solved };
}

/**
 * Klettern über Spannbäume: eine Verbindung, die noch nicht im Netz ist,
 * hinzunehmen und dafür eine andere auf dem entstehenden Kreis streichen (das
 * Netz bleibt ein Baum, kein Stück mit vier Rohren). Angenommen wird nur, was
 * der Löser weiter vollständig OHNE Raten festlegt und mindestens so viele
 * Netz-Schlüsse verlangt wie vorher. Feste Versuchszahl (deterministisch).
 */
function climbTree(base, mask, res, rnd, checks, maxTier) {
  const { rows, cols, wrap } = base, n = rows * cols;
  const nb = (i, d) => {
    let r = Math.floor(i / cols) + DR[d], c = (i % cols) + DC[d];
    if (wrap) { r = (r + rows) % rows; c = (c + cols) % cols; }
    return r < 0 || c < 0 || r >= rows || c >= cols ? -1 : r * cols + c;
  };
  for (let t = 0; t < checks; t++) {
    const i = Math.floor(rnd() * n), d = Math.floor(rnd() * 4);
    const j = nb(i, d);
    if (j < 0 || j === i || (mask[i] & BIT[d])) continue;
    if (degree(mask[i]) >= 3 || degree(mask[j]) >= 3) continue;
    // Weg i → j im Baum (Breitensuche über die Rohre).
    const prev = new Int32Array(n).fill(-1); prev[i] = i;
    const q = [i];
    for (let h = 0; h < q.length && prev[j] < 0; h++) {
      const x = q[h];
      for (let k = 0; k < 4; k++) if (mask[x] & BIT[k]) { const y = nb(x, k); if (prev[y] < 0) { prev[y] = x; q.push(y); } }
    }
    const path = [];
    for (let x = j; x !== i; x = prev[x]) path.push([prev[x], x]);
    const [a, b] = path[Math.floor(rnd() * path.length)];
    const m2 = mask.slice();
    m2[i] |= BIT[d]; m2[j] |= BIT[(d + 2) % 4];
    let da = 0;
    for (let k = 0; k < 4; k++) if ((mask[a] & BIT[k]) && nb(a, k) === b) da = k;
    m2[a] &= ~BIT[da]; m2[b] &= ~BIT[(da + 2) % 4];
    const r2 = solveLogic({ ...base, tiles: m2 }, { maxTier });
    if (r2.solved && r2.tier2 >= res.tier2) { mask = m2; res = r2; }
  }
  return { mask, res };
}
const n2 = (r, c) => r * c * 10;
