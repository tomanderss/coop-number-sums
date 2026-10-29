import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// „Gem Hunt" (Queens/Star-Battle-Prinzip): je Zeile, Spalte und Käfig genau ein
// Edelstein, Steine berühren sich nie. Fehler erst bei vollem Brett.

test.use({ hasTouch: true, isMobile: true });

async function gotoApp(page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('gems')); } catch {}
  });
  await gotoHome(page);
}
async function startGame(page, difficulty = 'leicht') {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .gm-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
  await page.waitForTimeout(300);
}
async function centers(page) {
  const box = await page.locator('.gm-board').boundingBox();
  const n = await page.evaluate(() => window.__cns.state.puzzle.rows);
  return (id) => ({ x: box.x + ((id % n) + 0.5) * (box.width / n), y: box.y + (Math.floor(id / n) + 0.5) * (box.height / n) });
}
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const cells = (page) => page.evaluate(() => window.__cns.state.gemCells.slice());

test('Werkzeug Stein/Kreuz: Tippen setzt das gewählte, Wischen nur mit Kreuz', async ({ page, context }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('gems');
  await startGame(page, 'mittel');
  const at = await centers(page);
  const cdp = await context.newCDPSession(page);
  const tap = async (i) => { await touch(cdp, 'touchStart', [at(i)]); await touch(cdp, 'touchEnd', []); };
  // Werkzeug unter dem Brett, „Stein" ist vorgewählt.
  await expect(page.locator('.gm-tools')).toBeVisible();
  await expect(page.locator('.gm-tool.gem.on')).toBeVisible();
  await tap(0);
  expect((await cells(page))[0]).toBe(2);
  await expect(page.locator('.gm-mark.gem')).toHaveCount(1);
  await tap(0);
  expect((await cells(page))[0]).toBe(0);
  // Mit „Stein" setzt Wischen nichts.
  await touch(cdp, 'touchStart', [at(0)]);
  for (let c = 1; c < 5; c++) await touch(cdp, 'touchMove', [at(c)]);
  await touch(cdp, 'touchEnd', []);
  expect((await cells(page)).slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
  // Umschalten auf „Kreuz".
  await page.locator('.gm-tool.cross').click();
  await expect(page.locator('.gm-tool.cross.on')).toBeVisible();
  expect(await page.evaluate(() => window.__cns.state.gemTool)).toBe('cross');
  await tap(0);
  expect((await cells(page))[0]).toBe(1);
  await tap(0);
  expect((await cells(page))[0]).toBe(0);
  // Wischen über die erste Zeile: Kreuze überall.
  await touch(cdp, 'touchStart', [at(0)]);
  for (let c = 1; c < 5; c++) await touch(cdp, 'touchMove', [at(c)]);
  await touch(cdp, 'touchEnd', []);
  expect((await cells(page)).slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
  await expect(page.locator('.gm-mark.cross')).toHaveCount(5);
  // Beginnt das Wischen auf einem Kreuz, radiert es.
  await touch(cdp, 'touchStart', [at(1)]);
  for (let c = 2; c < 4; c++) await touch(cdp, 'touchMove', [at(c)]);
  await touch(cdp, 'touchEnd', []);
  expect((await cells(page)).slice(0, 5)).toEqual([1, 0, 0, 0, 1]);
  // Ein Stein wird mit „Kreuz" zum Kreuz.
  await page.evaluate(() => window.__cns.setGem(2, 2));
  await tap(2);
  expect((await cells(page))[2]).toBe(1);
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(0);
  await expect(page.locator('.rt-undo, .round-btn, .tutor-card')).toHaveCount(0);
});

test('Konflikte leuchten rot; erst ein volles falsches Brett kostet ein Leben', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'leicht');
  const n = await page.evaluate(() => window.__cns.state.puzzle.rows);
  // Zwei Steine nebeneinander = Konflikt, aber kein Fehler.
  await page.evaluate(() => { window.__cns.setGem(0, 2); window.__cns.setGem(1, 2); });
  await expect(page.locator('.gm-mark.gem.bad')).toHaveCount(2);
  expect(await page.evaluate(() => window.__cns.state.lives)).toBe(3);
  // Volles Brett: n Steine, sicher falsch (zwei berühren sich).
  await page.evaluate((n) => { for (let r = 2; r < n; r++) window.__cns.setGem(r * n + ((r * 2) % n), 2); }, n);
  await page.waitForFunction(() => window.__cns.state.lives === 2);
  await expect(page.locator('.gm-board.full-wrong')).toBeVisible();
  // Einen Stein wegnehmen löscht die rote Kontur.
  await page.evaluate(() => window.__cns.setGem(0, 0));
  await expect(page.locator('.gm-board.full-wrong')).toHaveCount(0);
});

