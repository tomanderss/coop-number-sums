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

test('Ziehen zeichnet ein Rechteck, Antippen löscht es; kein Rückgängig, keine Leiste, kein Tipp', async ({ page, context }) => {
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
  // Nutzerwunsch: kein Rückgängig-Knopf, keine Erklärleiste unter dem Brett, kein Tipp.
  await expect(page.locator('.rect-tools, .rt-undo, .rt-hint, .rect-status')).toHaveCount(0);
  await expect(page.locator('.screen.game .round-btn')).toHaveCount(0);
});

test('ein neues Rechteck über bestehende ersetzt sie', async ({ page }) => {
  await gotoApp(page);
  await startGame(page);
  await page.evaluate(() => { window.__cns.drawRect(0, 0, 0, 1); window.__cns.drawRect(1, 0, 1, 1); });
  expect((await rectsOf(page)).length).toBe(2);
  await page.evaluate(() => window.__cns.drawRect(0, 0, 1, 0));
  expect(await rectsOf(page)).toEqual(['0,0,2,1']);
});

test('Barriere: ein bestehendes Rechteck hält zuerst auf, mit Nachdruck wird es ersetzt', async ({ page, context }) => {
  await gotoApp(page);
  await startGame(page);
  const cdp = await context.newCDPSession(page);
  const at = await geometry(page);
  const { cols } = await page.evaluate(() => window.__cns.state.puzzle);
  expect(cols).toBeGreaterThanOrEqual(5);
  await page.evaluate(() => window.__cns.drawRect(0, 2, 1, 2)); // senkrechtes Rechteck in Spalte 2
  const box = await page.locator('.rect-board').boundingBox();
  const cw = box.width / cols;

  // 1) Fast eine ganze Zelle über die Kante (0,9 Zelle — erst die GANZE bricht durch):
  //    die Vorschau stockt, das Rechteck leuchtet auf; Loslassen legt nur bis zur Kante.
  const a = at(0, 0), edge = at(0, 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((edge.x + cw * 0.4 - a.x) * i) / 8, y: a.y }] });
  }
  await expect(page.locator('.rb-rects .rrect.blocking')).toHaveCount(1);
  await expect(page.locator('.rb-preview.held')).toHaveCount(1);
  // Die Vorschau gibt nur gummiartig nach: ihr rechter Rand bleibt nahe der Kante.
  const pv = await page.locator('.rb-preview').boundingBox();
  expect(pv.x + pv.width).toBeLessThan(box.x + 2.3 * cw);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await rectsOf(page)).sort()).toEqual(['0,0,1,2', '0,2,2,1']);
  await expect(page.locator('.rb-rects .rrect.blocking, .rb-rects .rrect.doomed')).toHaveCount(0);

  // 2) Mit Nachdruck durch: das Rechteck wird blass und beim Loslassen ersetzt.
  const b = at(1, 0), far = at(1, 3);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [b] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + ((far.x - b.x) * i) / 10, y: b.y }] });
  }
  await expect(page.locator('.rb-rects .rrect.doomed')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await rectsOf(page)).sort()).toEqual(['0,0,1,2', '1,0,1,4']);

  // 3) Wer IN einem Rechteck aufsetzt, zieht es ohne Barriere neu.
  const c = at(1, 1), d = at(1, 4);
  await touchDrag(page, cdp, c, d);
  expect((await rectsOf(page)).sort()).toEqual(['0,0,1,2', '1,1,1,4']);
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

// ── Training ─────────────────────────────────────────────────────────

test('Training legt Schritt für Schritt alle Rechtecke mit Begründung', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.modal = 'howto'; });
  await page.locator('.training-btn').click();
  await page.waitForSelector('.training-banner');
  await expect(page.locator('.rb-focus .rtrain')).toHaveCount(1);
  const title = await page.locator('.training-banner b').textContent();
  expect(title).toMatch(/\d/);
  for (let i = 0; i < 60 && await page.evaluate(() => window.__cns.state.status === 'playing'); i++) {
    await page.locator('.training-banner .btn-primary').click();
  }
  await page.waitForFunction(() => window.__cns.state.status === 'won');
});

// ── Coop ─────────────────────────────────────────────────────────────────────

