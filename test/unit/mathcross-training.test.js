import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTrainingStep, isFullyTier1Solvable } from '../../js/games/mathcross/training.js';
import { generatePuzzle } from '../../js/games/mathcross/generator.js';
import { isBoardSolved } from '../../js/games/mathcross/model.js';

// Der Trainingsmodus rief isFullyTier1Solvable schon immer auf — die Funktion
// gab es aber nicht, „Training" endete in einem leeren Spielbildschirm.

test('isFullyTier1Solvable gibt es und beantwortet die Frage fuer echte Raetsel', () => {
  assert.equal(typeof isFullyTier1Solvable, 'function');
  let ja = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const p = generatePuzzle({ difficulty: 'sehrleicht', seed });
    if (isFullyTier1Solvable(p)) ja++;
  }
  // Die Trainingssuche probiert bis zu 40 Raetsel — es muss also welche geben.
  assert.ok(ja > 0, 'kein einziges Tier-1-loesbares Raetsel gefunden');
});

test('ein als loesbar erkanntes Raetsel laesst sich mit den Trainings-Schritten wirklich loesen', () => {
  let p = null;
  for (let seed = 1; seed <= 80 && !p; seed++) {
    const cand = generatePuzzle({ difficulty: 'sehrleicht', seed });
    if (isFullyTier1Solvable(cand)) p = cand;
  }
  assert.ok(p);
  const placed = p.slots.map((row) => row.map(() => null));
  const rest = p.tray.slice();
  for (let i = 0; i <= p.tray.length; i++) {
    const step = nextTrainingStep(p, placed, rest);
    if (!step) break;
    // Jeder Schritt legt die RICHTIGE Zahl (sonst wuerde der Tutor Falsches lehren).
    assert.equal(step.v, p.slots[step.r][step.c].v);
    placed[step.r][step.c] = step.v;
    rest.splice(rest.indexOf(step.v), 1);
  }
  assert.equal(isBoardSolved(p, placed), true);
});

test('Unsinn wird abgelehnt statt zu werfen', () => {
  assert.equal(isFullyTier1Solvable(null), false);
  assert.equal(isFullyTier1Solvable({}), false);
});
