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

  // ── Tier 1 (günstig): erzwungene Züge auf einer Gruppe ──────────────────────
  function tier1(g) {
    const { rem, und } = groupState(g);
    if (rem < 0) return 'c';
    if (und.length === 0) return rem !== 0 ? 'c' : false;
    let total = 0; for (const ci of und) total += model.cells[ci].val;
    if (total < rem) return 'c';
    if (rem === 0) { for (const ci of und) mark[ci] = REMOVE; tiers.t1++; maxTier = Math.max(maxTier, 1); return true; }
    if (total === rem) { for (const ci of und) mark[ci] = KEEP; tiers.t1++; maxTier = Math.max(maxTier, 1); return true; }
    let hit = false;
    for (const ci of und) if (model.cells[ci].val > rem) { mark[ci] = REMOVE; hit = true; }
    if (hit) { tiers.t1++; maxTier = Math.max(maxTier, 1); }
    return hit;
  }

  // ── Tier 2 (Teilsummen via DP) ──────────────────────────────────────────────
  function tier2(g) {
    const { rem, und } = groupState(g);
    if (und.length === 0) return rem !== 0 ? 'c' : false;
    const vals = und.map(ci => model.cells[ci].val);
    const res = subsetForce(vals, rem);
    if (res.contradiction) return 'c';
    let hit = false;
    for (let k = 0; k < und.length; k++) {
      if (res.force[k] === 1) { mark[und[k]] = KEEP; hit = true; }
      else if (res.force[k] === 2) { mark[und[k]] = REMOVE; hit = true; }
    }
    if (hit) { tiers.t2++; maxTier = Math.max(maxTier, 2); }
    return hit;
  }

  // Hauptschleife: erst alle Tier-1-Züge, dann Tier-2, dann ggf. Hypothese.
  for (;;) {
    let prog = false;
    for (const g of model.groups) { const r = tier1(g); if (r === 'c') return { solved: false, contradiction: true, tiers, maxTier }; if (r) prog = true; }
    if (prog) continue;
    for (const g of model.groups) { const r = tier2(g); if (r === 'c') return { solved: false, contradiction: true, tiers, maxTier }; if (r) prog = true; }
    if (prog) continue;
    if (allowHypo) {
      const r3 = hypothesisStep(model, mark);
      if (r3 === 'c') return { solved: false, contradiction: true, tiers, maxTier };
      if (r3) { tiers.t3++; maxTier = Math.max(maxTier, 3); continue; }
    }
    break;
  }

  const solved = mark.every(m => m !== UNK);
  return { solved, contradiction: false, tiers, maxTier };
}

// Teilsummen-Zwang via DP (typed arrays, schnell): liefert pro Element, ob es
// zwingend KEEP (1) oder REMOVE (2) ist, plus Widerspruchs-Flag.
function subsetForce(vals, rem) {
  const n = vals.length;
  let S = 0; for (const v of vals) S += v;
  if (rem < 0 || rem > S) return { contradiction: true };
  // Präfix-Erreichbarkeit: pre[k] = erreichbare Summen mit vals[0..k-1]
  const pre = new Array(n + 1);
  pre[0] = new Uint8Array(S + 1); pre[0][0] = 1;
  for (let k = 0; k < n; k++) {
    const cur = pre[k].slice(); const v = vals[k];
    for (let s = S - v; s >= 0; s--) if (pre[k][s]) cur[s + v] = 1;
    pre[k + 1] = cur;
  }
  if (!pre[n][rem]) return { contradiction: true };
  // Suffix-Erreichbarkeit: suf[k] = erreichbare Summen mit vals[k..n-1]
  const suf = new Array(n + 1);
  suf[n] = new Uint8Array(S + 1); suf[n][0] = 1;
  for (let k = n - 1; k >= 0; k--) {
    const cur = suf[k + 1].slice(); const v = vals[k];
    for (let s = S - v; s >= 0; s--) if (suf[k + 1][s]) cur[s + v] = 1;
    suf[k] = cur;
  }
  const force = new Int8Array(n);
  for (let k = 0; k < n; k++) {
    const v = vals[k], pk = pre[k], sk = suf[k + 1];
    let without = false; for (let a = 0; a <= rem; a++) if (pk[a] && sk[rem - a]) { without = true; break; }
    let withK = false; const t = rem - v; if (t >= 0) for (let a = 0; a <= t; a++) if (pk[a] && sk[t - a]) { withK = true; break; }
    if (!without && withK) force[k] = 1;        // muss KEEP
    else if (without && !withK) force[k] = 2;   // muss REMOVE
    else if (!without && !withK) return { contradiction: true };
  }
  return { contradiction: false, force };
}

// ── Tier 3: Hypothese & Widerspruch ──────────────────────────────────────────
// Für eine unentschiedene Zelle wird KEEP angenommen und nur mit Tier1/2
// propagiert; entsteht ein Widerspruch, MUSS die Zelle REMOVE sein (und umgekehrt).
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
