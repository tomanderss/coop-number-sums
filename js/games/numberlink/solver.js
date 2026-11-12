// games/numberlink/solver.js — Lösen OHNE Raten.
//
// Der Löser denkt in VERBINDUNGEN (Kanten zwischen zwei Nachbarzellen: an, aus
// oder offen) und in FARBEN je Zelle (welche Zahlen kommen dort noch in Frage).
// Er zieht nur erzwungene Schlüsse; jeder ausgeschlossene Fall ist bewiesen
// unmöglich, ein vollständig so gelöstes Rätsel ist also eindeutig.
//
// Stufe 1 (ein Blick):
//   • Grad: ein Ende hat genau eine Verbindung, jede andere Zelle genau zwei —
//     sind die nötigen erreicht, sind die übrigen aus; bleiben genau so viele
//     offen wie fehlen, sind sie an (Ecken!).
//   • Farbe: zwei verbundene Zellen haben dieselbe Farbe; können zwei Nachbarn
//     keine gemeinsame Farbe haben, ist die Verbindung aus.
//   • Kein Kreis: eine Verbindung, die ein Teilstück zu einem Ring schlösse,
//     ist aus.
//   • Fertige Linie: sind beide Enden einer Zahl verbunden, kommt sie nirgends
//     sonst mehr vor.
//   • Erreichbarkeit: eine Zelle kann nur die Farbe einer Zahl tragen, deren
//     BEIDE Enden sie über noch mögliche Wege erreicht.
// Stufe 2 (ein Schritt voraus): eine offene Verbindung probeweise an- bzw.
//   ausschalten; führt Stufe 1 danach zum Widerspruch, gilt das Gegenteil.
//
// `solveLogic(p, { maxTier, known })` protokolliert, in welchem Schritt jede
// Zelle ihre Farbe bekam — Grundlage für das Training.

import { endMap, endsOf, pairCount } from './model.js';

const OFF = 0, ON = 1, UNK = 2;

function buildGraph(p) {
  const N = p.rows * p.cols, cols = p.cols;
  const edges = [];          // [a, b]
  const inc = Array.from({ length: N }, () => []);   // Kanten-Indizes je Zelle
  for (let id = 0; id < N; id++) {
    const r = Math.floor(id / cols), c = id % cols;
    if (c < cols - 1) { inc[id].push(edges.length); inc[id + 1].push(edges.length); edges.push([id, id + 1]); }
    if (r < p.rows - 1) { inc[id].push(edges.length); inc[id + cols].push(edges.length); edges.push([id, id + cols]); }
  }
  return { N, edges, inc };
}
// Farben als 32-Bit-Maske (höchstens 31 Zahlen — der Generator bleibt darunter).
const bit = (k) => (1 << (k - 1)) >>> 0;
const popcount = (m) => { let n = 0; while (m) { m = (m & (m - 1)) >>> 0; n++; } return n; };
const lowK = (m) => 32 - Math.clz32((m & -m) >>> 0);
const has = (m, k) => ((m >>> (k - 1)) & 1) === 1;

/** Ausgangslage: Farben (Bitmaske je Zelle, bis 30 Zahlen) und alle Kanten offen. */
/** Kanten-Indizes der Wände ({ r, c, d: 'r' = rechts der Zelle, 'd' = darunter }). */
export function wallEdges(p, g) {
  const out = [];
  for (const w of p.walls || []) {
    const a = w.r * p.cols + w.c, b = w.d === 'r' ? a + 1 : a + p.cols;
    for (const e of g.inc[a] || []) { const [x, y] = g.edges[e]; if ((x === a && y === b) || (x === b && y === a)) out.push(e); }
  }
  return out;
}

function initState(p, g) {
  const K = pairCount(p);
  const all = K >= 32 ? 0xffffffff : ((2 ** K) - 1) >>> 0;
  const ends = endMap(p);
  const dom = new Array(g.N).fill(all);
  const isEnd = new Uint8Array(g.N);
  for (const [id, k] of ends) { dom[id] = bit(k); isEnd[id] = 1; }
  const st = new Uint8Array(g.edges.length).fill(UNK);
  // Wände: dort ist nie eine Verbindung.
  for (const e of wallEdges(p, g)) st[e] = OFF;
  return { K, dom, st, isEnd, endsK: endsOf(p) };
}

function clone(s) { return { ...s, dom: s.dom.slice(), st: s.st.slice() }; }

/**
 * Stufe-1-Propagation bis zum Stillstand. Gibt false bei Widerspruch zurück.
 * `onCell(id)` wird gerufen, wenn eine Zelle ihre Farbe endgültig bekommt.
 */
