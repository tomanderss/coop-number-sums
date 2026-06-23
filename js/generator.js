// generator.js — erzeugt eindeutig & ohne Raten lösbare Number-Sums-Rätsel.
//
// Vorgehen (Sudoku-artig):
//  1. Lösungsmaske bauen (welche Zellen gehören zur Lösung / werden eingekreist).
//  2. Farbige Regionen platzieren.
//  3. Zahlenwerte vergeben (immer 1–9 — Lösungszellen + Täuschzahlen).
//  4. Zielsummen aus der Lösung berechnen.
//  5. Mensch-Lösbarkeit sicherstellen: mindestens N einstellige Summen (Außen
//     oder Cage), sonst gibt es keinen Einstiegspunkt zum Loslegen.
//  6. Mit dem logischen Solver prüfen: vollständig & nur durch erzwungene Züge
//     lösbar?  → dann ist die Lösung BEWEISBAR eindeutig und ohne Raten lösbar.

import { logicalSolve, KEEP, REMOVE, UNK } from './solver.js';
import { DIFF_BY_ID, REGION_COLORS, MAX_VAL } from './config.js';

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

// ─── Regionen-Parkettierung: unregelmäßige, BLOBartige Cages (auch über Eck),
//     die das GANZE Feld bedecken. Jede Cage hat EXAKT so viele Zellen wie die
//     Felddimension (N×N ⇒ N Cages à N Zellen).
//     Verfahren: Saatzellen verteilen → Voronoi-BFS (Blobs) → exakt auf N Zellen
//     ausbalancieren. Fällt im Notfall auf garantierte Streifen-Variante zurück.
function neighborsFn(rows, cols) {
  return (i) => {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    if (r > 0) out.push(i - cols); if (r < rows - 1) out.push(i + cols);
    if (c > 0) out.push(i - 1); if (c < cols - 1) out.push(i + 1);
    return out;
  };
}
function staysConnected(id, regId, exclude, total, neighbors) {
  let start = -1, cnt = 0;
  for (let i = 0; i < total; i++) if (id[i] === regId && i !== exclude) { cnt++; if (start < 0) start = i; }
  if (cnt === 0) return false;
  const seen = new Uint8Array(total); seen[start] = 1; const st = [start]; let v = 1;
  while (st.length) { const cur = st.pop(); for (const nb of neighbors(cur)) if (id[nb] === regId && nb !== exclude && !seen[nb]) { seen[nb] = 1; st.push(nb); v++; } }
  return v === cnt;
}

// maxCageSize: optionale Obergrenze für die Cage-Größe, UNABHÄNGIG von der
// Felddimension (siehe config.js). null/undefined ⇒ exakt das bisherige
// Verhalten (Cage-Größe = Spaltenzahl, Cage-Anzahl = Zeilenzahl) — kein
// Unterschied für sehrleicht/leicht/mittel.
function partitionRegions(rng, rows, cols, maxCageSize) {
  const total = rows * cols;
  const N = maxCageSize ? Math.min(cols, maxCageSize) : cols;
  const K = maxCageSize ? Math.max(rows, Math.ceil(total / N)) : rows;
  const neighbors = neighborsFn(rows, cols);

  const minDist = Math.max(1, Math.floor(Math.sqrt(total / K) * 0.8));
  for (let attempt = 0; attempt < 30; attempt++) {
    const id = new Int16Array(total).fill(-1);
    // Saatzellen möglichst gleichmäßig verteilen (Mindestabstand) → balancierte
    // Voronoi-Blobs, die sich leicht exakt ausbalancieren lassen.
    const seeds = [];
    let guard = 0;
    while (seeds.length < K && guard++ < total * 6) {
      const cell = Math.floor(rng() * total);
      if (id[cell] !== -1) continue;
      const cr = Math.floor(cell / cols), cc = cell % cols;
      let ok = true;
      for (const s of seeds) { if (Math.abs(Math.floor(s / cols) - cr) + Math.abs((s % cols) - cc) < minDist) { ok = false; break; } }
      if (!ok) continue;
      id[cell] = seeds.length; seeds.push(cell);
    }
    while (seeds.length < K) { const cell = Math.floor(rng() * total); if (id[cell] === -1) { id[cell] = seeds.length; seeds.push(cell); } }
    // Voronoi-BFS (Schichten gemischt → organische Ränder)
    let layer = seeds.slice();
    while (layer.length) {
      for (let i = layer.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [layer[i], layer[j]] = [layer[j], layer[i]]; }
      const nx = [];
      for (const cell of layer) for (const nb of neighbors(cell)) if (id[nb] === -1) { id[nb] = id[cell]; nx.push(nb); }
      layer = nx;
    }
    for (let i = 0; i < total; i++) if (id[i] === -1) { const nb = neighbors(i).find(n => id[n] !== -1); id[i] = nb != null ? id[nb] : 0; }

    const size = new Array(K).fill(0); for (let i = 0; i < total; i++) size[id[i]]++;
    if (rebalanceToTarget(id, size, N, total, neighbors, rng, maxCageSize)) {
      return buildRegions(id, K, rows, cols);
    }
  }
  return maxCageSize ? partitionBandsCapped(rows, cols, K) : partitionStrips(rng, rows, cols); // garantierter Notnagel
}

