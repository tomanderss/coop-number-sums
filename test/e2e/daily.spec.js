import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle } from './helpers.js';

// The daily-challenge button is a direct child of .home-actions, distinct
// from the .btn-ghost buttons nested inside .home-grid (stats/settings/
// howto/changelog).
const dailyBtn = (page) => page.locator('.home-actions > .btn-ghost');

test.describe('daily challenge', () => {
  test('starts a puzzle restricted to the three easiest difficulties', async ({ page }) => {
    await gotoApp(page);
    await expect(dailyBtn(page)).toBeVisible();
    await dailyBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    const difficulty = await page.evaluate(() => window.__cns.state.puzzle.difficulty);
    expect(['sehrleicht', 'leicht', 'mittel']).toContain(difficulty);
    expect(await page.evaluate(() => window.__cns.state.isDailyGame)).toBe(true);
  });

  test('solving the daily puzzle records a streak and shows a share button', async ({ page }) => {
    await gotoApp(page);
    await dailyBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.result-card.win .btn-ghost', { hasText: 'Teilen' })).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.daily.currentStreak)).toBe(1);

    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();
    await expect(dailyBtn(page).locator('.badge-soon')).toHaveText('🔥1');
  });

  test('the same calendar day cannot be completed twice for streak purposes', async ({ page }) => {
    await gotoApp(page);
    await dailyBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await solveActivePuzzle(page);
    expect(await page.evaluate(() => window.__cns.state.daily.totalCompleted)).toBe(1);

    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü"
    await dailyBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await solveActivePuzzle(page);

    expect(await page.evaluate(() => window.__cns.state.daily.totalCompleted)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.daily.currentStreak)).toBe(1);
  });
});
