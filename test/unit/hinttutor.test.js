import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHintTutorial } from '../../js/hinttutor.js';
import { generatePuzzle } from '../../js/generator.js';

const emptyMarks = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill('none'));

// Kleines 1×3-Rätsel: Lösung = 4+5 behalten, 7 löschen.
// Zeile: Ziel 9; Spalten: 0 / 4 / 5. Der erste erklärbare Schritt ist die
// Spalte 1 mit Ziel 0 → „Summe bereits erreicht" (alles Offene weg).
const P13 = {
  rows: 1, cols: 3,
  values: [[7, 4, 5]],
  solution: [[false, true, true]],
  rowTargets: [9], colTargets: [0, 4, 5],
  regions: [],
};

test('hinttutor', async (t) => {
  await t.test('every tutorial ends with a final step carrying the action', () => {
    const tut = buildHintTutorial(P13, emptyMarks(1, 3));
    assert.ok(tut);
    assert.ok(tut.steps.length >= 2);
    const last = tut.steps[tut.steps.length - 1];
    assert.equal(last.final, true);
    assert.ok(last.action && typeof last.action.r === 'number');
    assert.deepEqual(tut.target, last.action);
    for (const s of tut.steps) {
      assert.ok(Array.isArray(s.cells) && s.cells.length > 0, 'jeder Schritt highlightet Zellen');
      assert.ok(typeof s.key === 'string' && s.key.length > 0);
    }
  });

  await t.test('a too-large value is explained with the concrete numbers', () => {
    // Zeile [7,2,3] Ziel 5 → 7 > 5 → tooLarge. (Spalten so gewählt, dass die
    // Zeile der ERSTE erklärbare Fund ist: Zeilen kommen im Modell vor Spalten.)
    const p = {
      rows: 1, cols: 3,
      values: [[7, 2, 3]],
      solution: [[false, true, true]],
      rowTargets: [5], colTargets: [0, 2, 3],
      regions: [],
    };
    const tut = buildHintTutorial(p, emptyMarks(1, 3));
    assert.equal(tut.reason, 'tooLarge');
    const stepKeys = tut.steps.map(s => s.key);
    assert.deepEqual(stepKeys, ['lookAt', 'statusNone', 'tooLarge', 'concludeRemove']);
    const tooLarge = tut.steps[2];
    assert.equal(tooLarge.params.val, 7);
    assert.equal(tooLarge.params.rem, 5);
    assert.deepEqual(tooLarge.cells, [[0, 0]]);
    assert.deepEqual(tut.target, { r: 0, c: 0, want: 'removed' });
  });

  await t.test('allNeeded lists the exact remaining values', () => {
    const p = {
      rows: 1, cols: 2,
      values: [[2, 4]],
      solution: [[true, true]],
      rowTargets: [6], colTargets: [2, 4],
      regions: [],
    };
    const tut = buildHintTutorial(p, emptyMarks(1, 2));
    assert.equal(tut.reason, 'allNeeded');
    const step = tut.steps.find(s => s.key === 'allNeeded');
    assert.equal(step.params.vals, '2, 4');
    assert.equal(step.params.rem, 6);
    assert.equal(tut.target.want, 'kept');
  });

  await t.test('already-kept cells appear as an interim status step with the sums', () => {
    // Zeile [7,4,5] Ziel 9, die 4 ist schon eingekreist → Status „4 (=4), fehlen 5",
    // dann tooLarge für die 7 (7 > 5).
    const marks = [['none', 'kept', 'none']];
    const tut = buildHintTutorial(P13, marks);
    const status = tut.steps.find(s => s.key === 'statusKept');
    assert.ok(status, 'Zwischenstand-Schritt vorhanden');
    assert.equal(status.params.kept, '4');
    assert.equal(status.params.keptSum, 4);
    assert.equal(status.params.rem, 5);
  });

  await t.test('subset forcing enumerates the concrete combinations', () => {
    // 2×3: Zeile 0 [6,3,5] Ziel 11 → einzige Kombination 6+5 (Tier 2, kein
    // Tier-1-Zug irgendwo: Spalten mixen behalten/gelöscht ohne tooLarge).
    const p = {
      rows: 2, cols: 3,
      values: [[6, 3, 5], [4, 7, 2]],
      solution: [[true, false, true], [false, true, false]],
      rowTargets: [11, 7], colTargets: [6, 7, 5],
      regions: [],
    };
    const tut = buildHintTutorial(p, emptyMarks(2, 3));
    assert.ok(['comboKeep', 'comboRemove'].includes(tut.reason), `Tier 2 erwartet, war ${tut.reason}`);
    const combos = tut.steps.find(s => s.key === 'combos');
    assert.ok(combos);
    assert.equal(combos.params.rem, 11);
    assert.ok(combos.params.combos.includes('6+5'), `Kombination 6+5 gelistet: ${combos.params.combos}`);
    assert.equal(combos.params.count, 1);
    const conclusion = tut.steps.find(s => s.key === 'inAllCombos');
    assert.ok(conclusion, 'eindeutige Kombination → Zelle in ALLEN Kombinationen');
    assert.equal(tut.target.want, 'kept');
  });

  // Härtetest: Der Tutor muss ein KOMPLETTES generiertes Rätsel Stellung für
  // Stellung erklären können (jede Position liefert eine Kette, deren Aktion
  // korrekt zur Lösung passt) — sonst wäre er irgendwo „sprachlos".
  await t.test('the tutor can walk an entire generated puzzle to completion', () => {
    for (const seed of [7, 42]) {
      const puzzle = generatePuzzle({ rows: 6, cols: 6, seed });
      const marks = emptyMarks(puzzle.rows, puzzle.cols);
      let guard = puzzle.rows * puzzle.cols + 5;
      let fallbacks = 0;
      while (guard-- > 0) {
        const open = marks.some((row, r) => row.some((m, c) => m === 'none'));
        if (!open) break;
        const tut = buildHintTutorial(puzzle, marks);
        assert.ok(tut, 'Tutor findet in jeder Stellung eine Erklärung');
        const { r, c, want } = tut.target;
        assert.equal(marks[r][c], 'none', 'Ziel ist eine offene Zelle');
        const correct = puzzle.solution[r][c] ? 'kept' : 'removed';
        assert.equal(want, correct, 'Folgerung stimmt mit der Lösung überein');
        if (tut.reason === 'fallback') fallbacks++;
        marks[r][c] = want;
      }
      assert.ok(marks.every(row => row.every(m => m !== 'none')), 'Brett komplett erklärt');
      assert.equal(fallbacks, 0, 'nie der erklärungslose Fallback nötig');
    }
  });
});
