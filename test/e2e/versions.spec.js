import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Hauptversions-Feier + rückwirkende Umnummerierung (js/versions.js):
// 1.224–1.240 heißen heute 2.0–2.16. Wer zuletzt eine 1.x sah, bekommt EINMAL
// die 2.0-Feier; „Was ist neu" zeigt nur, was seit der (übersetzten) zuletzt
// gesehenen Version wirklich neu ist.

async function bootWithSeen(page, seen) {
  await page.addInitScript((v) => {
    try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('cns_seen_version', JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } } catch {}
  }, seen);
  await page.goto('/');
  await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
}

test('wer zuletzt 1.240 sah, wird einmal in Version 2 begrüßt — ohne leeres „Was ist neu"', async ({ page }) => {
  await bootWithSeen(page, '1.240');
  const modal = page.locator('.major-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.mj-num')).toHaveText('2.0');
  await expect(modal.locator('.mj-title')).toContainText('Version 2.0');
  await expect(modal.locator('.mj-game')).toHaveCount(4);
  await expect(modal.locator('.mj-list li')).toHaveCount(4);
  await expect(page.locator('.whatsnew-badge')).toHaveCount(0);
  await modal.locator('.btn-primary').click();
  await expect(modal).toHaveCount(0);
  // 1.240 = 2.16: inhaltlich nichts Neues, also auch kein leeres Pop-up danach.
  const build = await page.evaluate(() => window.__cns.state && document.querySelector('.home-version')?.textContent.trim());
  await expect(page.locator('.whatsnew-badge')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_seen_version')))).toBe(build.replace(/^v/, ''));
  await page.reload();
  await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(800);
  await expect(page.locator('.major-modal')).toHaveCount(0);
});

test('nach der Feier zeigt „Was ist neu" nur die Versionen seit der alten Nummer', async ({ page }) => {
  await bootWithSeen(page, '1.230');   // = 2.6
  await page.locator('.major-modal .btn-primary').click();
  await expect(page.locator('.whatsnew-badge')).toBeVisible();
  const versions = await page.locator('.whatsnew-multi .cl-head b').allTextContents();
  expect(versions[versions.length - 1]).toBe('v2.7');
  expect(versions.every((v) => /^v2\./.test(v))).toBe(true);
});

test('eine Neuinstallation feiert keine Hauptversion', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('.major-modal')).toHaveCount(0);
});
