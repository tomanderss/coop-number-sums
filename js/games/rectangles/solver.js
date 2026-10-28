// games/rectangles/solver.js — Lösen OHNE Raten.
//
// Für jede Zahl gibt es eine Liste möglicher Rechtecke (Fläche = Zahl, die Zahl
// liegt darin, keine andere Zahl liegt darin, alles auf dem Brett). Gelöst wird
// ausschließlich über ERZWUNGENE Schlüsse; jeder Schritt wird protokolliert —
// daraus entstehen später Tipps und Training.
//
// Stufen (Tier) der Schlüsse:
//   1  „nur eine Form"   — für eine Zahl ist genau ein Rechteck übrig.
//      „nur eine Zahl"   — eine Zelle kann nur noch von EINER Zahl erreicht
//                          werden; deren Rechtecke müssen sie enthalten.
//   2  „sicherer Kern"   — alle übrigen Rechtecke einer Zahl teilen sich Zellen;
//                          die gehören sicher zu ihr, andere Zahlen verlieren sie.
// Geraten (Ausprobieren mit Widerspruch) wird NIE; der Generator verwirft jedes
// Rätsel, das diese Stufen nicht vollständig lösen.

/** Alle möglichen Rechtecke je Zahl. */
export function candidates(p) {
  const clueAt = new Map();
  p.clues.forEach((k, i) => clueAt.set(k.r * p.cols + k.c, i));
  return p.clues.map((k, i) => {
    const out = [];
    for (let h = 1; h <= k.n; h++) {
      if (k.n % h) continue;
      const w = k.n / h;
      if (h > p.rows || w > p.cols) continue;
      for (let r = Math.max(0, k.r - h + 1); r <= Math.min(k.r, p.rows - h); r++) {
        for (let c = Math.max(0, k.c - w + 1); c <= Math.min(k.c, p.cols - w); c++) {
          const cells = [];
          let ok = true;
          for (let rr = r; rr < r + h && ok; rr++) for (let cc = c; cc < c + w; cc++) {
            const id = rr * p.cols + cc;
            const o = clueAt.get(id);
            if (o !== undefined && o !== i) { ok = false; break; }
            cells.push(id);
          }
          if (ok) out.push({ r, c, h, w, cells });
        }
      }
    }
    return out;
  });
}

/**
 * Logisch lösen. `maxTier` begrenzt die erlaubten Schlüsse. `known` (optional):
 * Liste { k, r, c, h, w } bereits feststehender Rechtecke (z. B. richtig gezogene
 * des Spielers), die als Ausgangslage gelten.
 *
 * Liefert { solved, contradiction, rects (je Zahl das Rechteck oder null),
 *           steps: [{ tier, kind, k, cell? }], maxTierUsed, tier2Steps }.
 */
