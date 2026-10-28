import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// „Number Path" (Prinzip wie „Zip"): eine Linie über jede Zelle, Zahlen in
// Reihenfolge. Falsche Reihenfolge/Wand/belegte Zelle = gesperrt, kein Fehler.

test.use({ hasTouch: true, isMobile: true });

async function gotoApp(page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('numberpath')); } catch {}
  });
  await gotoHome(page);
}
async function startGame(page, difficulty = 'leicht') {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .np-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
  await page.waitForTimeout(300);
}
async function centers(page) {
  const box = await page.locator('.np-board').boundingBox();
  const { rows, cols } = await page.evaluate(() => window.__cns.state.puzzle);
  return (id) => ({ x: box.x + ((id % cols) + 0.5) * (box.width / cols), y: box.y + (Math.floor(id / cols) + 0.5) * (box.height / rows) });
}
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const pathOf = (page) => page.evaluate(() => window.__cns.state.path.slice());

test('Ziehen ab der 1 legt die Linie, Zurückziehen kürzt sie; kein Rückgängig, keine Leiste, kein Tipp', async ({ page, context }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('numberpath');
  await startGame(page, 'mittel');
  const cdp = await context.newCDPSession(page);
  const at = await centers(page);
  const sol = await page.evaluate(() => window.__cns.state.puzzle.solution);
  await touch(cdp, 'touchStart', [at(sol[0])]);
  for (let i = 1; i < 10; i++) await touch(cdp, 'touchMove', [at(sol[i])]);
  await touch(cdp, 'touchEnd', []);
  expect(await pathOf(page)).toEqual(sol.slice(0, 10));
  // Auf der Linie aufsetzen und zurückziehen kürzt sie.
  await touch(cdp, 'touchStart', [at(sol[9])]);
  await touch(cdp, 'touchMove', [at(sol[6])]);
  await touch(cdp, 'touchMove', [at(sol[4])]);
  await touch(cdp, 'touchEnd', []);
  expect(await pathOf(page)).toEqual(sol.slice(0, 5));
  await expect(page.locator('.rt-undo, .rect-tools, .round-btn, .tutor-card')).toHaveCount(0);
});

test('nicht auf der 1 beginnen, eine Zahl außer der Reihe, eine Wand: gesperrt, ohne Fehler', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'extrem');
  const r = await page.evaluate(() => {
    const s = window.__cns.state, p = s.puzzle;
    const out = {};
    // Start nicht auf der 1.
    out.wrongStart = window.__cns.drawCells([p.solution[1]]);
    // Bis kurz vor die 2, dann direkt auf die 3 versuchen (wenn benachbart) — sonst prüfen wir die 2.
    window.__cns.drawCells(p.solution.slice(0, 1));
    const three = p.clues.find((k) => k.n === 3);
    const id3 = three.r * p.cols + three.c;
    const before = s.path.length;
    window.__cns.drawCells([id3]);
    out.jumpedTo3 = s.path.length !== before;
    out.mistakes = s.mistakes;
    out.lives = s.lives;
    return out;
  });
  expect(r.wrongStart).toBe(0);
  expect(r.jumpedTo3).toBe(false);
  expect(r.mistakes).toBe(0);
  expect(r.lives).toBe(3);
});

test('die volle Linie gewinnt; ein angefangenes Spiel lässt sich fortsetzen', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'schwer');
  await page.evaluate(() => { const s = window.__cns.state; window.__cns.drawCells(s.puzzle.solution.slice(0, 12)); });
  await page.waitForTimeout(700);
  const saved = await pathOf(page);
  await page.reload();
  await page.waitForSelector('.screen.home');
  await page.locator('.resume-stack .btn-resume').click();
  await page.waitForSelector('.screen.game .np-board');
  expect(await pathOf(page)).toEqual(saved);
  await page.evaluate(() => window.__cns.solvePath());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(0);
});

test('Training führt Schritt für Schritt bis zum Sieg', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.modal = 'howto'; });
  await page.locator('.training-btn').click();
  await page.waitForSelector('.training-banner');
  await expect(page.locator('.np-focus .np-train')).toHaveCount(1);
  for (let i = 0; i < 60 && await page.evaluate(() => window.__cns.state.status === 'playing'); i++) {
    await page.locator('.training-banner .btn-primary').click();
  }
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

test('Coop: die Linie des Partners kommt an, die spätere gewinnt', async ({ page }) => {
  await gotoApp(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/numberpath/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 77 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'np1', running: true, puzzle, path: puzzle.solution.slice(0, 4), pathBy: ['host', 'host', 'host', 'host'], startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .np-board');
  expect(await pathOf(page)).toEqual(p.solution.slice(0, 4));
  await page.evaluate((sol) => window.__cns.handleCoopMsg({ type: 'move', op: 'path', path: sol.slice(0, 7), by: [], from: 'host' }, '-N0000000000000005'), p.solution);
  expect((await pathOf(page)).length).toBe(7);
  // Eine ÄLTERE Linie danach wird verworfen.
  await page.evaluate((sol) => window.__cns.handleCoopMsg({ type: 'move', op: 'path', path: sol.slice(0, 2), by: [], from: 'host' }, '-A0000000000000001'), p.solution);
  expect((await pathOf(page)).length).toBe(7);
  // Eine kaputte Linie wird nur bis zur ersten ungültigen Stelle übernommen.
  await page.evaluate((sol) => window.__cns.handleCoopMsg({ type: 'move', op: 'path', path: [sol[0], sol[1], sol[5]], by: [], from: 'host' }, '~~~zzz'), p.solution);
  expect((await pathOf(page)).length).toBe(2);
});

test('Endlos startet; Erfolge/Missionen ohne Große Zahlen; Freunde sehen das Spiel', async ({ page }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.state.missions.list.some((m) => m.id === 'bigWin2'))).toBe(false);
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await expect(page.locator('.mode-toggle', { hasText: 'Große Zahlen' })).toHaveCount(0);
  await page.evaluate(() => { window.__cns.state.sel.endless = true; });
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .np-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.endless.active);
  expect((await page.evaluate(() => window.__cns.currentGameInfo())).id).toBe('numberpath');
  await page.evaluate(() => window.__cns.solvePath());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await expect(page.locator('.endless-lives-row')).toBeVisible();
});
