import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../js/games/mathcross/model.js';
import { generatePuzzle } from '../../js/games/mathcross/generator.js';
import { genOptionsFor } from '../../js/games/mathcross/difficulty.js';
import { divSymbolFor } from '../../js/games/mathcross/model.js';
import { nextForcedStep } from '../../js/games/mathcross/hinttutor.js';
import { nextTrainingStep } from '../../js/games/mathcross/training.js';

// 8 - □ = 5 (waagerecht) kreuzt □ + 2 = 5 (senkrecht) im Ergebnisfeld.
function fixture() {
  return {
    rows: 3, cols: 3,
    slots: [
      [{ v: 8, given: true }, { v: 3, given: false }, { v: 5, given: false }],
      [null, null, { v: 2, given: true }],
      [null, null, { v: 7, given: true }],
    ],
    equations: [
      { dir: 'h', r: 0, c: 0, n: 2, ops: ['-'] },
      { dir: 'v', r: 0, c: 2, n: 2, ops: ['+'] },
    ],
    tray: [3, 5],
  };
}

test('buildDisplay setzt Zahlen auf gerade, Operatoren auf ungerade Felder', () => {
  const p = fixture();
  const d = B.buildDisplay(p);
  assert.equal(d.rows, 5);
  assert.equal(d.cols, 5);
  assert.deepEqual(d.cells[0][0], { t: 'num', r: 0, c: 0, given: true });
  assert.equal(d.cells[0][1].sym, '−');
  assert.equal(d.cells[0][3].sym, '=');
  assert.equal(d.cells[1][4].sym, '+');
  assert.equal(d.cells[1][0], null, 'zwischen zwei Gleichungen bleibt es leer');
});

test('Vorrat: ein genommener Stein bleibt als benutzter Platz stehen', () => {
  const tray = [5, 1, 9, 1].map((v, i) => ({ id: i, v, used: false }));
  B.takeFromTray(tray, 9);
  assert.equal(B.trayLeft(tray), 3);
  assert.equal(tray[2].used, true, 'der Platz bleibt stehen (die UI rendert ihn nicht)');
  B.returnToTray(tray, 9);
  assert.equal(tray[2].used, false, 'derselbe Stein wird wieder frei');
  assert.equal(tray.length, 4, 'kein zusätzlicher Stein');
});

test('Fehler nur bei einer VOLLSTÄNDIGEN, falschen Rechnung', () => {
  const p = fixture();
  const placed = B.emptyPlaced(p);
  // 5 auf das mittlere Feld: „8 − 5 = □" ist noch offen → kein Urteil, kein Fehler.
  assert.equal(B.placementBreaksEquation(p, placed, 0, 1, 5), false);
  placed[0][1] = 5;
  // Der Abschluss deckt es auf: 8 − 5 = 5 ist falsch.
  assert.equal(B.placementBreaksEquation(p, placed, 0, 2, 5), true);
  // Auch die KREUZENDE Rechnung zählt: 3 + 2 = 7 stimmt nicht.
  assert.equal(B.placementBreaksEquation(p, placed, 0, 2, 3), true);
  // Mit der richtigen 3 links geht beides auf: 8 − 3 = 5 und 5 + 2 = 7.
  placed[0][1] = 3;
  assert.equal(B.placementBreaksEquation(p, placed, 0, 2, 5), false);
});

test('falsch platziert, aber alle vollen Rechnungen stimmen → kein Fehler', () => {
  const p = fixture();
  const placed = B.emptyPlaced(p);
  // 5 auf das erste Feld: die Rechnung 8 - 5 = □ bleibt offen und geht auf.
  assert.equal(B.placementBreaksEquation(p, placed, 0, 1, 5), false);
});

test('isBoardSolved verlangt volles Brett und stimmige Rechnungen', () => {
  const p = fixture();
  const placed = B.emptyPlaced(p);
  assert.equal(B.isBoardSolved(p, placed), false);
  placed[0][1] = 3;
  assert.equal(B.progressOf(p, placed), 0.5);
  placed[0][2] = 5;
  assert.equal(B.isBoardSolved(p, placed), true);
  assert.equal(B.progressOf(p, placed), 1);
});

test('solvedEquationSet erkennt fertige Rechnungen', () => {
  const p = fixture();
  const placed = B.emptyPlaced(p);
  assert.equal(B.solvedEquationSet(p, placed).size, 0);
  placed[0][1] = 3; placed[0][2] = 5;
  assert.deepEqual([...B.solvedEquationSet(p, placed)].sort(), [0, 1]);
});

