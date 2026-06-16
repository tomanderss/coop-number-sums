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

// ─── Regionen platzieren (nicht überlappende Rechtecke) ───────────────────────
function placeRegions(rng, rows, cols, count) {
  const used = Array.from({ length: rows }, () => Array(cols).fill(false));
  const regions = [];
  let tries = 0;
  while (regions.length < count && tries < count * 40) {
    tries++;
    const h = randInt(rng, 2, 3), w = randInt(rng, 2, 3);
    if (h > rows || w > cols) continue;
    const r0 = randInt(rng, 0, rows - h), c0 = randInt(rng, 0, cols - w);
    let free = true;
    for (let r = r0; r < r0 + h && free; r++)
      for (let c = c0; c < c0 + w; c++) if (used[r][c]) { free = false; break; }
    if (!free) continue;
    const cells = [];
    for (let r = r0; r < r0 + h; r++)
      for (let c = c0; c < c0 + w; c++) { used[r][c] = true; cells.push([r, c]); }
    regions.push({ id: regions.length, cells, colorIndex: regions.length % REGION_COLORS.length, target: 0 });
  }
  return regions;
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
  if (n <= 6) return 0;
  if (n <= 8) return 9;
  if (n <= 10) return 13;
  if (n <= 12) return 18;
  return 24; // 13–14
}
function effParams(diff, rows, cols) {
  const n = Math.max(rows, cols);
  const area = rows * cols;
  const maxVal = Math.max(diff.maxVal, sizeFloorMaxVal(n));
  let keepRatio = diff.keepRatio;
  if (n >= 9) keepRatio = Math.max(keepRatio, 0.58); // große Felder: etwas dichter → besser lösbar
  let regionCount = Math.round(diff.regionFactor * area);
  if (diff.regionFactor > 0 && n >= 7) regionCount = Math.max(regionCount, Math.round(area / 12));
  if (n >= 9) regionCount = Math.max(regionCount, Math.round(area / 9)); // große Felder brauchen Regionen für Lösbarkeit
  regionCount = Math.min(regionCount, Math.floor(area / 4)); // nicht überfüllen
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
    const regions = placeRegions(rng, rows, cols, regionCount);
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
