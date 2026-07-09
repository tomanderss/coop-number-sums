import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, generatePuzzle, findHintCell, remapColorsForMarkVisibility, MARK_VISIBILITY_THRESHOLD } from '../../js/generator.js';
import { logicalSolve, countSolutions } from '../../js/solver.js';
import { DIFFICULTIES, REGION_COLORS, regionColorDist, markOnRegionDist, hexToRgb } from '../../js/config.js';

describe('generator.makeRng', () => {
  test('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    assert.deepEqual(seqA, seqB);
  });

  test('produces values in [0, 1)', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1);
    }
  });

  test('different seeds produce different sequences', () => {
    const a = makeRng(1)();
    const b = makeRng(2)();
    assert.notEqual(a, b);
  });
});

describe('generator.generatePuzzle', () => {
  test('same seed + difficulty produces an identical puzzle', () => {
    const p1 = generatePuzzle({ difficulty: 'sehrleicht', seed: 123 });
    const p2 = generatePuzzle({ difficulty: 'sehrleicht', seed: 123 });
    assert.deepEqual(p1, p2);
  });

  test('matches the configured dimensions for each difficulty', () => {
    for (const diff of DIFFICULTIES) {
      const puzzle = generatePuzzle({ difficulty: diff.id, seed: 1 });
      assert.equal(puzzle.rows, diff.dim.r);
      assert.equal(puzzle.cols, diff.dim.c);
      assert.equal(puzzle.difficulty, diff.id);
    }
  });

  test('cell values are always within 1..9', () => {
    const puzzle = generatePuzzle({ difficulty: 'mittel', seed: 99 });
    for (const row of puzzle.values) {
      for (const v of row) {
        assert.ok(v >= 1 && v <= 9);
      }
    }
  });

  test('regions partition the whole board exactly once', () => {
    const puzzle = generatePuzzle({ difficulty: 'schwer', seed: 5 });
    const seen = new Set();
    for (const reg of puzzle.regions) {
      for (const [r, c] of reg.cells) {
        const key = `${r},${c}`;
        assert.ok(!seen.has(key), `cell ${key} covered by more than one region`);
        seen.add(key);
      }
    }
    assert.equal(seen.size, puzzle.rows * puzzle.cols);
  });

  test('generated puzzle is uniquely and logically solvable', () => {
    for (const diff of DIFFICULTIES) {
      const puzzle = generatePuzzle({ difficulty: diff.id, seed: 2024 });
      const result = logicalSolve(puzzle, { allowHypo: true });
      assert.equal(result.solved, true, `${diff.id} should be fully solved by logic`);
      assert.equal(result.contradiction, false, `${diff.id} should have no contradiction`);
      assert.ok(result.tiers.t3 <= diff.maxTier3Steps, `${diff.id} should respect maxTier3Steps`);

      // logicalSolve hat oben jede Zelle ERZWUNGEN bestimmt — das ist bereits ein
      // Beweis der Eindeutigkeit (jeder Schritt alternativlos). countSolutions ist
      // nur eine zusätzliche Brute-Force-Gegenprobe; ihr Suchraum explodiert aber
      // auf großen Feldern (13×13 braucht Sekunden bis Minuten und sprengt das
      // Knotenbudget). Daher die Gegenprobe nur auf kleineren Feldern fahren.
      if (diff.dim.r * diff.dim.c <= 121) {
        const count = countSolutions(puzzle, 2, 50000);
        assert.equal(count, 1, `${diff.id} should have exactly one solution`);
      }
    }
  });

  test('solver mark matches the intended solution mask', () => {
    const puzzle = generatePuzzle({ difficulty: 'leicht', seed: 77 });
    const result = logicalSolve(puzzle, { allowHypo: true });
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const want = puzzle.solution[r][c] ? 1 : 2; // KEEP : REMOVE
        assert.equal(result.mark[r * puzzle.cols + c], want);
      }
    }
  });

  test('every row and column has at least one kept and one removed cell', () => {
    const puzzle = generatePuzzle({ difficulty: 'mittel', seed: 321 });
    for (let r = 0; r < puzzle.rows; r++) {
      const row = puzzle.solution[r];
      assert.ok(row.some(Boolean), `row ${r} has no kept cell`);
      assert.ok(row.some(v => !v), `row ${r} has no removed cell`);
    }
    for (let c = 0; c < puzzle.cols; c++) {
      const col = puzzle.solution.map(row => row[c]);
      assert.ok(col.some(Boolean), `col ${c} has no kept cell`);
      assert.ok(col.some(v => !v), `col ${c} has no removed cell`);
    }
  });
});

