import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  rowSum, colSum, regionSum, rowSums, colSums,
  cellCorrect, rowResolved, colResolved, regionResolved,
  isSolved, progressPct, buildCellMeta, validPuzzleShape,
} from '../../js/games/numbersums/model.js';
import { generatePuzzle } from '../../js/games/numbersums/generator.js';
import { snapshotProgress } from '../../js/storage.js';

// Diese Regeln standen bis zur Spiel-Trennung in app.js auf dem einen grossen
// reaktiven `state` und waren damit NICHT einzeln testbar — obwohl an ihnen
// Sieg, Fortschrittsanzeige, Coop-Prozente und die Auflösungs-Animationen
// haengen. Jetzt nehmen sie puzzle/marks ausdruecklich als Argumente.

// Ein 2x2-Brett: Loesung = Hauptdiagonale behalten.
//   Werte  3 5     Loesung  ja nein
//          2 4              nein ja
const p2 = {
  rows: 2, cols: 2,
  values: [[3, 5], [2, 4]],
  solution: [[true, false], [false, true]],
  rowTargets: [3, 4], colTargets: [3, 4],
  regions: [{ cells: [[0, 0], [0, 1]], target: 3, colorIndex: 0 },
            { cells: [[1, 0], [1, 1]], target: 4, colorIndex: 1 }],
};
const m = (a, b, c, d) => [[a, b], [c, d]];
const leer = () => m('none', 'none', 'none', 'none');
const geloest = () => m('kept', 'removed', 'removed', 'kept');

describe('Brett-Modell: Summen', () => {
  test('zaehlen NUR eingekreiste Zellen', () => {
    assert.equal(rowSum(p2, leer(), 0), 0);
    assert.equal(rowSum(p2, m('kept', 'kept', 'none', 'none'), 0), 8);
    assert.equal(rowSum(p2, geloest(), 0), 3, 'die geloeschte 5 zaehlt nicht mit');
    assert.equal(colSum(p2, geloest(), 1), 4);
    assert.equal(regionSum(p2, geloest(), 0), 3);
    assert.equal(regionSum(p2, geloest(), 1), 4);
  });

  test('rowSums/colSums liefern dasselbe wie die Einzelabfrage', () => {
    const marks = m('kept', 'none', 'kept', 'kept');
    assert.deepEqual(rowSums(p2, marks), [rowSum(p2, marks, 0), rowSum(p2, marks, 1)]);
    assert.deepEqual(colSums(p2, marks), [colSum(p2, marks, 0), colSum(p2, marks, 1)]);
  });
});

describe('Brett-Modell: Fertig-Status', () => {
  test('eine Gruppe ist erst aufgeloest, wenn JEDE Zelle korrekt markiert ist', () => {
    // Die Summe allein genuegt NICHT — es gibt kein automatisches Aufloesen.
    const nurSummeStimmt = m('kept', 'none', 'none', 'kept');
    assert.equal(rowSum(p2, nurSummeStimmt, 0), p2.rowTargets[0], 'die Summe stimmt');
    assert.equal(rowResolved(p2, nurSummeStimmt, 0), false, 'aufgeloest ist sie trotzdem nicht');

    assert.equal(rowResolved(p2, geloest(), 0), true);
    assert.equal(colResolved(p2, geloest(), 0), true);
    assert.equal(regionResolved(p2, geloest(), 0), true);
  });

  test('cellCorrect unterscheidet Loesungszelle (einkreisen) von Rest (loeschen)', () => {
    assert.equal(cellCorrect(p2, m('kept', 'none', 'none', 'none'), 0, 0), true);
    assert.equal(cellCorrect(p2, m('removed', 'none', 'none', 'none'), 0, 0), false);
    assert.equal(cellCorrect(p2, m('none', 'removed', 'none', 'none'), 0, 1), true);
    assert.equal(cellCorrect(p2, m('none', 'kept', 'none', 'none'), 0, 1), false);
  });

  test('isSolved nur bei vollstaendig korrektem Brett; ohne Puzzle false', () => {
    assert.equal(isSolved(p2, leer()), false);
    assert.equal(isSolved(p2, m('kept', 'removed', 'removed', 'none')), false, 'eine offene Zelle genuegt');
    assert.equal(isSolved(p2, geloest()), true);
    assert.equal(isSolved(null, leer()), false);
  });
});

