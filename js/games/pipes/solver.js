// games/pipes/solver.js — ein Löser, der wie ein Mensch nur ERZWUNGENE Schlüsse
// zieht (rein, unit-getestet). Grundlage für Generator (ratefrei) und Training.
//
// Zustand je Verbindung zwischen zwei Nachbarn: offen / zu / offen-unbekannt.
// Ränder sind zu. Je Zelle bleiben die Lagen ihres Stücks, die zu den bekannten
// Verbindungen passen; sind sich alle übrigen Lagen über eine Seite einig, steht
// diese Verbindung fest.
//   Stufe 1  Rand & Nachbarn: Lagen ausschließen, die ins Leere zeigen oder an
//            eine schon geschlossene Seite stoßen; zwei Endstücke verbinden sich
//            nie miteinander (sonst wären sie vom Rest abgeschnitten).
//   Stufe 2  Netz-Schlüsse: keine Verbindung innerhalb eines schon verbundenen
//            Stücks (wäre ein Kreis); eine Verbindung, nach der ein Teilnetz
//            keinen Ausgang mehr hätte, ist zu; hat ein Teilnetz nur noch EINEN
//            möglichen Ausgang, ist er offen.

import { orientations, neighbor, has, degree, opp } from './model.js';

export function solveLogic(p, { maxTier = 2, known = [] } = {}) {
  const n = p.rows * p.cols;
  // e[i*4+d]: 0 unbekannt, 1 offen, -1 zu
  const e = new Int8Array(n * 4);
  const cand = p.tiles.map((m) => orientations(m));
  const steps = [];
  const fixedAt = new Array(n).fill(-1);
  let contradiction = false;

  const set = (i, d, v) => {
    const j = neighbor(p, i, d);
    if (e[i * 4 + d] === v) return false;
    if (e[i * 4 + d] !== 0) { contradiction = true; return false; }
    e[i * 4 + d] = v;
    if (j >= 0) {
      if (e[j * 4 + opp(d)] !== 0 && e[j * 4 + opp(d)] !== v) contradiction = true;
      e[j * 4 + opp(d)] = v;
    } else if (v === 1) contradiction = true;
    return true;
  };
  for (let i = 0; i < n; i++) for (let d = 0; d < 4; d++) if (neighbor(p, i, d) < 0) e[i * 4 + d] = -1;
  // Vorgaben (z.B. die vom Spieler richtig gelegten Stücke im Training).
  for (const { i, m } of known) {
    cand[i] = cand[i].filter((o) => o.m === m);
    for (let d = 0; d < 4; d++) set(i, d, has(m, d) ? 1 : -1);
  }

  const note = (i, tier, why) => { if (fixedAt[i] < 0 && cand[i].length === 1) { fixedAt[i] = steps.length; steps.push({ i, m: cand[i][0].m, k: cand[i][0].k, tier, why }); } };

  // Stufe 1: je Zelle filtern und Einigkeit übernehmen.
  const tier1 = () => {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const before = cand[i].length;
      cand[i] = cand[i].filter((o) => {
        for (let d = 0; d < 4; d++) {
          const s = e[i * 4 + d];
          if (s === 1 && !has(o.m, d)) return false;
          if (s === -1 && has(o.m, d)) return false;
        }
        return true;
      });
      if (!cand[i].length) { contradiction = true; return false; }
      if (cand[i].length !== before) changed = true;
      for (let d = 0; d < 4; d++) {
        if (e[i * 4 + d] !== 0) continue;
        const all = cand[i].every((o) => has(o.m, d)), none = cand[i].every((o) => !has(o.m, d));
        if (all) changed = set(i, d, 1) || changed;
        else if (none) changed = set(i, d, -1) || changed;
        else if (n > 2 && degree(p.tiles[i]) === 1) {
          const j = neighbor(p, i, d);
          if (j >= 0 && degree(p.tiles[j]) === 1) changed = set(i, d, -1) || changed;
        }
      }
      note(i, 1, 'edge');
    }
    return changed;
  };

  // Stufe 2: Teilnetze über offene Verbindungen.
  const tier2 = () => {
    const par = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let i = 0; i < n; i++) for (const d of [1, 2]) if (e[i * 4 + d] === 1) { const j = neighbor(p, i, d); par[find(i)] = find(j); }
    const size = new Map(), exits = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      size.set(r, (size.get(r) || 0) + 1);
      for (let d = 0; d < 4; d++) if (e[i * 4 + d] === 0) {
        const j = neighbor(p, i, d);
        if (find(j) !== r) { if (!exits.has(r)) exits.set(r, []); exits.get(r).push([i, d]); }
      }
    }
    for (let i = 0; i < n; i++) for (let d = 0; d < 4; d++) {
      if (e[i * 4 + d] !== 0) continue;
      const j = neighbor(p, i, d);
      const a = find(i), b = find(j);
      if (a === b) { set(i, d, -1); return true; }       // wäre ein Kreis
      // Zusammen ohne weiteren Ausgang und nicht alles? → zu.
      if ((size.get(a) || 0) + (size.get(b) || 0) < n) {
        const rest = (exits.get(a) || []).length + (exits.get(b) || []).length - 2;
        if (rest <= 0) { set(i, d, -1); return true; }
      }
    }
    for (const [r, ex] of exits) {
      if ((size.get(r) || 0) < n && ex.length === 1) { const [i, d] = ex[0]; set(i, d, 1); return true; }
    }
    return false;
  };

  for (let guard = 0; guard < n * 16 && !contradiction; guard++) {
    if (tier1()) continue;
    if (contradiction) break;
    if (maxTier >= 2) {
      const before = steps.length;
      if (tier2()) {
        // Was Stufe 2 festlegt, wird im nächsten Durchgang von Stufe 1 übernommen —
        // die so festgelegten Zellen bekommen das Etikett „Netz".
        tier1();
        for (let s = before; s < steps.length; s++) steps[s].tier = 2, steps[s].why = 'net';
        continue;
      }
    }
    break;
  }
  const decided = cand.filter((c) => c.length === 1).length;
  return { solved: !contradiction && decided === n, ok: !contradiction, decided, steps, masks: cand.map((c) => (c.length === 1 ? c[0].m : null)), tier2: steps.filter((s) => s.tier === 2).length };
}

/** Nächster erzwungener Schritt ab den vom Spieler RICHTIG gelegten Stücken. */
export function nextDeduction(p, known, maxTier = 1) {
  const res = solveLogic(p, { maxTier, known });
  const k = new Set(known.map((x) => x.i));
  return res.steps.find((s) => !k.has(s.i)) || null;
}
