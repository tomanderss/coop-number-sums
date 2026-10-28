import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Spielauswahl = rotierende Scheibe (js/gamewheel.js): das laufende Spiel groß
// in der Mitte, ziehen oder ein Seiten-Logo antippen dreht ein anderes hinein.
// Der Wechsel geschieht OHNE Neuladen — Brett, Leiter, Texte, Optik und die
// spieleigenen Daten werden im laufenden Betrieb umgehängt.
const gameOf = (page) => page.evaluate(() => window.__cns.gameId);

async function dragWheel(page, dx) {
  const box = await page.locator('.game-wheel').boundingBox();
  const y = box.y + 60, x0 = box.x + box.width / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(x0 + (dx * i) / 12, y); await page.waitForTimeout(16); }
  await page.mouse.up();
}

test.describe('Spielauswahl', () => {
  test('alle Spiele stehen auf der Scheibe, Number Sums ist voreingestellt', async ({ page }) => {
    await gotoApp(page);
    // Alle Spiele plus Mix, jedes genau einmal als Haupt-Exemplar (der Ring zeigt
    // weiter entfernte Einträge zusätzlich als Kopien).
    await expect(page.locator('.game-wheel .gw-item[data-game]')).toHaveCount(7);
    expect((await page.locator('.game-wheel .gw-item[data-game]').evaluateAll((els) => els.map((e) => e.dataset.game))).sort())
      .toEqual(['gems', 'mathcross', 'mix', 'numberpath', 'numbersums', 'pipes', 'rectangles']);
    await expect(page.locator('.gw-item.on')).toHaveAttribute('data-game', 'numbersums');
    await expect(page.locator('.brand-title')).toContainText('Number Games');
  });

  test('Antippen wechselt das Spiel ohne Neuladen, Ziehen wechselt zurück', async ({ page }) => {
    await gotoApp(page);
    let loads = 0;
    page.on('load', () => { loads++; });
    await page.locator('.gw-item[data-game="mathcross"]').click();
    await page.waitForFunction(() => window.__cns.gameId === 'mathcross');
    const mc = await page.evaluate(() => ({
      css: !!document.getElementById('game-css') && document.getElementById('game-css').href.endsWith('/css/games/mathcross.css'),
      attr: document.documentElement.getAttribute('data-game'),
      stored: JSON.parse(localStorage.getItem('cns_game')),
    }));
    expect(mc).toEqual({ css: true, attr: 'mathcross', stored: 'mathcross' });
    await page.locator('.modal-divstyle .btn-primary').click({ timeout: 3000 }).catch(() => {});
    await expect(page.locator('.gw-item.on')).toHaveAttribute('data-game', 'mathcross');
    await expect(page.locator('.home-actions')).toBeVisible();
    // Zurück per Ziehen nach rechts (Number Sums liegt links). Ein Schritt —
    // der Ring hat keine Enden mehr, ein langer Zieher drehte weiter.
    await dragWheel(page, 80);
    await page.waitForFunction(() => window.__cns.gameId === 'numbersums');
    expect(await page.evaluate(() => [!!document.getElementById('game-css'), document.documentElement.getAttribute('data-game')])).toEqual([false, 'numbersums']);
    expect(loads).toBe(0);
  });

  test('ein kurzer Zieher rastet zurück, ohne zu wechseln', async ({ page }) => {
    await gotoApp(page);
    await dragWheel(page, -30);
    await page.waitForTimeout(700);
    expect(await gameOf(page)).toBe('numbersums');
  });

  test('nach dem Wechsel laeuft eine echte Partie des neuen Spiels', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => { const s = window.__cns.state.settings; s.divStyle = 'obelus'; });
    await page.locator('.gw-item[data-game="mathcross"]').click();
    await page.waitForFunction(() => window.__cns.gameId === 'mathcross');
    await startNewGame(page, 'sehrleicht');
    // Math-Cross-Brett samt Vorrat unter dem Brett.
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.locator('.tray, .tray-bar').first()).toBeVisible();
    expect(await page.evaluate(() => Array.isArray(window.__cns.state.puzzle.slots))).toBe(true);
  });

  test('die Spiele führen getrennte Statistiken (auch ohne Neuladen)', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => localStorage.setItem('cns_stats', JSON.stringify({ played: 7, won: 7, lost: 0, byDifficulty: {} })));
    await page.evaluate(() => window.__cns.switchGame('mathcross'));
    expect(await page.evaluate(() => window.__cns.state.stats.played || 0)).toBe(0);
    await page.evaluate(() => window.__cns.switchGame('numbersums'));
    expect(await page.evaluate(() => window.__cns.state.stats.played)).toBe(7);
  });

  test('während einer Partie bleibt das Spiel gesperrt', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    expect(await page.evaluate(() => window.__cns.switchGame('mathcross'))).toBe(false);
    expect(await gameOf(page)).toBe('numbersums');
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
    mix: window.__cns.state.mixOn,
  }));
  expect(r.game).toBe('mathcross');
  expect(r.mix).toBe(false);   // der Link öffnet das Spiel, nicht den Standard Mix
  expect(r.attr).toBe('mathcross');
  expect(r.url).toBe('');
});

