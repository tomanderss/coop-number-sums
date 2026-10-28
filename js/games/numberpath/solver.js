// games/numberpath/solver.js — Lösen OHNE Raten.
//
// Ein Mensch verlängert die Linie von ihrem Ende aus. Der Löser tut dasselbe:
// er geht nur weiter, wenn GENAU EIN nächster Schritt übrig bleibt, der nicht
// zwangsläufig scheitert. Jeder ausgeschlossene Schritt ist BEWIESEN unmöglich,
// deshalb ist ein vollständig so gelöstes Rätsel auch eindeutig.
//
// Ein Schritt scheitert zwangsläufig (Stufe 1), wenn danach
//   • die freien Zellen nicht mehr alle vom Linienende aus erreichbar sind
//     (eine abgeschnittene Insel), oder
//   • eine freie Zelle zur Sackgasse wird (höchstens ein freier Nachbar), die
//     nicht die letzte Zahl ist — dort müsste die Linie enden, darf aber nicht.
//   • die freien Zellen farblich nicht aufgehen (Schachbrett-Parität: jeder
//     Schritt wechselt die Farbe; die letzte Zahl muss auf der Endfarbe liegen),
//   • die nächste Zahl nicht mehr erreichbar ist, ohne über eine spätere Zahl
//     zu laufen.
// Stufe n schaut n−1 Schritte weiter: ein Schritt scheitert auch, wenn von
// dort aus KEIN Folgeschritt die Prüfung der Stufe darunter besteht.

import { clueMap, wallSet, neighbors, lastClue, canStep } from './model.js';

function makeCtx(p) {
  const walls = wallSet(p);
  const N = p.rows * p.cols;
  const nb = Array.from({ length: N }, (_, id) => neighbors(p, id, walls));
  const clues = clueMap(p);
  const cellOf = [];
  for (const [id, n] of clues) cellOf[n] = id;
  const color = new Uint8Array(N);
  for (let id = 0; id < N; id++) color[id] = (Math.floor(id / p.cols) + (id % p.cols)) % 2;
  return { clues, walls, K: lastClue(p), N, nb, cellOf, color };
}

