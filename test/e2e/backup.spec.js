import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Nutzerwunsch: EINE App — die Sicherung enthält alle Spiele, nicht nur das offene.
test('Sicherung einspielen stellt die Statistik ALLER Spiele wieder her', async ({ page }) => {
  await gotoApp(page);
  const file = {
    v: 2, label: 'manual', ts: Date.now(), settings: { themeMode: 'dark' },
    games: {
      numbersums: { stats: { played: 11, won: 11 } },
      pipes: { stats: { played: 22, won: 22 } },
      gems: { stats: { played: 33, won: 33 } },
    },
  };
  await page.evaluate(() => { window.__cns.state.screen = 'settings'; window.__cns.state.settingsScope = 'general'; window.__cns.state.settingsTab = 'daten'; });
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)),
  });
  await page.waitForFunction(() => window.__cns.state.stats && window.__cns.state.stats.played === 11);
  const raw = await page.evaluate(() => ({
    pipes: JSON.parse(localStorage.getItem('cns_stats__pipes')).played,
    gems: JSON.parse(localStorage.getItem('cns_stats__gems')).played,
  }));
  expect(raw).toEqual({ pipes: 22, gems: 33 });
});