export function solveLogic(p, { maxTier = 2, known = null, maxSteps = Infinity } = {}) {
  const N = p.rows * p.cols, K = p.clues.length;
  const cands = candidates(p);
  const alive = cands.map((list) => new Uint8Array(list.length).fill(1));
  const aliveN = cands.map((list) => list.length);
  const owner = new Int16Array(N).fill(-1);
  // Wer kann welche Zelle noch erreichen? cover[cell] = Liste [k, idx].
  const cover = Array.from({ length: N }, () => []);
  cands.forEach((list, k) => list.forEach((q, j) => { for (const id of q.cells) cover[id].push(k, j); }));
  const fixed = new Uint8Array(K);
  const steps = [];
  let contradiction = false, maxTierUsed = 0, tier2Steps = 0;

  const kill = (k, j) => { if (alive[k][j]) { alive[k][j] = 0; aliveN[k]--; if (!aliveN[k]) contradiction = true; } };
  // Zelle `id` gehört sicher zu Zahl `k`: alle fremden Rechtecke darüber fallen
  // weg, und k behält nur Rechtecke, die die Zelle enthalten.
  const own = (id, k) => {
    if (owner[id] === k) return false;
    if (owner[id] >= 0) { contradiction = true; return false; }
    owner[id] = k;
    const cv = cover[id];
    for (let t = 0; t < cv.length; t += 2) if (cv[t] !== k) kill(cv[t], cv[t + 1]);
    cands[k].forEach((q, j) => { if (alive[k][j] && !q.cells.includes(id)) kill(k, j); });
    return true;
  };
  const note = (tier, kind, k, cell) => {
    steps.push(cell == null ? { tier, kind, k } : { tier, kind, k, cell });
    if (tier > maxTierUsed) maxTierUsed = tier;
    if (tier === 2) tier2Steps++;
  };

  if (known) {
    for (const q of known) {
      const k = q.k;
      if (k == null || k < 0 || k >= K) continue;
      const j = cands[k].findIndex((x) => x.r === q.r && x.c === q.c && x.h === q.h && x.w === q.w);
      if (j < 0) { contradiction = true; break; }
      for (const id of cands[k][j].cells) own(id, k);
    }
  }

  // Ein Schritt = der einfachste gerade mögliche Schluss (Tier 1 vor Tier 2).
  // So entsteht eine Kette, die ein Mensch nachvollziehen kann.
  const stepOnce = () => {
    // Tier 1a: nur noch eine Form.
    for (let k = 0; k < K; k++) {
      if (fixed[k] || aliveN[k] !== 1) continue;
      fixed[k] = 1;
      const j = alive[k].indexOf(1);
      let changed = false;
      for (const id of cands[k][j].cells) changed = own(id, k) || changed;
      note(1, 'single', k);
      return true;
    }
    // Tier 1b: eine Zelle kann nur eine Zahl erreichen.
    for (let id = 0; id < N; id++) {
      if (owner[id] >= 0) continue;
      const cv = cover[id];
      let only = -1, many = false;
      for (let t = 0; t < cv.length; t += 2) {
        if (!alive[cv[t]][cv[t + 1]]) continue;
        if (only < 0) only = cv[t]; else if (cv[t] !== only) { many = true; break; }
      }
      if (only < 0) { contradiction = true; return false; }
      if (!many) { own(id, only); note(1, 'onlyclue', only, id); return true; }
    }
    if (maxTier < 2) return false;
    // Tier 2: sicherer Kern einer Zahl.
    for (let k = 0; k < K; k++) {
      if (fixed[k]) continue;
      let core = null;
      cands[k].forEach((q, j) => {
        if (!alive[k][j]) return;
        if (!core) core = new Set(q.cells);
        else for (const id of [...core]) if (!q.cells.includes(id)) core.delete(id);
      });
      if (!core) continue;
      const fresh = [...core].filter((id) => owner[id] !== k);
      if (!fresh.length) continue;
      for (const id of fresh) own(id, k);
      note(2, 'core', k, fresh[0]);
      return true;
    }
    return false;
  };

  while (!contradiction && steps.length < maxSteps && stepOnce()) { /* weiter */ }

  const rects = cands.map((list, k) => {
    if (aliveN[k] !== 1) return null;
    const q = list[alive[k].indexOf(1)];
    return { r: q.r, c: q.c, h: q.h, w: q.w };
  });
  let ownedAll = true;
  for (let id = 0; id < N; id++) if (owner[id] < 0) { ownedAll = false; break; }
  const solved = !contradiction && ownedAll && rects.every(Boolean);
  return { solved, contradiction, rects, steps, maxTierUsed, tier2Steps };
}

/**
 * Lösungen zählen (exakte Überdeckung, mit Abbruch bei `limit`). Nur für Tests
 * und Absicherung — der Generator verlässt sich auf solveLogic, das nur
 * erzwungene Schlüsse zieht und damit Eindeutigkeit bereits beweist.
 */
export function countSolutions(p, limit = 2) {
  const N = p.rows * p.cols;
  const cands = candidates(p);
  const used = new Uint8Array(N);
  const done = new Uint8Array(p.clues.length);
  let count = 0;
  const firstFree = () => { for (let id = 0; id < N; id++) if (!used[id]) return id; return -1; };
  const rec = () => {
    if (count >= limit) return;
    const id = firstFree();
    if (id < 0) { count++; return; }
    // Die erste freie Zelle muss von irgendeinem Rechteck bedeckt werden.
    for (let k = 0; k < cands.length; k++) {
      if (done[k]) continue;
      for (const q of cands[k]) {
        if (!q.cells.includes(id) || q.cells.some((x) => used[x])) continue;
        for (const x of q.cells) used[x] = 1;
        done[k] = 1;
        rec();
        done[k] = 0;
        for (const x of q.cells) used[x] = 0;
        if (count >= limit) return;
      }
    }
  };
  rec();
  return count;
}
