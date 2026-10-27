// solver.js — Deduktions-Maschine für das Rechenkreuz.
//
// Der Solver arbeitet auf dem Modell aus model.js: bekannte Felder (Vorgaben)
// + eine MULTIMENGE übriger Zahlen (der Vorrat). Er nutzt ausschließlich
// ERZWUNGENE Schlüsse — nie Ausprobieren. Bleibt er stecken, gilt das Rätsel
// als „nicht ratefrei lösbar" und wird vom Generator verworfen.
//
// STUFEN
//  T1  (direkt)      Eine Gleichung hat genau EINE Lücke → Wert ausrechnen.
//  T2  (Kombination) Eine Gleichung hat mehrere Lücken, aber der Vorrat lässt
//                    nur EINE Belegung zu (bzw. für ein Feld nur einen Wert).
//  T2.5 (Kreuzung)   Ein Feld gehört zu waagerechter UND senkrechter Gleichung;
//                    der Schnitt beider Kandidatenmengen ist einelementig.
//  T3  (Vorrat)      Ein Wert kommt k-mal im Vorrat vor und passt in genau k
//                    Felder → alle k sind erzwungen (Zählargument).
//
// Alle Stufen sind logisch zwingend und einem Menschen erklärbar (siehe
// hinttutor.js). Kein Schritt ist eine Hypothese.

import { eqIds, evalExpr, countMap, blankIds, givenValues, equationHolds } from './equations.js';

export const TIER = { DIRECT: 1, COMBO: 2, CROSS: 2.5, POOL: 3 };
// Firebase-sichere Schlüssel für die Tier-Statistik (s. tierCounts unten): die
// RTDB verbietet '.' in Schlüsseln, '2.5' wäre also ein harter Schreibfehler.
export const TIER_KEY = { 1: 't1', 2: 't2', 2.5: 't25', 3: 't3' };

// Sicherheitsnetz: Wird eine Gleichung mit sehr vielen möglichen Belegungen
// aufgezählt, brechen wir ab und LEITEN DARAUS NICHTS AB (eine abgeschnittene
// Kandidatenmenge wäre unvollständig und damit unsicher).
const ENUM_LIMIT = 40000;

/**
 * Ausgangslage des Solvers. Ohne Argumente = frisches Rätsel (nur Vorgaben,
 * voller Vorrat). Mit `from` = der LAUFENDE Spielstand (bereits gelegte Steine
 * + Rest-Vorrat) — so kann der Tipp-Tutor mitten in der Partie den nächsten
 * erzwungenen Schritt bestimmen.
 */
export function createSolveState(puzzle, from = null) {
  if (from) {
    const unknown = new Set();
    for (const id of blankIds(puzzle)) if (from.values[id] == null) unknown.add(id);
    return { values: from.values.slice(), pool: countMap(from.pool), unknown, cols: puzzle.cols };
  }
  return {
    values: givenValues(puzzle),
    pool: countMap(puzzle.tray),
    unknown: new Set(blankIds(puzzle)),
    cols: puzzle.cols,
  };
}

function poolLeft(pool, v, used) { return (pool.get(v) || 0) - (used.get(v) || 0); }

/**
 * Zählt alle Belegungen der Lücken EINER Gleichung, die mit dem Vorrat möglich
 * sind. Liefert Kandidatenmengen je Lücke + die einzige Belegung, falls es nur
 * eine gibt.
 */
