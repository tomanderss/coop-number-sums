import { test, expect } from '@playwright/test';
import { gotoApp, dismissStreakModal } from './helpers.js';

// Zufallsmodus „Mix" (js/mix.js): ein Eintrag mehr auf der Scheibe, ein Lauf
// über alle Spiele — jedes Level ein zufälliges Spiel in einer zufälligen Stufe.

async function boot(page, { game = 'numbersums', mix = false } = {}) {
  await page.addInitScript(({ g, m }) => {
    try {
      if (!sessionStorage.getItem('booted')) {
        localStorage.setItem('cns_game', JSON.stringify(g));
        if (m) localStorage.setItem('cns_mix_on', 'true');
        sessionStorage.setItem('booted', '1');
      }
    } catch {}
  }, { g: game, m: mix });
  await gotoApp(page);
}
const levelReady = (page) => page.waitForFunction(() => {
  const s = window.__cns.state;
  return s.screen === 'game' && s.puzzle && !s.generating && !s.mixReveal && s.status === 'playing';
}, null, { timeout: 20000 });
// Nach Siegen können Feier-Pop-ups (Tages-Serie, Prestige-Stufe) über dem Ergebnis liegen.
async function dismissCelebrations(page) {
  await dismissStreakModal(page);
  try { await page.locator('.prestige-unlock-modal .btn-primary').click({ timeout: 1500 }); } catch {}
}
async function solveLevel(page) {
  await page.evaluate(() => {
    const c = window.__cns;
    if (c.gameId === 'rectangles') c.solveRects();
    else if (c.gameId === 'numberpath') c.solvePath();
    else throw new Error('kein Löse-Haken für ' + c.gameId);
  });
  await page.waitForFunction(() => window.__cns.state.status === 'won');
}

