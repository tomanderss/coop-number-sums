import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, generatePuzzle, findHintCell } from '../../js/generator.js';
import { logicalSolve, countSolutions } from '../../js/solver.js';
import { DIFFICULTIES } from '../../js/config.js';

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

      const count = countSolutions(puzzle, 2, 50000);
      assert.equal(count, 1, `${diff.id} should have exactly one solution`);
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
      for (let seed = 0; seed < 25; seed++) {
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
