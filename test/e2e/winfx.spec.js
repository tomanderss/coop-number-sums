import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Mythische (Tier 5) und göttliche (Tier 6) Sieganimationen: jede startet,
// füllt das Overlay mit Teilchen und räumt es danach wieder ab.
const EPIC = ['hyperjump', 'aurora', 'coronation', 'supernova', 'grandfinale'];

for (const id of EPIC) {
  test(`Sieganimation ${id}: läuft an und verschwindet wieder`, async ({ page }) => {
    await gotoApp(page);
    await page.evaluate((id) => window.__cns.previewWinFx(id), id);
    const fx = page.locator(`.winfx.fx-${id}`);
    await expect(fx).toBeVisible();
    expect(await fx.locator('i').count()).toBeGreaterThan(20);
    await expect(fx).toHaveCount(0, { timeout: 8000 });
  });
}
