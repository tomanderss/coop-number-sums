// generator.js — erzeugt Rechenkreuz-Rätsel: Layout → Werte → Lücken → Prüfung.
//
// ABLAUF
//  1. LAYOUT: Gleichungen wachsen kreuzworträtsel-artig auf dem logischen
//     Raster; jede neue Gleichung KREUZT eine bestehende (zusammenhängendes
//     Gitter). Ein Feld gehört zu höchstens einer waagerechten und einer
//     senkrechten Gleichung.
//  2. WERTE: Backtracking über die Gleichungen (Operatoren werden dabei mit
//     gewählt). Nur ganze Zahlen; negativ werden darf höchstens ein
//     ZWISCHENstand einer Kette (1 − 4 + 7), nie das Ergebnis (s. evalExpr).
//  3. LÜCKEN: Beginnend mit „alles vorgegeben" wird Feld für Feld eine Lücke
//     versucht; behalten wird sie nur, wenn das Rätsel weiterhin OHNE RATEN
//     eindeutig lösbar ist (logicalSolve). Der Vorrat besteht damit exakt aus
//     den fehlenden Zahlen.
//  4. PRÜFUNG: Mindestanteil an Lücken + Stufenlimit, sonst neuer Versuch.

import { eqIds, evalExpr, OPS } from './equations.js';
import { DIFF_BY_ID, genOptionsFor } from './difficulty.js';
import { logicalSolve } from './solver.js';
import { log } from '../../debuglog.js';

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function range(min, max) {
  const out = [];
  for (let v = min; v <= max; v++) out.push(v);
  return out;
}

// ─── 1. LAYOUT ────────────────────────────────────────────────────────────────

function eqCellList(dir, r, c, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(dir === 'h' ? [r, c + i] : [r + i, c]);
  return out;
}

/**
 * Baut ein zusammenhängendes Gleichungs-Layout.
 * @returns {{rows, cols, equations, used:Set}}
 */
export function buildLayout(rows, cols, rng, opts) {
  // Das Wachstum kann sich festfahren (Sperrfelder + Überlappungsverbot).
  // Mehrere Anläufe mit demselben RNG-Strom sind billig (<1 ms) und heben die
  // Erfolgsquote von ~30 % auf praktisch 100 %.
  for (let attempt = 0; attempt < (opts.layoutTries || 12); attempt++) {
    const l = growLayout(rows, cols, rng, opts);
    if (l) return l;
  }
  return null;
}

