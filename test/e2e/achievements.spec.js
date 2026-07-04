import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, dismissStreakModal } from './helpers.js';

const statsBtn = (page) => page.locator('.home-grid .btn-ghost').nth(0);

async function openAchievements(page) {
  await statsBtn(page).click();
  await expect(page.locator('.screen.stats')).toBeVisible();
  // Gezielt der Achievements-Knopf — seit dem Shop liegt oben in .stats-body auch
  // ein zweiter .btn-ghost (Shop-Einstieg), daher spezifische Klasse verwenden.
  await page.locator('.achievements-top-btn').click();
  await expect(page.locator('.screen.achievements')).toBeVisible();
}

test.describe('achievements', () => {
  test('all achievements start locked', async ({ page }) => {
    await gotoApp(page);
    await openAchievements(page);
    await expect(page.locator('.achievement-row')).not.toHaveCount(0);
    await expect(page.locator('.achievement-row.unlocked')).toHaveCount(0);
    await expect(page.locator('.achievement-icon.locked .ico-lock').first()).toBeVisible();
  });

  test('winning a puzzle unlocks firstWin and shows a toast', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);
    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.toast')).toContainText('Achievement');
    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await openAchievements(page);
    const row = page.locator('.achievement-row.unlocked').first();
    await expect(row).toBeVisible();
    await expect(row.locator('.achievement-date')).not.toHaveText('Gesperrt');
  });
});