test('Coop: Rechtecke des Partners kommen an, gleichzeitige Überdeckung — das spätere gewinnt', async ({ page }) => {
  await gotoApp(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/rectangles/generator.js');
    return generatePuzzle({ difficulty: 'mittel', seed: 4242 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({
      type: 'init', gameId: 'rc1', running: true, puzzle,
      rects: [{ id: 'h1', r: puzzle.solution[0].r, c: puzzle.solution[0].c, h: puzzle.solution[0].h, w: puzzle.solution[0].w, by: 'host', col: 2 }],
      startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0,
    });
  }, p);
  await page.waitForSelector('.screen.game .rect-board');
  await expect(page.locator('.rb-rects .rrect')).toHaveCount(1);
  // Fremdes Rechteck trägt die Spielerfarbe als Rand.
  expect(await page.locator('.rb-rects .rrect').first().evaluate((el) => el.style.getPropertyValue('--rb'))).toBe('#e5679a');

  // Partner zieht ein weiteres Rechteck.
  const q1 = p.solution[1];
  await page.evaluate((q) => window.__cns.handleCoopMsg({ type: 'move', op: 'add', rect: { id: 'h2', ...q, by: 'host', col: 4 }, from: 'host' }, '-M0000000000000002'), q1);
  await expect(page.locator('.rb-rects .rrect')).toHaveCount(2);

  // Ich ziehe über beide; ein FRÜHERER Partner-Zug, der meinen überdeckt, wird verworfen …
  await page.evaluate((q) => window.__cns.drawRect(q.r, q.c, q.r, q.c + 1 < 7 ? q.c + 1 : q.c - 1), p.solution[0]);
  const mine = await page.evaluate(() => window.__cns.state.rects.find((x) => x.by === 'me'));
  expect(mine).toBeTruthy();
  await page.evaluate((m) => window.__cns.handleCoopMsg({ type: 'move', op: 'add', rect: { id: 'old', r: m.r, c: m.c, h: 1, w: 1, by: 'host', col: 1 }, from: 'host' }, '-A0000000000000000'), mine);
  expect(await page.evaluate((id) => window.__cns.state.rects.some((x) => x.id === id), mine.id)).toBe(true);
  // … ein SPÄTERER ersetzt meinen.
  await page.evaluate((m) => window.__cns.handleCoopMsg({ type: 'move', op: 'add', rect: { id: 'new', r: m.r, c: m.c, h: 1, w: 1, by: 'host', col: 1 }, from: 'host' }, '~~~~zzzz'), mine);
  expect(await page.evaluate((id) => window.__cns.state.rects.some((x) => x.id === id), mine.id)).toBe(false);
  // Löschen durch den Partner.
  await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'move', op: 'del', id: 'new', from: 'host' }, '~~~~zzzz1'));
  expect(await page.evaluate(() => window.__cns.state.rects.some((x) => x.id === 'new'))).toBe(false);
});

test('Wettkampf/Team: dasselbe Rätsel aus demselben Seed, Endlos startet', async ({ page }) => {
  await gotoApp(page);
  const same = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/rectangles/generator.js');
    const a = generatePuzzle({ difficulty: 'schwer', seed: 99 }), b = generatePuzzle({ difficulty: 'schwer', seed: 99 });
    return JSON.stringify(a.clues) === JSON.stringify(b.clues);
  });
  expect(same).toBe(true);
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.evaluate(() => { window.__cns.state.sel.endless = true; });
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .rect-board');
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.endless.active);
  await page.evaluate(() => window.__cns.solveRects());
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await expect(page.locator('.endless-lives-row')).toBeVisible();
});

// ── Alle Ebenen der App ──────────────────────────────────────────────────────

test('Erfolge, Missionen und Einstellungen zeigen nur, was es in Rectangles gibt', async ({ page }) => {
  await gotoApp(page);
  // Erfolge: keine „Große Zahlen"-Erfolge, und die Gesamtzahl passt zur Liste.
  await page.evaluate(() => { window.__cns.state.screen = 'achievements'; });
  await page.waitForSelector('.achievement-row');
  const rows = await page.locator('.achievement-row').count();
  expect(await page.locator('.achievements-progress-label').textContent()).toContain(String(rows));
  expect(await page.evaluate(() => [...document.querySelectorAll('.achievement-row')].some((r) => /Große Zahlen/i.test(r.textContent)))).toBe(false);
  expect(rows).toBeGreaterThan(30);
  // Missionen: über viele Wochen nie die Große-Zahlen-Mission.
  expect(await page.evaluate(() => window.__cns.state.missions.list.some((m) => m.id === 'bigWin2'))).toBe(false);
  // Einstellungen: Löschstil (nur Number Sums) fehlt.
  await page.evaluate(() => { window.__cns.state.screen = 'settings'; window.__cns.state.settingsTab = 'spiel'; });
  await page.waitForSelector('.set-howto-btn');
  await expect(page.locator('.screen.settings', { hasText: 'Durchstreichen' })).toHaveCount(0);
});

test('Freunde sehen, dass ich gerade Rectangles spiele', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'leicht');
  const info = await page.evaluate(() => window.__cns.currentGameInfo && window.__cns.currentGameInfo());
  expect(info && info.id).toBe('rectangles');
});
