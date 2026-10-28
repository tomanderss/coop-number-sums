import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// „Pipes": Rohrstücke drehen, bis das Wasser von der Quelle jede Zelle erreicht
// und kein Rohr ins Leere zeigt. Drehen kostet nichts.

test.use({ hasTouch: true, isMobile: true });

async function gotoApp(page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('pipes')); } catch {}
  });
  await gotoHome(page);
}
async function startGame(page, difficulty = 'leicht') {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .pp-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
  await page.waitForTimeout(300);
}
async function centers(page) {
  const box = await page.locator('.pp-board').boundingBox();
  const { rows, cols } = await page.evaluate(() => window.__cns.state.puzzle);
  return (id) => ({ x: box.x + ((id % cols) + 0.5) * (box.width / cols), y: box.y + (Math.floor(id / cols) + 0.5) * (box.height / rows) });
}
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const rots = (page) => page.evaluate(() => window.__cns.state.pipeRot.slice());

test('Antippen dreht, langes Drücken sperrt; kein Rückgängig, keine Leiste, kein Fehler', async ({ page, context }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('pipes');
  await startGame(page, 'mittel');
  const at = await centers(page);
  const cdp = await context.newCDPSession(page);
  await touch(cdp, 'touchStart', [at(0)]); await touch(cdp, 'touchEnd', []);
  await touch(cdp, 'touchStart', [at(0)]); await touch(cdp, 'touchEnd', []);
  expect((await rots(page))[0]).toBe(2);
  // Die Drehung ist eine echte Rotation der Ebene (Animation über transform).
  await expect(page.locator('.pp-tile').first().locator('.pp-rot')).toHaveAttribute('style', /rotate\(180deg\)/);
  // Langes Drücken sperrt — danach dreht ein Tipp nicht mehr.
  await touch(cdp, 'touchStart', [at(1)]);
  await page.waitForTimeout(600);
  await touch(cdp, 'touchEnd', []);
  expect(await page.evaluate(() => window.__cns.state.pipeLock[1])).toBe(true);
  const r1 = (await rots(page))[1];
  await touch(cdp, 'touchStart', [at(1)]); await touch(cdp, 'touchEnd', []);
  expect((await rots(page))[1]).toBe(r1);
  await expect(page.locator('.pp-tile.locked')).toHaveCount(1);
  expect(await page.evaluate(() => [window.__cns.state.mistakes, window.__cns.state.lives])).toEqual([0, 3]);
  await expect(page.locator('.rt-undo, .round-btn, .tutor-card')).toHaveCount(0);
});

test('Wasser fließt von der Quelle, offene Enden lecken; lösen gewinnt', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'schwer');
  // Quelle ist immer nass.
  await expect(page.locator('.pp-tile.src.wet')).toHaveCount(1);
  // Alle Stücke richtig → alles nass, kein Leck, Sieg.
  await page.evaluate(() => window.__cns.solvePipes());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  const n = await page.evaluate(() => window.__cns.state.puzzle.tiles.length);
  await expect(page.locator('.pp-tile.wet')).toHaveCount(n);
  await expect(page.locator('.pp-arm.leak')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(0);
});

test('ein angefangenes Spiel lässt sich fortsetzen', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'leicht');
  await page.evaluate(() => { window.__cns.rotatePipe(0); window.__cns.rotatePipe(3); window.__cns.rotatePipe(3); window.__cns.lockPipe(5); });
  await page.waitForTimeout(700);
  const saved = await rots(page);
  await page.reload();
  await page.waitForSelector('.screen.home');
  await page.locator('.resume-stack .btn-resume').click();
  await page.waitForSelector('.screen.game .pp-board');
  expect(await rots(page)).toEqual(saved);
  expect(await page.evaluate(() => window.__cns.state.pipeLock[5])).toBe(true);
});

test('Training führt Schritt für Schritt bis zum Sieg', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.modal = 'howto'; });
  await page.locator('.training-btn').click();
  await page.waitForSelector('.training-banner');
  await expect(page.locator('.pp-focus .pp-train')).toHaveCount(1);
  for (let i = 0; i < 40 && await page.evaluate(() => window.__cns.state.status === 'playing'); i++) {
    await page.locator('.training-banner .btn-primary').click();
  }
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

test('Coop: Drehungen des Partners kommen an, je Stück gewinnt die spätere', async ({ page }) => {
  await gotoApp(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/pipes/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 77 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    const pipeRot = puzzle.tiles.map(() => 0); pipeRot[2] = 3;
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'pp1', running: true, puzzle, pipeRot, pipeBy: pipeRot.map((r) => (r ? 'host' : '')), startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .pp-board');
  expect((await rots(page))[2]).toBe(3);
  await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'move', op: 'rot', i: 4, r: 2, from: 'host' }, '-N0000000000000005'));
  expect((await rots(page))[4]).toBe(2);
  // Eine ÄLTERE Drehung desselben Stücks wird verworfen.
  await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'move', op: 'rot', i: 4, r: 1, from: 'host' }, '-A0000000000000001'));
  expect((await rots(page))[4]).toBe(2);
  // Sperren kommt auch an; das Stück trägt die Farbe des Partners.
  await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'move', op: 'lock', i: 4, v: true, from: 'host' }, '-N0000000000000009'));
  expect(await page.evaluate(() => window.__cns.state.pipeLock[4])).toBe(true);
  await expect(page.locator('.pp-tile').nth(4)).toHaveAttribute('style', /--pb/);
});

test('Endlos startet; keine Große-Zahlen-Missionen; Freunde sehen das Spiel', async ({ page }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.state.missions.list.some((m) => m.id === 'bigWin2'))).toBe(false);
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await expect(page.locator('.mode-toggle', { hasText: 'Große Zahlen' })).toHaveCount(0);
  await page.evaluate(() => { window.__cns.state.sel.endless = true; });
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .pp-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.endless.active);
  expect((await page.evaluate(() => window.__cns.currentGameInfo())).id).toBe('pipes');
  await page.evaluate(() => window.__cns.solvePipes());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await expect(page.locator('.endless-lives-row')).toBeVisible();
});
