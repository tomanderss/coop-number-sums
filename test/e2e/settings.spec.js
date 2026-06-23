import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

test.describe('settings', () => {
  test('dark mode toggle persists across reload', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    const switchEl = page.locator('.set-row .switch').first();
    const wasOn = await switchEl.evaluate(el => el.classList.contains('on'));
    await switchEl.click();
    await expect.poll(() => switchEl.evaluate(el => el.classList.contains('on'))).toBe(!wasOn);

    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    await page.locator('.home-settings-btn').click();
    const isOnAfterReload = await page.locator('.set-row .switch').first().evaluate(el => el.classList.contains('on'));
    expect(isOnAfterReload).toBe(!wasOn);
  });

  test('switching language updates UI text immediately and persists', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('h2')).toHaveText('Einstellungen');

    await page.locator('select.text-input').selectOption('en');
    await expect(page.locator('h2')).toHaveText('Settings');

    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    await expect(page.locator('.btn-primary .btn-tx b').first()).toHaveText('Solo mode');
  });

  // The 8 non-DE/EN locales are machine-translated (accepted as-is per product
  // decision -- no content-quality review here). This is a grobe Sichtprüfung:
  // every locale must render on the home screen without a crash and without
  // leaking a raw, untranslated dot-path key (e.g. "home.newGame") to the user.
  const ALL_LOCALES = ['de', 'en', 'es', 'fr', 'pt-BR', 'it', 'ja', 'ko', 'tr', 'ru'];
  for (const locale of ALL_LOCALES) {
    test(`locale "${locale}" renders the home screen without raw keys or errors`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      await gotoApp(page);
      await page.locator('.home-settings-btn').click();
      await page.locator('select.text-input').selectOption(locale);
      await page.locator('.screen.settings .icon-btn').click();
      await expect(page.locator('.screen.home')).toBeVisible();

      const bodyText = await page.locator('.screen.home').innerText();
      for (const rawKeyPrefix of ['home.', 'common.', 'difficulty.']) {
        expect(bodyText).not.toContain(rawKeyPrefix);
      }
      expect(pageErrors).toEqual([]);
    });
  }
});
