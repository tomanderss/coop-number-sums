// board.js — reine Brett-Logik: Anzeige-Raster, Vorrat, Zugprüfung.
// Kein Vue, kein DOM — damit alles unit-testbar bleibt (app.js verdrahtet nur).

import { eqCells, eqIds, slotId, evalExpr, equationHolds, solutionValues, blankIds } from './equations.js';

export const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/**
 * Ein Rätsel, das durch die Firebase-RTDB gereist ist, wieder DICHT machen.
 *
 * Die RTDB speichert KEINE null-Werte: `slots` ist ein 2D-Raster mit null für
 * jede tote Zelle (die Löcher und Ausläufer des Kreuzworts) und kommt deshalb
 * als Objekt mit numerischen Schlüsseln zurück — eine Zeile OHNE einzige Zelle
 * fehlt sogar komplett. `buildDisplay` greift mit `puzzle.slots[r][c]` zu und
 * warf dann einen TypeError; Vue bricht den Brett-Teilbaum ab (der bekannte
 * Blackscreen). Betroffen ist alles, was ein Rätsel über die Cloud trägt: die
 * Bibliothek gespeicherter Partien, die Aktivspiel-Slots, die Cloud-Session und
 * das Coop-INIT.
 *
 * Rein und idempotent — ein lokal erzeugtes Rätsel geht unverändert durch.
 */
export function normalizePuzzle(p) {
  if (!p || !p.rows || !p.cols) return p;
  const src = p.slots;
  if (!src) return p;
  const dense = Array.isArray(src) && src.length === p.rows
    && src.every((row) => Array.isArray(row) && row.length === p.cols);
  const eqs = p.equations;
  const eqDense = Array.isArray(eqs);
  if (dense && eqDense) return p;
  const slots = [];
  for (let r = 0; r < p.rows; r++) {
    const row = src[r] || {};
    const out = new Array(p.cols).fill(null);
    for (let c = 0; c < p.cols; c++) out[c] = row[c] != null ? row[c] : null;
    slots.push(out);
  }
  return { ...p, slots, equations: eqDense ? eqs : Object.values(eqs || {}) };
}

/**
 * Baut das ANZEIGE-Raster: (2*rows-1) × (2*cols-1). Zahl-Felder sitzen auf
 * geraden Koordinaten, Operator-/Gleichheitszeichen dazwischen.
 * @returns {{rows, cols, cells}} cells[dr][dc] = null | {t:'num',r,c,given} | {t:'op',sym}
 */
// `divSym` beschriftet die Divisions-Felder (Nutzer-Einstellung, s. DIV_STYLES
// in config.js). Default = Obelus, damit jeder Alt-Aufruf unverändert bleibt.
export function buildDisplay(puzzle, divSym = '÷') {
  const rows = puzzle.rows * 2 - 1, cols = puzzle.cols * 2 - 1;
  const cells = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const s = puzzle.slots[r][c];
      if (s) cells[r * 2][c * 2] = { t: 'num', r, c, given: !!s.given };
    }
  }
  for (const eq of puzzle.equations) {
    const cs = eqCells(eq);
    for (let i = 0; i < eq.n; i++) {
      const [r1, c1] = cs[i], [r2, c2] = cs[i + 1];
      const sym = i < eq.n - 1 ? (eq.ops[i] === '/' ? divSym : OP_SYMBOL[eq.ops[i]]) : '=';
      cells[r1 + r2][c1 + c2] = { t: 'op', sym, eqIndex: puzzle.equations.indexOf(eq) };
    }
  }
  return { rows, cols, cells };
}

/** Vorrat als Anzeige-Liste. Ein benutzter Stein hinterlässt eine LÜCKE. */
export function buildTray(puzzle) {
  return puzzle.tray.map((v, i) => ({ id: i, v, used: false }));
}

/** Nimmt EINEN unbenutzten Stein mit dem Wert v aus dem Vorrat (mutiert). */
export function takeFromTray(tray, v) {
  const t = tray.find(x => !x.used && x.v === v);
  if (t) { t.used = true; return t; }
  return null;
}

