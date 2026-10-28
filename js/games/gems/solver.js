// games/gems/solver.js — logischer Löser für „Gem Hunt" (Star Battle mit einem
// Stein je Zeile/Spalte/Käfig). Zieht NUR erzwungene Schlüsse — geraten wird
// nie. Was er nicht ganz löst, ist für ein Rätsel ohne Raten ungeeignet.
//
// Stufen (so würde es ein Mensch auch sehen):
//   1 · „nur noch ein Feld": eine Zeile/Spalte/ein Käfig hat genau ein freies Feld.
//     · „eingesperrt": alle freien Felder eines Käfigs liegen in EINER Zeile
//       (Spalte) → der Rest dieser Zeile ist aus; ebenso Zeile/Spalte → Käfig.
//     · „würde alles blockieren": ein Stein auf X nähme einer anderen Zeile/
//       Spalte/einem Käfig das letzte freie Feld → X ist aus.
//   2 · „Schubfach": k Käfige liegen zusammen in genau k Zeilen (Spalten) → in
//       diesen Zeilen ist außerhalb dieser Käfige alles aus (und umgekehrt).
//
// Ergebnis: { solved, stars, steps: [{ tier, kind, unit, place?, out? }], ok }

import { neighbors8 } from './model.js';

function units(p) {
  const n = p.rows;
  const rows = [], cols = [], regs = [];
  for (let k = 0; k < n; k++) { rows.push([]); cols.push([]); regs.push([]); }
  for (let i = 0; i < n * n; i++) {
    rows[Math.floor(i / n)].push(i);
    cols[i % n].push(i);
    regs[p.regions[i]].push(i);
  }
  return { rows, cols, regs };
}

/**
 * Löst so weit wie möglich. `known` = bereits feststehende Steine (Zellindizes),
 * `maxTier` = höchste erlaubte Stufe. Bricht beim ersten Widerspruch ab (ok:false).
 */