describe('Brett-Modell: Fortschritt', () => {
  test('zaehlt korrekt markierte Zellen, nicht bloss markierte', () => {
    assert.equal(progressPct(p2, leer()), 0);
    assert.equal(progressPct(p2, m('kept', 'none', 'none', 'none')), 25);
    // Falsch markiert ist KEIN Fortschritt.
    assert.equal(progressPct(p2, m('removed', 'none', 'none', 'none')), 0);
    assert.equal(progressPct(p2, geloest()), 100);
    assert.equal(progressPct(null, leer()), 0);
  });

  test('dieselbe Formel wie snapshotProgress in der Spielstand-Liste', () => {
    // Beide muessen dieselbe Zahl zeigen — sonst widerspricht die Liste dem
    // laufenden Spiel (dafuer steht die Formel ausdruecklich zweimal).
    for (const marks of [leer(), m('kept', 'none', 'none', 'none'), m('kept', 'removed', 'none', 'kept'), geloest()]) {
      assert.equal(snapshotProgress({ puzzle: p2, marks }), progressPct(p2, marks));
    }
  });
});

describe('Brett-Modell: Zellen-Metadaten', () => {
  test('jede Zelle kennt ihren Kaefig und seine Farbe', () => {
    const meta = buildCellMeta(p2);
    assert.equal(meta.length, 2);
    assert.equal(meta[0][0].region, 0);
    assert.equal(meta[1][1].region, 1);
    assert.ok(meta[0][0].color, 'die Kaefig-Farbe haengt an der Zelle');
  });

  test('der Ziel-Chip sitzt genau EINMAL je Kaefig, auf der obersten-linkesten Zelle', () => {
    const meta = buildCellMeta(p2);
    const chips = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) if (meta[r][c].chip != null) chips.push([r, c, meta[r][c].chip]);
    assert.deepEqual(chips, [[0, 0, 3], [1, 0, 4]]);
  });

  test('Kaefig-Raender liegen dort, wo der Nachbar zu einem anderen Kaefig gehoert', () => {
    const meta = buildCellMeta(p2);
    // Kaefig 0 = obere Zeile: oben/links/rechts Rand (Brettkante), unten Rand
    // zum zweiten Kaefig.
    assert.deepEqual(meta[0][0].edges, { t: true, b: true, l: true, r: false });
    assert.deepEqual(meta[0][1].edges, { t: true, b: true, l: false, r: true });
  });

  test('ein echtes generiertes Raetsel bekommt fuer JEDE Zelle einen Kaefig', () => {
    const p = generatePuzzle({ difficulty: 'leicht', seed: 4711 });
    const meta = buildCellMeta(p);
    let chips = 0;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        assert.ok(meta[r][c].region >= 0, `Zelle ${r}/${c} ohne Kaefig`);
        if (meta[r][c].chip != null) chips++;
      }
    }
    assert.equal(chips, p.regions.length, 'genau ein Chip je Kaefig');
    // Die Loesung des Generators muss das Brett auch nach den Modell-Regeln loesen.
    const marks = p.solution.map((row) => row.map((v) => (v ? 'kept' : 'removed')));
    assert.equal(isSolved(p, marks), true);
    assert.equal(progressPct(p, marks), 100);
  });
});

describe('Brett-Modell: Struktur-Pruefung empfangener Puzzles', () => {
  test('nimmt ein vollstaendiges Puzzle an', () => {
    assert.equal(validPuzzleShape(p2), true);
    assert.equal(validPuzzleShape(generatePuzzle({ difficulty: 'leicht', seed: 7 })), true);
  });

  test('weist alles ab, was den Brett-Aufbau zum Absturz braechte', () => {
    // Genau das ist der Blackscreen-Schutz beim Coop-INIT.
    assert.equal(validPuzzleShape(null), false);
    assert.equal(validPuzzleShape({}), false);
    assert.equal(validPuzzleShape({ ...p2, rows: 0 }), false);
    assert.equal(validPuzzleShape({ ...p2, rows: 2.5 }), false);
    assert.equal(validPuzzleShape({ ...p2, values: undefined }), false);
    assert.equal(validPuzzleShape({ ...p2, values: [[3, 5]] }), false, 'zu wenige Zeilen');
    assert.equal(validPuzzleShape({ ...p2, solution: undefined }), false);
    assert.equal(validPuzzleShape({ ...p2, rowTargets: undefined }), false);
    assert.equal(validPuzzleShape({ ...p2, colTargets: undefined }), false);
  });
});