function growLayout(rows, cols, rng, opts) {
  const eqTarget = opts.eqTarget;
  const ternaryChance = opts.ternaryChance || 0;
  const equations = [];
  const byDir = { h: new Set(), v: new Set() }; // belegte Felder je Richtung
  const used = new Set();
  const key = (r, c) => r * cols + c;

  // TOTE ZELLEN: ein paar Felder werden vorab gesperrt. Ohne sie wächst das
  // Layout zu einem satten Block zusammen; mit ihnen entstehen die typischen
  // Löcher und ausgefransten Ränder (siehe Vorlage) — reine Optik, keine Regel.
  const blocked = new Set();
  const holeCount = Math.round(rows * cols * (opts.holeRatio ?? 0.12) * (0.4 + rng()));
  for (let i = 0; i < holeCount; i++) blocked.add(key(Math.floor(rng() * rows), Math.floor(rng() * cols)));

  const fits = (dir, r, c, n) => {
    let fresh = 0;
    for (const [rr, cc] of eqCellList(dir, r, c, n)) {
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return -1;
      if (byDir[dir].has(key(rr, cc))) return -1; // parallele Überlappung verboten
      if (blocked.has(key(rr, cc)) && !used.has(key(rr, cc))) return -1;
      if (!used.has(key(rr, cc))) fresh++;
    }
    return fresh;
  };
  const add = (dir, r, c, n) => {
    equations.push({ dir, r, c, n, ops: [] });
    for (const [rr, cc] of eqCellList(dir, r, c, n)) { byDir[dir].add(key(rr, cc)); used.add(key(rr, cc)); }
  };
  const pickN = () => (rng() < ternaryChance ? 3 : 2);

  // Startgleichung
  {
    const n = pickN();
    const dir = rng() < 0.5 ? 'h' : 'v';
    const maxR = dir === 'h' ? rows - 1 : rows - 1 - n;
    const maxC = dir === 'h' ? cols - 1 - n : cols - 1;
    if (maxR < 0 || maxC < 0) return null;
    let placed = false;
    for (let t = 0; t < 60 && !placed; t++) {
      const r = Math.floor(rng() * (maxR + 1)), c = Math.floor(rng() * (maxC + 1));
      if (fits(dir, r, c, n) < 0) continue;
      add(dir, r, c, n); placed = true;
    }
    if (!placed) return null;
  }

  // Wachstum: ALLE gültigen kreuzenden Platzierungen sammeln und bevorzugt
  // jene nehmen, die viel Neuland erschließen — sonst schwankt die Dichte des
  // Bretts stark (mal 18, mal 36 Felder bei gleicher Vorgabe).
  while (equations.length < eqTarget) {
    const cands = [];
    for (const id of used) {
      const cr = Math.floor(id / cols), cc0 = id % cols;
      for (const dir of ['h', 'v']) {
        for (const n of ternaryChance > 0 ? [2, 3] : [2]) {
          if (n === 3 && rng() > ternaryChance * 2) continue;
          for (let off = 0; off <= n; off++) {
            const r = dir === 'v' ? cr - off : cr;
            const c = dir === 'h' ? cc0 - off : cc0;
            const fresh = fits(dir, r, c, n);
            if (fresh < 1) continue;
            cands.push({ dir, r, c, n, fresh });
          }
        }
      }
    }
    if (!cands.length) break;
    // Meistens „viel Neuland" (kompaktes Wachstum), manchmal bewusst eine
    // sparsame Platzierung — das erzeugt Ausläufer und Buchten statt Blöcke.
    cands.sort((a, b) => b.fresh - a.fresh);
    const greedy = rng() > (opts.wanderChance ?? 0.3);
    const top = greedy
      ? cands.slice(0, Math.max(1, Math.ceil(cands.length * 0.35)))
      : cands.slice(-Math.max(1, Math.ceil(cands.length * 0.35)));
    const pick = top[Math.floor(rng() * top.length)];
    add(pick.dir, pick.r, pick.c, pick.n);
  }
  if (equations.length < Math.max(2, Math.floor(eqTarget * 0.75))) return null;
  if (opts.minSlots && used.size < opts.minSlots) return null;

  return { rows, cols, equations, used };
}

// ─── 2. WERTE ─────────────────────────────────────────────────────────────────

function opCombos(n, allowed, rng) {
  if (n === 2) return shuffle(allowed.map(o => [o]), rng);
  const out = [];
  for (const a of allowed) for (const b of allowed) out.push([a, b]);
  return shuffle(out, rng).slice(0, 8);
}

