// generator.js — erzeugt eindeutig & ohne Raten lösbare Number-Sums-Rätsel.
//
// Vorgehen (Sudoku-artig):
//  1. Lösungsmaske bauen (welche Zellen gehören zur Lösung / werden eingekreist).
//  2. Farbige Regionen platzieren (ab Schwierigkeit Mittel).
//  3. Zahlenwerte vergeben (Lösungszellen + Täuschzahlen).
//  4. Zielsummen aus der Lösung berechnen.
//  5. Mit dem logischen Solver prüfen: vollständig & nur durch erzwungene Züge
//     lösbar?  → dann ist die Lösung BEWEISBAR eindeutig und ohne Raten lösbar.
//  6. Schwierigkeit anhand der nötigen Deduktionsstufe einordnen; passt sie nicht,
//     neu versuchen.

import { logicalSolve, KEEP, REMOVE, UNK } from './solver.js';
import { DIFF_BY_ID, SIZE_BY_ID, REGION_COLORS } from './config.js';

// ─── Seedbarer Zufall (mulberry32) ────────────────────────────────────────────
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ─── Lösungsmaske ─────────────────────────────────────────────────────────────
function buildSolutionMask(rng, rows, cols, keepRatio) {
  const mask = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => rng() < keepRatio));

  // Entartete Zeilen/Spalten vermeiden: nicht alle behalten, nicht alle entfernt.
  const fixLine = (getCell, setCell, len) => {
    let kept = 0; for (let i = 0; i < len; i++) if (getCell(i)) kept++;
    if (kept === 0) setCell(randInt(rng, 0, len - 1), true);          // mind. 1 behalten
    else if (kept === len) setCell(randInt(rng, 0, len - 1), false);  // mind. 1 entfernen
  };
  for (let r = 0; r < rows; r++)
    fixLine(c => mask[r][c], (c, v) => mask[r][c] = v, cols);
  for (let c = 0; c < cols; c++)
    fixLine(r => mask[r][c], (r, v) => mask[r][c] = v, rows);
  return mask;
}

// ─── Regionen-Parkettierung: unregelmäßige Polyominoes, die das GANZE Feld
//     bedecken (wie im echten Spiel; auch L-/eckige Formen). Jede Zelle gehört
//     zu genau einer Region.
const MIN_CAGE = 6; // Mindestgröße einer farbigen Region (Cage)

function partitionRegions(rng, rows, cols, targetCount) {
  const total = rows * cols;
  // Nicht mehr Regionen als bei Mindestgröße möglich
  const k = Math.max(1, Math.min(targetCount, Math.floor(total / MIN_CAGE) || 1));
  const id = new Int16Array(total).fill(-1);
  const neighbors = (i) => {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    if (r > 0) out.push(i - cols); if (r < rows - 1) out.push(i + cols);
    if (c > 0) out.push(i - 1); if (c < cols - 1) out.push(i + 1);
    return out;
  };

  // k verschiedene Saatzellen wählen
  const pool = Array.from({ length: total }, (_, i) => i);
  const seeds = [];
  for (let s = 0; s < k; s++) { const j = Math.floor(rng() * pool.length); seeds.push(pool[j]); pool.splice(j, 1); }

  // Mehrquellen-BFS (jede Zelle zur nächstgelegenen Saat): kompakte, ausgewogene
  // Cages gleicher Größe. Jede Schicht wird gemischt → organische, eckige Ränder.
  seeds.forEach((cell, region) => { id[cell] = region; });
  let layer = seeds.slice();
  while (layer.length) {
    for (let i = layer.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [layer[i], layer[j]] = [layer[j], layer[i]]; }
    const nextLayer = [];
    for (const cell of layer) for (const nb of neighbors(cell)) if (id[nb] === -1) { id[nb] = id[cell]; nextLayer.push(nb); }
    layer = nextLayer;
  }
  for (let i = 0; i < total; i++) if (id[i] === -1) { const nb = neighbors(i).find(n => id[n] !== -1); id[i] = nb != null ? id[nb] : 0; }

  // ── Zu kleine Cages mit Nachbarn verschmelzen, bis alle ≥ MIN_CAGE ──────────
  mergeSmallCages(id, total, neighbors);

  // IDs lückenlos neu nummerieren
  const map = new Map(); let next = 0;
  for (let i = 0; i < total; i++) { if (!map.has(id[i])) map.set(id[i], next++); id[i] = map.get(id[i]); }
  const regions = Array.from({ length: next }, (_, r2) => ({ id: r2, cells: [], colorIndex: 0, target: 0 }));
  for (let i = 0; i < total; i++) regions[id[i]].cells.push([Math.floor(i / cols), i % cols]);
  colorRegions(regions, id, rows, cols);
  return regions;
}

