import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, dismissStreakModal, gotoSettingsSection } from './helpers.js';

test.describe('home screen', () => {
  test('shows the brand, primary actions and a version number', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.brand-title')).toBeVisible();
    await expect(page.locator('.home-actions .btn-primary')).toBeVisible();
    await expect(page.locator('.home-version')).toHaveText(/^v\d+\.\d+$/);
  });

  test('navigates to setup and back to home', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await expect(page.locator('.screen.setup')).toBeVisible();
    await page.locator('.screen.setup .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('navigates to stats and back to home', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-grid .btn-ghost').nth(0).click();
    await expect(page.locator('.screen.stats')).toBeVisible();
    await page.locator('.screen.stats .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('navigates to settings and back to home', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('.screen.settings')).toBeVisible();
    // Zurück-Knopf ist der erste Icon-Button (links); der Drawer-Hamburger rechts.
    await page.locator('.screen.settings .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('opens and closes the how-to modal (from settings ▸ Spiel)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('.screen.settings')).toBeVisible();
    await page.locator('.set-howto-btn').click();
    await expect(page.locator('.modal .rules')).toBeVisible();
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.modal-bg')).toHaveCount(0);
  });

  test('opens and closes the changelog modal from settings', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('.screen.settings')).toBeVisible();
    await gotoSettingsSection(page, 'Daten');
    await page.locator('.screen.settings button:has-text("Changelog")').click();
    await expect(page.locator('.modal-bg .changelog')).toBeVisible();
    await page.locator('.modal-bg .btn-primary').click();
    await expect(page.locator('.modal-bg')).toHaveCount(0);
  });

  test('coop button is either available or marked as coming soon, never silently broken', async ({ page }) => {
    await gotoApp(page);
    const coopBtn = page.locator('.btn-coop');
    await expect(coopBtn).toBeVisible();
    const disabled = await coopBtn.isDisabled();
    const hasBadge = await page.locator('.badge-soon').isVisible().catch(() => false);
    expect(disabled).toBe(hasBadge);
  });

  test('leaving an unfinished solo game shows a resume button that continues the same puzzle', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.resume-row')).toHaveCount(0);
    await startNewGame(page, 'sehrleicht');
    const seedBefore = await page.evaluate(() => window.__cns.state.puzzle.seed);
    await page.locator('.game-top .icon-btn').first().click(); // Pause
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await expect(page.locator('.screen.home')).toBeVisible();
    const resumeRow = page.locator('.resume-row');
    await expect(resumeRow).toBeVisible();
    await expect(resumeRow.locator('.btn-resume')).toHaveCount(1);
    await resumeRow.locator('.btn-resume').click();
    await expect(page.locator('.screen.game')).toBeVisible();
    const seedAfter = await page.evaluate(() => window.__cns.state.puzzle.seed);
    expect(seedAfter).toBe(seedBefore);
  });

  test('a finished solo game leaves no resume button behind', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      for (let r = 0; r < p.rows; r++)
        for (let c = 0; c < p.cols; c++) {
          state.tool = p.solution[r][c] ? 'pen' : 'eraser';
          onCellTap(r, c);
        }
    });
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    await dismissStreakModal(page);
    await page.locator('.result-card.win .btn-ghost').click();
    await expect(page.locator('.screen.home')).toBeVisible();
    await expect(page.locator('.resume-row')).toHaveCount(0);
  });

  test('solo and coop resume buttons render side by side when both saves exist', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await page.locator('.game-top .icon-btn').first().click(); // Pause
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await expect(page.locator('.screen.home')).toBeVisible();
    // Fake a separately-saved coop game in the dedicated coop slot (real coop
    // saves go through Coop.rejoin()'s Firebase round-trip, which the E2E
    // suite deliberately never exercises -- see coop.spec.js) and reload so
    // refreshResume() (run on mount) picks it up from localStorage.
    await page.evaluate(() => {
      const solo = JSON.parse(localStorage.getItem('cns_active_game'));
      localStorage.setItem('cns_active_game_coop', JSON.stringify({ ...solo, ts: Date.now() }));
    });
    await page.reload();
    await page.waitForSelector('.screen.home');
    const resumeRow = page.locator('.resume-row');
    await expect(resumeRow).toBeVisible();
    await expect(resumeRow.locator('.btn-resume')).toHaveCount(2);
    const box1 = await resumeRow.locator('.btn-resume').nth(0).boundingBox();
    const box2 = await resumeRow.locator('.btn-resume').nth(1).boundingBox();
    expect(Math.abs(box1.y - box2.y)).toBeLessThan(5); // side by side, not stacked
  });
});
