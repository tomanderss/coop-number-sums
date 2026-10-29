import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// Live-Entwürfe (features.liveDrafts): im Coop zeichnen ALLE gleichzeitig — es
// gibt keine Bearbeiten-Sperre mehr (Nutzerwunsch) —, aber jeder sieht live, was
// die anderen gerade ziehen. Ohne Firebase wird der Entwurf eines Mitspielers
// über den Test-Haken setLiveState eingespielt (wie Coop.onLive).

async function boot(page) {
  await page.addInitScript(() => { try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('rectangles')); } catch {} });
  await gotoHome(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/rectangles/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 11 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me'; s.coop.connected = true;
    s.coop.players = [{ id: 'host', name: 'Hanna', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'el1', running: true, puzzle, rects: [], startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .rect-board');
  return p;
}
const rectCount = (page) => page.evaluate(() => window.__cns.state.rects.length);

test('beide zeichnen gleichzeitig, der Entwurf des anderen ist live sichtbar', async ({ page }) => {
  await boot(page);
  // Keine Sperre: kein Sperr-Chip, das normale Coop-Kennzeichen steht da.
  await expect(page.locator('.edit-chip')).toHaveCount(0);
  await expect(page.locator('.chip.coop-chip')).toBeVisible();
  // Hanna zieht gerade ein Rechteck …
  await page.evaluate(() => window.__cns.setLiveState({ host: { box: { r: 1, c: 1, h: 2, w: 3 }, cur: 7, c: '#e5679a' } }));
  await expect(page.locator('.live-box')).toBeVisible();
  await expect(page.locator('.live-cursor')).toBeVisible();
  await expect(page.locator('.board-wrap.edit-locked')).toHaveCount(0);
  // … und ich darf trotzdem zeichnen.
  await page.evaluate(() => window.__cns.drawRect(0, 0, 0, 1));
  expect(await rectCount(page)).toBe(1);
  await expect(page.locator('.live-box')).toBeVisible();
  // Hanna ist fertig: ihr Entwurf verschwindet.
  await page.evaluate(() => window.__cns.setLiveState({}));
  await expect(page.locator('.live-box')).toHaveCount(0);
});

test('Pipes: drehen, während der andere live ein Stück anfasst', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('cns_game', JSON.stringify('pipes')); } catch {} });
  await gotoHome(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/pipes/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 5 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me'; s.coop.connected = true;
    s.coop.players = [{ id: 'host', name: 'Hanna', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'pl1', running: true, puzzle, startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .pp-board');
  await page.evaluate(() => window.__cns.setLiveState({ host: { cur: 0, c: '#e5679a' } }));
  await expect(page.locator('.live-cursor')).toBeVisible();
  const before = await page.evaluate(() => window.__cns.state.pipeRot[1] || 0);
  await page.locator('.pp-board').click({ position: await page.evaluate(() => {
    const b = document.querySelector('.pp-board').getBoundingClientRect();
    const cols = window.__cns.state.puzzle.cols;
    return { x: (1.5 / cols) * b.width, y: (0.5 / window.__cns.state.puzzle.rows) * b.height };
  }) });
  await expect.poll(() => page.evaluate(() => window.__cns.state.pipeRot[1] || 0)).toBe(before + 1);
});