// Nutzerwunsch: die Scheibe enger, mehrere Spiele je Seite sichtbar — und beim
// Wechsel soll sich das Menü nicht ab- und wieder aufbauen („ruckartig").
test('auf dem ersten Spiel sind auch die übernächsten Logos sichtbar', async ({ page }) => {
  await gotoApp(page);
  await page.waitForTimeout(500);
  const vis = await page.evaluate(() => [...document.querySelectorAll('.gw-item[data-game]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { game: el.dataset.game, opacity: Number(getComputedStyle(el).opacity), inView: r.right > 0 && r.left < innerWidth };
  }));
  // Endlos-Ring: von jedem Eintrag aus liegt JEDES Spiel in Sichtweite (links oder rechts).
  expect(vis.length).toBe(7);
  for (const v of vis) {
    expect(v.inView, v.game).toBe(true);
    expect(v.opacity, v.game).toBeGreaterThan(0.3);
  }
});

// Nutzerwunsch: Mix ist der Standard, steht in der Mitte, die Scheibe ist endlos.
test.describe('Mix als Standard', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('ohne gespeicherte Wahl steht die Scheibe auf Mix, die Spiele links und rechts', async ({ page }) => {
    await gotoApp(page);
    expect(await page.evaluate(() => window.__cns.state.mixOn)).toBe(true);
    await expect(page.locator('.gw-item.on')).toHaveAttribute('data-game', 'mix');
    await expect(page.locator('.home-mix')).toBeVisible();
    const xs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gw-item[data-game]')].map((el) => {
      const r = el.getBoundingClientRect(); return [el.dataset.game, r.left + r.width / 2];
    })));
    const others = Object.entries(xs).filter(([g]) => g !== 'mix');
    expect(others.some(([, x]) => x < xs.mix)).toBe(true);
    expect(others.some(([, x]) => x > xs.mix)).toBe(true);
  });

  test('die Scheibe dreht endlos: immer weiter nach rechts kommt man wieder an', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.game-wheel').focus();
    const n = await page.locator('.game-wheel .gw-item[data-game]').count();
    const seen = [];
    for (let i = 0; i <= n; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(550);
      seen.push(await page.evaluate(() => (window.__cns.state.mixOn ? 'mix' : window.__cns.gameId)));
    }
    // n Einträge: nach n Schritten wieder auf Mix, der nächste wie der erste.
    expect(seen[n - 1]).toBe('mix');
    expect(seen[n]).toBe(seen[0]);
    expect(new Set(seen).size).toBe(n);
  });
});

test('beim Spielwechsel bleibt das Menü stehen (kein Aus- und Einblenden)', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => {
    document.querySelector('.home-actions').dataset.keep = '1';
    window.__minOpacity = 1;
    const t0 = performance.now();
    const f = () => {
      const el = document.querySelector('.home-actions');
      window.__minOpacity = Math.min(window.__minOpacity, el ? Number(getComputedStyle(el).opacity) : 0);
      if (performance.now() - t0 < 1500) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  // Das letzte Spiel liegt im Ring direkt links neben Number Sums.
  await page.locator('.gw-item[data-game="pipes"]').click();
  await page.waitForFunction(() => window.__cns.gameId === 'pipes');
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => document.querySelector('.home-actions').dataset.keep)).toBe('1');
  expect(await page.evaluate(() => window.__minOpacity)).toBe(1);
});