// Balanciert jede Cage auf genau `target` Zellen (ohne maxCageSize) bzw. auf ein
// Toleranzband [target-2, maxCageSize] (mit maxCageSize, da total/K dann meist
// nicht glatt aufgeht): verschiebt je eine Zelle entlang eines Pfads (über
// benachbarte Cages) von einer zu großen zur nächsten zu kleinen Cage. So
// funktioniert es auch, wenn groß/klein nicht direkt benachbart sind.
function rebalanceToTarget(id, size, target, total, neighbors, rng, maxCageSize) {
  const K = size.length;
  const maxSize = maxCageSize || target;
  const minSize = maxCageSize ? Math.max(3, maxCageSize - 2) : target;
  const isDone = () => size.every(s => s >= minSize && s <= maxSize);
  const regionAdj = () => {
    const adj = Array.from({ length: K }, () => new Set());
    for (let i = 0; i < total; i++) for (const nb of neighbors(i)) if (id[nb] !== id[i]) adj[id[i]].add(id[nb]);
    return adj;
  };
  for (let guard = 0; guard < total * 3; guard++) {
    if (isDone()) return true;
    const adj = regionAdj();
    // BFS im Cage-Graph von einer zu großen Cage zur nächsten mit noch freier
    // Kapazität (< maxSize, NICHT < minSize — sonst gilt jede bereits im Band
    // liegende Cage fälschlich als "voll" und der Pfad findet trotz vorhandener
    // freier Nachbarn keinen Empfänger, was beim Toleranzband fast immer in den
    // starren Notnagel-Fallback führte statt die Cages organisch zu balancieren).
    let path = null;
    for (let A = 0; A < K && !path; A++) {
      if (size[A] <= maxSize) continue;
      const prev = new Array(K).fill(-2); prev[A] = -1; const q = [A];
      while (q.length) {
        const cur = q.shift();
        if (size[cur] < maxSize) { const p = []; let x = cur; while (x !== -1) { p.push(x); x = prev[x]; } path = p.reverse(); break; }
        for (const nb of adj[cur]) if (prev[nb] === -2) { prev[nb] = cur; q.push(nb); }
      }
    }
    if (!path) return false;
    // je eine Grenzzelle entlang des Pfads weiterreichen (Zusammenhang erhalten)
    let okAll = true;
    for (let s = 0; s < path.length - 1; s++) {
      const from = path[s], to = path[s + 1];
      const cands = [];
      for (let i = 0; i < total; i++) if (id[i] === from && neighbors(i).some(n => id[n] === to)) cands.push(i);
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      let moved = false;
      for (const cell of cands) { if (staysConnected(id, from, cell, total, neighbors)) { id[cell] = to; size[from]--; size[to]++; moved = true; break; } }
      if (!moved) { okAll = false; break; }
    }
    if (!okAll) continue;
  }
  return isDone();
}

// Garantierter Notnagel für gekappte Cage-Größe: Schlangenlinie (Zeilen
// abwechselnd vor-/rückwärts) über das ganze Feld in K zusammenhängende Bänder
// à ~total/K Zellen — kein Reparatur-Loop nötig, kann nie fehlschlagen.
function partitionBandsCapped(rows, cols, K) {
  const total = rows * cols;
  const id = new Int16Array(total);
  const order = [];
  for (let r = 0; r < rows; r++) {
    const cs = []; for (let c = 0; c < cols; c++) cs.push(c);
    if (r % 2 === 1) cs.reverse(); // Schlangenlinie ⇒ Bänder bleiben zusammenhängend
    for (const c of cs) order.push(r * cols + c);
  }
  const base = Math.floor(total / K), extra = total % K;
  let pos = 0;
  for (let k = 0; k < K; k++) {
    const len = base + (k < extra ? 1 : 0);
    for (let i = 0; i < len; i++) id[order[pos++]] = k;
  }
  return buildRegions(id, K, rows, cols);
}

