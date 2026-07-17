import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, dismissStreakModal } from './helpers.js';

test.describe('weekly missions', () => {
  test('home missions button → missions screen lists the weekly quests; a completed one can be claimed for coins', async ({ page }) => {
    await gotoApp(page);
    // Missionen öffnen sich jetzt über den runden Knopf oben links auf Home.
    await expect(page.locator('.home-missions-btn')).toBeVisible();
    await page.locator('.home-missions-btn').click();
    await page.waitForSelector('.screen.missions-screen');

    // Vier Wochen-Missionen werden gelistet.
    expect(await page.locator('.mission-card').count()).toBe(4);
    // Anfangs nichts einlösbar.
    await expect(page.locator('.mission-claim')).toHaveCount(0);

    const before = await page.evaluate(() => window.__cns.state.wallet.balance || 0);
    // Die erste Mission künstlich auf „geschafft" setzen → Einlösen-Knopf erscheint.
    const reward = await page.evaluate(() => {
      const s = window.__cns.state;
      const m = s.missions.list[0];
      s.missions.progress = { ...s.missions.progress, [m.id]: m.target };
      return m.reward;
    });
    await expect(page.locator('.mission-claim').first()).toBeVisible();
    await page.locator('.mission-claim').first().click();

    // Belohnung gutgeschrieben, Mission als eingelöst markiert, kein Claim mehr.
    expect(await page.evaluate(() => window.__cns.state.wallet.balance)).toBe(before + reward);
    await expect(page.locator('.mission-card.claimed')).toHaveCount(1);
    await expect(page.locator('.mission-claim')).toHaveCount(0);
    // Persistiert: cns_missions trägt den claimed-Eintrag.
    expect(await page.evaluate(() => {
      const raw = localStorage.getItem('cns_missions');
      const m = raw && JSON.parse(raw);
      return m && m.claimed && Object.keys(m.claimed).length >= 1;
    })).toBe(true);
  });

  test('winning a solo game advances matching missions', async ({ page }) => {
    await gotoApp(page);
    // Deterministisch: bekannte Missionen in die Wochenliste setzen (statt der
    // wöchentlich rotierenden Zufallsauswahl) — play8 (jedes Spiel), winAny5
    // (jeder Sieg), perfect3 (makelloser Sieg).
    await page.evaluate(async () => {
      const mod = await import('/js/missions.js');
      const s = window.__cns.state;
      s.missions.list = ['play8', 'winAny5', 'perfect3'].map(id => mod.MISSION_POOL.find(m => m.id === id));
      s.missions.progress = {};
    });
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page); // makelloser Sieg (0 Fehler/Hinweise)
    await dismissStreakModal(page);
    await expect(page.locator('.result-card.win')).toBeVisible();
    const p = await page.evaluate(() => ({ ...window.__cns.state.missions.progress }));
    expect(p.play8 || 0).toBe(1);
    expect(p.winAny5 || 0).toBe(1);
    expect(p.perfect3 || 0).toBe(1);
  });
});
