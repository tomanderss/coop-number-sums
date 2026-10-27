import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Die alte App „Coop Math Cross" liegt unter derselben Herkunft und hinterlässt
// ihre Daten als cmc_* im localStorage. Beim ersten Start werden sie übernommen.
test('Daten der alten Math-Cross-App werden beim Start uebernommen', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('cns_e2e_seeded')) return;   // nur vor dem ERSTEN Laden
    localStorage.setItem('cns_e2e_seeded', '1');
    localStorage.setItem('cmc_wallet', JSON.stringify({ balance: 321, updatedAt: 1 }));
    localStorage.setItem('cmc_stats', JSON.stringify({ won: 4, played: 5, byDifficulty: {} }));
    localStorage.setItem('cmc_inventory', JSON.stringify({ palette_ozean: { acquiredAt: 1, source: 'buy' } }));
  });
  await gotoApp(page);
  await expect.poll(() => page.evaluate(() => window.__cns.state.wallet.balance)).toBe(321);
  const lokal = await page.evaluate(() => ({
    stats: JSON.parse(localStorage.getItem('cns_stats__mathcross')),
    nsStats: localStorage.getItem('cns_stats'),
    inv: Object.keys(window.__cns.state.inventory),
    flag: !!localStorage.getItem('cns_mc_local_migrated'),
    alt: localStorage.getItem('cmc_wallet'),
  }));
  expect(lokal.stats.won).toBe(4);
  expect(lokal.nsStats).toBeNull();          // Number Sums bekommt keine fremde Statistik
  expect(lokal.inv).toContain('palette_ozean');
  expect(lokal.flag).toBe(true);
  expect(lokal.alt).not.toBeNull();          // Alt-Daten bleiben stehen

  // Ein zweiter Start bucht nichts erneut.
  await page.reload();
  await page.waitForSelector('.screen.home');
  expect(await page.evaluate(() => window.__cns.state.wallet.balance)).toBe(321);
});