function propagate(p, g, s, onCell, light = false) {
  const { N, edges, inc } = g;
  const { dom, st, isEnd, K, endsK } = s;
  let changed = true;
  const fixed = new Uint8Array(N);
  for (let id = 0; id < N; id++) if (popcount(dom[id]) === 1) fixed[id] = 1;
  const setDom = (id, m) => {
    if (m === dom[id]) return true;
    if (!m) return false;
    dom[id] = m; changed = true;
    if (!fixed[id] && popcount(m) === 1) { fixed[id] = 1; if (onCell) onCell(id, lowK(m)); }
    return true;
  };
  let guard = 0;
  while (changed && guard++ < 10000) {
    changed = false;
    // Farbe ↔ Kanten
    for (let e = 0; e < edges.length; e++) {
      const [a, b] = edges[e];
      if (st[e] === OFF) continue;
      const both = (dom[a] & dom[b]) >>> 0;
      if (st[e] === ON) {
        if (!setDom(a, both) || !setDom(b, both)) return false;
      } else if (!both) { st[e] = OFF; changed = true; }
    }
    // Grad
    for (let id = 0; id < N; id++) {
      const need = isEnd[id] ? 1 : 2;
      let on = 0, unk = 0;
      for (const e of inc[id]) { if (st[e] === ON) on++; else if (st[e] === UNK) unk++; }
      if (on > need || on + unk < need) return false;
      if (unk && on === need) { for (const e of inc[id]) if (st[e] === UNK) st[e] = OFF; changed = true; }
      else if (unk && on + unk === need) { for (const e of inc[id]) if (st[e] === UNK) st[e] = ON; changed = true; }
    }
    // Teilstücke (Union-Find über AN-Kanten): Kreise verbieten, fertige Linien.
    const parent = new Int32Array(N); for (let i = 0; i < N; i++) parent[i] = i;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let e = 0; e < edges.length; e++) if (st[e] === ON) {
      const ra = find(edges[e][0]), rb = find(edges[e][1]);
      if (ra === rb) return false;          // Kreis
      parent[ra] = rb;
    }
    for (let e = 0; e < edges.length; e++) if (st[e] === UNK && find(edges[e][0]) === find(edges[e][1])) { st[e] = OFF; changed = true; }
    // Zwei Enden verschiedener Zahlen im selben Teilstück → Widerspruch (Farbe fängt das ab).
    // Fertige Linien: beide Enden einer Zahl im selben Teilstück.
    for (let k = 1; k <= K; k++) {
      const [a, b] = endsK[k];
      if (find(a) !== find(b)) continue;
      const root = find(a), m = bit(k);
      for (let id = 0; id < N; id++) if (find(id) !== root && has(dom[id], k)) { if (!setDom(id, (dom[id] & ~m) >>> 0)) return false; }
    }
    // Erreichbarkeit je Farbe: von beiden Enden über Zellen, die k tragen dürfen,
    // und Kanten, die nicht aus sind. (Die Probe-Läufe der Stufe 2 lassen diesen
    // teuersten Schritt aus, bis sonst nichts mehr geht.)
    if (light && changed) continue;
    for (let k = 1; k <= K; k++) {
      const [a, b] = endsK[k];
      const ra = reach(g, s, k, a), rb = reach(g, s, k, b);
      if (!ra[b]) return false;
      const m = bit(k);
      for (let id = 0; id < N; id++) if (has(dom[id], k) && !(ra[id] && rb[id])) { if (!setDom(id, (dom[id] & ~m) >>> 0)) return false; }
    }
  }
  return true;
}

// Zellen, die Farbe k von `from` aus erreichen kann (fremde Enden blockieren).
function reach(g, s, k, from) {
  const seen = new Uint8Array(g.N);
  const stack = [from]; seen[from] = 1;
  while (stack.length) {
    const id = stack.pop();
    // Über ein Ende der Zahl k (außer dem Start) läuft die Linie nicht hinaus.
    if (id !== from && s.isEnd[id]) continue;
    for (const e of g.inc[id]) {
      if (s.st[e] === OFF) continue;
      const [a, b] = g.edges[e];
      const n = a === id ? b : a;
      if (!seen[n] && has(s.dom[n], k)) { seen[n] = 1; stack.push(n); }
    }
  }
  return seen;
}

function isComplete(g, s) {
  for (let e = 0; e < s.st.length; e++) if (s.st[e] === UNK) return false;
  for (let id = 0; id < g.N; id++) if (popcount(s.dom[id]) !== 1) return false;
  return true;
}

/**
 * Löst so weit wie möglich. known = [Pfad je Zahl] (z.B. die richtig gezogenen
 * Linien des Spielers) setzt deren Kanten vorab an.
 * Rückgabe: { solved, contradiction, tier2Steps, dom, st, order: [{ id, k, step, tier }] }
 */
export const MAX_PAIRS = 31;