export function solveLogic(p, { maxTier = 2, known = [], maxK = 4 } = {}) {
  const n = p.rows, N = n * n;
  const U = units(p);
  const rowOf = (i) => Math.floor(i / n), colOf = (i) => i % n, regOf = (i) => p.regions[i];
  // „Blockiert" ist symmetrisch (Zeile, Spalte, Käfig, Nachbar) — einmal je Lösung
  // als Liste UND als Tabelle vorberechnen, das macht Stufe 1c billig.
  const blk = [], blkM = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) {
    const set = new Set(neighbors8(n, i));
    for (const j of U.rows[rowOf(i)]) set.add(j);
    for (const j of U.cols[colOf(i)]) set.add(j);
    for (const j of U.regs[regOf(i)]) set.add(j);
    set.delete(i);
    const l = [...set];
    blk.push(l);
    for (const j of l) blkM[i * N + j] = 1;
  }
  const cand = new Int8Array(N);   // 0 offen, 1 Stein, -1 aus
  const steps = [];
  let ok = true;
  function place(i) {
    if (cand[i] === 1) return;
    if (cand[i] === -1) { ok = false; return; }
    cand[i] = 1;
    for (const j of blk[i]) { if (cand[j] === 1) { ok = false; return; } cand[j] = -1; }
  }
  const open = (list) => list.filter((i) => cand[i] === 0);
  const hasStar = (list) => { for (const i of list) if (cand[i] === 1) return true; return false; };
  for (const k of known) place(k);

  const ALL = [
    ...U.rows.map((l, k) => ({ type: 'row', k, l })),
    ...U.cols.map((l, k) => ({ type: 'col', k, l })),
    ...U.regs.map((l, k) => ({ type: 'reg', k, l })),
  ];
  const inUnit = (u, x) => (u.type === 'row' ? rowOf(x) === u.k : u.type === 'col' ? colOf(x) === u.k : regOf(x) === u.k);
  function eliminate(cells, tier, kind, unit) {
    const out = cells.filter((i) => cand[i] === 0);
    if (!out.length) return false;
    for (const i of out) cand[i] = -1;
    steps.push({ tier, kind, unit, out });
    return true;
  }

  for (let guard = 0; guard < N * 6 && ok; guard++) {
    let progress = false;
    // Stufe 1a: Einheit mit genau einem freien Feld.
    for (const u of ALL) {
      if (hasStar(u.l)) continue;
      const o = open(u.l);
      if (!o.length) { ok = false; break; }
      if (o.length === 1) { place(o[0]); steps.push({ tier: 1, kind: 'single', unit: { type: u.type, k: u.k }, place: o[0] }); progress = true; break; }
    }
    if (!ok) break;
    if (progress) continue;
    // Stufe 1b: eingesperrt (Käfig in einer Zeile/Spalte; Zeile/Spalte in einem Käfig).
    for (let k = 0; k < n && !progress; k++) {
      const l = U.regs[k];
      if (hasStar(l)) continue;
      const o = open(l);
      const r0 = rowOf(o[0]), c0 = colOf(o[0]);
      if (o.every((i) => rowOf(i) === r0) && eliminate(U.rows[r0].filter((i) => regOf(i) !== k), 1, 'regInLine', { type: 'reg', k })) progress = true;
      else if (o.every((i) => colOf(i) === c0) && eliminate(U.cols[c0].filter((i) => regOf(i) !== k), 1, 'regInLine', { type: 'reg', k })) progress = true;
    }
    if (progress) continue;
    for (const u of ALL) {
      if (u.type === 'reg' || hasStar(u.l)) continue;
      const o = open(u.l);
      const g = regOf(o[0]);
      if (o.every((i) => regOf(i) === g) && eliminate(U.regs[g].filter((i) => !inUnit(u, i)), 1, 'lineInReg', { type: u.type, k: u.k })) { progress = true; break; }
    }
    if (progress) continue;
    // Stufe 1c: ein Stein auf X würde einer anderen Einheit das letzte Feld nehmen.
    // X muss dazu JEDES freie Feld der Einheit blockieren = Schnitt ihrer Blocklisten.
    for (const u of ALL) {
      if (hasStar(u.l)) continue;
      const o = open(u.l);
      const hit = [];
      for (const x of blk[o[0]]) {
        if (cand[x] !== 0 || inUnit(u, x)) continue;
        let all = true;
        for (let q = 1; q < o.length; q++) if (!blkM[o[q] * N + x]) { all = false; break; }
        if (all) hit.push(x);
      }
      if (hit.length) {
        for (const x of hit) cand[x] = -1;
        steps.push({ tier: 1, kind: 'blocks', unit: { type: u.type, k: u.k }, out: hit });
        progress = true; break;
      }
    }
    if (progress) continue;
    if (maxTier < 2) break;
    // Stufe 2: Schubfach mit k = 2..maxK.
    const freeRegs = U.regs.map((l, k) => ({ l, k })).filter((r) => !hasStar(r.l));
    const freeRows = U.rows.map((l, k) => ({ l, k })).filter((r) => !hasStar(r.l));
    const freeCols = U.cols.map((l, k) => ({ l, k })).filter((r) => !hasStar(r.l));
    const regOpen = freeRegs.map((r) => open(r.l));
    const lineSets = [['row', rowOf, U.rows, freeRows], ['col', colOf, U.cols, freeCols]];
    outer:
    for (let k = 2; k <= maxK; k++) {
      for (const [type, lineOf, lines, free] of lineSets) {
        // k Käfige in genau k Zeilen → Rest dieser Zeilen aus.
        for (const combo of combos([...freeRegs.keys()], k)) {
          const ls = new Set();
          for (const x of combo) { for (const i of regOpen[x]) ls.add(lineOf(i)); if (ls.size > k) break; }
          if (ls.size !== k) continue;
          const inside = new Set(combo.map((x) => freeRegs[x].k));
          const cells = [];
          for (const L of ls) for (const i of lines[L]) if (!inside.has(regOf(i))) cells.push(i);
          if (eliminate(cells, 2, 'regsInLines', { type, k: [...ls], regs: [...inside] })) { progress = true; break outer; }
        }
        // k Zeilen liegen zusammen in genau k Käfigen → Rest dieser Käfige aus.
        const lineOpen = free.map((L) => open(L.l));
        for (const combo of combos([...free.keys()], k)) {
          const gs = new Set();
          for (const x of combo) { for (const i of lineOpen[x]) gs.add(regOf(i)); if (gs.size > k) break; }
          if (gs.size !== k) continue;
          const lineIds = new Set(combo.map((x) => free[x].k));
          const cells = [];
          for (const g of gs) for (const i of U.regs[g]) if (!lineIds.has(lineOf(i))) cells.push(i);
          if (eliminate(cells, 2, 'linesInRegs', { type, k: [...lineIds], regs: [...gs] })) { progress = true; break outer; }
        }
      }
    }
    if (!progress) break;
  }
  const stars = [], undecided = [];
  for (let i = 0; i < N; i++) { if (cand[i] === 1) stars.push(i); else if (cand[i] === 0) undecided.push(i); }
  return { solved: ok && stars.length === n, stars, steps, ok, decided: N - undecided.length, undecided };
}

function* combos(list, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc; return; }
  for (let i = start; i <= list.length - (k - acc.length); i++) yield* combos(list, k, i + 1, acc.concat([list[i]]));
}

/** Zahl der Lösungen (bis `cap`) per Rücksetzsuche — nur für Tests/Generator-Kontrolle. */
export function countSolutions(p, cap = 2) {
  const n = p.rows;
  let count = 0;
  const cols = new Array(n).fill(false), regs = new Array(n).fill(false);
  const pick = [];
  function go(r) {
    if (count >= cap) return;
    if (r === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (cols[c] || regs[p.regions[i]]) continue;
      if (r > 0 && Math.abs(pick[r - 1] - c) <= 1) continue;
      cols[c] = regs[p.regions[i]] = true; pick[r] = c;
      go(r + 1);
      cols[c] = regs[p.regions[i]] = false;
    }
  }
  go(0);
  return count;
}

/** Der nächste Stein, den der Löser ab den gegebenen (richtigen) Steinen setzt. */
export function nextDeduction(p, known, maxTier = 1) {
  const res = solveLogic(p, { maxTier, known });
  const step = res.steps.find((s) => s.place != null && !known.includes(s.place));
  return step || null;
}
