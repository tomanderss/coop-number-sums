import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle, commitMistakes } from './helpers.js';

// .boss-btn is a stable hook independent of the btn-ghost/btn-daily class
// that toggles depending on whether this ISO week's attempt was already used.
const bossBtn = (page) => page.locator('.home-actions > .boss-btn');

test.describe('boss challenge', () => {
  test('starts a puzzle restricted to the three hardest difficulties with a forced single life', async ({ page }) => {
    await gotoApp(page);
    await expect(bossBtn(page)).toBeVisible();
    await bossBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    const { difficulty, isBossGame, lives, maxLives } = await page.evaluate(() => {
      const { state } = window.__cns;
      return { difficulty: state.puzzle.difficulty, isBossGame: state.isBossGame, lives: state.lives, maxLives: state.maxLives };
    });
    expect(['schwer', 'extrem', 'mashallah']).toContain(difficulty);
    expect(isBossGame).toBe(true);
    expect(lives).toBe(1);
    expect(maxLives).toBe(1);
  });

  test('winning increments the streak and hides the retry button', async ({ page }) => {
    await gotoApp(page);
    await bossBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.boss.currentStreak)).toBe(1);
    await expect(page.locator('.result-card.win .btn-primary', { hasText: 'Nächst' })).not.toBeVisible();

    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();
    await expect(bossBtn(page).locator('.badge-soon')).toHaveText('🔥1');
    await expect(bossBtn(page)).toBeDisabled();
  });

  test('a single mistake loses immediately, resets the streak and offers no retry', async ({ page }) => {
    await gotoApp(page);
    await bossBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await solveActivePuzzle(page);
    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü" -- now currentStreak === 1

    // ISO week is fixed for a given calendar day, so the boss button is already
    // exhausted; reset state directly to drive a second attempt within the same test run.
    await page.evaluate(() => { window.__cns.state.boss.lastAttemptedWeek = null; });
    await bossBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await commitMistakes(page, 1);

    await expect(page.locator('.result-card.lose')).toBeVisible();
    await expect(page.locator('.result-card.lose .btn-primary')).not.toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.boss.currentStreak)).toBe(0);
  });
});