export function solveLogic(p, { maxTier = 2, known = null, probeBudget = 0 } = {}) {
  const g = buildGraph(p);
  // Farben sind 32-Bit-Masken: mehr als 31 Zahlen kann der Löser nicht
  // darstellen — dann gilt das Rätsel als NICHT gelöst (nie falsch „gelöst“).
  if (pairCount(p) > MAX_PAIRS) return { solved: false, contradiction: false, tier2Steps: 0, order: [], dom: [], st: new Uint8Array(0), g };
  let s = initState(p, g);
  const order = [];
  let step = 0, tier = 1;
  const onCell = (id, k) => order.push({ id, k, step, tier });
  if (known) {
    const eIdx = new Map(g.edges.map(([a, b], i) => [`${a}-${b}`, i]));
    known.forEach((path, i) => {
      for (let j = 1; j < (path || []).length; j++) {
        const a = Math.min(path[j - 1], path[j]), b = Math.max(path[j - 1], path[j]);
        const e = eIdx.get(`${a}-${b}`);
        if (e != null) s.st[e] = ON;
      }
      for (const id of path || []) if (has(s.dom[id], i + 1)) s.dom[id] = bit(i + 1);
    });
  }
  // Ausgangsfarben (Enden) zählen nicht als Schritt.
  for (let id = 0; id < g.N; id++) if (s.isEnd[id]) order.push({ id, k: lowK(s.dom[id]), step: -1, tier: 0 });
  const doneIds = new Set(order.map((o) => o.id));
  const onCellOnce = (id, k) => { if (!doneIds.has(id)) { doneIds.add(id); onCell(id, k); } };
  if (!propagate(p, g, s, onCellOnce, true)) return { solved: false, contradiction: true, tier2Steps: 0, order, dom: s.dom, st: s.st, g };
  let tier2Steps = 0;
  // Stufe 2: reihum jede offene Kante probieren; nach einem Treffer geht es an
  // der nächsten Kante weiter (nicht wieder von vorn) — bis eine ganze Runde
  // nichts mehr bringt.
  if (maxTier >= 2) {
    const E = s.st.length;
    let e = 0, idle = 0, probes = 0;
    // Budget = feste ZAHL von Probe-Kanten (nie Zeit): deterministisch je Rätsel.
    const budget = probeBudget || Infinity;
    while (idle < E && probes < budget && !isComplete(g, s)) {
      let hit = false;
      if (s.st[e] === UNK) {
        probes++;
        for (const v of [ON, OFF]) {
          const t = clone(s);
          t.st[e] = v;
          if (!propagate(p, g, t, null, true)) {
            step++; tier = 2; tier2Steps++;
            s.st[e] = v === ON ? OFF : ON;
            if (!propagate(p, g, s, onCellOnce, true)) return { solved: false, contradiction: true, tier2Steps, order, dom: s.dom, st: s.st, g };
            tier = 1;
            hit = true;
            break;
          }
        }
      }
      idle = hit ? 0 : idle + 1;
      e = (e + 1) % E;
    }
  }
  return { solved: isComplete(g, s), contradiction: false, tier2Steps, order, dom: s.dom, st: s.st, g };
}

/** Die Linien der (vom Löser festgelegten) Lösung als Pfade je Zahl. */
export function pathsFromState(p, res) {
  const { g, st } = res;
  const K = pairCount(p), endsK = endsOf(p);
  const out = [];
  for (let k = 1; k <= K; k++) {
    const path = [endsK[k][0]];
    let prev = -1, cur = endsK[k][0];
    for (let guard = 0; guard < g.N; guard++) {
      let next = -1;
      for (const e of g.inc[cur]) if (st[e] === ON) { const [a, b] = g.edges[e]; const n = a === cur ? b : a; if (n !== prev) { next = n; break; } }
      if (next < 0) break;
      path.push(next); prev = cur; cur = next;
      if (cur === endsK[k][1]) break;
    }
    out.push(path);
  }
  return out;
}

/** Undeckte Zelle mit den meisten offenen Farben (für den Generator: hier hakt es). */
export function stuckCells(res) {
  const out = [];
  for (let id = 0; id < res.dom.length; id++) if (popcount(res.dom[id]) > 1) out.push(id);
  return out;
}

/**
 * Nächster erzwungener Schritt fürs Training: ausgehend von den richtig
 * gezogenen Linien (`known`) die erste Zahl, deren Linie der Löser jetzt
 * vollständig festlegt und die noch nicht richtig liegt — samt Pfad.
 */
export function nextDeduction(p, known, { maxTier = 1 } = {}) {
  const res = solveLogic(p, { maxTier, known });
  if (res.contradiction) return null;
  const K = pairCount(p);
  const paths = pathsFromState(p, res);
  const endsK = endsOf(p);
  for (let k = 1; k <= K; k++) {
    const path = paths[k - 1];
    if (path[path.length - 1] !== endsK[k][1]) continue;   // noch nicht festgelegt
    const cur = known && known[k - 1];
    const same = cur && cur.length === path.length && (cur.every((v, i) => v === path[i]) || cur.every((v, i) => v === path[path.length - 1 - i]));
    if (!same) return { k, path, tier: 1 };
  }
  return null;
}

/** Wie viele Lösungen (bis `limit`)? Rückverfolgung über Kanten — nur für Tests. */
export function countSolutions(p, limit = 2) {
  const g = buildGraph(p);
  let count = 0;
  const rec = (s) => {
    if (count >= limit) return;
    if (!propagate(p, g, s, null)) return;
    let e = -1;
    for (let i = 0; i < s.st.length; i++) if (s.st[i] === UNK) { e = i; break; }
    if (e < 0) { if (isComplete(g, s)) count++; return; }
    for (const v of [ON, OFF]) { const t = clone(s); t.st[e] = v; rec(t); }
  };
  rec(initState(p, g));
  return count;
}