// Stufe-1-Prüfung des Zustands „Pfad mit Ende `end`, belegt = used,
// nächste zu erreichende Zahl = nextN".
function feasible(p, ctx, used, end, len, nextN) {
  const { N, nb, clues, K, color } = ctx;
  if (len === N) return clues.get(end) === K;
  // Sackgassen: jede freie Zelle braucht zwei Anschlüsse (frei oder das Ende),
  // nur die letzte Zahl darf mit einem auskommen.
  let kCell = -1, same = 0, other = 0;
  const ce = color[end];
  for (let id = 0; id < N; id++) {
    if (used[id]) continue;
    let deg = 0;
    for (const n of nb[id]) if (!used[n] || n === end) deg++;
    const isK = clues.get(id) === K;
    if (isK) kCell = id;
    if (deg === 0 || (deg < 2 && !isK)) return false;
    if (color[id] === ce) same++; else other++;
  }
  if (kCell < 0) return false;
  // Schachbrett-Parität: der Rest des Weges wechselt bei jedem Schritt die
  // Farbe und beginnt mit der Gegenfarbe des Endes. Also gibt es gleich viele
  // oder genau eine Gegenfarbe mehr — und die letzte Zahl liegt auf der Farbe,
  // mit der der Weg endet.
  if (other !== same && other !== same + 1) return false;
  if ((other === same ? ce : 1 - ce) !== color[kCell]) return false;
  // Zusammenhang: alle freien Zellen vom Ende aus erreichbar.
  const seen = new Uint8Array(N);
  const stack = [];
  for (const n of nb[end]) if (!used[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
  let count = 0;
  while (stack.length) {
    const id = stack.pop(); count++;
    for (const n of nb[id]) if (!used[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
  }
  if (count !== N - len) return false;
  // Die NÄCHSTE Zahl muss erreichbar sein, ohne über eine spätere zu laufen.
  if (nextN <= K) {
    const target = ctx.cellOf[nextN];
    const seen2 = new Uint8Array(N);
    const st = [end]; seen2[end] = 1;
    let found = false;
    while (st.length && !found) {
      const id = st.pop();
      for (const n of nb[id]) {
        if (seen2[n] || used[n]) continue;
        if (n === target) { found = true; break; }
        const cn = clues.get(n);
        if (cn && cn > nextN) continue;
        seen2[n] = 1; st.push(n);
      }
    }
    if (!found) return false;
  }
  return true;
}

function reached(ctx, path) {
  let best = 0;
  for (const id of path) { const n = ctx.clues.get(id); if (n && n > best) best = n; }
  return best;
}
function survivors(p, ctx, path, used, tier) {
  const end = path[path.length - 1];
  const out = [];
  const r0 = reached(ctx, path);
  for (const v of ctx.nb[end]) {
    if (!canStep(p, path, v, ctx)) continue;
    used[v] = 1; path.push(v);
    const r1 = Math.max(r0, ctx.clues.get(v) || 0);
    let ok = feasible(p, ctx, used, v, path.length, r1 + 1);
    if (ok && tier >= 2 && path.length < ctx.N) ok = survivors(p, ctx, path, used, tier - 1).length > 0;
    path.pop(); used[v] = 0;
    if (ok) out.push(v);
  }
  return out;
}

/**
 * Nächster erzwungener Schritt ab `path` (oder null). Liefert { cell, tier }.
 * Der Pfad muss mit der 1 beginnen (ein leerer Pfad liefert die 1).
 */
export function forcedNext(p, path, { maxTier = 2, ctx = makeCtx(p) } = {}) {
  if (!path.length) {
    const one = p.clues.find((k) => k.n === 1);
    return one ? { cell: one.r * p.cols + one.c, tier: 1 } : null;
  }
  const used = new Uint8Array(ctx.N);
  for (const id of path) used[id] = 1;
  const work = path.slice();
  for (let tier = 1; tier <= maxTier; tier++) {
    const s = survivors(p, ctx, work, used, tier);
    if (s.length === 1) return { cell: s[0], tier };
    if (s.length === 0) return null;
  }
  return null;
}

/**
 * Logisch lösen: Schritt für Schritt nur erzwungene Züge. Liefert
 * { solved, path, steps: [{ cell, tier }], tier2Steps, stuckAt }.
 */
export function solveLogic(p, { maxTier = 2, from = [] } = {}) {
  const ctx = makeCtx(p);
  const path = from.slice();
  const steps = [];
  let tier2Steps = 0;
  while (path.length < ctx.N) {
    const f = forcedNext(p, path, { maxTier, ctx });
    if (!f) break;
    path.push(f.cell);
    steps.push(f);
    if (f.tier === 2) tier2Steps++;
  }
  const solved = path.length === ctx.N && ctx.clues.get(path[path.length - 1]) === ctx.K;
  return { solved, path, steps, tier2Steps, stuckAt: solved ? -1 : path.length };
}

/** Lösungen zählen (Tiefensuche mit Abbruch bei `limit`) — für Tests. */
export function countSolutions(p, limit = 2) {
  const ctx = makeCtx(p);
  const one = p.clues.find((k) => k.n === 1);
  if (!one) return 0;
  const start = one.r * p.cols + one.c;
  const used = new Uint8Array(ctx.N);
  const path = [start]; used[start] = 1;
  let count = 0;
  const rec = () => {
    if (count >= limit) return;
    if (path.length === ctx.N) { if (ctx.clues.get(path[path.length - 1]) === ctx.K) count++; return; }
    if (!feasible(p, ctx, used, path[path.length - 1], path.length, reached(ctx, path) + 1)) return;
    for (const v of ctx.nb[path[path.length - 1]]) {
      if (!canStep(p, path, v, ctx)) continue;
      used[v] = 1; path.push(v);
      rec();
      path.pop(); used[v] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}

// ═════════════════════════════════════════════════════════════════════════════
// KANTEN-LÖSER — so wie ein Mensch über das GANZE Brett denkt, nicht nur am
// Linienende. Jede Verbindung zwischen zwei Nachbarzellen ist „an", „aus" oder
// noch offen. Jede Zelle braucht genau zwei Verbindungen (die 1 und die letzte
// Zahl genau eine). Erzwungene Schlüsse (Stufe 1):
//   • Grad: hat eine Zelle schon genug Verbindungen, fallen die übrigen weg;
//     bleiben genau so viele offene wie nötig, sind alle Pflicht (z. B. Ecken).
//   • Kein Kreis: zwei Enden desselben Teilstücks dürfen sich nicht verbinden.
//   • Nicht zu früh fertig: ein Teilstück von der 1 bis zur letzten Zahl muss
//     alle Zellen enthalten.
//   • Reihenfolge: auf einem Teilstück folgen die Zahlen lückenlos aufeinander
//     (zwischen 3 und 5 fehlt sonst die 4) — eine Verbindung, die das bricht,
//     fällt weg.
//   • Zusammenhang: das Brett darf nicht in getrennte Teile zerfallen.
// Stufe 2 (nur obere Schwierigkeiten): ein kurzer Vorausblick — führt „an" für
// eine Verbindung mit den Regeln oben sofort in einen Widerspruch, ist sie
// „aus" (und umgekehrt).
// ═════════════════════════════════════════════════════════════════════════════

function edgeModel(p) {
  const N = p.rows * p.cols;
  const walls = wallSet(p);
  const ea = [], eb = [];
  const cellEdges = Array.from({ length: N }, () => []);
  for (let id = 0; id < N; id++) {
    for (const n of neighbors(p, id, walls)) {
      if (n < id) continue;
      const e = ea.length;
      ea.push(id); eb.push(n);
      cellEdges[id].push(e); cellEdges[n].push(e);
    }
  }
  const clues = clueMap(p);
  const K = lastClue(p);
  const need = new Uint8Array(N).fill(2);
  for (const [id, n] of clues) if (n === 1 || n === K) need[id] = 1;
  return { N, E: ea.length, ea, eb, cellEdges, clues, K, need };
}

// Teilstücke aus den „an"-Verbindungen: je Zelle die Kennung ihres Teilstücks,
// je Teilstück die Zellen in Reihenfolge. null = Widerspruch (Kreis, Zelle mit
// mehr als zwei Verbindungen, Zahlen nicht lückenlos).
function chains(m, st) {
  const { N, cellEdges, ea, eb, clues } = m;
  const nbOn = Array.from({ length: N }, () => []);
  for (let e = 0; e < m.E; e++) if (st[e] === 1) { nbOn[ea[e]].push(eb[e]); nbOn[eb[e]].push(ea[e]); }
  const chainOf = new Int32Array(N).fill(-1);
  const list = [];
  for (let id = 0; id < N; id++) {
    if (nbOn[id].length > 2) return null;
    if (chainOf[id] >= 0 || nbOn[id].length === 2) continue;
    const cells = [id];
    chainOf[id] = list.length;
    let prev = -1, cur = id;
    for (;;) {
      const nx = nbOn[cur].find((x) => x !== prev);
      if (nx === undefined) break;
      prev = cur; cur = nx;
      chainOf[cur] = list.length; cells.push(cur);
    }
    list.push(cells);
  }
  for (let id = 0; id < N; id++) if (chainOf[id] < 0) return null;   // Kreis
  for (const cells of list) if (!orderOk(cells.map((c) => clues.get(c)).filter(Boolean))) return null;
  void cellEdges;
  return { chainOf, list, nbOn };
}
// Zahlen entlang eines Teilstücks: lückenlos auf- oder absteigend.
function orderOk(seq) {
  if (seq.length < 2) return true;
  const dir = seq[1] - seq[0];
  if (dir !== 1 && dir !== -1) return false;
  for (let i = 2; i < seq.length; i++) if (seq[i] - seq[i - 1] !== dir) return false;
  return true;
}

function propagate(m, st) {
  const { N, cellEdges, ea, eb, need, clues, K } = m;
  for (let guard = 0; guard < 10000; guard++) {
    let changed = false;
    // Grad-Regel.
    for (let id = 0; id < N; id++) {
      let on = 0, unk = 0;
      for (const e of cellEdges[id]) { if (st[e] === 1) on++; else if (st[e] === 0) unk++; }
      if (on > need[id] || on + unk < need[id]) return false;
      if (unk && on === need[id]) { for (const e of cellEdges[id]) if (st[e] === 0) st[e] = -1; changed = true; }
      else if (unk && on + unk === need[id]) { for (const e of cellEdges[id]) if (st[e] === 0) st[e] = 1; changed = true; }
    }
    if (changed) continue;
    const ch = chains(m, st);
    if (!ch) return false;
    const { chainOf, list } = ch;
    // Ein Teilstück mit beiden Enden auf „Endzellen" (1 bzw. letzte Zahl) muss alles umfassen.
    for (const cells of list) {
      const a = cells[0], b = cells[cells.length - 1];
      if (cells.length > 1 && need[a] === 1 && need[b] === 1 && cells.length < N) return false;
    }
    if (list.length === 1 && list[0].length === N) return true;
    // Offene Verbindungen prüfen: Kreis, verfrühtes Ende, Reihenfolge. Je
    // Teilstück reicht die (kurze) Zahlenfolge — die Zellen selbst werden nicht kopiert.
    const seqs = list.map((cells) => cells.map((c) => clues.get(c)).filter(Boolean));
    for (let e = 0; e < m.E; e++) {
      if (st[e] !== 0) continue;
      const u = ea[e], v = eb[e];
      const cu = chainOf[u], cv = chainOf[v];
      let bad = false;
      if (cu === cv) bad = true;
      else {
        const A = list[cu], B = list[cv];
        const uFirst = A[0] === u, vFirst = B[0] === v;
        const sa = uFirst ? seqs[cu].slice().reverse() : seqs[cu];
        const sb = vFirst ? seqs[cv] : seqs[cv].slice().reverse();
        if ((sa.length || sb.length) && !orderOk(sa.concat(sb))) bad = true;
        else {
          const endA = uFirst ? A[A.length - 1] : A[0];
          const endB = vFirst ? B[B.length - 1] : B[0];
          if (need[endA] === 1 && need[endB] === 1 && A.length + B.length < N) bad = true;
        }
      }
      if (bad) { st[e] = -1; changed = true; }
    }
    if (changed) continue;
    // Zusammenhang über an+offene Verbindungen.
    const seen = new Uint8Array(N);
    const stack = [0]; seen[0] = 1; let cnt = 0;
    while (stack.length) {
      const id = stack.pop(); cnt++;
      for (const e of cellEdges[id]) {
        if (st[e] === -1) continue;
        const o = ea[e] === id ? eb[e] : ea[e];
        if (!seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    if (cnt !== N) return false;
    return true;
  }
  return false;
}

/** Den fertigen Weg aus den Verbindungen lesen (ab der 1). */
function readPath(p, m, st) {
  const one = p.clues.find((k) => k.n === 1);
  let cur = one.r * p.cols + one.c, prev = -1;
  const path = [cur];
  for (;;) {
    let nx = -1;
    for (const e of m.cellEdges[cur]) {
      if (st[e] !== 1) continue;
      const o = m.ea[e] === cur ? m.eb[e] : m.ea[e];
      if (o !== prev) { nx = o; break; }
    }
    if (nx < 0) break;
    prev = cur; cur = nx; path.push(cur);
    if (path.length > m.N) break;
  }
  return path;
}

/**
 * Über Verbindungen lösen. Liefert { solved, path, tier2Steps, decided(e→st) }.
 * Nur erzwungene Schlüsse; ist am Ende alles festgelegt, gibt es genau eine Lösung.
 */
export function solveEdges(p, { maxTier = 2, from = null } = {}) {
  const m = edgeModel(p);
  const st = new Int8Array(m.E);
  let tier2Steps = 0;
  // Ausgangslage: eine schon gezogene Linie (z. B. im Training).
  if (from && from.length > 1) {
    const key = new Map();
    for (let e = 0; e < m.E; e++) key.set(m.ea[e] * 100000 + m.eb[e], e);
    for (let i = 1; i < from.length; i++) {
      const a = Math.min(from[i - 1], from[i]), b = Math.max(from[i - 1], from[i]);
      const e = key.get(a * 100000 + b);
      if (e === undefined) return { solved: false, contradiction: true, path: [], tier2Steps, st, m };
      st[e] = 1;
    }
  }
  if (!propagate(m, st)) return { solved: false, contradiction: true, path: [], tier2Steps, st, m };
  const done = () => { for (let e = 0; e < m.E; e++) if (st[e] === 0) return false; return true; };
  while (!done() && maxTier >= 2) {
    let progress = false;
    // Nur Verbindungen an Zellen probieren, die schon angebunden sind (oder
    // Zahlen tragen) — dort entstehen kurze Widersprüche; das spart den
    // Großteil der Versuche.
    const hot = new Uint8Array(m.N);
    for (let e = 0; e < m.E; e++) if (st[e] === 1) { hot[m.ea[e]] = 1; hot[m.eb[e]] = 1; }
    for (const id of m.clues.keys()) hot[id] = 1;
    for (let e = 0; e < m.E && !progress; e++) {
      if (st[e] !== 0 || !(hot[m.ea[e]] || hot[m.eb[e]])) continue;
      for (const val of [1, -1]) {
        const trial = st.slice(); trial[e] = val;
        if (!propagate(m, trial)) {
          st[e] = -val; tier2Steps++;
          if (!propagate(m, st)) return { solved: false, contradiction: true, path: [], tier2Steps, st, m };
          progress = true; break;
        }
      }
    }
    if (!progress) break;
  }
  if (!done()) return { solved: false, path: [], tier2Steps, st, m };
  const path = readPath(p, m, st);
  const ok = path.length === m.N && m.clues.get(path[path.length - 1]) === m.K;
  return { solved: ok, path, tier2Steps, st, m };
}

/** Erste Stelle des echten Weges, an der der Kanten-Löser noch unentschieden ist. */
export function edgeStuckIndex(res, solution) {
  const { m, st } = res;
  const key = new Map();
  for (let e = 0; e < m.E; e++) key.set(m.ea[e] * 100000 + m.eb[e], e);
  for (let i = 1; i < solution.length; i++) {
    const a = Math.min(solution[i - 1], solution[i]), b = Math.max(solution[i - 1], solution[i]);
    const e = key.get(a * 100000 + b);
    if (e === undefined || st[e] !== 1) return i;
  }
  return -1;
}

/**
 * Der nächste erzwungene Schritt ab einer gezogenen Linie (Training): die
 * Verbindung vom Linienende, die der Kanten-Löser als Pflicht erkennt.
 * Liefert { cell, reason } oder null. reason = 'onlyway' (vom Ende aus bleibt
 * nur ein freier Weg) | 'logic' (jeder andere Weg bräche eine Regel).
 */
export function nextEdgeStep(p, path, { maxTier = 2 } = {}) {
  if (!path.length) {
    const one = p.clues.find((k) => k.n === 1);
    return one ? { cell: one.r * p.cols + one.c, reason: 'start' } : null;
  }
  const end = path[path.length - 1];
  const ctx = { clues: clueMap(p), walls: wallSet(p), K: lastClue(p) };
  const open = neighbors(p, end, ctx.walls).filter((v) => canStep(p, path, v, ctx));
  if (open.length === 1) return { cell: open[0], reason: 'onlyway' };
  for (let tier = 1; tier <= maxTier; tier++) {
    const res = solveEdges(p, { maxTier: tier, from: path });
    if (res.contradiction) return null;
    const { m, st } = res;
    for (const e of m.cellEdges[end]) {
      if (st[e] !== 1) continue;
      const o = m.ea[e] === end ? m.eb[e] : m.ea[e];
      if (!path.includes(o)) return { cell: o, reason: 'logic' };
    }
  }
  return null;
}