describe('generator cage colors', () => {
  test('no two orthogonally/diagonally adjacent cages share the exact same color, across many seeds', () => {
    // Regression: colorRegions()' "all colors too similar" relax fallback used
    // to reuse an already-fully-banned Set without clearing it, which silently
    // fell through to a hardcoded colorIndex 0 regardless of whether a neighbor
    // already used it -- a guaranteed literal collision whenever a neighbor's
    // colorIndex was 0. Run across many seeds/difficulties so any future
    // regression in colorRegions() is caught even if a single seed wouldn't
    // happen to trigger the relax branch.
    for (const diff of DIFFICULTIES) {
      // Große Felder generieren langsam (14×14 ~Sekunden) -- dort weniger Seeds,
      // sonst sprengt die Schleife die CI-Laufzeit. colorRegions() ist von der
      // Feldgröße unabhängig; wenige Seeds je Größe genügen als Regressionsschutz.
      const seedCount = diff.dim.r >= 14 ? 4 : (diff.dim.r >= 12 ? 8 : 25);
      for (let seed = 0; seed < seedCount; seed++) {
        const puzzle = generatePuzzle({ difficulty: diff.id, seed });
        const idGrid = Array.from({ length: puzzle.rows }, () => new Array(puzzle.cols).fill(-1));
        for (const reg of puzzle.regions) for (const [r, c] of reg.cells) idGrid[r][c] = reg.id;
        for (let r = 0; r < puzzle.rows; r++) {
          for (let c = 0; c < puzzle.cols; c++) {
            const a = idGrid[r][c];
            for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) continue;
              const b = idGrid[nr][nc];
              if (b === a) continue;
              assert.notEqual(
                puzzle.regions[a].colorIndex, puzzle.regions[b].colorIndex,
                `${diff.id} seed ${seed}: adjacent cages ${a} and ${b} share colorIndex ${puzzle.regions[a].colorIndex}`,
              );
            }
          }
        }
      }
    }
  });

  test('adjacent cages stay perceptually far apart (not just non-identical), across many seeds', () => {
    // Regression: colorRegions()' "all colors banned" relax path used to drop
    // the similarity threshold to 0 entirely (only avoiding an exact repeat),
    // which let directly-touching cages end up with barely-distinguishable
    // colours (e.g. two different greens) even though they were never the exact
    // same colorIndex -- exactly the "too similar" report this guards against.
    // Metric is now the same perceptual distance the generator uses
    // (regionColorDist: redmean of the composited cage colour, worst theme) --
    // hue alone can't measure distinctness once lightness carries part of the
    // separation (18 colours don't fit >=30deg apart on the wheel).
    for (const diff of DIFFICULTIES) {
      // Große Felder generieren langsam (14×14 ~Sekunden) -- dort weniger Seeds,
      // sonst sprengt die Schleife die CI-Laufzeit. colorRegions() ist von der
      // Feldgröße unabhängig; wenige Seeds je Größe genügen als Regressionsschutz.
      const seedCount = diff.dim.r >= 14 ? 4 : (diff.dim.r >= 12 ? 8 : 25);
      for (let seed = 0; seed < seedCount; seed++) {
        const puzzle = generatePuzzle({ difficulty: diff.id, seed });
        const idGrid = Array.from({ length: puzzle.rows }, () => new Array(puzzle.cols).fill(-1));
        for (const reg of puzzle.regions) for (const [r, c] of reg.cells) idGrid[r][c] = reg.id;
        for (let r = 0; r < puzzle.rows; r++) {
          for (let c = 0; c < puzzle.cols; c++) {
            const a = idGrid[r][c];
            for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) continue;
              const b = idGrid[nr][nc];
              if (b === a) continue;
              const ca = REGION_COLORS[puzzle.regions[a].colorIndex];
              const cb = REGION_COLORS[puzzle.regions[b].colorIndex];
              const d = regionColorDist(ca, cb);
              assert.ok(
                d >= 55,
                `${diff.id} seed ${seed}: adjacent cages ${a} and ${b} only ${d.toFixed(0)} apart (perceptual)`,
              );
            }
          }
        }
      }
    }
  });
});

