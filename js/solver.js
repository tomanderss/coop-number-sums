// solver.js — Deduktions-Engine für Number Sums.
//
// Ein Rätsel besteht aus Zellen mit Werten und "Gruppen" (Zeilen, Spalten,
// farbige Regionen). Jede Gruppe hat eine Zielsumme: die Summe der EINGEKREISTEN
// (behaltenen) Zellen dieser Gruppe muss exakt die Zielsumme ergeben.
//
// Der logische Solver nutzt ausschließlich ERZWUNGENE Züge (keine Rateschritte).
// Wenn er dadurch jede Zelle eindeutig bestimmt, ist die Lösung BEWEISBAR eindeutig
// und das Rätsel "ohne Raten" lösbar — genau das wollen wir generieren.
//
// Zell-Zustände:  UNK = unentschieden, KEEP = einkreisen, REMOVE = wegradieren.

export const UNK = 0;
export const KEEP = 1;
export const REMOVE = 2;

// ─── Hilfsfunktionen: Teilsummen-Erreichbarkeit (subset sum) ──────────────────
// Liefert ein BigInt-Bitset: Bit k gesetzt ⇔ Summe k ist mit Teilmenge erreichbar.
function reachBitset(values) {
  let reach = 1n; // Summe 0 ist immer erreichbar (leere Menge)
  for (const v of values) reach |= reach << BigInt(v);
  return reach;
}
function bitSet(bits, k) {
  if (k < 0) return false;
  return ((bits >> BigInt(k)) & 1n) === 1n;
}

// ─── Modell-Aufbau aus einem Puzzle ───────────────────────────────────────────
// Erzeugt flache Zell-/Gruppenstruktur für schnelle Propagation.
export function buildModel(puzzle) {
  const { rows, cols, values, rowTargets, colTargets, regions = [] } = puzzle;
  const idx = (r, c) => r * cols + c;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ r, c, val: values[r][c], groups: [] });

  const groups = [];
  const addGroup = (cellIds, target, kind, ref) => {
    const g = { id: groups.length, cells: cellIds, target, kind, ref };
    groups.push(g);
    for (const ci of cellIds) cells[ci].groups.push(g.id);
  };

  for (let r = 0; r < rows; r++) {
    const ids = []; for (let c = 0; c < cols; c++) ids.push(idx(r, c));
    addGroup(ids, rowTargets[r], 'row', r);
  }
  for (let c = 0; c < cols; c++) {
    const ids = []; for (let r = 0; r < rows; r++) ids.push(idx(r, c));
    addGroup(ids, colTargets[c], 'col', c);
  }
  regions.forEach((reg, ri) => {
    const ids = reg.cells.map(([r, c]) => idx(r, c));
    addGroup(ids, reg.target, 'region', ri);
  });

  return { rows, cols, cells, groups, idx };
}

// ─── Logischer Solver ─────────────────────────────────────────────────────────
// Optionen: allowHypo (Tier-3 Hypothesen-Deduktion zulassen)
// Rückgabe: { solved, contradiction, mark, tiers:{t1,t2,t3}, maxTier }
export function logicalSolve(puzzle, { allowHypo = false } = {}) {
  const model = buildModel(puzzle);
  const mark = new Array(model.cells.length).fill(UNK);
  const res = run(model, mark, allowHypo);
  return { ...res, mark, model };
}

