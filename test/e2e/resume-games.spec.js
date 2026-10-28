import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Der Fortsetzen-Knopf gilt für JEDES Spiel. Die Prüfung „hat ein Brett" darf
// nicht an Number-Sums-Feldern (`marks`) hängen: Math Cross speichert `placed`,
// Rectangles `rects`, Number Path `path` — und ein noch leeres Brett fehlt nach
// dem Cloud-Abgleich ganz. Gemeldet: Rectangles zeigte „Weitere Spielstände",
// aber keinen Fortsetzen-Knopf.

const GAMES = ['numbersums', 'mathcross', 'rectangles', 'numberpath'];

async function boot(page, game) {
  await page.addInitScript((g) => { try { localStorage.setItem('cns_game', JSON.stringify(g)); } catch {} }, game);
  await gotoApp(page);
  // Math Cross fragt einmalig nach dem Geteilt-Zeichen — vorbelegen (wie mathcross-helpers).
  await page.evaluate(() => {
    if (!window.__cns.state.settings.divStyle) window.__cns.setSetting('divStyle', 'obelus');
    window.__cns.state.showDivStyle = false;
  });
}
async function startSolo(page, endless) {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate((e) => { window.__cns.state.sel.difficulty = 'sehrleicht'; window.__cns.state.sel.endless = e; }, endless);
  await page.locator('.diff-start').click();
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating && window.__cns.state.screen === 'game');
  await page.waitForTimeout(600);
}
const suffix = (g) => (g === 'numbersums' ? '' : '__' + g);

for (const game of GAMES) {
  test(`${game}: ohne Aktivspiel-Slot bietet der Knopf den Stand aus der Bibliothek an`, async ({ page }) => {
    await boot(page, game);
    await startSolo(page, false);
    // Der Slot ist leer (z.B. die zuletzt gespielte Partie wurde gelöscht oder beendet),
    // die Bibliothek hält aber noch einen Stand.
    // Erst VOR dem nächsten Start räumen — beim Verlassen sichert die Seite den
    // Slot sonst gleich wieder (pagehide).
    await page.addInitScript((k) => {
      if (!sessionStorage.getItem('slotCleared')) { localStorage.removeItem('cns_active_game' + k); sessionStorage.setItem('slotCleared', '1'); }
    }, suffix(game));
    await page.reload();
    await page.waitForSelector('.screen.home');
    await expect(page.locator('.resume-stack .btn-resume')).toBeVisible();
    await page.locator('.resume-stack .btn-resume').click();
    await page.waitForFunction(() => window.__cns.state.screen === 'game' && !!window.__cns.state.puzzle);
  });

  test(`${game}: ein Endlos-Lauf bleibt nach dem Neuladen fortsetzbar`, async ({ page }) => {
    await boot(page, game);
    await startSolo(page, true);
    await page.reload();
    await page.waitForSelector('.screen.home');
    await expect(page.locator('.resume-stack .btn-resume.endless')).toBeVisible();
  });
}
