import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle } from './helpers.js';

// Custom-Modus (eigene Rastergröße, Feature 10): generiert ein Rätsel mit
// abweichenden Maßen und zählt bewusst nicht in die nach Schwierigkeit
// gebucketeten Stats/Highscores ein.

test.describe('custom size mode', () => {
  test('selecting a custom size generates a puzzle with that grid size and excludes it from stats', async ({ page }) => {
    await gotoApp(page);

    const statsBefore = await page.evaluate(() => window.__cns.state.stats.byDifficulty['mittel']);

    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.locator('.seg button').nth(1).click(); // "Custom" tab
    // Difficulty label is translated -- select by position (mittel = index 2) to stay locale-agnostic.
    const DIFFICULTY_INDEX_MITTEL = 2;
    await page.locator('.option-grid').nth(0).locator('.opt-card').nth(DIFFICULTY_INDEX_MITTEL).click();
    await page.locator('.option-grid').nth(1).locator('.opt-card', { hasText: '9×9' }).click();
    await page.locator('.btn-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    const { rows, cols, isCustomGame } = await page.evaluate(() => {
      const { state } = window.__cns;
      return { rows: state.puzzle.rows, cols: state.puzzle.cols, isCustomGame: state.isCustomGame };
    });
    expect(rows).toBe(9);
    expect(cols).toBe(9);
    expect(isCustomGame).toBe(true);

    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.highscore-badge')).not.toBeVisible();

    const statsAfter = await page.evaluate(() => window.__cns.state.stats.byDifficulty['mittel']);
    expect(statsAfter).toEqual(statsBefore);
  });

  test('the custom tab is hidden in coop mode', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => { window.__cns.state.coop.active = true; });
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await expect(page.locator('.seg')).not.toBeVisible();
  });
});
