import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Hintergrundmusik: prozedural, pro Bereich schaltbar (Menü + je Spielmodus),
// Default an. Diese Tests prüfen die Steuerlogik (isPlaying-Flag) und die
// Settings-UI — NICHT die echte Audio-Ausgabe (hängt von der Autoplay-Policy
// ab, separat manuell verifiziert). Music.isPlaying() spiegelt den Soll-Zustand.

test('Menü-Musik läuft im Hauptmenü (Default an)', async ({ page }) => {
  await gotoApp(page);
  await page.waitForFunction(() => window.__cns.Music.isPlaying() === true, null, { timeout: 4000 });
});

test('Menü-Musik aus: still im Menü', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cns_settings', JSON.stringify({ musicMenu: false })));
  await gotoApp(page);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__cns.Music.isPlaying())).toBe(false);
});

test('Solo-Modus-Schalter steuert die Spielmusik (Menü-Musik aus isoliert den Test)', async ({ page }) => {
  // Menü-Musik aus, damit nach dem Sieg (Menü-Kontext) wirklich Stille herrscht.
  await page.addInitScript(() => localStorage.setItem('cns_settings', JSON.stringify({ musicMenu: false })));
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

test('Pro-Modus-Schalter aus: keine Spielmusik im Solo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cns_settings', JSON.stringify({ musicMenu: false, musicSolo: false })));
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cns.Music.isPlaying())).toBe(false);
});

test('Einstellungen: Ton-Kategorie mit Menü- + vier Modus-Schaltern und Lautstärke', async ({ page }) => {
  await gotoApp(page);
  await page.locator('.home-settings-btn').click();
  await page.waitForSelector('.screen.settings');
  await expect(page.getByText('Musik in Menüs')).toBeVisible();
  await expect(page.getByText('Musik im Solo-Modus')).toBeVisible();
  await expect(page.getByText('Musik im Coop-Modus')).toBeVisible();
  await expect(page.getByText('Musik im Wettkampf')).toBeVisible();
  await expect(page.getByText('Musik im Training')).toBeVisible();
  await expect(page.locator('.screen.settings .set-range')).toHaveCount(1);
});

test('Einstellungen: Aktions-Sounds pro Aktion schaltbar', async ({ page }) => {
  await gotoApp(page);
  await page.locator('.home-settings-btn').click();
  await page.waitForSelector('.screen.settings');
  const s = page.locator('.screen.settings');
  await expect(s.getByText('Aktions-Töne — je Aktion einzeln schaltbar.')).toBeVisible();
  await expect(s.getByText('Vervollständigung (Käfig/Reihe/Spalte)')).toBeVisible();
  await expect(s.getByText('Einkreisen', { exact: true })).toBeVisible();
});

test('Aktions-Sounds: alle Funktionen vorhanden und werfen nicht', async ({ page }) => {
  await gotoApp(page);
  const ok = await page.evaluate(() => {
    const M = window.__cns.Music;
    for (const fn of ['sfxComplete', 'sfxKeep', 'sfxRemove', 'sfxError', 'sfxHint', 'sfxToolSwitch'])
      if (typeof M[fn] !== 'function') throw new Error('missing ' + fn);
    M.sfxComplete(1); M.sfxComplete(3); M.sfxKeep(); M.sfxRemove(); M.sfxError(); M.sfxHint(); M.sfxToolSwitch();
    return true;
  });
  expect(ok).toBe(true);
});
