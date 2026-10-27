import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, genOptionsFor } from '../../js/games/mathcross/difficulty.js';
import { generatePuzzle, buildLayout, mulberry32 } from '../../js/games/mathcross/generator.js';
import { logicalSolve, countSolutions, allEquationsHold } from '../../js/games/mathcross/solver.js';
import { solutionValues, blankIds, eqCells, eqIds, slotId } from '../../js/games/mathcross/equations.js';

function checkPuzzle(p, opts, label) {
  assert.ok(p, `${label}: kein Rätsel erzeugt`);
  const sol = solutionValues(p);

  // 1. Jede Gleichung geht auf — und liegt vollständig auf existierenden Feldern.
  for (const eq of p.equations) {
    for (const [r, c] of eqCells(eq)) {
      assert.ok(r >= 0 && c >= 0 && r < p.rows && c < p.cols, `${label}: Gleichung ragt aus dem Brett`);
      assert.ok(p.slots[r][c], `${label}: Gleichung nutzt ein totes Feld`);
    }
  }
  assert.ok(allEquationsHold(p, sol), `${label}: Lösung erfüllt nicht alle Gleichungen`);

  // 2. Keine zwei GLEICHGERICHTETEN Gleichungen teilen sich ein Feld
  //    (sonst läsen sie sich als eine verkettete Rechnung).
  for (const dir of ['h', 'v']) {
    const seen = new Set();
    for (const eq of p.equations.filter(e => e.dir === dir)) {
      for (const id of eqIds(eq, p.cols)) {
        assert.ok(!seen.has(id), `${label}: zwei ${dir}-Gleichungen überlappen`);
        seen.add(id);
      }
    }
  }

  // 3. Nur ganze, positive Zahlen im erlaubten Rahmen.
  for (const v of sol.filter(v => v != null)) {
    assert.ok(Number.isInteger(v) && v >= 1, `${label}: ungültiger Wert ${v}`);
    assert.ok(v <= opts.maxResult, `${label}: Wert ${v} über maxResult`);
  }

  // 4. Der Vorrat ist EXAKT die Menge der fehlenden Zahlen.
  const blanks = blankIds(p);
  assert.equal(p.tray.length, blanks.length, `${label}: Vorratsgröße ≠ Lückenzahl`);
  const sort = a => a.slice().sort((x, y) => x - y);
  assert.deepEqual(sort(p.tray), sort(blanks.map(id => sol[id])), `${label}: Vorrat passt nicht zu den Lücken`);

  // 5. Ohne Raten lösbar — innerhalb der für die Stufe erlaubten Schlussweisen.
  const res = logicalSolve(p, { maxTier: opts.maxTier });
  assert.equal(res.solved, true, `${label}: nicht ratefrei lösbar`);
  assert.ok(res.maxTier <= opts.maxTier, `${label}: braucht Stufe ${res.maxTier}`);

  // 6. Jedes Feld gehört zu mindestens einer Gleichung.
  const inEq = new Set();
  for (const eq of p.equations) for (const id of eqIds(eq, p.cols)) inEq.add(id);
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      if (p.slots[r][c]) assert.ok(inEq.has(slotId(r, c, p.cols)), `${label}: freistehendes Feld`);
    }
  }
}

for (const d of DIFFICULTIES) {
  test(`Generator: ${d.id} erzeugt gültige, eindeutige Rätsel`, () => {
    const opts = genOptionsFor(d.id);
    for (const seed of [12345, 777]) {
      const p = generatePuzzle({ ...opts, seed });
      checkPuzzle(p, opts, `${d.id}/${seed}`);
      assert.equal(p.difficulty, d.id);
    }
  });
}

test('Lösung ist eindeutig (Brute-Force-Gegenprobe)', () => {
  for (const id of ['sehrleicht', 'leicht', 'mittel', 'schwer', 'extrem']) {
    const p = generatePuzzle({ ...genOptionsFor(id), seed: 4242 });
    assert.equal(countSolutions(p, 2), 1, `${id}: nicht eindeutig`);
  }
});

test('gleicher Seed → identisches Rätsel', () => {
  const a = generatePuzzle({ ...genOptionsFor('mittel'), seed: 909 });
  const b = generatePuzzle({ ...genOptionsFor('mittel'), seed: 909 });
  assert.deepEqual(JSON.parse(JSON.stringify(a.slots)), JSON.parse(JSON.stringify(b.slots)));
  assert.deepEqual(a.tray, b.tray);
});

test('„Große Zahlen" hebt den Zahlenraum an', () => {
  const normal = generatePuzzle({ ...genOptionsFor('mittel'), seed: 55 });
  const big = generatePuzzle({ ...genOptionsFor('mittel', { bigNumbers: true }), seed: 55 });
  checkPuzzle(big, genOptionsFor('mittel', { bigNumbers: true }), 'mittel/big');
  assert.equal(big.bigNumbers, true);
  const max = p => Math.max(...solutionValues(p).filter(v => v != null));
  assert.ok(max(big) > max(normal), 'Große Zahlen sind nicht größer');
});

test('Layout hält Sperrfelder frei und bleibt zusammenhängend', () => {
  const rng = mulberry32(2024);
  const layout = buildLayout(6, 6, rng, { eqTarget: 12, ternaryChance: 0, holeRatio: 0.15 });
  assert.ok(layout, 'kein Layout');
  assert.ok(layout.used.size < 36, 'Layout füllt das gesamte Raster (keine toten Zellen)');
  // Zusammenhang: von der ersten Gleichung aus müssen alle erreichbar sein.
  const reach = new Set(eqIds(layout.equations[0], layout.cols));
  let grew = true;
  while (grew) {
    grew = false;
    for (const eq of layout.equations) {
      const ids = eqIds(eq, layout.cols);
      if (ids.some(id => reach.has(id)) && ids.some(id => !reach.has(id))) {
        for (const id of ids) reach.add(id);
        grew = true;
      }
    }
  }
  assert.equal(reach.size, layout.used.size, 'Layout zerfällt in getrennte Inseln');
});