export function enumEquation(eq, st) {
  const ids = eqIds(eq, st.cols);
  const known = ids.map(id => st.values[id]);
  const unkPos = [];
  for (let i = 0; i < ids.length; i++) if (known[i] == null) unkPos.push(i);
  if (!unkPos.length) return null;

  const operandUnk = unkPos.filter(i => i < eq.n);
  const resUnknown = known[eq.n] == null;
  const distinct = [...st.pool.keys()].sort((a, b) => a - b);
  const cand = ids.map(() => null);
  for (const i of unkPos) cand[i] = new Set();
  const vals = known.slice();
  const used = new Map();
  let total = 0, first = null, aborted = false;

  const rec = (k) => {
    if (aborted) return;
    if (k === operandUnk.length) {
      const res = evalExpr(vals.slice(0, eq.n), eq.ops);
      if (res == null) return;
      if (resUnknown) {
        if (poolLeft(st.pool, res, used) <= 0) return;
        vals[eq.n] = res;
      } else if (res !== known[eq.n]) return;
      total++;
      if (total === 1) first = vals.slice();
      if (total > ENUM_LIMIT) { aborted = true; return; }
      for (const i of unkPos) cand[i].add(vals[i]);
      return;
    }
    const pos = operandUnk[k];
    for (const v of distinct) {
      if (poolLeft(st.pool, v, used) <= 0) continue;
      used.set(v, (used.get(v) || 0) + 1);
      vals[pos] = v;
      rec(k + 1);
      used.set(v, used.get(v) - 1);
      if (aborted) break;
    }
    vals[pos] = null;
  };
  rec(0);
  return { ids, unkPos, cand, total, first, aborted, eq };
}

function assign(st, id, v) {
  st.values[id] = v;
  st.unknown.delete(id);
  const left = (st.pool.get(v) || 0) - 1;
  if (left <= 0) st.pool.delete(v); else st.pool.set(v, left);
}

function intersect(a, b) {
  const out = new Set();
  for (const v of a) if (b.has(v)) out.add(v);
  return out;
}

/**
 * Löst so weit wie möglich mit erzwungenen Schritten.
 * @returns {{solved, contradiction, steps, values, maxTier, tierCounts}}
 */
