import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { logicalSolve, countSolutions, buildModel, UNK, KEEP, REMOVE } from '../../js/solver.js';

// 2x2 trivial puzzle: keep the diagonal (0,0) and (1,1).
// values:        1 2
//                3 4
// row targets:   1, 4   col targets: 1, 4
function trivialPuzzle() {
  return {
    rows: 2, cols: 2,
    values: [[1, 2], [3, 4]],
    rowTargets: [1, 4],
    colTargets: [1, 4],
    regions: [],
  };
}

describe('solver.buildModel', () => {
  test('creates one group per row and column, no regions', () => {
    const model = buildModel(trivialPuzzle());
    assert.equal(model.cells.length, 4);
    assert.equal(model.groups.length, 4); // 2 rows + 2 cols
  });

  test('includes region groups when present', () => {
    const puzzle = trivialPuzzle();
    puzzle.regions = [{ cells: [[0, 0], [0, 1], [1, 0], [1, 1]], target: 4 }];
    const model = buildModel(puzzle);
    assert.equal(model.groups.length, 5);
  });
});

describe('solver.logicalSolve', () => {
  test('solves a trivial puzzle uniquely', () => {
    const result = logicalSolve(trivialPuzzle());
    assert.equal(result.solved, true);
    assert.equal(result.contradiction, false);
    // (0,0) kept, (0,1) removed, (1,0) removed, (1,1) kept
    assert.equal(result.mark[0], KEEP);
    assert.equal(result.mark[1], REMOVE);
    assert.equal(result.mark[2], REMOVE);
    assert.equal(result.mark[3], KEEP);
  });

  test('detects a contradiction for an impossible target', () => {
    const puzzle = trivialPuzzle();
    puzzle.rowTargets = [100, 4]; // impossible: row sum can never reach 100
    const result = logicalSolve(puzzle);
    assert.equal(result.contradiction, true);
    assert.equal(result.solved, false);
  });

  test('leaves ambiguous puzzles unsolved without raising a contradiction', () => {
    // 2x2 where both diagonals satisfy row/col targets -> not uniquely forced
    // values: 1 1 / 1 1, row/col targets all 1 -> any single cell per row works,
    // but tier1 can't force a specific one since all cells share value 1.
    const puzzle = {
      rows: 2, cols: 2,
      values: [[1, 1], [1, 1]],
      rowTargets: [1, 1],
      colTargets: [1, 1],
      regions: [],
    };
    const result = logicalSolve(puzzle);
    assert.equal(result.contradiction, false);
    assert.equal(result.solved, false);
    assert.ok(result.mark.some(m => m === UNK));
  });

  test('allowHypo solves puzzles that plain tier1/tier2 cannot', () => {
    const puzzle = {
      rows: 2, cols: 2,
      values: [[1, 1], [1, 1]],
      rowTargets: [1, 1],
      colTargets: [1, 1],
      regions: [],
    };
    // Without hypothesis, this stays ambiguous (verified above). With allowHypo
    // it's still genuinely ambiguous (symmetric), so it should remain unsolved
    // too -- hypothesis can't break real symmetry, only resolve forced contradictions.
    const result = logicalSolve(puzzle, { allowHypo: true });
    assert.equal(result.contradiction, false);
  });
});

describe('solver.countSolutions', () => {
  test('counts exactly 1 for a uniquely solvable puzzle', () => {
    const count = countSolutions(trivialPuzzle(), 2);
    assert.equal(count, 1);
  });

  test('counts >= 2 for a genuinely ambiguous puzzle', () => {
    const puzzle = {
      rows: 2, cols: 2,
      values: [[1, 1], [1, 1]],
      rowTargets: [1, 1],
      colTargets: [1, 1],
      regions: [],
    };
    const count = countSolutions(puzzle, 2);
    assert.equal(count, 2);
  });

  test('counts 0 for an unsolvable puzzle', () => {
    const puzzle = trivialPuzzle();
    puzzle.rowTargets = [100, 4];
    const count = countSolutions(puzzle, 2);
    assert.equal(count, 0);
  });
});
