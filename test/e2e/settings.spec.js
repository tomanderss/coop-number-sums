import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, gotoSettingsSection } from './helpers.js';

test.describe('settings', () => {
  test('Einstellungen im Spiel über das Pausenmenü: pausiert (gleiche Mechanik wie Pause-Knopf) und bleibt nach Zurück pausiert', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(false);
    // Pause-Knopf (oben) -> Pausenmenü -> Einstellungen
    await page.locator('.game-top .icon-btn').first().click();
    await expect(page.locator('.pause-overlay')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    await page.locator('.pause-overlay').getByText('Einstellungen').click();
    await expect(page.locator('.screen.settings')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    // Zurück -> Spiel bleibt pausiert (Pause-Overlay wieder sichtbar). Der
    // Zurück-Knopf ist der ERSTE Topbar-Icon-Button (links); der Drawer-Hamburger
    // sitzt rechts.
    await page.locator('.screen.settings .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.game')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    await expect(page.locator('.pause-overlay')).toBeVisible();
  });

  test('settings open fully collapsed and theme choice (dark) persists across reload', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    // Immer zugeklappt starten: keine Karte offen, keine Options-Reihe sichtbar.
    await expect(page.locator('.screen.settings .admin-acc-body')).toHaveCount(0);

    await gotoSettingsSection(page, 'Darstellung');
    await page.locator('.seg button', { hasText: '🌙' }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    expect(await page.evaluate(() => window.__cns.state.settings.themeMode)).toBe('dark');
    // Auch nach dem Reload: Einstellungen starten zugeklappt.
    await page.locator('.home-settings-btn').click();
    await expect(page.locator('.screen.settings .admin-acc-body')).toHaveCount(0);
  });

  test('colorblind mode toggle applies a global CSS class and persists across reload', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    await gotoSettingsSection(page, 'Darstellung'); // Farbenblind-Modus lebt jetzt unter „Darstellung"
    const row = page.locator('.set-row', { hasText: '🎨' });
    await expect(row).toBeVisible();
    const isColorblind = () => page.evaluate(() => document.documentElement.classList.contains('colorblind'));
    expect(await isColorblind()).toBe(false);

    await row.locator('.switch').click();
    await expect.poll(isColorblind).toBe(true);

    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    expect(await isColorblind()).toBe(true);
  });

  test('switching language updates UI text immediately and persists', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-settings-btn').click();
    // Sprachwahl liegt in der Karte „Darstellung"; der Screen-Titel ist statisch
    // („Einstellungen") und wechselt mit der Sprache mit.
    await gotoSettingsSection(page, 'Darstellung');
    await expect(page.locator('.screen.settings h2')).toHaveText('Einstellungen');

    await page.locator('select.lang-select').selectOption('en');
    await expect(page.locator('.screen.settings h2')).toHaveText('Settings');

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
      await gotoSettingsSection(page, 'Darstellung'); // Sprachwahl-Select liegt hier
      await page.locator('select.lang-select').selectOption(locale);
      await page.locator('.screen.settings .topbar .icon-btn').first().click(); // Zurück (erster Icon-Button, links)
      await expect(page.locator('.screen.home')).toBeVisible();

      const bodyText = await page.locator('.screen.home').innerText();
      for (const rawKeyPrefix of ['home.', 'common.', 'difficulty.']) {
        expect(bodyText).not.toContain(rawKeyPrefix);
      }
      expect(pageErrors).toEqual([]);
    });
  }
});
