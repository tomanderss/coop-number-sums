import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// „Number Link" (Prinzip wie „Flow"): gleiche Zahlen verbinden, Linien kreuzen
// sich nie, jede Zelle wird bedeckt. Fremde Zahlen sperren, kein Fehler.

test.use({ hasTouch: true, isMobile: true });

async function gotoApp(page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('numberlink')); } catch {}
  });
  await gotoHome(page);
}
async function startGame(page, difficulty = 'leicht') {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .nl-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
  await page.waitForTimeout(300);
}
async function centers(page) {
  const box = await page.locator('.nl-board').boundingBox();
  const { rows, cols } = await page.evaluate(() => window.__cns.state.puzzle);
  return (id) => ({ x: box.x + ((id % cols) + 0.5) * (box.width / cols), y: box.y + (Math.floor(id / cols) + 0.5) * (box.height / rows) });
}
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const linksOf = (page) => page.evaluate(() => window.__cns.state.links.map((x) => x.slice()));
const solution = (page) => page.evaluate(() => window.__cns.solutionPaths());

test('Ziehen von einer Zahl verbindet das Paar; Zurückziehen kürzt; kein Rückgängig, keine Leiste, kein Tipp', async ({ page, context }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.gameId)).toBe('numberlink');
  await startGame(page, 'mittel');
  const cdp = await context.newCDPSession(page);
  const at = await centers(page);
  const sol = await solution(page);
  const path = sol[0];
  await touch(cdp, 'touchStart', [at(path[0])]);
  for (let i = 1; i < path.length; i++) await touch(cdp, 'touchMove', [at(path[i])]);
  await touch(cdp, 'touchEnd', []);
  expect((await linksOf(page))[0]).toEqual(path);
  await expect(page.locator('.nl-end.on[data-k="1"]')).toHaveCount(2);
  // Auf der Linie aufsetzen und zurückziehen kürzt sie (das Paar ist dann offen).
  await touch(cdp, 'touchStart', [at(path[path.length - 2])]);
  await touch(cdp, 'touchMove', [at(path[1])]);
  await touch(cdp, 'touchEnd', []);
  expect((await linksOf(page))[0]).toEqual(path.slice(0, 2));
  await expect(page.locator('.nl-end.on[data-k="1"]')).toHaveCount(0);
  await expect(page.locator('.rt-undo, .rect-tools, .round-btn, .tutor-card, .tool-toggle')).toHaveCount(0);
});

test('über eine fremde Linie ziehen schneidet sie, Zurückziehen stellt sie wieder her; fremde Zahl sperrt', async ({ page, context }) => {
  await gotoApp(page);
  // Festes 3×3-Brett: 1 oben (0-1-2), 2 Mitte (3-4-5), 3 unten (6-7-8).
  await page.evaluate(() => {
    const s = window.__cns.state;
    s.sel.difficulty = 'sehrleicht';
  });
  await startGame(page, 'sehrleicht');
  const p = { rows: 3, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 0, c: 2, k: 1 }, { r: 1, c: 0, k: 2 }, { r: 1, c: 2, k: 2 }, { r: 2, c: 0, k: 3 }, { r: 2, c: 2, k: 3 }], solution: [1, 1, 1, 2, 2, 2, 3, 3, 3], colors: [0, 1, 2], seed: 1, difficulty: 'sehrleicht', game: 'numberlink' };
  await page.evaluate((puzzle) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'nlx', running: true, puzzle, startTime: Date.now(), lives: 3, maxLives: 3, mistakes: 0 }), p);
  await page.evaluate(() => { const s = window.__cns.state; s.coop.active = false; });
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.puzzle.rows === 3);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__cns.setLink(2, [3, 4, 5]));
  expect((await linksOf(page))[1]).toEqual([3, 4, 5]);
  const cdp = await context.newCDPSession(page);
  const at = await centers(page);
  // Paar 1 von (0,0) nach unten in die Mitte: schneidet Linie 2 bei Zelle 4.
  await touch(cdp, 'touchStart', [at(0)]);
  await touch(cdp, 'touchMove', [at(1)]);
  await touch(cdp, 'touchMove', [at(4)]);
  await expect.poll(() => linksOf(page)).toEqual([[0, 1, 4], [3], []]);
  // Zurückziehen: Linie 2 ist wieder da.
  await touch(cdp, 'touchMove', [at(1)]);
  await expect.poll(() => linksOf(page)).toEqual([[0, 1], [3, 4, 5], []]);
  // Fremde Zahl (die 2 rechts) sperrt: von 1 nach 2 geht nicht, die Linie bleibt.
  await touch(cdp, 'touchMove', [at(2)]);
  await touch(cdp, 'touchMove', [at(5)]);
  await touch(cdp, 'touchEnd', []);
  await expect.poll(() => linksOf(page)).toEqual([[0, 1, 2], [3, 4, 5], []]);
  expect(await page.evaluate(() => [window.__cns.state.mistakes, window.__cns.state.lives])).toEqual([0, 3]);
  // Alle verbunden, aber Zellen frei → freie Zellen leuchten; dann fertig.
  await page.evaluate(() => window.__cns.setLink(3, [6, 7, 8]));
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