test('Scheibe: Mix ist ein eigener Eintrag — das Menü blendet um, nichts verschiebt sich', async ({ page }) => {
  await boot(page, { game: 'numberpath' });
  // Menü-Zelle und Fußzeile dürfen sich beim Umblenden nicht bewegen.
  const layout = async () => { const m = await page.locator('.home-menu').boundingBox(); const f = await page.locator('.home-foot').boundingBox(); return [m.y, m.height, f.y]; };
  const before = await layout();
  // Mix steht rechts neben dem letzten Spiel.
  await page.locator('.gw-item[data-game="mix"]').click();
  await page.waitForFunction(() => window.__cns.state.mixOn === true);
  await expect(page.locator('.home-mix')).toBeVisible();
  await expect(page.locator('.home-actions')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.mix-pool-card .mpc-logos img')).toHaveCount(4);
  const after = await layout();
  for (let i = 0; i < 3; i++) expect(Math.abs(after[i] - before[i])).toBeLessThanOrEqual(1);
  // Die Wahl ist gerätelokal gemerkt.
  await page.reload();
  await page.waitForSelector('.screen.home');
  expect(await page.evaluate(() => window.__cns.state.mixOn)).toBe(true);
  await expect(page.locator('.gw-item[data-game="mix"]')).toHaveClass(/\bon\b/);
  // Zurück auf ein Spiel.
  await page.locator('.gw-item[data-game="numberpath"]').click();
  await page.waitForFunction(() => window.__cns.state.mixOn === false);
  await expect(page.locator('.home-actions')).toHaveCSS('visibility', 'visible');
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('numberpath');
});

test('Auswahl eingrenzen, Lauf spielen, fortsetzen und beenden', async ({ page }) => {
  await boot(page, { mix: true });
  await page.locator('.mix-play-btn').click();
  await page.waitForSelector('.screen.mix-screen');
  // Standard: alles drin.
  await expect(page.locator('.mix-tiles b').first()).toHaveText('36');
  // Nur Rectangles, nur die leichten Stufen.
  for (const name of ['Number Sums', 'Math Cross', 'Number Path']) await page.locator('.mix-game', { hasText: name }).click();
  await expect(page.locator('.mix-row.off')).toHaveCount(3);
  await expect(page.locator('.mix-tiles b').first()).toHaveText('9');
  await page.locator('.mix-chip', { hasText: 'Leicht' }).click();
  await expect(page.locator('.mix-tiles b').first()).toHaveText('3');
  await expect(page.locator('.mix-chip.on')).toHaveText('Leicht');
  // Eine einzelne Stufe abwählen.
  await page.locator('.mix-row:not(.off) .mix-dot.on').first().click();
  await expect(page.locator('.mix-tiles b').first()).toHaveText('2');

  await page.locator('.mix-start').click();
  await expect(page.locator('.mix-reveal')).toBeVisible();
  await levelReady(page);
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('rectangles');
  expect(['leicht', 'mittel']).toContain(await page.evaluate(() => window.__cns.state.puzzle.difficulty));
  await expect(page.locator('.hud-item.endless-lvl.mix')).toBeVisible();

  // Level 1 lösen: normaler Gewinn-Screen mit dem Logo des Spiels, Sieg zählt im Spiel.
  await solveLevel(page);
  await expect(page.locator('.result-card.win .rc-gamelogo')).toBeVisible();
  await page.waitForFunction(() => (window.__cns.state.stats.won || 0) === 1);
  await dismissCelebrations(page);
  await page.locator('.result-card .btn-primary').click();
  await levelReady(page);
  expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(2);
  const seed = await page.evaluate(() => window.__cns.state.puzzle.seed);

  // Zum Menü → „Mix fortsetzen" bringt dasselbe Brett zurück.
  await page.locator('.game-top .icon-btn').first().click();
  await page.locator('.pause-overlay').getByText('Zum Menü').click();
  await page.waitForSelector('.screen.home');
  await expect(page.locator('.resume-stack .btn-resume.mix')).toBeVisible();
  await page.locator('.resume-stack .btn-resume.mix').click();
  await levelReady(page);
  expect(await page.evaluate(() => [window.__cns.state.endless.level, window.__cns.state.puzzle.seed, !!window.__cns.state.endless.mix])).toEqual([2, seed, true]);

  // Letztes Leben verspielen → Mix-Ergebnis mit „geschafft je Spiel", eigener Bestwert.
  await page.evaluate(() => { const c = window.__cns; c.state.lives = 1; const p = c.state.puzzle; c.drawRect(0, 0, p.rows - 1, p.cols - 1); });
  await expect(page.locator('.endless-reached')).toBeVisible();
  await expect(page.locator('.mix-played-chip')).toHaveCount(1);
  await expect(page.locator('.mix-played-chip b')).toHaveText('1');
  expect(await page.evaluate(() => window.__cns.state.mixStats)).toMatchObject({ best: 1, runs: 1 });
  // Der Endlos-Bestwert des Spiels bleibt unberührt, der Lauf liegt nicht im Endlos-Slot.
  expect(await page.evaluate(() => window.__cns.state.stats.endlessBest || 0)).toBe(0);
  expect(await page.evaluate(() => !!window.__cns.state.resumeAvailableEndless)).toBe(false);
  // „Neues Spiel" startet einen frischen Mix-Lauf.
  await page.locator('.result-card .btn-primary').click();
  await levelReady(page);
  expect(await page.evaluate(() => [window.__cns.state.endless.level, !!window.__cns.state.endless.mix])).toEqual([1, true]);
});

test('mit zwei Spielen wechselt jedes Level das Spiel', async ({ page }) => {
  await boot(page, { mix: true });
  await page.evaluate(() => window.__cns.setSetting('mixPool', { off: { numbersums: true, mathcross: true } }));
  await page.locator('.mix-play-btn').click();
  await page.locator('.mix-chip', { hasText: 'Leicht' }).click();
  await page.locator('.mix-start').click();
  const games = [];
  for (let i = 0; i < 3; i++) {
    await levelReady(page);
    games.push(await page.evaluate(() => window.__cns.gameId));
    await solveLevel(page);
    await dismissCelebrations(page);
    await page.locator('.result-card .btn-primary').click();
  }
  expect(new Set(games)).toEqual(new Set(['rectangles', 'numberpath']));
  for (let i = 1; i < games.length; i++) expect(games[i]).not.toBe(games[i - 1]);
});