test('Lösen gewinnt; ein angefangenes Spiel lässt sich fortsetzen', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'schwer');
  await page.evaluate(() => { const s = window.__cns.state; window.__cns.setGem(s.puzzle.solution[0], 2); const x = [...Array(s.puzzle.rows ** 2).keys()].find((i) => !s.puzzle.solution.includes(i)); window.__cns.setGem(x, 1); });
  await page.waitForTimeout(700);
  const saved = await cells(page);
  await page.reload();
  await page.waitForSelector('.screen.home');
  await page.locator('.resume-stack .btn-resume').click();
  await page.waitForSelector('.screen.game .gm-board');
  expect(await cells(page)).toEqual(saved);
  await page.evaluate(() => window.__cns.solveGems());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(0);
});

test('Training führt Schritt für Schritt bis zum Sieg', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.modal = 'howto'; });
  await page.locator('.training-btn').click();
  await page.waitForSelector('.training-banner');
  await expect(page.locator('.gm-focus .gm-train')).toHaveCount(1);
  for (let i = 0; i < 30 && await page.evaluate(() => window.__cns.state.status === 'playing'); i++) {
    await page.locator('.training-banner .btn-primary').click();
  }
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

test('Coop: Züge des Partners kommen an, je Feld gewinnt der spätere', async ({ page }) => {
  await gotoApp(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/gems/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 77 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    const gemCells = new Array(puzzle.rows * puzzle.rows).fill(0); gemCells[puzzle.solution[0]] = 2;
    const gemBy = gemCells.map((v) => (v === 2 ? 'host' : ''));
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'gm1', running: true, puzzle, gemCells, gemBy, startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .gm-board');
  expect((await cells(page))[p.solution[0]]).toBe(2);
  // Ring in der Farbe des Partners.
  await expect(page.locator('.gm-mark.gem').first()).toHaveAttribute('style', /--gb/);
  const i = p.solution[1];
  await page.evaluate((i) => window.__cns.handleCoopMsg({ type: 'move', op: 'cells', list: [[i, 2]], from: 'host' }, '-N0000000000000005'), i);
  expect((await cells(page))[i]).toBe(2);
  // Ein ÄLTERER Zug auf dasselbe Feld wird verworfen.
  await page.evaluate((i) => window.__cns.handleCoopMsg({ type: 'move', op: 'cells', list: [[i, 1]], from: 'host' }, '-A0000000000000001'), i);
  expect((await cells(page))[i]).toBe(2);
  // RTDB-Form: Liste als Objekt.
  await page.evaluate((i) => window.__cns.handleCoopMsg({ type: 'move', op: 'cells', list: { 0: { 0: i, 1: 0 } }, from: 'host' }, '-Z0000000000000009'), i);
  expect((await cells(page))[i]).toBe(0);
});

test('Endlos startet; keine Große-Zahlen-Missionen; Freunde sehen das Spiel', async ({ page }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.state.missions.list.some((m) => m.id === 'bigWin2'))).toBe(false);
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await expect(page.locator('.mode-toggle', { hasText: 'Große Zahlen' })).toHaveCount(0);
  await page.evaluate(() => { window.__cns.state.sel.endless = true; });
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .gm-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.endless.active);
  expect((await page.evaluate(() => window.__cns.currentGameInfo())).id).toBe('gems');
  await page.evaluate(() => window.__cns.solveGems());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await expect(page.locator('.endless-lives-row')).toBeVisible();
});
