import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Die App soll sich wie eine native App anfühlen: die Startseite steht fest —
// nichts lässt sich seitlich verschieben, nichts scrollt, nichts zoomt. Gemeldet
// wurde eine seitlich verschiebbare Startseite mit Scrollbalken in beide
// Richtungen (der Name des Nachbarspiels unter der Spielauswahl ragte über den Rand).
const SIZES = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932]];

for (const [w, h] of SIZES) {
  test(`Startseite steht fest auf ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await gotoApp(page);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const s = document.querySelector('.screen.home');
      const de = document.documentElement;
      return {
        docX: de.scrollWidth - innerWidth, docY: de.scrollHeight - innerHeight,
        homeX: s.scrollWidth - s.clientWidth, homeY: s.scrollHeight - s.clientHeight,
        htmlOverflow: getComputedStyle(de).overflowX + '/' + getComputedStyle(de).overflowY,
        touch: getComputedStyle(de).touchAction,
      };
    });
    expect(m.docX).toBeLessThanOrEqual(0);
    expect(m.docY).toBeLessThanOrEqual(0);
    expect(m.homeX).toBeLessThanOrEqual(0);
    expect(m.homeY).toBeLessThanOrEqual(0);
    expect(m.htmlOverflow).toBe('hidden/hidden');
    expect(m.touch).toBe('pan-x pan-y');     // kein Browser-Zoom
  });
}

test('auch nach dem Spielwechsel ragt nichts über den Rand', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.settings.divStyle = 'obelus'; });
  await page.locator('.gw-item[data-game="mathcross"]').click();
  await page.waitForFunction(() => window.__cns.gameId === 'mathcross');
  await page.waitForTimeout(700);
  const x = await page.evaluate(() => { const s = document.querySelector('.screen.home'); return s.scrollWidth - s.clientWidth; });
  expect(x).toBeLessThanOrEqual(0);
});