// Garantierte Streifen-Variante (Start = Zeilen, dann größen-/zusammenhangs-
// erhaltende Tausche). Kann nie fehlschlagen.
function partitionStrips(rng, rows, cols) {
  const total = rows * cols, K = rows;
  const neighbors = neighborsFn(rows, cols);
  const id = new Int16Array(total);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) id[r * cols + c] = r;
  for (let m = 0; m < total * 10; m++) {
    const i = Math.floor(rng() * total);
    const diff = neighbors(i).filter(n => id[n] !== id[i]);
    if (!diff.length) continue;
    const j = diff[Math.floor(rng() * diff.length)];
    const A = id[i], B = id[j];
    if (!neighbors(j).some(n => n !== i && id[n] === A)) continue;
    if (!neighbors(i).some(n => n !== j && id[n] === B)) continue;
    if (!staysConnected(id, A, i, total, neighbors) || !staysConnected(id, B, j, total, neighbors)) continue;
    id[i] = B; id[j] = A;
  }
  return buildRegions(id, K, rows, cols);
}

function buildRegions(id, K, rows, cols) {
  const regions = Array.from({ length: K }, (_, r) => ({ id: r, cells: [], colorIndex: 0, target: 0 }));
  for (let i = 0; i < id.length; i++) regions[id[i]].cells.push([Math.floor(i / cols), i % cols]);
  colorRegions(regions, id, rows, cols);
  return regions;
}

// Minimaler Winkelabstand auf dem Farbkreis (0–180°) — Farben mit kleinerem
// Abstand gelten als "zu ähnlich" und werden ebenfalls gebannt.
const HUE_SIM_THRESHOLD = 55;
function hueDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

