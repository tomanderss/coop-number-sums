// games/numbersums/model.js — das BRETT-MODELL von „Number Sums", rein.
//
// Alles, was sich allein aus `puzzle` + `marks` beantworten laesst: Summen,
// „ist diese Zeile/Spalte/dieser Kaefig aufgeloest?", „ist das Brett fertig?",
// wie weit ist der Fortschritt, die Zellen-Metadaten (Regionen, Raender, Chips)
// und die Struktur-Pruefung eines empfangenen Puzzles.
//
// Warum hier und nicht in app.js: das ist die SPIELREGEL, der einzige Teil, den
// ein zweites Spiel komplett anders beantwortet — waehrend Menue, Coop, Shop,
// Erfolge und Kopfleiste identisch bleiben. In app.js standen diese Funktionen
// auf `state` (dem einen grossen reaktiven Objekt) und waren damit weder
// austauschbar noch einzeln testbar. Hier nehmen sie `puzzle`/`marks`
// ausdruecklich als Argumente; app.js behaelt duenne Weichen mit denselben
// Namen, damit die ~70 Aufrufstellen unveraendert bleiben.
//
// Coop Math Cross hat dasselbe als `js/model.js` — bei der Zusammenlegung zu
// EINER App wird daraus `js/games/mathcross/model.js`.

import { REGION_COLORS } from '../../config.js';

// ── Summen ───────────────────────────────────────────────────────────────────
export function rowSum(p, marks, r) {
  let s = 0;
  for (let c = 0; c < p.cols; c++) if (marks[r][c] === 'kept') s += p.values[r][c];
  return s;
}
export function colSum(p, marks, c) {
  let s = 0;
  for (let r = 0; r < p.rows; r++) if (marks[r][c] === 'kept') s += p.values[r][c];
  return s;
}
export function regionSum(p, marks, i) {
  let s = 0;
  for (const [r, c] of p.regions[i].cells) if (marks[r][c] === 'kept') s += p.values[r][c];
  return s;
}

/** Alle Zeilensummen in einem Durchgang (Render-Cache in app.js). */
export function rowSums(p, marks) {
  const a = new Array(p.rows);
  for (let r = 0; r < p.rows; r++) a[r] = rowSum(p, marks, r);
  return a;
}
/** Alle Spaltensummen in einem Durchgang (Render-Cache in app.js). */
export function colSums(p, marks) {
  const a = new Array(p.cols);
  for (let c = 0; c < p.cols; c++) a[c] = colSum(p, marks, c);
  return a;
}

// ── Fertig-Status ────────────────────────────────────────────────────────────
// Eine Gruppe gilt erst als „aufgeloest", wenn JEDE Zelle korrekt markiert ist
// (Loesungszellen eingekreist, alle anderen geloescht) — nicht schon, wenn die
// Summe stimmt. Kein automatisches Aufloesen.
export function cellCorrect(p, marks, r, c) {
  return p.solution[r][c] ? marks[r][c] === 'kept' : marks[r][c] === 'removed';
}
export function rowResolved(p, marks, r) {
  for (let c = 0; c < p.cols; c++) if (!cellCorrect(p, marks, r, c)) return false;
  return true;
}
export function colResolved(p, marks, c) {
  for (let r = 0; r < p.rows; r++) if (!cellCorrect(p, marks, r, c)) return false;
  return true;
}
export function regionResolved(p, marks, i) {
  for (const [r, c] of p.regions[i].cells) if (!cellCorrect(p, marks, r, c)) return false;
  return true;
}

/** Ist das Brett vollstaendig und korrekt geloest? */
export function isSolved(p, marks) {
  if (!p) return false;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      if (!cellCorrect(p, marks, r, c)) return false;
  return true;
}