/** Legt einen Stein mit Wert v zurück. Fehlt sein Platz, kommt er hinten dazu. */
export function returnToTray(tray, v) {
  const t = tray.find(x => x.used && x.v === v);
  if (t) { t.used = false; return t; }
  const fresh = { id: tray.length ? Math.max(...tray.map(x => x.id)) + 1 : 0, v, used: false };
  tray.push(fresh);
  return fresh;
}

/**
 * Bringt den Vorrat zwingend mit Brett + Rätsel in Einklang: die OFFENEN Steine
 * müssen exakt die noch fehlenden Zahlen sein (Rätsel-Vorrat minus alles, was
 * schon auf dem Brett liegt). Rein — heilt beim Laden auch alte, verkorkste
 * Spielstände.
 *
 * Nötig, weil der Vorrat sonst auseinanderlaufen kann: `returnToTray` legt einen
 * fehlenden Stein wieder an, und beim TAUSCH
 * zweier gelegter Steine lief das Auf und Ab so gegeneinander, dass ein Stein
 * doppelt existierte (gemeldet: „manche Level haben zu viele Steine").
 * Reihenfolge und ids bestehender Steine bleiben erhalten, es wird nur
 * Überzähliges entfernt und Fehlendes ergänzt.
 */
/**
 * Prüft in O(n), ob Vorrat und Brett zusammenpassen: die OFFENEN Steine müssen
 * exakt die noch fehlenden Zahlen sein. Rein — die billige Wache vor dem
 * teureren `reconcileTray` (das alle ids neu vergibt und deshalb nur laufen
 * darf, wenn wirklich etwas auseinandergelaufen ist).
 */
export function trayMatchesBoard(tray, placedValues, puzzleTray) {
  const need = new Map();                       // Wert -> wie viele noch OFFEN sein müssen
  for (const v of puzzleTray || []) need.set(v, (need.get(v) || 0) + 1);
  for (const v of placedValues || []) {
    const n = need.get(v) || 0;
    if (n <= 0) return false;                   // liegt auf dem Brett, gehört aber nicht dazu
    need.set(v, n - 1);
  }
  for (const t of (Array.isArray(tray) ? tray : [])) {
    if (!t || t.used) continue;
    const n = need.get(t.v) || 0;
    if (n <= 0) return false;                   // ein Stein zu viel im Vorrat
    need.set(t.v, n - 1);
  }
  for (const n of need.values()) if (n > 0) return false;   // ein Stein fehlt im Vorrat
  return true;
}

export function reconcileTray(tray, placedValues, puzzleTray) {
  const open = new Map();          // Wert -> wie viele Steine OFFEN sein müssen
  for (const v of puzzleTray || []) open.set(v, (open.get(v) || 0) + 1);
  const used = new Map();          // Wert -> wie viele Steine auf dem Brett liegen
  for (const v of placedValues || []) used.set(v, (used.get(v) || 0) + 1);
  for (const [v, n] of used) open.set(v, Math.max(0, (open.get(v) || 0) - n));
  const out = [];
  for (const t of (Array.isArray(tray) ? tray : [])) {
    const bucket = t && t.used ? used : open;
    const n = (t && bucket.get(t.v)) || 0;
    if (n <= 0) continue;                       // überzählig → fällt weg
    bucket.set(t.v, n - 1);
    out.push({ v: t.v, used: !!t.used });
  }
  for (const [v, n] of open) for (let i = 0; i < n; i++) out.push({ v, used: false });
  for (const [v, n] of used) for (let i = 0; i < n; i++) out.push({ v, used: true });
  return out.map((t, i) => ({ ...t, id: i }));
}

/** Wie viele Steine liegen noch im Vorrat? */
export function trayLeft(tray) { return tray.reduce((n, t) => n + (t.used ? 0 : 1), 0); }

/** Leeres Platzierungs-Raster (nur Lücken sind belegbar). */
export function emptyPlaced(puzzle) {
  return Array.from({ length: puzzle.rows }, () => new Array(puzzle.cols).fill(null));
}

/** Vorgaben + bereits gelegte Steine als flache Wertetabelle (für den Solver). */
export function currentValues(puzzle, placed) {
  const out = new Array(puzzle.rows * puzzle.cols).fill(null);
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const s = puzzle.slots[r][c];
      if (!s) continue;
      out[slotId(r, c, puzzle.cols)] = s.given ? s.v : (placed[r][c] ?? null);
    }
  }
  return out;
}

