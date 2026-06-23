import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

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
    await page.locator('.screen.setup .icon-btn').click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('navigates to stats and back to home', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-grid .btn-ghost').nth(0).click();
    await expect(page.locator('.screen.stats')).toBeVisible();
    await page.locator('.screen.stats .icon-btn').click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('navigates to settings and back to home', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('.screen.settings')).toBeVisible();
    await page.locator('.screen.settings .icon-btn').click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('opens and closes the how-to modal', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-howto-btn').click();
    await expect(page.locator('.modal .rules')).toBeVisible();
    await page.locator('.modal .btn-primary').click();
    await expect(page.locator('.modal-bg')).toHaveCount(0);
  });

  test('opens and closes the changelog modal from settings', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('.screen.settings')).toBeVisible();
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
});
