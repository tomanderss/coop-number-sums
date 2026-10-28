import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// „Rectangles" (Shikaku): das Feld in Rechtecke zerlegen, jedes mit genau einer
// Zahl = seiner Fläche. Ziehen zeichnet, Antippen löscht, Überziehen ersetzt;
// ein Fehler zählt erst, wenn das Brett voll ist und nicht aufgeht.

test.use({ hasTouch: true, isMobile: true });

async function gotoApp(page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('rectangles')); } catch {}
  });
  await gotoHome(page);
}

async function startGame(page, difficulty = 'leicht') {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .rect-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
  await page.waitForTimeout(300);
}

// Mittelpunkt einer Zelle in Bildschirm-Koordinaten.
async function geometry(page) {
  const box = await page.locator('.rect-board').boundingBox();
  const { rows, cols } = await page.evaluate(() => window.__cns.state.puzzle);
  return (r, c) => ({ x: box.x + (c + 0.5) * (box.width / cols), y: box.y + (r + 0.5) * (box.height / rows) });
}
async function touchDrag(page, cdp, a, z, steps = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((z.x - a.x) * i) / steps, y: a.y + ((z.y - a.y) * i) / steps }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const rectsOf = (page) => page.evaluate(() => window.__cns.state.rects.map((q) => `${q.r},${q.c},${q.h},${q.w}`));

test('Ziehen zeichnet ein Rechteck, Antippen löscht es, Rückgängig holt es zurück', async ({ page, context }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('rectangles');
  await startGame(page);
  const cdp = await context.newCDPSession(page);
  const at = await geometry(page);
  const q = await page.evaluate(() => window.__cns.state.puzzle.solution.find((s) => s.h * s.w >= 2));
  // Rückwärts gezogen (vom unteren rechten Ende zur oberen linken Ecke) und mit
  // etwas Überschuss über die Zielzelle hinaus — beim Loslassen rastet es ein.
  const z = at(q.r + q.h - 1, q.c + q.w - 1), a = at(q.r, q.c);
  await touchDrag(page, cdp, { x: z.x + 6, y: z.y + 5 }, { x: a.x - 4, y: a.y - 3 });
  expect(await rectsOf(page)).toEqual([`${q.r},${q.c},${q.h},${q.w}`]);
  await expect(page.locator('.rb-rects .rrect')).toHaveCount(1);

  await page.touchscreen.tap(a.x, a.y);
  await expect(page.locator('.rb-rects .rrect')).toHaveCount(0);
  await page.locator('.undo-btn').click();
  expect(await rectsOf(page)).toEqual([`${q.r},${q.c},${q.h},${q.w}`]);
});

test('ein neues Rechteck über bestehende ersetzt sie', async ({ page }) => {
  await gotoApp(page);
  await startGame(page);
  await page.evaluate(() => { window.__cns.drawRect(0, 0, 0, 1); window.__cns.drawRect(1, 0, 1, 1); });
  expect((await rectsOf(page)).length).toBe(2);
  await page.evaluate(() => window.__cns.drawRect(0, 0, 1, 0));
  expect(await rectsOf(page)).toEqual(['0,0,2,1']);
});

test('ein falsch volles Brett kostet ein Leben, ein richtiges gewinnt', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'sehrleicht');
  // Jede Zeile als ein Rechteck: bedeckt alles, geht aber nicht auf.
  const lives = await page.evaluate(() => window.__cns.state.lives);
  await page.evaluate(() => {
    const p = window.__cns.state.puzzle;
    for (let r = 0; r < p.rows; r++) window.__cns.drawRect(r, 0, r, p.cols - 1);
  });
  expect(await page.evaluate(() => window.__cns.state.lives)).toBe(lives - 1);
  await expect(page.locator('.rect-status.bad')).toBeVisible();
  await expect(page.locator('.rect-board.full-wrong')).toBeVisible();
  // Löschen nimmt den Hinweis zurück; die Lösung gewinnt.
  await page.evaluate(() => window.__cns.solveRects());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  expect(await page.evaluate(() => window.__cns.state.lives)).toBe(lives - 1);
});

test('ein angefangenes Spiel lässt sich nach dem Neuladen fortsetzen', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'mittel');
  const q = await page.evaluate(() => window.__cns.state.puzzle.solution[0]);
  await page.evaluate((q) => window.__cns.drawRect(q.r, q.c, q.r + q.h - 1, q.c + q.w - 1), q);
  await page.waitForTimeout(700);   // gebündelter Autosave
  await page.reload();
  await page.waitForSelector('.screen.home');
  await page.locator('.resume-stack .btn-resume').click();
  await page.waitForSelector('.screen.game .rect-board');
  expect(await rectsOf(page)).toEqual([`${q.r},${q.c},${q.h},${q.w}`]);
});