// Die Tipp-Funktion im Spiel ist entfallen, die dahinterliegende Deduktion aber
// nicht: der Trainingsmodus lebt davon. Der Härtetest bleibt deshalb — jedes
// Rätsel muss sich ALLEIN aus erzwungenen Schritten lösen lassen, sonst wäre es
// nicht ratefrei.
test('erzwungene Schritte lösen jedes Rätsel bis zum Ende', () => {
  for (const id of ['sehrleicht', 'mittel', 'extrem']) {
    const p = generatePuzzle({ ...genOptionsFor(id), seed: 31 });
    const placed = B.emptyPlaced(p);
    const tray = p.tray.slice();
    let guard = 0;
    while (guard++ < 300) {
      const found = nextForcedStep(p, placed, tray);
      if (!found) break;
      const { step } = found;
      assert.ok(step.cells.length && step.cells.length === step.values.length, 'Schritt legt konkrete Felder fest');
      step.cells.forEach(([r, c], i) => {
        assert.equal(p.slots[r][c].v, step.values[i], 'erzwungener Schritt trifft die Lösung');
        placed[r][c] = step.values[i];
        tray.splice(tray.indexOf(step.values[i]), 1);
      });
    }
    assert.equal(B.isBoardSolved(p, placed), true, `${id}: bleibt stecken`);
  }
});

test('Trainingsschritt nutzt nur die einfachste Stufe', () => {
  const p = generatePuzzle({ ...genOptionsFor('sehrleicht'), seed: 12 });
  const st = nextTrainingStep(p, B.emptyPlaced(p), p.tray.slice());
  assert.ok(st, 'kein Trainingsschritt gefunden');
  assert.equal(p.slots[st.r][st.c].v, st.v);
  assert.equal(st.key, 'training.step.direct');
  assert.ok(st.params.eq.includes('='));
});

// ── normalizePuzzle: RTDB frisst null-Werte ──────────────────────────────────
// Ein Rätsel, das über die Cloud gereist ist (Bibliothek, Aktivspiel-Slot,
// Cloud-Session, Coop-INIT), hat kein dichtes `slots`-Raster mehr: tote Zellen
// (die Löcher des Kreuzworts) sind null und werden von der RTDB gar nicht erst
// gespeichert — Zeilen kommen als Objekt zurück, komplett tote Zeilen fehlen.
const DENSE = {
  rows: 2, cols: 3,
  slots: [[null, { v: 4, given: true }, null], [null, null, null]],
  equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
};

test('normalizePuzzle macht ein löchriges RTDB-Raster wieder dicht', () => {
  const holey = {
    rows: 2, cols: 3,
    slots: { 0: { 1: { v: 4, given: true } } },   // Zeile 1 fehlt komplett
    equations: { 0: { dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] } },
  };
  const p = B.normalizePuzzle(holey);
  assert.equal(p.slots.length, 2);
  assert.ok(p.slots.every((row) => Array.isArray(row) && row.length === 3));
  assert.deepEqual(p.slots[0], [null, { v: 4, given: true }, null]);
  assert.deepEqual(p.slots[1], [null, null, null]);
  assert.ok(Array.isArray(p.equations));
  assert.equal(p.equations[0].dir, 'h');
});

test('normalizePuzzle lässt ein dichtes Rätsel unverändert (idempotent)', () => {
  assert.equal(B.normalizePuzzle(DENSE), DENSE);
  assert.equal(B.normalizePuzzle(B.normalizePuzzle(DENSE)), DENSE);
});

test('geheiltes Rätsel ist wieder darstellbar (das war der Blackscreen)', () => {
  const holey = { ...DENSE, slots: { 0: { 1: { v: 4, given: true } } } };
  assert.throws(() => B.buildDisplay(holey));
  assert.doesNotThrow(() => B.buildDisplay(B.normalizePuzzle(holey)));
});

// ── Vorrat/Brett dürfen nie auseinanderlaufen ────────────────────────────────
// Es müssen IMMER exakt die Steine im Vorrat liegen, die noch fehlen.
const multiset = (a) => a.slice().sort((x, y) => x - y).join(',');

