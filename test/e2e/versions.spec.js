import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Hauptversions-Feier + rückwirkende Umnummerierung (js/versions.js):
// 1.224–1.240 heißen heute 2.0–2.16. Wer zuletzt eine ältere Hauptversion sah,
// bekommt EINMAL die Feier der laufenden (seit 3.0); „Was ist neu" zeigt nur, was
// seit der (übersetzten) zuletzt gesehenen Version wirklich neu ist.

async function bootWithSeen(page, seen) {
  await page.addInitScript((v) => {
    try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('cns_seen_version', JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } } catch {}
  }, seen);
  await page.goto('/');
  await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
}

const currentBuild = async (page) => (await page.locator('.home-version').textContent()).trim().replace(/^v/, '');

test('wer die vorige Hauptversion sah, wird einmal in der neuen begrüßt', async ({ page }) => {
  await bootWithSeen(page, '2.28');
  const modal = page.locator('.major-modal');
  await expect(modal).toBeVisible();
  const major = await page.evaluate(() => window.__cns.state.majorCelebration);
  expect(major).toBeGreaterThanOrEqual(3);
  await expect(modal.locator('.mj-num')).toHaveText(major + '.0');
  await expect(modal.locator('.mj-title')).toContainText('Version ' + major + '.0');
  await expect(modal.locator('.mj-list li')).toHaveCount(4);
  // Der Knopf passt auf den Bildschirm (sechs Logos in EINER Reihe).
  const btn = await modal.locator('.btn-primary').boundingBox();
  expect(btn.y + btn.height).toBeLessThanOrEqual(page.viewportSize().height);
  await expect(page.locator('.whatsnew-badge')).toHaveCount(0);
  await modal.locator('.btn-primary').click();
  await expect(modal).toHaveCount(0);
  // Danach „Was ist neu" mit allem seit 2.28.
  await expect(page.locator('.whatsnew-badge')).toBeVisible();
  await page.locator('.modal-bg .btn-primary').click();
  const build = await currentBuild(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_seen_version')))).toBe(build);
  await page.reload();
  await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(800);
  await expect(page.locator('.major-modal')).toHaveCount(0);
});

test('wer zuletzt 1.240 (= 2.16) sah, feiert die aktuelle Hauptversion; „Was ist neu" beginnt bei 2.17', async ({ page }) => {
  await bootWithSeen(page, '1.240');
  const modal = page.locator('.major-modal');
  await expect(modal).toBeVisible();
  const build = await currentBuild(page);
  await expect(modal.locator('.mj-num')).toHaveText(build.split('.')[0] + '.0');
  await modal.locator('.btn-primary').click();
  await expect(page.locator('.whatsnew-badge')).toBeVisible();
  const versions = await page.locator('.whatsnew-multi .cl-head b').allTextContents();
  expect(versions[versions.length - 1]).toBe('v2.17');
  expect(versions[0]).toBe('v' + build);
});

test('nach der Feier zeigt „Was ist neu" nur die Versionen seit der alten Nummer', async ({ page }) => {
  await bootWithSeen(page, '1.230');   // = 2.6
  await page.locator('.major-modal .btn-primary').click();
  await expect(page.locator('.whatsnew-badge')).toBeVisible();
  const versions = await page.locator('.whatsnew-multi .cl-head b').allTextContents();
  expect(versions[versions.length - 1]).toBe('v2.7');
  expect(versions.every((v) => /^v[23]\./.test(v))).toBe(true);
});

test('eine Neuinstallation feiert keine Hauptversion', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('.major-modal')).toHaveCount(0);
});
