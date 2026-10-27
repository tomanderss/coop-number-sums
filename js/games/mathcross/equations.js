// model.js — Datenmodell des Rechenkreuz-Rätsels (reine Logik, keine UI).
//
// GRUNDIDEE
// Das Brett ist ein LOGISCHES Raster aus Zahl-Feldern (`rows` × `cols`). Auf
// diesem Raster liegen Gleichungen — waagerecht oder senkrecht, jeweils
// `a op b = c` (n = 2 Operanden) bzw. `a op b op c = d` (n = 3). Eine Gleichung
// belegt also n+1 aufeinanderfolgende Zahl-Felder in ihrer Zeile/Spalte.
//
// Gleichungen KREUZEN sich (Kreuzworträtsel-Prinzip): ein Feld darf zu genau
// EINER waagerechten und EINER senkrechten Gleichung gehören. Sie sind dabei
// NICHT aneinandergekettet — jede Gleichung steht für sich, das geteilte Feld
// trägt nur denselben Wert.
//
// DARSTELLUNG: Das Anzeige-Raster ist doppelt so fein (2*rows-1 × 2*cols-1):
// Zahl-Felder sitzen auf geraden Anzeige-Koordinaten, Operator- und
// Gleichheitszeichen auf den ungeraden Zwischenfeldern.
//
// REGELN (Nutzervorgabe): nur ganze Zahlen, nie Kommazahlen — jede Division
// muss aufgehen. Das ERGEBNIS ist immer positiv; ein Zwischenschritt der
// Plus/Minus-Kette darf dagegen negativ werden, solange er nicht selbst das
// Ergebnis ist (Beispiel des Nutzers: `4 − 42 + 67 = 29`). Punkt vor Strich
// gilt (nur bei 3 Operanden überhaupt relevant).

export const OPS = ['+', '-', '*', '/'];

/** Alle Zahl-Felder einer Gleichung als [r,c]-Paare (Operanden … Ergebnis). */
export function eqCells(eq) {
  const out = [];
  for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? [eq.r, eq.c + i] : [eq.r + i, eq.c]);
  return out;
}

/** Flacher Index eines Feldes im logischen Raster. */
export function slotId(r, c, cols) { return r * cols + c; }

/** Feld-Indizes einer Gleichung (gleiche Reihenfolge wie `eqCells`). */
export function eqIds(eq, cols) {
  const out = [];
  for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? slotId(eq.r, eq.c + i, cols) : slotId(eq.r + i, eq.c, cols));
  return out;
}

/**
 * Wertet `vals[0] ops[0] vals[1] ops[1] …` mit Punkt-vor-Strich aus.
 * Liefert `null`, sobald eine Regel verletzt wird: Division mit Rest, Division
 * durch 0, oder ein negatives ENDergebnis. Negative Zwischenstände der
 * Plus/Minus-Kette sind erlaubt.
 */
export function evalExpr(vals, ops) {
  const v = vals.slice(), o = ops.slice();
  for (let i = 0; i < o.length;) {
    if (o[i] === '*' || o[i] === '/') {
      const a = v[i], b = v[i + 1];
      let r;
      if (o[i] === '*') r = a * b;
      else { if (b === 0 || a % b !== 0) return null; r = a / b; }
      if (r < 0) return null;
      v.splice(i, 2, r); o.splice(i, 1);
    } else i++;
  }
  for (let i = 0; i < o.length;) {
    const a = v[i], b = v[i + 1];
    // Zwischenstände dürfen negativ werden — nur das Endergebnis nicht.
    const r = o[i] === '+' ? a + b : a - b;
    v.splice(i, 2, r); o.splice(i, 1);
  }
  return v[0] < 0 ? null : v[0];
}

/** Prüft eine einzelne Gleichung gegen eine Wertetabelle (`values[id]`). */
export function equationHolds(eq, values, cols) {
  const ids = eqIds(eq, cols);
  const vals = ids.map(id => values[id]);
  if (vals.some(v => v == null)) return null; // unvollständig — noch kein Urteil
  const res = evalExpr(vals.slice(0, eq.n), eq.ops);
  return res != null && res === vals[eq.n];
}

/** Vollständige Werte-Tabelle des gelösten Rätsels (givens + Lösungswerte). */
export function solutionValues(puzzle) {
  const out = new Array(puzzle.rows * puzzle.cols).fill(null);
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const s = puzzle.slots[r][c];
      if (s) out[slotId(r, c, puzzle.cols)] = s.v;
    }
  }
  return out;
}

/** Nur die vorgegebenen Werte; leere Felder (= vom Spieler zu füllen) sind null. */
export function givenValues(puzzle) {
  const out = new Array(puzzle.rows * puzzle.cols).fill(null);
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const s = puzzle.slots[r][c];
      if (s && s.given) out[slotId(r, c, puzzle.cols)] = s.v;
    }
  }
  return out;
}

/** Indizes aller vom Spieler zu füllenden Felder. */
export function blankIds(puzzle) {
  const out = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const s = puzzle.slots[r][c];
      if (s && !s.given) out.push(slotId(r, c, puzzle.cols));
    }
  }
  return out;
}

/** Multimenge als Map value→count. */
export function countMap(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return m;
}

/** Für jedes Feld die Gleichungen, in denen es vorkommt. */
export function equationsBySlot(puzzle) {
  const map = new Map();
  for (const eq of puzzle.equations) {
    for (const id of eqIds(eq, puzzle.cols)) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(eq);
    }
  }
  return map;
}

/**
 * Grobe Plausibilitätsprüfung eines empfangenen Puzzles (Coop/Netzwerk) —
 * verhindert, dass ein kaputtes Objekt den Brett-Render sprengt.
 */
export function validPuzzleShape(p) {
  if (!p || typeof p !== 'object') return false;
  if (!Number.isInteger(p.rows) || !Number.isInteger(p.cols)) return false;
  if (p.rows < 1 || p.cols < 1 || p.rows > 24 || p.cols > 24) return false;
  if (!Array.isArray(p.slots) || p.slots.length !== p.rows) return false;
  for (const row of p.slots) {
    if (!Array.isArray(row) || row.length !== p.cols) return false;
    for (const s of row) {
      if (s === null) continue;
      if (!s || typeof s !== 'object' || !Number.isFinite(s.v)) return false;
    }
  }
  if (!Array.isArray(p.equations) || !p.equations.length) return false;
  for (const eq of p.equations) {
    if (!eq || (eq.dir !== 'h' && eq.dir !== 'v')) return false;
    if (!Number.isInteger(eq.n) || eq.n < 2 || eq.n > 4) return false;
    if (!Array.isArray(eq.ops) || eq.ops.length !== eq.n - 1) return false;
    if (eq.ops.some(o => !OPS.includes(o))) return false;
    for (const [r, c] of eqCells(eq)) {
      if (r < 0 || c < 0 || r >= p.rows || c >= p.cols) return false;
      if (!p.slots[r][c]) return false;
    }
  }
  if (!Array.isArray(p.tray)) return false;
  if (p.tray.some(v => !Number.isFinite(v))) return false;
  return true;
}
