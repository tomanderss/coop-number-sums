import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// PeerJS is vendored locally (js/peerjs.min.js), so Coop.isAvailable() is true
// and the coop button is never disabled in this suite. We deliberately do NOT
// attempt real two-peer WebRTC signaling (that needs an external broker) --
// these tests cover the UI/state machine up to the point a real network
// connection would be required (host waiting-for-guest spinner, guest
// connecting spinner).
test.describe('coop', () => {
  async function goToCoop(page) {
    await gotoApp(page);
    await page.locator('.btn-coop').click();
    await page.waitForSelector('.screen.coop-screen');
  }

  test('identity gate requires a name before continuing', async ({ page }) => {
    await goToCoop(page);
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-body .text-input').fill('Tom');
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();

    await page.locator('.coop-body .btn-primary').click();
    await expect(page.locator('.coop-body .coop-tagline')).toBeVisible();
  });

  test('host flow: set a code, pick a difficulty, start hosting shows waiting state', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-primary').click(); // "Host" option
    await expect(page.locator('.coop-code-label')).toBeVisible();

    await page.locator('.coop-input').fill('123456');
    await page.locator('.option-grid .opt-card').first().click();
    await page.locator('.coop-body .btn-primary').click(); // "start hosting"

    await expect(page.locator('.coop-code')).toHaveText('123456');
    await expect(page.locator('.coop-waiting')).toBeVisible();
  });

  test('host flow: cancel returns to the host/join choice', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    await page.locator('.coop-body .btn-primary').click(); // "Host" option

    await page.locator('.coop-body .btn-ghost').click(); // cancel
    await expect(page.locator('.coop-body .coop-tagline')).toBeVisible();
    await expect(page.locator('.coop-body .btn-primary')).toBeVisible();
    await expect(page.locator('.coop-body .btn-ghost')).toBeVisible();
  });

  test('guest flow: connect button stays disabled until a 6-digit code is entered', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-ghost').click(); // "Join" option
    await expect(page.locator('.coop-code-label')).toBeVisible();
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-input').fill('123');
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-input').fill('123456');
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
  });

  test('guest flow: connecting shows a connecting state and an eventual error for an unreachable code', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    await page.locator('.coop-body .btn-ghost').click(); // "Join" option

    await page.locator('.coop-input').fill('999999');
    await page.locator('.coop-body .btn-primary').click();

    await expect(page.locator('.coop-error')).toBeVisible({ timeout: 20000 });
  });

  test('back navigation from the coop screen returns to home', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.screen.coop-screen .icon-btn').click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('the back button on the host/join choice screen returns to home', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.screen.coop-screen .icon-btn').click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });
});