// Wie oft kommt jeder Wert schon auf dem Brett vor? Basis der Vielfalt:
// ohne diese Gewichtung landete immer wieder dieselbe kleine Zahlenmenge auf
// dem Brett (gemeldet: „viel zu viele 1en, dieselbe Rechnung zehnmal").
function valueFreq(values) {
  const m = new Map();
  for (const v of values) if (v != null) m.set(v, (m.get(v) || 0) + 1);
  return m;
}
// Entartete Rechnungen, die nichts zu denken geben: ×1, ÷1, x÷x.
function trivialTerm(a, op, b) {
  if (op === '*') return a === 1 || b === 1;
  if (op === '/') return b === 1 || a === b;
  return false;
}
function completions(eq, ops, ids, values, opts, rng, limit) {
  const known = ids.map(id => values[id]);
  const unk = [];
  for (let i = 0; i < eq.n; i++) if (known[i] == null) unk.push(i);
  const vals = known.slice();
  const out = [];
  // Seltene Werte zuerst: erst mischen, dann STABIL nach Häufigkeit sortieren —
  // gleich häufige Werte bleiben damit zufällig geordnet.
  const freq = valueFreq(values);
  const pool = shuffle(range(opts.minOperand, opts.maxOperand), rng)
    .sort((a, b) => (freq.get(a) || 0) - (freq.get(b) || 0));

  const leaf = () => {
    for (let i = 0; i < ops.length; i++) if (trivialTerm(vals[i], ops[i], vals[i + 1])) return;
    const res = evalExpr(vals.slice(0, eq.n), ops);
    if (res == null || res < opts.minResult || res > opts.maxResult) return;
    if (known[eq.n] != null) { if (res !== known[eq.n]) return; }
    else vals[eq.n] = res;
    out.push(vals.slice());
    if (known[eq.n] == null) vals[eq.n] = null;
  };
  const rec = (k) => {
    if (out.length >= limit) return;
    if (k === unk.length) { leaf(); return; }
    const pos = unk[k];
    for (const v of pool) {
      vals[pos] = v;
      rec(k + 1);
      if (out.length >= limit) break;
    }
    vals[pos] = null;
  };
  rec(0);
  // Die „frischesten" Belegungen zuerst: Kosten = wie oft die NEUEN Werte
  // (Operanden UND Ergebnis) schon auf dem Brett stehen. Ohne das wiederholten
  // sich vor allem die Ergebnisse, weil sie nicht frei gewählt, sondern
  // gerechnet werden.
  const cost = (tuple) => tuple.reduce((sum, v, i) => sum + (known[i] == null ? (freq.get(v) || 0) : 0), 0);
  return out.map((t, i) => ({ t, i, c: cost(t) })).sort((a, b) => a.c - b.c || a.i - b.i).map(x => x.t);
}

// Signatur einer fertigen Rechnung („12+7=19"), damit dieselbe Aufgabe nicht
// mehrfach auf demselben Brett steht.
function termSignature(tuple, ops) {
  const parts = [tuple[0]];
  for (let i = 0; i < ops.length; i++) parts.push(ops[i], tuple[i + 1]);
  parts.push('=', tuple[tuple.length - 1]);
  return parts.join(' ');
}

export function assignValues(layout, rng, opts) {
  const { cols, equations } = layout;
  const values = new Array(layout.rows * layout.cols).fill(null);
  const done = new Set();
  const usedTerms = new Set();
  let nodes = 0;

  // MRV („fail first"): Immer die Gleichung mit den WENIGSTEN offenen Feldern
  // als Nächstes belegen. Vollständig durch Kreuzungen festgelegte Gleichungen
  // werden dadurch SOFORT geprüft statt erst am Ende — ohne das lief die
  // Suche bei dichten Layouts minutenlang in Sackgassen (gemessen: 2,7 s
  // Wertesuche je Rätsel, 5 von 6 Versuchen ohne Ergebnis).
  const rec = () => {
    if (++nodes > (opts.valueNodes || 40000)) return false;
    let best = null, bestUnk = Infinity;
    for (const eq of equations) {
      if (done.has(eq)) continue;
      let unk = 0;
      for (const id of eqIds(eq, cols)) if (values[id] == null) unk++;
      if (unk < bestUnk) { best = eq; bestUnk = unk; if (unk === 0) break; }
    }
    if (!best) return true;
    const ids = eqIds(best, cols);
    done.add(best);
    for (const ops of opCombos(best.n, opts.ops, rng)) {
      const cands = completions(best, ops, ids, values, opts, rng, opts.candLimit || 40);
      for (const tuple of cands) {
        const sig = termSignature(tuple, ops);
        if (usedTerms.has(sig)) continue;   // dieselbe Rechnung nie zweimal
        const changed = [];
        for (let i = 0; i < ids.length; i++) {
          if (values[ids[i]] == null) { values[ids[i]] = tuple[i]; changed.push(ids[i]); }
        }
        best.ops = ops.slice();
        usedTerms.add(sig);
        if (rec()) return true;
        usedTerms.delete(sig);
        for (const id of changed) values[id] = null;
      }
    }
    done.delete(best);
    return false;
  };
  return rec() ? values : null;
}

// ─── 3. LÜCKEN ────────────────────────────────────────────────────────────────