/**
 * Fortschritt in Prozent = korrekt markierte Zellen / alle Zellen. Bewusst
 * generisch (kein Team-/Race-Bezug im Namen): Team und 1v1 schicken NUR diesen
 * Prozentwert + die Fehlerzahl ueber die Leitung, nie Zellinhalte — sonst waere
 * es ein Antwort-Leak an die Gegenseite. `snapshotProgress` in storage.js nutzt
 * dieselbe Formel, damit Spielstand-Liste und laufendes Spiel dieselbe Zahl
 * zeigen.
 */
export function progressPct(p, marks) {
  if (!p) return 0;
  let total = 0, correct = 0;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) { total++; if (cellCorrect(p, marks, r, c)) correct++; }
  return total ? Math.round((correct / total) * 100) : 0;
}

/**
 * Alle FALSCH markierten Zellen (eingekreist, obwohl sie weg muessen, oder
 * umgekehrt). Grundlage des „Pruefen"-Knopfes; die Fehler-/Leben-Buchhaltung
 * drumherum gehoert zur Schale, weil sie in jedem Spiel gleich ist.
 */
export function findWrongCells(p, marks) {
  const wrong = [];
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      const mk = marks[r][c], sol = p.solution[r][c];
      if ((mk === 'kept' && !sol) || (mk === 'removed' && sol)) wrong.push([r, c]);
    }
  return wrong;
}

// ── Zellen-Metadaten (Regionen, Raender, Chips) ──────────────────────────────
/**
 * Pro Zelle: zu welchem Kaefig sie gehoert, seine Farbe, auf welchen Seiten ein
 * Kaefig-Rand gezeichnet wird, und ob sie den Ziel-Chip des Kaefigs traegt (die
 * oberste-linkeste Zelle). Rein aus dem Puzzle berechnet.
 */
export function buildCellMeta(puzzle) {
  const { rows, cols, regions } = puzzle;
  const meta = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ region: -1, color: null, edges: {}, chip: null, hint: false, hintMark: false })));
  // Regions-ID-Gitter aufbauen
  const rid = Array.from({ length: rows }, () => Array(cols).fill(-1));
  regions.forEach((reg, ri) => { for (const [r, c] of reg.cells) rid[r][c] = ri; });
  const same = (r, c, ri) => r >= 0 && r < rows && c >= 0 && c < cols && rid[r][c] === ri;

  regions.forEach((reg, ri) => {
    const color = REGION_COLORS[reg.colorIndex % REGION_COLORS.length];
    let chipCell = null;
    for (const [r, c] of reg.cells) {
      const m = meta[r][c];
      m.region = ri; m.color = color;
      // Rand auf einer Seite, wenn der Nachbar zu einer anderen Region gehört (oder außerhalb)
      m.edges = {
        t: !same(r - 1, c, ri), b: !same(r + 1, c, ri),
        l: !same(r, c - 1, ri), r: !same(r, c + 1, ri),
      };
      if (chipCell === null || r < chipCell[0] || (r === chipCell[0] && c < chipCell[1])) chipCell = [r, c];
    }
    if (chipCell) meta[chipCell[0]][chipCell[1]].chip = reg.target;
  });
  return meta;
}

// ── Struktur-Pruefung eines empfangenen Puzzles ──────────────────────────────
/**
 * Minimale Struktur-Pruefung eines per Coop-INIT empfangenen Puzzles: alles,
 * was Brett-Template und `loadPuzzleIntoState` zwingend brauchen. Verhindert,
 * dass ein kaputtes INIT die App halb laedt (Spiel-Screen ohne Brett =
 * Blackscreen).
 */
export function validPuzzleShape(p) {
  return !!(p && Number.isInteger(p.rows) && p.rows > 0 && Number.isInteger(p.cols) && p.cols > 0
    && Array.isArray(p.values) && p.values.length === p.rows && Array.isArray(p.values[0])
    && Array.isArray(p.solution) && p.solution.length === p.rows
    && Array.isArray(p.rowTargets) && Array.isArray(p.colTargets));
}