export function logicalSolve(puzzle, opts = {}) {
  const maxTier = opts.maxTier ?? 3;
  const st = createSolveState(puzzle, opts.from || null);
  const steps = [];
  // Schlüssel BEWUSST ohne Punkt ('t25' statt '2.5'): tierCounts hängt am Rätsel,
  // das Rätsel reist über die Firebase-RTDB (Cloud-Snapshot, Cloud-Session,
  // Coop-INIT) — und die RTDB verbietet '.' in Schlüsseln und weist den GESAMTEN
  // Schreibvorgang zurück. Genau daran scheiterte jeder Upload, sobald ein
  // Rätsel im Snapshot lag: syncedRev blieb null, jeder Start galt als
  // Erstkontakt (Spielstand-Dialog in Endlosschleife), und das Coop-INIT wurde
  // nie geschrieben (der Beitretende sah die Bereit-Lobby nie).
  const tierCounts = { t1: 0, t2: 0, t25: 0, t3: 0 };
  let maxUsed = 0;

  const record = (tier, cells, values, eq) => {
    tierCounts[TIER_KEY[tier]]++;
    if (tier > maxUsed) maxUsed = tier;
    steps.push({ tier, cells, values, eq: eq ? { dir: eq.dir, r: eq.r, c: eq.c, n: eq.n, ops: eq.ops.slice() } : null });
  };
  const toRC = id => [Math.floor(id / puzzle.cols), id % puzzle.cols];

  let guard = 0;
  while (st.unknown.size) {
    if (++guard > 20000) break;
    let progressed = false;
    const candBySlot = new Map();

    for (const eq of puzzle.equations) {
      const r = enumEquation(eq, st);
      if (!r) continue;
      if (r.aborted) continue;
      if (r.total === 0) return { solved: false, contradiction: true, steps, values: st.values, maxTier: maxUsed, tierCounts };
      if (r.total === 1) {
        const tier = r.unkPos.length === 1 ? TIER.DIRECT : TIER.COMBO;
        if (tier > maxTier) continue;
        const cells = [], vals = [];
        for (const i of r.unkPos) { assign(st, r.ids[i], r.first[i]); cells.push(toRC(r.ids[i])); vals.push(r.first[i]); }
        record(tier, cells, vals, eq);
        progressed = true;
        break;
      }
      for (const i of r.unkPos) {
        const id = r.ids[i];
        const prev = candBySlot.get(id);
        candBySlot.set(id, prev ? intersect(prev, r.cand[i]) : new Set(r.cand[i]));
      }
    }
    if (progressed) continue;

    // T2/T2.5 — einelementige Kandidatenmenge (ggf. erst durch den Schnitt
    // beider Gleichungen einer Kreuzung).
    for (const [id, set] of candBySlot) {
      if (set.size === 0) return { solved: false, contradiction: true, steps, values: st.values, maxTier: maxUsed, tierCounts };
      if (set.size === 1) {
        const tier = TIER.CROSS;
        if (tier > maxTier) continue;
        const v = [...set][0];
        assign(st, id, v);
        record(tier, [toRC(id)], [v], null);
        progressed = true;
        break;
      }
    }
    if (progressed) continue;

    // T3 — Zählargument über den Vorrat.
    if (maxTier >= TIER.POOL && candBySlot.size) {
      for (const [v, k] of st.pool) {
        const fits = [];
        for (const [id, set] of candBySlot) if (set.has(v)) fits.push(id);
        if (fits.length === 0) return { solved: false, contradiction: true, steps, values: st.values, maxTier: maxUsed, tierCounts };
        if (fits.length === k && k > 0) {
          const cells = [];
          for (const id of fits) { assign(st, id, v); cells.push(toRC(id)); }
          record(TIER.POOL, cells, fits.map(() => v), null);
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) break;
  }

  return { solved: st.unknown.size === 0, contradiction: false, steps, values: st.values, maxTier: maxUsed, tierCounts };
}

/** Prüft, ob eine komplette Wertetabelle alle Gleichungen erfüllt. */
export function allEquationsHold(puzzle, values) {
  return puzzle.equations.every(eq => equationHolds(eq, values, puzzle.cols) === true);
}

/**
 * Zählt Lösungen per Backtracking (Testhilfe/Verifikation). Zwei Belegungen,
 * die sich nur in der Reihenfolge GLEICHER Vorratszahlen unterscheiden, sind
 * dieselbe Lösung — das ergibt sich automatisch, weil über WERTE gebrancht wird.
 */
export function countSolutions(puzzle, limit = 2, nodeBudget = 200000, from = null) {
  const st = createSolveState(puzzle, from);
  let count = 0, nodes = 0;

  const rec = () => {
    if (count >= limit) return;
    if (++nodes > nodeBudget) return;
    if (!st.unknown.size) {
      if (allEquationsHold(puzzle, st.values)) count++;
      return;
    }
    // MRV: Feld mit der kleinsten Kandidatenmenge zuerst.
    const candBySlot = new Map();
    for (const eq of puzzle.equations) {
      const r = enumEquation(eq, st);
      if (!r) continue;
      if (r.total === 0) return;
      if (r.aborted) continue;
      for (const i of r.unkPos) {
        const id = r.ids[i];
        const prev = candBySlot.get(id);
        candBySlot.set(id, prev ? intersect(prev, r.cand[i]) : new Set(r.cand[i]));
      }
    }
    let best = null, bestSet = null;
    for (const [id, set] of candBySlot) {
      if (set.size === 0) return;
      if (!bestSet || set.size < bestSet.size) { best = id; bestSet = set; }
    }
    if (best == null) { // Felder ohne Gleichung dürfte es nicht geben
      const id = [...st.unknown][0];
      best = id; bestSet = new Set(st.pool.keys());
    }
    for (const v of bestSet) {
      if ((st.pool.get(v) || 0) <= 0) continue;
      const snapshotPool = st.pool.get(v);
      assign(st, best, v);
      rec();
      st.values[best] = null;
      st.unknown.add(best);
      st.pool.set(v, snapshotPool);
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}