function run(model, mark, allowHypo) {
  const tiers = { t1: 0, t2: 0, t3: 0 };
  let maxTier = 0;

  // Pro Gruppe: aktuelle Restsumme + unentschiedene Zellen berechnen
  function groupState(g) {
    let rem = g.target;
    const und = [];
    for (const ci of g.cells) {
      if (mark[ci] === KEEP) rem -= model.cells[ci].val;
      else if (mark[ci] === UNK) und.push(ci);
    }
    return { rem, und };
  }

  // Einen erzwungenen Zug auf Gruppen-Ebene finden & anwenden.
  // Liefert true bei Fortschritt, 'contradiction' bei Widerspruch, false sonst.
  function propagateOnce() {
    let progressed = false;
    for (const g of model.groups) {
      const { rem, und } = groupState(g);
      if (rem < 0) return 'contradiction';
      if (und.length === 0) { if (rem !== 0) return 'contradiction'; continue; }

      const vals = und.map(ci => model.cells[ci].val);
      const total = vals.reduce((a, b) => a + b, 0);

      // ── Tier 1: günstige Spezialfälle ───────────────────────────────
      if (rem === 0) { und.forEach(ci => mark[ci] = REMOVE); tiers.t1++; maxTier = Math.max(maxTier, 1); return true; }
      if (total === rem) { und.forEach(ci => mark[ci] = KEEP); tiers.t1++; maxTier = Math.max(maxTier, 1); return true; }
      if (total < rem) return 'contradiction';
      let t1hit = false;
      for (const ci of und) {
        if (model.cells[ci].val > rem) { mark[ci] = REMOVE; t1hit = true; } // passt nie hinein
      }
      if (t1hit) { tiers.t1++; maxTier = Math.max(maxTier, 1); return true; }

      // ── Tier 2: Teilsummen-Erreichbarkeit ───────────────────────────
      // Gesamt-Erreichbarkeit muss rem enthalten, sonst Widerspruch.
      const reachAll = reachBitset(vals);
      if (!bitSet(reachAll, rem)) return 'contradiction';
      let t2hit = false;
      for (let k = 0; k < und.length; k++) {
        const ci = und[k];
        const v = model.cells[ci].val;
        const without = vals.slice(0, k).concat(vals.slice(k + 1));
        const reachW = reachBitset(without);
        const canExcludeReach = bitSet(reachW, rem);        // Ziel ohne diese Zelle erreichbar?
        const canIncludeReach = bitSet(reachW, rem - v);    // Ziel mit dieser Zelle erreichbar?
        if (!canExcludeReach && canIncludeReach) { mark[ci] = KEEP; t2hit = true; }     // muss rein
        else if (canExcludeReach && !canIncludeReach) { mark[ci] = REMOVE; t2hit = true; } // muss raus
        else if (!canExcludeReach && !canIncludeReach) return 'contradiction';
      }
      if (t2hit) { tiers.t2++; maxTier = Math.max(maxTier, 2); return true; }
    }
    return progressed;
  }

  // Hauptschleife: erzwungene Züge bis Stillstand.
  for (;;) {
    const r = propagateOnce();
    if (r === 'contradiction') return { solved: false, contradiction: true, tiers, maxTier };
    if (r === true) continue;
    // Stillstand → ggf. Tier-3 Hypothese probieren
    if (allowHypo) {
      const r3 = hypothesisStep(model, mark);
      if (r3 === 'contradiction') return { solved: false, contradiction: true, tiers, maxTier };
      if (r3) { tiers.t3++; maxTier = Math.max(maxTier, 3); continue; }
    }
    break;
  }

  const solved = mark.every(m => m !== UNK);
  return { solved, contradiction: false, tiers, maxTier };
}

// ── Tier 3: Hypothese & Widerspruch ──────────────────────────────────────────
// Für eine unentschiedene Zelle wird KEEP angenommen und nur mit Tier1/2
// propagiert; entsteht ein Widerspruch, MUSS die Zelle REMOVE sein (und umgekehrt).
// Das ist weiterhin ein erzwungener Zug → Eindeutigkeit bleibt gewahrt.
function hypothesisStep(model, mark) {
  for (let ci = 0; ci < mark.length; ci++) {
    if (mark[ci] !== UNK) continue;
    for (const guess of [KEEP, REMOVE]) {
      const trial = mark.slice();
      trial[ci] = guess;
      const r = run(model, trial, false); // ohne Rekursion in Tier 3
      if (r.contradiction) {
        mark[ci] = guess === KEEP ? REMOVE : KEEP;
        return true;
      }
    }
  }
  return false;
}

// ─── Vollständige Lösungs-Zählung (Backtracking, gedeckelt) ───────────────────
// Fallback/Sicherheitscheck für Eindeutigkeit, falls Logik nicht ausreicht.
// limit z.B. 2 → es reicht zu wissen, ob 0, 1 oder ≥2 Lösungen existieren.
export function countSolutions(puzzle, limit = 2, nodeBudget = 200000) {
  const model = buildModel(puzzle);
  const mark = new Array(model.cells.length).fill(UNK);
  let count = 0;
  let nodes = 0;

  function feasible() {
    for (const g of model.groups) {
      let rem = g.target;
      const vals = [];
      for (const ci of g.cells) {
        if (mark[ci] === KEEP) rem -= model.cells[ci].val;
        else if (mark[ci] === UNK) vals.push(model.cells[ci].val);
      }
      if (rem < 0) return false;
      if (vals.length === 0) { if (rem !== 0) return false; continue; }
      if (!bitSet(reachBitset(vals), rem)) return false;
    }
    return true;
  }

  function pickCell() {
    let best = -1, bestUnd = Infinity;
    for (const g of model.groups) {
      let und = 0, target = -1;
      for (const ci of g.cells) {
        if (mark[ci] === UNK) { und++; target = ci; }
      }
      if (und > 0 && und < bestUnd) { bestUnd = und; best = target; }
    }
    if (best !== -1) return best;
    return mark.indexOf(UNK);
  }

  function dfs() {
    if (count >= limit) return;
    if (++nodes > nodeBudget) { count = -1; return; } // Budget gesprengt → "unbekannt"
    if (!feasible()) return;
    const ci = pickCell();
    if (ci === -1) { count++; return; }
    for (const guess of [KEEP, REMOVE]) {
      mark[ci] = guess;
      dfs();
      if (count >= limit || count < 0) { mark[ci] = UNK; return; }
    }
    mark[ci] = UNK;
  }

  dfs();
  return count; // -1 = unbekannt (Budget), sonst Anzahl bis limit
}