test('verbunden, aber nicht alles bedeckt: freie Zellen leuchten auf, kein Sieg', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'sehrleicht');
  const p = { rows: 2, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 1, c: 0, k: 1 }], solution: [1, 1, 1, 1, 1, 1], colors: [0], seed: 1, difficulty: 'sehrleicht', game: 'numberlink' };
  await page.evaluate((puzzle) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'nly', running: true, puzzle, startTime: Date.now(), lives: 3, maxLives: 3, mistakes: 0 }), p);
  await page.evaluate(() => { window.__cns.state.coop.active = false; });
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.puzzle.cols === 3 && window.__cns.state.puzzle.rows === 2);
  await page.evaluate(() => window.__cns.setLink(1, [0, 3]));
  await expect(page.locator('.nl-gap')).toHaveCount(4);
  expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  await page.evaluate(() => window.__cns.setLink(1, [0, 1, 2, 5, 4, 3]));
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

test('ein angefangenes Spiel lässt sich fortsetzen; die volle Lösung gewinnt ohne Fehler', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'schwer');
  const sol = await solution(page);
  await page.evaluate((s) => { window.__cns.setLink(1, s[0]); window.__cns.setLink(2, s[1]); }, sol);
  await page.waitForTimeout(700);
  const saved = await linksOf(page);
  await page.reload();
  await page.waitForSelector('.screen.home');
  await page.locator('.resume-stack .btn-resume').click();
  await page.waitForSelector('.screen.game .nl-board');
  expect(await linksOf(page)).toEqual(saved);
  await page.evaluate(() => window.__cns.solveLinks());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(0);
});

test('Training führt Linie für Linie bis zum Sieg', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.modal = 'howto'; });
  await page.locator('.training-btn').click();
  await page.waitForSelector('.training-banner');
  await expect(page.locator('.nl-focus .nl-train')).toHaveCount(1);
  for (let i = 0; i < 40 && await page.evaluate(() => window.__cns.state.status === 'playing'); i++) {
    await page.locator('.training-banner .btn-primary').click();
  }
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

test('Coop: Linien des Partners kommen an, die spätere gewinnt, Überdeckung kappt die eigene', async ({ page }) => {
  await gotoApp(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/numberlink/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 77 });
  });
  const sol = await page.evaluate(async (puzzle) => {
    const { solveLogic, pathsFromState } = await import('/js/games/numberlink/solver.js');
    return pathsFromState(puzzle, solveLogic(puzzle, { maxTier: 1 }));
  }, p);
  await page.evaluate(({ puzzle, sol }) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    const links = sol.map((x, i) => (i === 0 ? x : ''));
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'nl1', running: true, puzzle, links, linkBy: ['host'], startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, { puzzle: p, sol });
  await page.waitForSelector('.screen.game .nl-board');
  expect((await linksOf(page))[0]).toEqual(sol[0]);
  await page.evaluate((sol) => window.__cns.handleCoopMsg({ type: 'move', op: 'links', set: { 2: sol[1] }, by: 'host', from: 'host' }, '-N0000000000000005'), sol);
  expect((await linksOf(page))[1]).toEqual(sol[1]);
  // Eine ÄLTERE Fassung derselben Linie wird verworfen.
  await page.evaluate((sol) => window.__cns.handleCoopMsg({ type: 'move', op: 'links', set: { 2: '' }, by: 'host', from: 'host' }, '-A0000000000000001'), sol);
  expect((await linksOf(page))[1]).toEqual(sol[1]);
  // Eine kaputte Linie endet an der ersten ungültigen Stelle.
  await page.evaluate((sol) => window.__cns.handleCoopMsg({ type: 'move', op: 'links', set: { 3: [sol[2][0], sol[2][1], 999] }, by: 'host', from: 'host' }, '~~~zzz'), sol);
  expect((await linksOf(page))[2]).toEqual(sol[2].slice(0, 2));
});

test('Coop: eine empfangene Linie über eine eigene kappt die eigene dort', async ({ page }) => {
  await gotoApp(page);
  const p = { rows: 3, cols: 3, ends: [{ r: 0, c: 0, k: 1 }, { r: 0, c: 2, k: 1 }, { r: 1, c: 0, k: 2 }, { r: 1, c: 2, k: 2 }, { r: 2, c: 0, k: 3 }, { r: 2, c: 2, k: 3 }], solution: [1, 1, 1, 2, 2, 2, 3, 3, 3], colors: [0, 1, 2], seed: 1, difficulty: 'sehrleicht', game: 'numberlink' };
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'nl2', running: true, puzzle, links: ['', [3, 4, 5], [6, 7]], linkBy: ['', 'me', 'me'], startTime: Date.now(), lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .nl-board');
  await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'move', op: 'links', set: { 1: [0, 1, 4, 7] }, by: 'host', from: 'host' }, '-N1'));
  // Linie 1 endet vor der fremden Zelle 7? Nein: 7 ist keine Zahl — erlaubt; Linie 2 wird bei 4 gekappt, Linie 3 bei 7.
  const links = await linksOf(page);
  expect(links[0]).toEqual([0, 1, 4, 7]);
  expect(links[1]).toEqual([]);           // [3] allein ist keine Linie
  expect(links[2]).toEqual([]);           // [6] allein ebenso
});

test('Endlos startet; Erfolge/Missionen ohne Große Zahlen; Freunde sehen das Spiel', async ({ page }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => window.__cns.state.missions.list.some((m) => m.id === 'bigWin2'))).toBe(false);
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await expect(page.locator('.mode-toggle', { hasText: 'Große Zahlen' })).toHaveCount(0);
  await page.evaluate(() => { window.__cns.state.sel.endless = true; });
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .nl-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.endless.active);
  expect((await page.evaluate(() => window.__cns.currentGameInfo())).id).toBe('numberlink');
  await page.evaluate(() => window.__cns.solveLinks());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await expect(page.locator('.endless-lives-row')).toBeVisible();
});