describe('generator.findHintCell', () => {
  test('returns null when the board is fully and correctly marked', () => {
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht', seed: 11 });
    const marks = puzzle.solution.map(row => row.map(v => (v ? 'kept' : 'removed')));
    assert.equal(findHintCell(puzzle, marks), null);
  });

  test('returns an unmarked cell matching the solution', () => {
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht', seed: 11 });
    const marks = puzzle.solution.map(row => row.map(() => 'none'));
    const hint = findHintCell(puzzle, marks);
    assert.ok(hint);
    const wantKept = puzzle.solution[hint.r][hint.c];
    assert.equal(hint.want, wantKept ? 'kept' : 'removed');
  });

  test('prefers a kept cell when both kinds of mistakes remain', () => {
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht', seed: 11 });
    const marks = puzzle.solution.map(row => row.map(v => (v ? 'kept' : 'removed')));
    // Find one kept and one removed cell, reset both to 'none'.
    let keptCell = null, removedCell = null;
    for (let r = 0; r < puzzle.rows && (!keptCell || !removedCell); r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (puzzle.solution[r][c] && !keptCell) keptCell = [r, c];
        if (!puzzle.solution[r][c] && !removedCell) removedCell = [r, c];
      }
    }
    marks[keptCell[0]][keptCell[1]] = 'none';
    marks[removedCell[0]][removedCell[1]] = 'none';
    const hint = findHintCell(puzzle, marks);
    assert.equal(hint.want, 'kept');
    assert.deepEqual([hint.r, hint.c], keptCell);
  });
});

describe('generator.remapColorsForMarkVisibility (Cage-Farben meiden die Spielerfarbe)', () => {
  // Zwei nebeneinanderliegende 1×2-Regionen auf einem 1×4-Brett.
  const regions = (ci1, ci2) => ([
    { cells: [[0, 0], [0, 1]], colorIndex: ci1 },
    { cells: [[0, 2], [0, 3]], colorIndex: ci2 },
  ]);
  // Spielerfarbe Pink (#ec4899 aus COOP_COLORS) — konfliktreichste Palettenfarbe finden.
  const pink = hexToRgb('#ec4899');
  const pinkIdx = REGION_COLORS.reduce((best, c, i) =>
    markOnRegionDist(pink, c) < markOnRegionDist(pink, REGION_COLORS[best]) ? i : best, 0);

  test('Palette enthält eine mit Pink kollidierende Farbe (Testvoraussetzung)', () => {
    assert.ok(markOnRegionDist(pink, REGION_COLORS[pinkIdx]) < MARK_VISIBILITY_THRESHOLD,
      'keine Palettenfarbe kollidiert mit Pink — Threshold prüfen');
  });
  test('kollidierende Cage wird auf eine sichere Farbe umgelenkt', () => {
    const out = remapColorsForMarkVisibility({
      regions: regions(pinkIdx, 0), rows: 1, cols: 4,
      effectiveColors: REGION_COLORS, avoidRgbs: [pink],
    });
    assert.notEqual(out[0], pinkIdx, 'Pink-Cage muss umgefärbt werden');
    assert.ok(markOnRegionDist(pink, REGION_COLORS[out[0]]) >= MARK_VISIBILITY_THRESHOLD, 'Ersatzfarbe muss sicher sein');
    assert.equal(out[1], 0, 'konfliktfreie Cage bleibt unverändert');
  });
  test('Ersatzfarbe unterscheidet sich weiter von der Nachbar-Cage', () => {
    const out = remapColorsForMarkVisibility({
      regions: regions(pinkIdx, 0), rows: 1, cols: 4,
      effectiveColors: REGION_COLORS, avoidRgbs: [pink],
    });
    assert.ok(regionColorDist(REGION_COLORS[out[0]], REGION_COLORS[out[1]]) >= 70,
      'Nachbarn müssen unterscheidbar bleiben');
  });
  test('ohne Spielerfarben/Konflikt: identische Zuordnung', () => {
    assert.deepEqual(remapColorsForMarkVisibility({
      regions: regions(2, 5), rows: 1, cols: 4,
      effectiveColors: REGION_COLORS, avoidRgbs: [],
    }), [2, 5]);
    const blue = hexToRgb('#3b82f6');
    const safeIdx = REGION_COLORS.findIndex(c => markOnRegionDist(blue, c) >= MARK_VISIBILITY_THRESHOLD);
    assert.deepEqual(remapColorsForMarkVisibility({
      regions: regions(safeIdx, safeIdx), rows: 1, cols: 4,
      effectiveColors: REGION_COLORS, avoidRgbs: [blue],
    }), [safeIdx, safeIdx]);
  });
  test('kollidieren ALLE Farben (degeneriert), bleibt die Zuordnung unangetastet', () => {
    const out = remapColorsForMarkVisibility({
      regions: regions(1, 2), rows: 1, cols: 4,
      effectiveColors: REGION_COLORS, avoidRgbs: [pink],
      threshold: 10000,   // absurd hoch → alles „Konflikt" → kein Ausweg → Identität
    });
    assert.deepEqual(out, [1, 2]);
  });
});
