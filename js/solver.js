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

  // Überlapp-Paare für Tier 2.5 (Killer-Sudoku-artige "Innie/Outtie"-Deduktion):
  // eine Region und die Zeile/Spalte, mit der sie ≥2 Zellen gemeinsam hat.
  // Region↔Region überlappt nie (Regionen zerlegen das Feld), Zeile↔Spalte nur
  // in genau 1 Zelle (nutzlos) — daher nur Region↔Zeile/Spalte relevant.
  const overlapPairs = [];
  for (const g of groups) {
    if (g.kind !== 'region') continue;
    const byRow = new Map(), byCol = new Map();
    for (const ci of g.cells) {
      const r = Math.floor(ci / cols), c = ci % cols;
      if (!byRow.has(r)) byRow.set(r, []);
      if (!byCol.has(c)) byCol.set(c, []);
      byRow.get(r).push(ci);
      byCol.get(c).push(ci);
    }
    for (const [r, shared] of byRow) if (shared.length >= 2) overlapPairs.push({ gA: g, gB: groups[r], shared });
    for (const [c, shared] of byCol) if (shared.length >= 2) overlapPairs.push({ gA: g, gB: groups[rows + c], shared });
  }

  return { rows, cols, cells, groups, overlapPairs, idx };
}

// ─── Logischer Solver ─────────────────────────────────────────────────────────
// Optionen: allowHypo (Tier-3 Hypothesen-Deduktion zulassen),
//           allowOverlap (Tier-2.5 Überlapp-Deduktion zulassen, Default an)
// Rückgabe: { solved, contradiction, mark, tiers:{t1,t2,t25,t3}, maxTier }
export function logicalSolve(puzzle, { allowHypo = false, allowOverlap = true } = {}) {
  const model = buildModel(puzzle);
  const mark = new Array(model.cells.length).fill(UNK);
  const res = run(model, mark, allowHypo, allowOverlap);
  return { ...res, mark, model };
}

function run(model, mark, allowHypo, allowOverlap = true) {
  const tiers = { t1: 0, t2: 0, t25: 0, t3: 0 };
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

  // ── Tier 2.5 (Killer-Sudoku-artige Überlapp-/"Innie-Outtie"-Deduktion) ──────
  // Region G und Zeile/Spalte H teilen sich ≥2 noch unentschiedene Zellen S.
  // Aus G's eigener Restsumme lässt sich ableiten, welche Summen S (kombiniert
  // mit den G-exklusiven Zellen) überhaupt erreichen kann — ebenso aus H's
  // Restsumme. Der Schnitt beider Möglichkeiten ist eine ECHTE (nicht nur
  // vermutete) Eingrenzung von S' Summe, die mit keiner der beiden Gruppen
  // allein ableitbar wäre. Liefert das eine einzelne Summe, lassen sich daraus
  // per Teilsummen-DP einzelne Zellen in S erzwingen.
  function tier25(pair) {
    const { gA, gB, shared } = pair;
    const stA = groupState(gA), stB = groupState(gB);
    const sharedUnd = shared.filter(ci => mark[ci] === UNK);
    if (sharedUnd.length < 2) return false;
    const sharedSet = new Set(sharedUnd);
    const valsShared = sharedUnd.map(ci => model.cells[ci].val);
    const valsAExcl = stA.und.filter(ci => !sharedSet.has(ci)).map(ci => model.cells[ci].val);
    const valsBExcl = stB.und.filter(ci => !sharedSet.has(ci)).map(ci => model.cells[ci].val);
    const sumShared = valsShared.reduce((a, b) => a + b, 0);
    const reachShared = reachBitset(valsShared);
    const reachAExcl = reachBitset(valsAExcl);
    const reachBExcl = reachBitset(valsBExcl);
    const impliedA = new Set(), impliedB = new Set();
    for (let s = 0; s <= sumShared; s++) {
      if (!bitSet(reachShared, s)) continue;
      if (bitSet(reachAExcl, stA.rem - s)) impliedA.add(s);
      if (bitSet(reachBExcl, stB.rem - s)) impliedB.add(s);
    }
    const intersection = [...impliedA].filter(s => impliedB.has(s));
    if (intersection.length === 0) return 'c';
    const res = subsetForceMulti(valsShared, intersection);
    if (res.contradiction) return 'c';
    let hit = false;
    for (let k = 0; k < sharedUnd.length; k++) {
      if (res.force[k] === 1) { mark[sharedUnd[k]] = KEEP; hit = true; }
      else if (res.force[k] === 2) { mark[sharedUnd[k]] = REMOVE; hit = true; }
    }
    // Zählt als reine Logik (kein Raten) — bleibt unter maxTier 2, damit die
    // Tier-3-Begrenzung in generator.js davon unberührt bleibt.
    if (hit) { tiers.t25++; maxTier = Math.max(maxTier, 2); }
    return hit;
  }

  // Hauptschleife: erst alle Tier-1-Züge, dann Tier-2, dann ggf. Tier-2.5, dann ggf. Hypothese.
  for (;;) {
    let prog = false;
    for (const g of model.groups) { const r = tier1(g); if (r === 'c') return { solved: false, contradiction: true, tiers, maxTier }; if (r) prog = true; }
    if (prog) continue;
    for (const g of model.groups) { const r = tier2(g); if (r === 'c') return { solved: false, contradiction: true, tiers, maxTier }; if (r) prog = true; }
    if (prog) continue;
    if (allowOverlap) {
      for (const pair of model.overlapPairs) { const r = tier25(pair); if (r === 'c') return { solved: false, contradiction: true, tiers, maxTier }; if (r) prog = true; }
      if (prog) continue;
    }
    if (allowHypo) {
      const r3 = hypothesisStep(model, mark, allowOverlap);
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

// Verallgemeinerung von subsetForce auf eine MENGE möglicher Zielsummen (statt
// eines einzelnen Skalars): eine Zelle ist nur erzwungen, wenn sich ALLE
// verbleibenden Zielsummen einig sind (einstimmig KEEP bzw. einstimmig REMOVE).
// Für Tier 2.5, wenn die Überlapp-Deduktion die Summe der Schnittmenge nicht
// auf einen einzigen Wert, sondern nur auf eine kleine Kandidatenmenge eingrenzt.
function subsetForceMulti(vals, targetSet) {
  const n = vals.length;
  const results = [];
  for (const t of targetSet) {
    const r = subsetForce(vals, t);
    if (!r.contradiction) results.push(r.force);
  }
  if (results.length === 0) return { contradiction: true };
  const force = new Int8Array(n);
  for (let k = 0; k < n; k++) {
    const allKeep = results.every(f => f[k] === 1);
    const allRemove = results.every(f => f[k] === 2);
    if (allKeep) force[k] = 1;
    else if (allRemove) force[k] = 2;
  }
  return { contradiction: false, force };
}

// ── Tier 3: Hypothese & Widerspruch ──────────────────────────────────────────
// Für eine unentschiedene Zelle wird KEEP angenommen und nur mit Tier1/2(/2.5)
// propagiert; entsteht ein Widerspruch, MUSS die Zelle REMOVE sein (und umgekehrt).
function hypothesisStep(model, mark, allowOverlap) {
  for (let ci = 0; ci < mark.length; ci++) {
    if (mark[ci] !== UNK) continue;
    for (const guess of [KEEP, REMOVE]) {
      const trial = mark.slice();
      trial[ci] = guess;
      const r = run(model, trial, false, allowOverlap); // ohne Rekursion in Tier 3
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
