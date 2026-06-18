import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, commitMistakes } from './helpers.js';

test.describe('gameplay', () => {
  test('solving the puzzle shows the win screen and records a highscore', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.highscore-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await page.locator('.home-grid .btn-ghost').nth(0).click();
    await expect(page.locator('.diff-row').first().locator('.chip').first()).toHaveText('1 / 1');
  });

  test('three deliberate mistakes (lives enabled) trigger the loss screen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await commitMistakes(page, 3);

    await expect(page.locator('.result-card.lose')).toBeVisible();
  });

  test('giving up shows the gave-up screen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');

    await page.locator('.top-actions .icon-btn').nth(1).click(); // give-up icon button
    await expect(page.locator('.modal-sm')).toBeVisible();
    await page.locator('.confirm-actions .btn-danger').click();

    await expect(page.locator('.result-card.lose .result-emoji')).toHaveText('🏳');
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('gaveup');
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