// Die billige Wache vor reconcileTray: sie muss JEDE Abweichung sehen, sonst
// summiert sich der Schaden im Coop auf (doppelte Steine).
test('trayMatchesBoard erkennt gesunde und kaputte Vorräte', () => {
  const puzzleTray = [3, 5, 5, 9];
  // gesund: die 5 liegt auf dem Brett, der Rest ist offen
  assert.equal(B.trayMatchesBoard(
    [{ id: 0, v: 3, used: false }, { id: 1, v: 5, used: true }, { id: 2, v: 5, used: false }, { id: 3, v: 9, used: false }],
    [5], puzzleTray), true);
  // ein Stein ZU VIEL im Vorrat (der geklonte Fall)
  assert.equal(B.trayMatchesBoard(
    [{ id: 0, v: 3, used: false }, { id: 1, v: 5, used: false }, { id: 2, v: 5, used: false }, { id: 3, v: 9, used: false }],
    [5], puzzleTray), false);
  // ein Stein FEHLT
  assert.equal(B.trayMatchesBoard([{ id: 0, v: 3, used: false }], [5], puzzleTray), false);
  // ein Wert liegt auf dem Brett, der gar nicht zum Rätsel gehört
  assert.equal(B.trayMatchesBoard([], [7], [7]), true);
  assert.equal(B.trayMatchesBoard([], [7, 7], [7]), false);
  // leeres Brett, voller Vorrat
  assert.equal(B.trayMatchesBoard(puzzleTray.map((v, i) => ({ id: i, v, used: false })), [], puzzleTray), true);
});

test('reconcileTray entfernt überzählige und ergänzt fehlende Steine', () => {
  // Brett hat die 7 liegen, im Vorrat taucht sie trotzdem noch als offen auf.
  const tray = [{ id: 0, v: 7, used: false }, { id: 1, v: 3, used: false }];
  const out = B.reconcileTray(tray, [7], [7, 3]);
  assert.equal(multiset(out.filter((t) => !t.used).map((t) => t.v)), '3');
  // Fehlender Stein wird ergänzt.
  const out2 = B.reconcileTray([], [7], [7, 3]);
  assert.equal(multiset(out2.filter((t) => !t.used).map((t) => t.v)), '3');
});

test('reconcileTray lässt einen gesunden Vorrat inhaltlich unverändert', () => {
  const tray = [{ id: 0, v: 7, used: true }, { id: 1, v: 3, used: false }, { id: 2, v: 3, used: false }];
  const out = B.reconcileTray(tray, [7], [7, 3, 3]);
  assert.equal(out.length, 3);
  assert.equal(multiset(out.filter((t) => !t.used).map((t) => t.v)), '3,3');
  assert.equal(multiset(out.filter((t) => t.used).map((t) => t.v)), '7');
});

test('Tauschen zweier gelegter Steine erzeugt keinen Stein aus dem Nichts', () => {
  // Genau der gemeldete Fall: A und B liegen, ihre Plätze werden getauscht.
  // Erst ALLE freigewordenen zurück, dann alle neuen entnehmen (wie applyChanges).
  const tray = [{ id: 0, v: 4, used: true }, { id: 1, v: 9, used: true }, { id: 2, v: 5, used: false }];
  const freed = [4, 9], taken = [9, 4];
  for (const v of freed) B.returnToTray(tray, v);
  for (const v of taken) B.takeFromTray(tray, v);
  assert.equal(tray.length, 3, 'kein zusätzlicher Stein');
  assert.equal(multiset(tray.filter((t) => !t.used).map((t) => t.v)), '5');
});

// Das Geteilt-Zeichen ist reine ANZEIGE: gerechnet wird immer mit '/'. Nur die
// Beschriftung der Operator-Felder wechselt, und der Default (Obelus) laesst
// jeden Alt-Aufruf unveraendert.
// 12 : 3 = 4 (waagerecht)
function divFixture() {
  return {
    rows: 1, cols: 3,
    slots: [[{ v: 12, given: true }, { v: 3, given: true }, { v: 4, given: false }]],
    equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['/'] }],
    tray: [4],
  };
}
const opSyms = (d) => d.cells.flat().filter((c) => c && c.t === 'op').map((c) => c.sym);

test('buildDisplay beschriftet die Divisions-Felder mit dem gewaehlten Zeichen', () => {
  const p = divFixture();
  assert.deepEqual(opSyms(B.buildDisplay(p)), ['÷', '='], 'ohne Angabe der Obelus');
  assert.deepEqual(opSyms(B.buildDisplay(p, ':')), [':', '=']);
  assert.deepEqual(opSyms(B.buildDisplay(p, '/')), ['/', '=']);
});

test('das gewaehlte Zeichen ruehrt an keinem anderen Operator', () => {
  const p = fixture();   // enthaelt nur - und +
  const standard = opSyms(B.buildDisplay(p));
  assert.deepEqual(opSyms(B.buildDisplay(p, ':')), standard);
  assert.ok(!standard.includes('÷'));
});

test('divSymbolFor faellt auf den Obelus zurueck', () => {
  assert.equal(divSymbolFor('obelus'), '÷');
  assert.equal(divSymbolFor('colon'), ':');
  assert.equal(divSymbolFor('slash'), '/');
  assert.equal(divSymbolFor(null), '÷');        // noch nie gewaehlt
  assert.equal(divSymbolFor('quatsch'), '÷');   // unbekannter Wert aus der Cloud
});
