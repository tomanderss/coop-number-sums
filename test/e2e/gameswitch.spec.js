import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Spielauswahl auf dem Startbildschirm: ein Logo je Spiel, ein Tipp wechselt
// das Spiel (die App lädt neu — Brett, Leiter, Texte und Optik wechseln mit).
test.describe('Spielauswahl', () => {
  test('beide Spiele stehen zur Wahl, Number Sums ist voreingestellt', async ({ page }) => {
    await gotoApp(page);
    const tiles = page.locator('.game-switch .game-tile');
    await expect(tiles).toHaveCount(2);
    await expect(page.locator('.game-tile.on .game-tile-name')).toHaveText('Number Sums');
    await expect(page.locator('.brand-title')).toContainText('Number Games');
  });

  test('ein Tipp auf Math Cross wechselt das Spiel und zurück', async ({ page }) => {
    await gotoApp(page);
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('.game-tile', { hasText: 'Math Cross' }).click(),
    ]);
    await page.waitForFunction(() => window.__cns && window.__cns.gameId === 'mathcross');
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    // Math-Cross-Optik ist eingehängt, das Spiel bleibt nach einem Neuladen gewählt.
    const css = await page.evaluate(() => [...document.styleSheets].some((s) => s.href && s.href.endsWith('/css/games/mathcross.css')));
    expect(css).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_game')))).toBe('mathcross');
    // Erste Frage nach dem Geteilt-Zeichen gehört zu Math Cross — beantworten.
    await page.locator('.modal-divstyle .btn-primary').click({ timeout: 3000 }).catch(() => {});
    await expect(page.locator('.game-tile.on .game-tile-name')).toHaveText('Math Cross');
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('.game-tile', { hasText: 'Number Sums' }).click(),
    ]);
    await page.waitForFunction(() => window.__cns && window.__cns.gameId === 'numbersums');
  });

  test('die Spiele führen getrennte Statistiken', async ({ page }) => {
    // Spielspezifische Speicher-Schlüssel: dasselbe Konto, aber Math Cross hat
    // eigene Statistik (cns_stats__mathcross), Number Sums behält cns_stats.
    await gotoApp(page);
    await page.evaluate(() => localStorage.setItem('cns_stats', JSON.stringify({ played: 7, won: 7, lost: 0, byDifficulty: {} })));
    await page.evaluate(() => { localStorage.setItem('cns_game', JSON.stringify('mathcross')); });
    await page.reload();
    await page.waitForFunction(() => window.__cns && window.__cns.gameId === 'mathcross');
    expect(await page.evaluate(() => window.__cns.state.stats.played || 0)).toBe(0);
  });
});

test('ein Beitritt in ein anderes Spiel wird nach dem Wechsel nachgeholt (Namens-Gate mit Code)', async ({ page }) => {
  // So steht es nach joinInOtherGame() im Speicher: Spiel gewechselt, Auftrag gemerkt.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('cns_game', JSON.stringify('mathcross'));
    localStorage.setItem('cns_settings', JSON.stringify({ divStyle: 'obelus', coopName: 'Tom' }));
    localStorage.setItem('cns_pending_join', JSON.stringify({ code: '654321', mode: 'coop', game: 'mathcross', ts: Date.now() }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__cns && window.__cns.gameId === 'mathcross');
  await page.waitForFunction(() => window.__cns.state.screen === 'coop');
  const c = await page.evaluate(() => ({ code: window.__cns.state.coop.code, pending: window.__cns.state.coop.pendingJoin, gate: window.__cns.state.coop.identityConfirmed }));
  expect(c).toEqual({ code: '654321', pending: true, gate: false });
  // Der Auftrag ist verbraucht — ein erneuter Start fragt nicht wieder.
  expect(await page.evaluate(() => localStorage.getItem('cns_pending_join'))).toBeNull();
});

// Der Umzugs-Hinweis der alten App „Coop Math Cross" verlinkt mit ?game=mathcross.
test('?game=mathcross oeffnet die App direkt in Math Cross', async ({ page }) => {
  await page.goto('/?game=mathcross');
  await page.waitForFunction(() => window.__cns && window.__cns.state);
  const r = await page.evaluate(() => ({
    game: JSON.parse(localStorage.getItem('cns_game')),
    attr: document.documentElement.getAttribute('data-game'),
    url: location.search,
  }));
  expect(r.game).toBe('mathcross');
  expect(r.attr).toBe('mathcross');
  expect(r.url).toBe('');
});