// Färbung: benachbarte Cages verschieden UND nicht zu ähnlich im Farbton,
// dabei möglichst viele Farben nutzen (seltenste erlaubte Farbe bevorzugt).
// "Benachbart" zählt auch diagonal/über Eck (nicht nur orthogonal) — sonst
// können sich zwei nur an einer Ecke berührende Cages eine zu ähnliche Farbe
// teilen, was im Raster trotzdem leicht übersehen wird.
function colorRegions(regions, idGrid, rows, cols) {
  const k = regions.length;
  const adj = Array.from({ length: k }, () => new Set());
  const idx = (r, c) => r * cols + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = idGrid[idx(r, c)];
    if (c < cols - 1) { const b = idGrid[idx(r, c + 1)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
    if (r < rows - 1) { const b = idGrid[idx(r + 1, c)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
    if (r < rows - 1 && c < cols - 1) { const b = idGrid[idx(r + 1, c + 1)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
    if (r < rows - 1 && c > 0) { const b = idGrid[idx(r + 1, c - 1)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
  }
  const usage = new Array(REGION_COLORS.length).fill(0);
  for (let i = 0; i < k; i++) {
    const banned = new Set();
    for (const nb of adj[i]) {
      if (nb >= i) continue;
      const nbIdx = regions[nb].colorIndex;
      const nbHue = REGION_COLORS[nbIdx].h;
      for (let ci = 0; ci < REGION_COLORS.length; ci++) {
        if (hueDist(REGION_COLORS[ci].h, nbHue) < HUE_SIM_THRESHOLD) banned.add(ci);
      }
    }
    let best = -1, bestU = Infinity;
    for (let col = 0; col < REGION_COLORS.length; col++) {
      if (banned.has(col)) continue;
      if (usage[col] < bestU) { bestU = usage[col]; best = col; }
    }
    if (best === -1) { // all colors too similar — relax and just avoid exact match
      banned.clear(); // banned war vom Schwellenwert-Durchlauf bereits voll (sonst wären wir
                       // nie hier) -- ohne dieses clear() bleiben alle 10 Farben weiterhin
                       // "verboten" und best fällt unten ungeprüft auf 0 zurück, was exakt zur
                       // gemeldeten Farbkollision führte
      for (const nb of adj[i]) if (nb < i) banned.add(regions[nb].colorIndex);
      best = -1; bestU = Infinity;
      for (let col = 0; col < REGION_COLORS.length; col++) {
        if (banned.has(col)) continue;
        if (usage[col] < bestU) { bestU = usage[col]; best = col; }
      }
      if (best === -1) best = 0; // nur falls wirklich alle 10 Farben exakt von Nachbarn belegt sind
    }
    regions[i].colorIndex = best; usage[best]++;
  }
}

// ─── Werte vergeben + Zielsummen berechnen ────────────────────────────────────
// Zellwerte sind immer 1–9 (MAX_VAL), unabhängig von der Feldgröße — auch bei
// 10×10/11×11. Größere Cages liefern dadurch mehr Teilsummen-Kollisionen; das
// wird über keepRatio (config.js) und den Solver (Tier-3-Hypothese) kompensiert.
function assignValues(rng, rows, cols) {
  const values = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      values[r][c] = randInt(rng, 1, MAX_VAL);
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

// Zählt, wie viele Außen- (Reihen/Spalten) und Cage-Summen einstellig sind
// (1–9). Mindestens eine bestimmte Anzahl davon muss garantiert vorhanden
// sein — sonst hat der Spieler keinen logischen Einstiegspunkt und das Rätsel
// ist zwar technisch, aber nicht für einen Menschen zumutbar lösbar. Zusätzlich
// muss mindestens 1 davon bei den Außensummen UND mindestens 1 bei den Cages
// liegen ("verteilt über außensummen und cages", nicht alle in einer Kategorie).
function countSingleDigitSums(rowTargets, colTargets, regions) {
  let outer = 0, cage = 0;
  for (const t of rowTargets) if (t >= 1 && t <= 9) outer++;
  for (const t of colTargets) if (t >= 1 && t <= 9) outer++;
  for (const reg of regions) if (reg.target >= 1 && reg.target <= 9) cage++;
  return { total: outer + cage, outer, cage };
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────
// opts: { difficulty (id), seed?, dim? }
export function generatePuzzle(opts) {
  const diff = DIFF_BY_ID[opts.difficulty] || DIFF_BY_ID.mittel;
  const baseSeed = (opts.seed != null) ? (opts.seed >>> 0) : (Math.floor(Math.random() * 0xffffffff) >>> 0);
  const rng = makeRng(baseSeed);

  const { r: rows, c: cols } = opts.dim || diff.dim;
  const totalBudget = diff.genBudget || 2500; // harte Obergrenze, danach Notnagel-Neuversuch (leichteste Stufe)
  let attempts = 0;

  while (attempts < totalBudget) {
    attempts++;

    const mask = buildSolutionMask(rng, rows, cols, diff.keepRatio);
    const regions = partitionRegions(rng, rows, cols, diff.maxCageSize);
    // Jede Region braucht mind. eine Lösungszelle → Zielsumme ≥ 1 (kein „0"-Hinweis,
    // und keine fälschlich „fertige" Region beim Start).
    for (const reg of regions) {
      if (!reg.cells.some(([r, c]) => mask[r][c])) {
        const [r, c] = reg.cells[randInt(rng, 0, reg.cells.length - 1)];
        mask[r][c] = true;
      }
    }
    const values = assignValues(rng, rows, cols);
    const { rowTargets, colTargets } = computeTargets(rows, cols, mask, values, regions);

    const sdCounts = countSingleDigitSums(rowTargets, colTargets, regions);
    if (sdCounts.total < diff.minSingleDigitSums || sdCounts.outer < 1 || sdCounts.cage < 1) continue;

    const puzzle = {
      id: `${opts.difficulty}-${baseSeed}-${attempts}`,
      seed: baseSeed,
      difficulty: opts.difficulty,
      rows, cols, values,
      rowTargets, colTargets,
      regions: regions.map(r => ({ ...r })),
      solution: mask.map(row => row.slice()),
    };

    // Hypothesen-Deduktion (Beweis durch Widerspruch) immer erlauben: bleibt
    // „ohne Raten", erhöht aber die Lösbarkeitsrate stark — nötig, weil Cages mit
    // genau N Zellen relativ wenige Constraints liefern.
    const result = logicalSolve(puzzle, { allowHypo: true });
    if (!result.solved || result.contradiction) continue;

    // Tier-3 (Hypothese) nur begrenzt erlauben — sonst ist das Rätsel zwar
    // technisch eindeutig lösbar, praktisch aber zu stark auf Raten-artige
    // Beweisführung angewiesen (maxTier3Steps: 0 für sehrleicht/leicht/mittel,
    // kleines Kontingent für schwer/extrem/mashallah, siehe config.js).
    if (diff.maxTier3Steps != null && result.tiers.t3 > diff.maxTier3Steps) continue;

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
    puzzle.maxVal = MAX_VAL;
    puzzle.attempts = attempts;
    return puzzle;
  }

  // Notnagel: NIE auf eine andere Feldgröße/Schwierigkeit ausweichen — sonst stimmt
  // die angezeigte/erwartete Schwierigkeit (und die garantierte Mindestanzahl
  // einstelliger Summen für GENAU diese Schwierigkeit) nicht mehr. Stattdessen mit
  // frischer Zufallsfolge erneut versuchen (praktisch nie nötig, totalBudget reicht
  // fast immer; harte Notbremse nach mehreren Runden gegen einen Crash).
  const depth = (opts._depth || 0) + 1;
  if (depth > 5) return generatePuzzle({ difficulty: 'sehrleicht' });
  return generatePuzzle({ ...opts, seed: undefined, _depth: depth });
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