/** Indizes der Gleichungen, die dieses Feld enthalten. */
export function equationsAt(puzzle, r, c) {
  const id = slotId(r, c, puzzle.cols);
  const out = [];
  puzzle.equations.forEach((eq, i) => { if (eqIds(eq, puzzle.cols).includes(id)) out.push(i); });
  return out;
}

/**
 * Prüft, ob das Legen von `v` auf (r,c) eine Gleichung VOLLSTÄNDIG macht, die
 * dann nicht aufgeht. Genau das — und nur das — ist ein Fehler: eine Zahl an
 * der falschen Stelle, bei der alle vollen Rechnungen weiter stimmen, ist kein
 * Fehler, sondern fällt dem Spieler erst am Ende auf (übrige Steine).
 */
export function placementBreaksEquation(puzzle, placed, r, c, v) {
  const values = currentValues(puzzle, placed);
  values[slotId(r, c, puzzle.cols)] = v;
  for (const i of equationsAt(puzzle, r, c)) {
    if (equationHolds(puzzle.equations[i], values, puzzle.cols) === false) return true;
  }
  return false;
}

/** Gleichungen, die aktuell vollständig UND korrekt sind (grüne Hervorhebung). */
export function solvedEquationSet(puzzle, placed) {
  const values = currentValues(puzzle, placed);
  const set = new Set();
  puzzle.equations.forEach((eq, i) => { if (equationHolds(eq, values, puzzle.cols) === true) set.add(i); });
  return set;
}

/** Gelöst = jede Lücke gefüllt und jede Gleichung geht auf. */
export function isBoardSolved(puzzle, placed) {
  const values = currentValues(puzzle, placed);
  if (values.some((v, id) => v == null && puzzle.slots[Math.floor(id / puzzle.cols)][id % puzzle.cols])) return false;
  return puzzle.equations.every(eq => equationHolds(eq, values, puzzle.cols) === true);
}

/** Anzahl gefüllter Lücken / Anzahl Lücken. */
export function progressOf(puzzle, placed) {
  const blanks = blankIds(puzzle);
  if (!blanks.length) return 1;
  let filled = 0;
  for (const id of blanks) if (placed[Math.floor(id / puzzle.cols)][id % puzzle.cols] != null) filled++;
  return filled / blanks.length;
}

/** Der korrekte Wert eines Feldes (für Hinweise/Trainings-Schritte). */
export function solutionAt(puzzle, r, c) {
  const s = puzzle.slots[r][c];
  return s ? s.v : null;
}

/** Liegt auf (r,c) ein FALSCH platzierter Stein? (nur für die Auswertung am Ende) */
export function misplacedCells(puzzle, placed) {
  const out = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const s = puzzle.slots[r][c];
      if (s && !s.given && placed[r][c] != null && placed[r][c] !== s.v) out.push([r, c]);
    }
  }
  return out;
}

export { solutionValues, evalExpr };

// ─── ANZEIGE DES GETEILT-ZEICHENS ─────────────────────────────────────────────
// REIN KOSMETISCH — das Raetsel, seine Loesung und jede Pruefung rechnen
// unveraendert mit '/'; nur die Beschriftung der Operator-Felder (und der
// Erklaertext des Tipp-Tutors) aendert sich. Der Obelus ist in vielen Schriften
// so eng gesetzt, dass er auf kleinen Feldern wie ein Plus aussieht (gemeldet)
// — deshalb ist er selbst gezeichnet (.op-obelus) und es gibt zusaetzlich die
// beiden schriftunabhaengigen Alternativen. Stand in Coop Math Cross in
// js/config.js; gehoert aber allein zu diesem Spiel.
export const DIV_STYLES = [
  { id: 'obelus', sym: '÷' },
  { id: 'colon', sym: ':' },
  { id: 'slash', sym: '/' },
];
export const DIV_STYLE_DEFAULT = 'obelus';
export function divSymbolFor(styleId) {
  const d = DIV_STYLES.find(x => x.id === styleId);
  return d ? d.sym : '÷';
}
