import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, commitMistakes, dismissStreakModal } from './helpers.js';

test.describe('gameplay', () => {
  // Regression: the player's chosen color (settings.coopMyColor) used to only
  // tint marks during an active coop session (cellStyle()/cellClasses() were
  // gated on state.coop.active). It must now also tint your own marks in solo,
  // since the setting was generalized from "coop color" to "my color".
  test('the chosen player color tints a kept mark even outside coop', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => { window.__cns.state.settings.coopMyColor = '#ff00aa'; });
    await startNewGame(page, 'sehrleicht');

    const result = await page.evaluate(() => {
      const { state, onCellTap, cellStyle, cellClasses } = window.__cns;
      const p = state.puzzle;
      let r, c;
      outer: for (r = 0; r < p.rows; r++) for (c = 0; c < p.cols; c++) if (p.solution[r][c]) break outer;
      state.tool = 'pen';
      onCellTap(r, c);
      return { markedColor: cellStyle(r, c)['--markcol'], coopMark: !!cellClasses(r, c)['coop-mark'] };
    });

    expect(result.coopMark).toBe(true);
    expect(result.markedColor).toBe('#ff00aa');
  });

  test('solving the puzzle shows the win screen and records a highscore', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.highscore-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await page.locator('.home-grid .btn-ghost').nth(0).click();
    await expect(page.locator('.diff-row').first().locator('.chip').first()).toContainText('1 / 1');
  });

  // Graded win animation (Punkt 10): ein makelloser Sieg (0 Fehler, 0 Hinweise)
  // bekommt zusätzlich zum normalen Konfetti einen goldenen Schimmer + Badge --
  // ein Sieg MIT Fehler bekommt explizit keines von beidem.
  test('a flawless win shows the perfect-win badge and shine, a win with a mistake does not', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);

    await expect(page.locator('.result-card.win.perfect')).toBeVisible();
    await expect(page.locator('.perfect-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click();
    await expect(page.locator('.screen.home')).toBeVisible();
    await startNewGame(page, 'sehrleicht');

    await commitMistakes(page, 1);
    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.result-card.win.perfect')).toHaveCount(0);
    await expect(page.locator('.perfect-badge')).toHaveCount(0);
  });

  test('three deliberate mistakes (lives enabled) trigger the loss screen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await commitMistakes(page, 3);

    await expect(page.locator('.result-card.lose')).toBeVisible();
  });

  test('the lives HUD shows one fewer heart after each mistake', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');

    const emptyHeartsBefore = await page.locator('.heart.empty').count();
    await commitMistakes(page, 1);
    await expect.poll(() => page.locator('.heart.empty').count()).toBe(emptyHeartsBefore + 1);
  });

  test('undo reverts the last mark', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');

    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      state.tool = p.solution[0][0] ? 'pen' : 'eraser';
      onCellTap(0, 0);
    });
    const markedAfterTap = await page.evaluate(() => window.__cns.state.marks[0][0]);
    expect(markedAfterTap).not.toBe('none');

    await page.locator('.toolbar .round-btn').first().click(); // undo
    const markedAfterUndo = await page.evaluate(() => window.__cns.state.marks[0][0]);
    expect(markedAfterUndo).toBe('none');
  });
});
