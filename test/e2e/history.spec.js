import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle } from './helpers.js';

// home-grid now only holds stats/history (settings is a top-right gear icon,
// howto is a top-left "?" icon, changelog moved into settings) — see js/app.js.
const historyBtn = (page) => page.locator('.home-grid .btn-ghost').nth(1);

test.describe('history', () => {
  test('shows an empty state before any puzzle has been solved', async ({ page }) => {
    await gotoApp(page);
    await historyBtn(page).click();
    await expect(page.locator('.screen.history')).toBeVisible();
    await expect(page.locator('.history-body .empty')).toBeVisible();
    await expect(page.locator('.history-row')).toHaveCount(0);
  });

  test('records a solved puzzle and offers to view or replay it', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    const seedBefore = await page.evaluate(() => window.__cns.state.puzzle.seed);
    await solveActivePuzzle(page);
    await expect(page.locator('.result-card.win')).toBeVisible();
    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await historyBtn(page).click();
    await expect(page.locator('.screen.history')).toBeVisible();
    const row = page.locator('.history-row').first();
    await expect(row).toBeVisible();
    await expect(row.locator('.history-outcome')).toHaveText('🏆');

    // "Ansehen" opens a read-only board overlay without touching the live game state
    // (state.puzzle/state.status, which quitToHome/goNextPuzzle rely on for resuming).
    await row.locator('.btn-ghost', { hasText: 'Ansehen' }).click();
    await expect(page.locator('.modal-history')).toBeVisible();
    const liveState = await page.evaluate(() => ({ puzzle: window.__cns.state.puzzle, status: window.__cns.state.status }));
    expect(liveState.puzzle.seed).toBe(seedBefore);
    expect(liveState.status).toBe('won');
    await page.locator('.modal-history .btn-primary').click();
    await expect(page.locator('.modal-history')).not.toBeVisible();

    // "Erneut spielen" regenerates the exact same puzzle from the stored seed.
    await row.locator('.btn-primary', { hasText: 'Erneut spielen' }).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    const seedAfter = await page.evaluate(() => window.__cns.state.puzzle.seed);
    expect(seedAfter).toBe(seedBefore);
  });

  test('a lost puzzle is recorded with the lost outcome', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await page.evaluate(() => { window.__cns.state.lives = 1; window.__cns.state.maxLives = 1; window.__cns.state.settings.livesEnabled = true; });
    // A single mistake with 1 life left immediately ends the round as lost.
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      let wrongR = -1, wrongC = -1;
      outer: for (let r = 0; r < p.rows; r++) {
        for (let c = 0; c < p.cols; c++) {
          if (state.marks[r][c] === 'none') { wrongR = r; wrongC = c; break outer; }
        }
      }
      state.tool = p.solution[wrongR][wrongC] ? 'eraser' : 'pen';
      onCellTap(wrongR, wrongC);
    });
    await expect(page.locator('.result-card.lose')).toBeVisible();
    await page.locator('.result-card.lose .btn-ghost', { hasText: 'Menü' }).click();
    await expect(page.locator('.screen.home')).toBeVisible();

    await historyBtn(page).click();
    const row = page.locator('.history-row').first();
    await expect(row.locator('.history-outcome')).toHaveText('💔');
  });
});
