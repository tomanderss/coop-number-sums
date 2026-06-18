import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// The real service-worker update handshake can't be driven deterministically in
// CI, but the risky part is the UI. We flip state.updateReady via the debug hook
// (window.__cns, gated to 127.0.0.1) and verify the banner renders and dismisses.
test.describe('update banner', () => {
  test('shows the update modal and can be dismissed with "Later"', async ({ page }) => {
    await gotoApp(page);

    await expect(page.locator('.modal-bg')).toHaveCount(0);

    await page.evaluate(() => { window.__cns.state.updateReady = true; });

    const modal = page.locator('.modal-bg', { hasText: 'Neue Version verfügbar' });
    await expect(modal).toBeVisible();
    await expect(modal.locator('.btn-primary')).toBeVisible(); // "Aktualisieren & neu starten"

    await modal.locator('.btn-ghost.btn-sm').click(); // "Später"
    await expect(page.locator('.modal-bg')).toHaveCount(0);
  });
});