// Verschmilzt jede Region < MIN_CAGE in die KLEINSTE benachbarte Region
// (so wachsen zwei kleine zu einer ≥6 zusammen, statt alles in eine große zu kippen).
function mergeSmallCages(id, total, neighbors) {
  const sizes = () => { const m = new Map(); for (let i = 0; i < total; i++) m.set(id[i], (m.get(id[i]) || 0) + 1); return m; };
  for (let guard = 0; guard < total; guard++) {
    const sz = sizes();
    if (sz.size <= 1) break;
    // kleinste Region unter MIN_CAGE finden
    let small = null, smallSz = Infinity;
    for (const [rid, s] of sz) if (s < MIN_CAGE && s < smallSz) { smallSz = s; small = rid; }
    if (small === null) break; // alle groß genug
    // kleinste benachbarte Region als Ziel
    let target = null, tSz = Infinity;
    for (let i = 0; i < total; i++) if (id[i] === small) {
      for (const nb of neighbors(i)) { const nr = id[nb]; if (nr !== small) { const s = sz.get(nr); if (s < tSz) { tSz = s; target = nr; } } }
    }
    if (target === null) break;
    for (let i = 0; i < total; i++) if (id[i] === small) id[i] = target;
  }
}

// Greedy-Färbung, damit benachbarte Regionen verschiedene Farben haben.
function colorRegions(regions, idGrid, rows, cols) {
  const k = regions.length;
  const adj = Array.from({ length: k }, () => new Set());
  const idx = (r, c) => r * cols + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = idGrid[idx(r, c)];
    if (c < cols - 1) { const b = idGrid[idx(r, c + 1)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
    if (r < rows - 1) { const b = idGrid[idx(r + 1, c)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
  }
  for (let i = 0; i < k; i++) {
    const banned = new Set();
    for (const nb of adj[i]) if (nb < i) banned.add(regions[nb].colorIndex);
    let col = 0; while (banned.has(col) && col < REGION_COLORS.length) col++;
    regions[i].colorIndex = col % REGION_COLORS.length;
  }
}

// ─── Werte vergeben + Zielsummen berechnen ────────────────────────────────────
function assignValues(rng, rows, cols, mask, maxVal) {
  const values = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      values[r][c] = randInt(rng, 1, maxVal);
  return values;
}
function computeTargets(rows, cols, mask, values, regions) {
  const rowTargets = Array(rows).fill(0);
  const colTargets = Array(cols).fill(0);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (mask[r][c]) { rowTargets[r] += values[r][c]; colTargets[c] += values[r][c]; }
  for (const reg of regions) {
    reg.target = reg.cells.reduce((s, [r, c]) => s + (mask[r][c] ? values[r][c] : 0), 0);
  }
  return { rowTargets, colTargets };
}

// ─── Effektive Parameter (skalieren mit der Feldgröße) ────────────────────────
// Große Felder mit kleinen Zahlen sind kaum eindeutig & ohne Raten lösbar
// (zu viele Teilsummen-Kollisionen). Daher wächst der Zahlenbereich mit der
// Kantenlänge — die "Extrem"/"Unendlichkeit"-Stufen nutzen also größere Zahlen.
function sizeFloorMaxVal(n) {
  if (n <= 10) return 0;   // bis 10×10: authentische kleine Zahlen (≤9)
  if (n <= 12) return 12;
  return 15;               // 13–14: moderat größere Zahlen
}
function effParams(diff, rows, cols) {
  const n = Math.max(rows, cols);
  const area = rows * cols;
  const maxVal = Math.max(diff.maxVal, sizeFloorMaxVal(n));
  let keepRatio = diff.keepRatio;
  if (n >= 9) keepRatio = Math.max(keepRatio, 0.58); // große Felder: etwas dichter → besser lösbar
  // Regionen bedecken das ganze Feld; Anzahl ≈ Fläche / mittlere Regionsgröße.
  const regionCount = Math.max(2, Math.round(area / diff.regionAvg));
  return { maxVal, keepRatio, regionCount };
}

// ─── Schwierigkeits-Bewertung ─────────────────────────────────────────────────
// Wir akzeptieren jedes vollständig & ohne Raten lösbare (⇒ eindeutige) Rätsel.
// Die gefühlte Schwierigkeit steuern wir über die Parameter-Tabelle in config.js
// (Zahlenbereich, Regionen, Decoy-Dichte, Leben, Hinweise) sowie die Feldgröße —
// das ist intuitiver als die solver-interne Deduktionsstufe und blitzschnell.
function gradeMatches(diff, result) {
  return result.solved && !result.contradiction;
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────
// opts: { size (id), difficulty (id), seed?, dim? }
export function generatePuzzle(opts) {
  const sizeTier = SIZE_BY_ID[opts.size] || SIZE_BY_ID.mittel;
  const diff = DIFF_BY_ID[opts.difficulty] || DIFF_BY_ID.mittel;
  const baseSeed = (opts.seed != null) ? (opts.seed >>> 0) : (Math.floor(Math.random() * 0xffffffff) >>> 0);
  const rng = makeRng(baseSeed);

  // Dimensionen: vorgegeben oder zufällig aus der Stufe
  const dims = sizeTier.dims.slice();
  let dim = opts.dim || pick(rng, dims);

  const softBudget = 250;   // ab hier nimm das erste lösbare Rätsel, auch wenn Stufe nicht exakt passt
  const totalBudget = 2500; // harte Obergrenze
  let attempts = 0;
  let firstSolved = null;   // erstes garantiert eindeutiges/lösbares Rätsel als Rückfalloption

  while (attempts < totalBudget) {
    attempts++;
    const { r: rows, c: cols } = dim;
    const { maxVal, keepRatio, regionCount } = effParams(diff, rows, cols);

    const mask = buildSolutionMask(rng, rows, cols, keepRatio);
    const regions = partitionRegions(rng, rows, cols, regionCount);
    // Jede Region braucht mind. eine Lösungszelle → Zielsumme ≥ 1 (kein „0"-Hinweis,
    // und keine fälschlich „fertige" Region beim Start).
    for (const reg of regions) {
      if (!reg.cells.some(([r, c]) => mask[r][c])) {
        const [r, c] = reg.cells[randInt(rng, 0, reg.cells.length - 1)];
        mask[r][c] = true;
      }
    }
    const values = assignValues(rng, rows, cols, mask, maxVal);
    const { rowTargets, colTargets } = computeTargets(rows, cols, mask, values, regions);

    const puzzle = {
      id: `${opts.size}-${opts.difficulty}-${baseSeed}-${attempts}`,
      seed: baseSeed,
      size: opts.size,
      difficulty: opts.difficulty,
      rows, cols, values,
      rowTargets, colTargets,
      regions: regions.map(r => ({ ...r })),
      solution: mask.map(row => row.slice()),
    };

    const result = logicalSolve(puzzle, { allowHypo: diff.allowHypo });
    if (!result.solved || result.contradiction) continue;

    // Sicherheit: die erzwungene (eindeutige) Lösung muss mit der vorgesehenen
    // übereinstimmen — sonst Bug/Inkonsistenz, verwerfen.
    let consistent = true;
    for (let r = 0; r < rows && consistent; r++)
      for (let c = 0; c < cols; c++) {
        const want = mask[r][c] ? KEEP : REMOVE;
        if (result.mark[r * cols + c] !== want) { consistent = false; break; }
      }
    if (!consistent) continue;

    puzzle.maxTier = result.maxTier;
    puzzle.tiers = result.tiers;
    puzzle.maxVal = maxVal;
    if (!firstSolved) firstSolved = puzzle;

    if (gradeMatches(diff, result)) { puzzle.attempts = attempts; return puzzle; }

    // Stufe passt (noch) nicht: nach dem Soft-Budget das erste lösbare nehmen,
    // damit die Generierung nie spürbar hängt.
    if (attempts >= softBudget && firstSolved) { firstSolved.attempts = attempts; return firstSolved; }

    // Bei sehr großen Feldern ggf. eine kleinere Dimension der Stufe probieren.
    if (attempts % 500 === 0 && dims.length > 1) dim = dims[0];
  }

  if (firstSolved) return firstSolved;
  // Allerletzter Notnagel: einfaches, garantiert lösbares Mini-Rätsel
  return generatePuzzle({ size: 'klein', difficulty: 'leicht', dim: { r: 4, c: 4 } });
}

// ─── Hilfen für die UI ────────────────────────────────────────────────────────
// Liefert für einen Hinweis eine "sichere" Zelle (KEEP oder REMOVE), die der
// Spieler noch nicht korrekt markiert hat — bevorzugt eine logisch erzwungene.
export function findHintCell(puzzle, marks) {
  const { rows, cols, solution } = puzzle;
  const candidates = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const want = solution[r][c] ? 'kept' : 'removed';
      if (marks[r][c] !== want) candidates.push({ r, c, want });
    }
  if (candidates.length === 0) return null;
  // Bevorzuge Lösungszellen (KEEP), die noch nicht eingekreist sind.
  const keeps = candidates.filter(x => x.want === 'kept');
  const pool = keeps.length ? keeps : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}
