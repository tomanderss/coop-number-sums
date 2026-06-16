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

function partitionRegions(rng, rows, cols) {
  const total = rows * cols, N = cols, K = rows;
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
    if (rebalanceToTarget(id, size, N, total, neighbors, rng)) {
      return buildRegions(id, K, rows, cols);
    }
  }
  return partitionStrips(rng, rows, cols); // garantierter Notnagel
}

// Balanciert jede Cage auf genau `target` Zellen: verschiebt je eine Zelle entlang
// eines Pfads (über benachbarte Cages) von einer zu großen zur nächsten zu kleinen
// Cage. So funktioniert es auch, wenn groß/klein nicht direkt benachbart sind.
function rebalanceToTarget(id, size, target, total, neighbors, rng) {
  const K = size.length;
  const regionAdj = () => {
    const adj = Array.from({ length: K }, () => new Set());
    for (let i = 0; i < total; i++) for (const nb of neighbors(i)) if (id[nb] !== id[i]) adj[id[i]].add(id[nb]);
    return adj;
  };
  for (let guard = 0; guard < total * 3; guard++) {
    if (size.every(s => s === target)) return true;
    const adj = regionAdj();
    // BFS im Cage-Graph von einer zu großen Cage zur nächsten zu kleinen
    let path = null;
    for (let A = 0; A < K && !path; A++) {
      if (size[A] <= target) continue;
      const prev = new Array(K).fill(-2); prev[A] = -1; const q = [A];
      while (q.length) {
        const cur = q.shift();
        if (size[cur] < target) { const p = []; let x = cur; while (x !== -1) { p.push(x); x = prev[x]; } path = p.reverse(); break; }
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
  return size.every(s => s === target);
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

// Färbung: benachbarte Cages verschieden, dabei möglichst viele Farben nutzen
// (jeweils die am seltensten verwendete erlaubte Farbe).
function colorRegions(regions, idGrid, rows, cols) {
  const k = regions.length;
  const adj = Array.from({ length: k }, () => new Set());
  const idx = (r, c) => r * cols + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = idGrid[idx(r, c)];
    if (c < cols - 1) { const b = idGrid[idx(r, c + 1)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
    if (r < rows - 1) { const b = idGrid[idx(r + 1, c)]; if (b !== a) { adj[a].add(b); adj[b].add(a); } }
  }
  const usage = new Array(REGION_COLORS.length).fill(0);
  for (let i = 0; i < k; i++) {
    const banned = new Set();
    for (const nb of adj[i]) if (nb < i) banned.add(regions[nb].colorIndex);
    let best = 0, bestU = Infinity;
    for (let col = 0; col < REGION_COLORS.length; col++) {
      if (banned.has(col)) continue;
      if (usage[col] < bestU) { bestU = usage[col]; best = col; }
    }
    regions[i].colorIndex = best; usage[best]++;
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
// Wenige große Cages (= Felddimension) liefern relativ wenige Constraints, daher
// wächst der Zahlenbereich mit der Kantenlänge stark, damit die Rätsel eindeutig
// & ohne Raten lösbar bleiben.
function sizeFloorMaxVal(n) {
  if (n <= 8) return 0;    // bis 8×8: authentische kleine Zahlen (≤9)
  if (n <= 10) return 14;
  if (n <= 11) return 32;
  return 45;               // 12×12
}
function effParams(diff, rows, cols) {
  const n = Math.max(rows, cols);
  const maxVal = Math.max(diff.maxVal, sizeFloorMaxVal(n));
  let keepRatio = diff.keepRatio;
  if (n >= 9) keepRatio = Math.max(keepRatio, 0.62); // große Felder: dichter → deutlich besser lösbar
  return { maxVal, keepRatio };
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
    const { maxVal, keepRatio } = effParams(diff, rows, cols);

    const mask = buildSolutionMask(rng, rows, cols, keepRatio);
    const regions = partitionRegions(rng, rows, cols);
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

    // Hypothesen-Deduktion (Beweis durch Widerspruch) immer erlauben: bleibt
    // „ohne Raten", erhöht aber die Lösbarkeitsrate stark — nötig, weil Cages mit
    // genau N Zellen relativ wenige Constraints liefern.
    const result = logicalSolve(puzzle, { allowHypo: true });
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
