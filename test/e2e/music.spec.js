import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Hintergrundmusik: prozedural, pro Modus schaltbar, Default an. Diese Tests
// prüfen die Steuerlogik (isPlaying-Flag) und die Settings-UI — NICHT die echte
// Audio-Ausgabe (die hängt von der Autoplay-Policy des Browsers ab und wird
// separat manuell verifiziert). Music.isPlaying() spiegelt den Soll-Zustand.

test('Solo-Spiel startet Musik (Default an), Sieg stoppt sie', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await page.waitForFunction(() => window.__cns.Music.isPlaying() === true, null, { timeout: 4000 });

  await page.evaluate(() => {
    const { state, onCellTap } = window.__cns, p = state.puzzle;
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      if (state.marks[r][c] !== 'none') continue;
      state.tool = p.solution[r][c] ? 'pen' : 'eraser';
      onCellTap(r, c);
    }
  });
  await page.waitForFunction(() => window.__cns.Music.isPlaying() === false, null, { timeout: 4000 });
});

test('Pro-Modus-Schalter aus: kein Start der Musik im Solo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cns_settings', JSON.stringify({ musicSolo: false })));
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cns.Music.isPlaying())).toBe(false);
});

test('Einstellungen: Ton-Kategorie mit vier Modus-Schaltern und Lautstärke', async ({ page }) => {
  await gotoApp(page);
  await page.locator('.home-settings-btn').click();
  await page.waitForSelector('.screen.settings');
  // Kategorie-Überschrift + vier Modus-Labels + Lautstärke-Regler (de-DE-Locale).
  await expect(page.getByText('Musik im Solo-Modus')).toBeVisible();
  await expect(page.getByText('Musik im Coop-Modus')).toBeVisible();
  await expect(page.getByText('Musik im Wettkampf')).toBeVisible();
  await expect(page.getByText('Musik im Training')).toBeVisible();
  await expect(page.locator('.screen.settings .set-range')).toHaveCount(1);
});
