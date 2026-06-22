import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle } from './helpers.js';

// Pass-and-Play is a purely local mode (no Firebase round-trip at all), so
// unlike coop.spec.js there is no real/simulated network boundary to respect
// here -- every step below is driven through real UI interaction.
async function goToLocalSetup(page) {
  await gotoApp(page);
  await page.locator('.btn-coop').click();
  await page.waitForSelector('.screen.coop-screen');
  await page.locator('.coop-body .text-input').fill('Tom');
  await page.locator('.coop-body .btn-primary').click();
  await page.locator('.coop-body .btn-coop').click(); // "Pass & Play" option
}

test.describe('pass-and-play', () => {
  test('setup screen defaults to 2 players and gates start on names', async ({ page }) => {
    await goToLocalSetup(page);
    await expect(page.locator('.coop-body .text-input')).toHaveCount(2);
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-body .text-input').nth(0).fill('Mara');
    await page.locator('.coop-body .text-input').nth(1).fill('Alex');
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
  });

  test('player count can be increased up to the max and adds more name fields', async ({ page }) => {
    await goToLocalSetup(page);
    await page.locator('.coop-body .option-grid .opt-card').nth(2).click(); // "4"
    await expect(page.locator('.coop-body .text-input')).toHaveCount(4);
  });

  test('starting a match enters the game with the first player active', async ({ page }) => {
    await goToLocalSetup(page);
    await page.locator('.coop-body .text-input').nth(0).fill('Mara');
    await page.locator('.coop-body .text-input').nth(1).fill('Alex');
    await page.locator('.coop-body .option-grid .opt-card').first().click(); // difficulty
    await page.locator('.coop-body .btn-primary').click();

    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.coop.local)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.coop.players.map(p => p.name))).toEqual(['Mara', 'Alex']);
    expect(await page.evaluate(() => window.__cns.state.coop.activePlayerIdx)).toBe(0);
    expect(await page.evaluate(() => window.__cns.state.coop.myId)).toBe('local0');
    await expect(page.locator('.coop-roster').first()).toBeVisible();
  });

  test('ending a turn shows a handoff overlay and switches the active player', async ({ page }) => {
    await goToLocalSetup(page);
    await page.locator('.coop-body .text-input').nth(0).fill('Mara');
    await page.locator('.coop-body .text-input').nth(1).fill('Alex');
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.locator('.coop-roster + .coop-roster .btn-ghost').click(); // "end turn"
    await expect(page.locator('.pause-overlay')).toBeVisible();

    await page.locator('.pause-overlay .btn-primary').click(); // "ready"
    await expect(page.locator('.pause-overlay')).not.toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.coop.activePlayerIdx)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.coop.myId)).toBe('local1');
  });

  test('solving the puzzle wins without any network activity', async ({ page }) => {
    await goToLocalSetup(page);
    await page.locator('.coop-body .text-input').nth(0).fill('Mara');
    await page.locator('.coop-body .text-input').nth(1).fill('Alex');
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await solveActivePuzzle(page);
    await expect(page.locator('.result-card.win')).toBeVisible();
  });
});
