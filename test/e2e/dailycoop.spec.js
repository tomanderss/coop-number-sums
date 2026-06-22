import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle } from './helpers.js';

// .daily-coop-btn is a stable hook, mirroring .daily-btn/.boss-btn/.training-btn.
const dailyCoopBtn = (page) => page.locator('.home-actions > .daily-coop-btn');

test.describe('daily coop', () => {
  test('skips the host/join choice and goes straight to a host setup with a fixed difficulty', async ({ page }) => {
    await gotoApp(page);
    await dailyCoopBtn(page).click();
    await page.waitForSelector('.screen.coop-screen');

    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click(); // confirm identity

    // No host/join/local choice -- straight to the host code screen.
    await expect(page.locator('.coop-code-label')).toBeVisible();
    await expect(page.locator('.coop-body .option-grid')).toHaveCount(0);
    expect(await page.evaluate(() => window.__cns.state.coop.isDaily)).toBe(true);
  });

  test('canceling out of the daily host setup clears the daily flag', async ({ page }) => {
    await gotoApp(page);
    await dailyCoopBtn(page).click();
    await page.waitForSelector('.screen.coop-screen');
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-ghost').click(); // cancel
    await expect(page.locator('.coop-body .coop-tagline')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.coop.isDaily)).toBe(false);
  });

  test('hosting and starting uses the same seed as the solo daily challenge', async ({ page }) => {
    await gotoApp(page);
    const dailySeed = await page.evaluate(() => window.__cns.getDailyChallenge().seed);

    await dailyCoopBtn(page).click();
    await page.waitForSelector('.screen.coop-screen');
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-input').fill('123456');
    await page.locator('.coop-body .btn-primary').click(); // "start hosting"

    // Two fake guests, same workaround as coop.spec.js's host-flow test --
    // avoids depending on the real (live Firebase) host onOpen round-trip
    // ever resolving, since canStartCoopMatch() only checks roster length.
    await page.evaluate(() => {
      window.__cns.state.coop.players.push(
        { id: 'fake-guest-1', name: 'Mara', color: '#f00' },
        { id: 'fake-guest-2', name: 'Alex', color: '#00f' },
      );
    });
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
    await page.locator('.coop-body .btn-primary').click(); // "start match"
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click(); // dismiss "ready?" lobby

    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.puzzle.seed)).toBe(dailySeed);
    expect(await page.evaluate(() => window.__cns.state.coop.isDaily)).toBe(true);
    await expect(page.locator('.coop-chip', { hasText: 'Tagesrätsel' })).toBeVisible();
  });

  test('winning a daily coop match counts as a coop win, not a daily streak', async ({ page }) => {
    await gotoApp(page);
    await dailyCoopBtn(page).click();
    await page.waitForSelector('.screen.coop-screen');
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-input').fill('123456');
    await page.locator('.coop-body .btn-primary').click();
    await page.evaluate(() => {
      window.__cns.state.coop.players.push(
        { id: 'fake-guest-1', name: 'Mara', color: '#f00' },
        { id: 'fake-guest-2', name: 'Alex', color: '#00f' },
      );
    });
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await solveActivePuzzle(page);
    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.daily.currentStreak)).toBe(0);
  });
});