function buildPuzzle(layout, values, blanks) {
  const { rows, cols, equations, used } = layout;
  const slots = [];
  const tray = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      if (!used.has(id)) { row.push(null); continue; }
      const given = !blanks.has(id);
      if (!given) tray.push(values[id]);
      row.push({ v: values[id], given });
    }
    slots.push(row);
  }
  return { rows, cols, slots, equations, tray };
}

export function carveBlanks(layout, values, rng, opts) {
  const ids = shuffle([...layout.used], rng);
  // Zielanteil an Lücken: der Rest bleibt als Anker vorgegeben. Ohne Deckel
  // würde die Gier-Schleife praktisch ALLES aufdecken (~90 %) — das Brett sähe
  // leer aus und der Vorrat wäre riesig.
  const maxBlanks = opts.blankRatio ? Math.round(layout.used.size * opts.blankRatio) : 0;
  const blanks = new Set();
  let solved = null;
  for (const id of ids) {
    blanks.add(id);
    const p = buildPuzzle(layout, values, blanks);
    p.tray = shuffle(p.tray, rng);
    const res = logicalSolve(p, { maxTier: opts.maxTier });
    if (res.solved) solved = res;
    else blanks.delete(id);
    if (maxBlanks && blanks.size >= maxBlanks) break;
  }
  return { blanks, solved };
}

// ─── 4. HAUPT-EINSTIEG ────────────────────────────────────────────────────────

export const DEFAULT_OPTS = {
  rows: 5, cols: 5, eqTarget: 8, ternaryChance: 0,
  ops: ['+', '-'], minOperand: 1, maxOperand: 12, minResult: 1, maxResult: 99,
  holeRatio: 0.12, wanderChance: 0.3,
  maxTier: 3, blankRatio: 0.6, minBlankRatio: 0.45, tries: 60,
};

/**
 * Erzeugt ein Rätsel. Wird nur eine `difficulty` übergeben, kommen Raster,
 * Rechenarten, Zahlenraum usw. aus config.js — jeder Aufrufer (Solo, Endlos,
 * Coop-INIT, Race/Team-Seed, Verlaufs-Endbrett) bekommt damit garantiert
 * dieselben Vorgaben, ohne sie einzeln durchreichen zu müssen.
 */
export function generatePuzzle(options = {}) {
  const preset = options.difficulty && DIFF_BY_ID[options.difficulty]
    ? genOptionsFor(options.difficulty, { bigNumbers: !!options.bigNumbers })
    : {};
  const opts = { ...DEFAULT_OPTS, ...preset, ...options };
  if (opts.ops.some(o => !OPS.includes(o))) throw new Error('unbekannter Operator');
  const t0 = Date.now();
  let seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;

  for (let attempt = 0; attempt < opts.tries; attempt++) {
    const rng = mulberry32((seed + attempt * 7919) >>> 0);
    const layout = buildLayout(opts.rows, opts.cols, rng, opts);
    if (!layout) continue;
    const values = assignValues(layout, rng, opts);
    if (!values) continue;
    const { blanks } = carveBlanks(layout, values, rng, opts);
    if (blanks.size < Math.ceil(layout.used.size * opts.minBlankRatio)) continue;

    const puzzle = buildPuzzle(layout, values, blanks);
    puzzle.tray = shuffle(puzzle.tray, rng).slice();
    const check = logicalSolve(puzzle, { maxTier: opts.maxTier });
    if (!check.solved) continue;

    puzzle.seed = seed + attempt * 7919;
    puzzle.difficulty = opts.difficulty || null;
    puzzle.bigNumbers = !!opts.bigNumbers;
    puzzle.maxTier = check.maxTier;
    puzzle.tierCounts = check.tierCounts;
    puzzle.blankCount = blanks.size;
    puzzle.slotCount = layout.used.size;
    puzzle.genMs = Date.now() - t0;
    puzzle.attempts = attempt + 1;
    return puzzle;
  }
  log('game', 'Generierung fehlgeschlagen', { difficulty: opts.difficulty, tries: opts.tries, tookMs: Date.now() - t0 });
  return null;
}
