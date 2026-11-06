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
  // Im Ruhezustand ist nichts gedreht: das Rohr ist direkt in seiner Lage
  // gezeichnet (sonst Versatz an den Zellgrenzen, gemeldet) — gedreht wird nur
  // während der Animation.
  await expect(page.locator('.pp-tile').first()).toHaveAttribute('data-rot', '2');
  await page.waitForTimeout(400);
  expect(await page.locator('.pp-tile').first().locator('.pp-rot').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
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

test('Finale: erst läuft die Welle durchs Netz, dann kommt der Sieg-Dialog', async ({ page }) => {
  // Nutzerwunsch: beim letzten Zug soll man merken, dass man fertig ist — das
  // Netz leuchtet von der Quelle nach außen auf, erst danach der Sieg-Bildschirm.
  await gotoApp(page);
  await startGame(page, 'mittel');
  const ms = await page.evaluate(() => { window.__cns.solvePipes(); return window.__cns.board.winFinaleMs(); });
  expect(ms).toBeGreaterThan(500);
  await expect(page.locator('.pp-board.done')).toBeVisible();
  expect(await page.evaluate(() => window.__cns.state.winHold)).toBe(true);
  await expect(page.locator('.overlay .result-card')).toHaveCount(0);
  // Die äußersten Stücke starten ihre Welle später als die Quelle.
  const fds = await page.evaluate(() => [...document.querySelectorAll('.pp-tile')].map((el) => parseInt(el.style.getPropertyValue('--fd'), 10) || 0));
  expect(Math.max(...fds)).toBeGreaterThan(0);
  expect(fds[await page.evaluate(() => window.__cns.state.puzzle.source)]).toBe(0);
  await expect(page.locator('.overlay .result-card')).toBeVisible({ timeout: ms + 3000 });
  expect(await page.evaluate(() => window.__cns.state.winHold)).toBe(false);
});

test('Wasser-Schalter: aus = kein Fluss, kein Fortschritt, kein Sieg; einschalten prüft und gewinnt', async ({ page }) => {
  await gotoApp(page);
  await startGame(page, 'mittel');
  const btn = page.locator('.pp-tools-wrap .pp-flow-btn:not(.pp-lock-btn)');
  await expect(btn).toHaveClass(/\bon\b/);
  const boardTop = async () => (await page.locator('.pp-board').boundingBox()).y;
  const y0 = await boardTop();
  await btn.click();
  expect(await page.evaluate(() => window.__cns.state.settings.pipesFlow)).toBe(false);
  await expect(page.locator('.pp-board.dry')).toHaveCount(1);
  await expect(page.locator('.pp-tile.wet')).toHaveCount(0);
  // Das Brett springt beim Umschalten nicht (Hinweis hat festen Platz).
  expect(await boardTop()).toBe(y0);
  // Gelöst, aber ohne Wasser: noch kein Sieg, kein Fortschritt verraten.
  await page.evaluate(() => window.__cns.solvePipes());
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => [window.__cns.state.status, window.__cns.board.boardProgressPct()])).toEqual(['playing', 0]);
  // Einschalten prüft: gelöst → Sieg.
  await btn.click();
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  expect(await page.evaluate(() => window.__cns.state.settings.pipesFlow)).toBe(true);
});

test('iPhone: langes Drücken sperrt, ohne dass das Brett die Lupe/Textauswahl auslöst', async ({ page, context }) => {
  // Gemeldet: beim Sperren erschien auf dem iPhone die Lupe. Das Brett muss
  // touchstart verhindern (nicht passiv) — die Gesten laufen über Pointer-Events.
  await gotoApp(page);
  await startGame(page, 'leicht');
  const prevented = await page.evaluate(() => {
    const el = document.querySelector('.pp-board');
    const r = el.getBoundingClientRect();
    const tp = new Touch({ identifier: 1, target: el, clientX: r.left + 10, clientY: r.top + 10 });
    const ev = new TouchEvent('touchstart', { cancelable: true, bubbles: true, touches: [tp], targetTouches: [tp], changedTouches: [tp] });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
  // Und das Sperren per langem Drücken klappt weiterhin.
  const cdp = await context.newCDPSession(page);
  const at = await centers(page);
  await touch(cdp, 'touchStart', [at(0)]);
  await page.waitForTimeout(650);
  await touch(cdp, 'touchEnd', []);
  await expect.poll(() => page.evaluate(() => window.__cns.state.pipeLock[0])).toBe(true);
});

test('Sperr-Modus: kurzer Tipp sperrt/entsperrt, gedreht wird nicht; aus = wieder drehen', async ({ page, context }) => {
  await gotoApp(page);
  await startGame(page, 'mittel');
  const btn = page.locator('.pp-tools-wrap .pp-lock-btn');
  await expect(btn).toBeVisible();
  await expect(btn).not.toHaveClass(/\bon\b/);
  const boardTop = async () => (await page.locator('.pp-board').boundingBox()).y;
  const y0 = await boardTop();
  await btn.click();
  await expect(btn).toHaveClass(/\bon\b/);
  expect(await page.evaluate(() => window.__cns.state.pipeLockMode)).toBe(true);
  await expect(page.locator('.toast')).toContainText('Sperr-Modus');
  expect(await boardTop()).toBe(y0);
  const at = await centers(page);
  const cdp = await context.newCDPSession(page);
  const r0 = await rots(page);
  await touch(cdp, 'touchStart', [at(2)]); await touch(cdp, 'touchEnd', []);
  expect(await page.evaluate(() => window.__cns.state.pipeLock[2])).toBe(true);
  expect(await rots(page)).toEqual(r0);
  // Nochmal tippen entsperrt.
  await touch(cdp, 'touchStart', [at(2)]); await touch(cdp, 'touchEnd', []);
  expect(await page.evaluate(() => window.__cns.state.pipeLock[2])).toBe(false);
  expect(await rots(page)).toEqual(r0);
  // Modus aus: Tippen dreht wieder.
  await btn.click();
  expect(await page.evaluate(() => window.__cns.state.pipeLockMode)).toBe(false);
  await touch(cdp, 'touchStart', [at(2)]); await touch(cdp, 'touchEnd', []);
  expect((await rots(page))[2]).toBe(r0[2] + 1);
});

test('Coop: Wasser-Schalter und Sperr-Modus gelten nur für mich; löst der Partner, gewinne ich mit — Wasser wird sichtbar', async ({ page }) => {
  await gotoApp(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/pipes/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 91 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.clearSentLog && window.__cns.clearSentLog();
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'ppflow', running: true, puzzle, pipeRot: puzzle.tiles.map(() => 0), startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .pp-board');
  // Ich schalte Wasser aus und den Sperr-Modus an — das ist MEINE Sicht, nichts davon geht an den Partner.
  await page.locator('.pp-tools-wrap .pp-flow-btn:not(.pp-lock-btn)').click();
  await page.locator('.pp-tools-wrap .pp-lock-btn').click();
  await expect(page.locator('.pp-board.dry')).toHaveCount(1);
  const sent = await page.evaluate(() => (window.__cns.sentLog ? window.__cns.sentLog() : []));
  expect(sent.filter((x) => x.type !== 'init'), 'Umschalten schickt nichts an den Partner').toEqual([]);
  // Der Partner dreht alles richtig: bei mir (Wasser aus) gewinnt noch nichts …
  await page.evaluate((solRot) => {
    solRot.forEach((r, i) => window.__cns.handleCoopMsg({ type: 'move', op: 'rot', i, r, from: 'host' }, '-N' + String(100000 + i).padStart(16, '0')));
  }, p.solRot);
  expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  // … bis sein Sieg ankommt: dann gewinne ich mit, und das Wasser wird sichtbar.
  await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'status', status: 'won', timeMs: 9000, mistakes: 0, hintsUsed: 0 }));
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await expect(page.locator('.pp-board.dry')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cns.state.settings.pipesFlow)).toBe(false);
// Gemeldet: „ab 12×12 ist die Drehung nicht mehr smooth, hakelig". Zwei Ursachen:
// jede Drehung zeichnete ALLE Stücke neu (der Wasserlauf hängt an jedem), und
// in jedem Arm lief eine Dauer-Animation — auch in trockenen, unsichtbaren.
test('Leistung: eine Drehung zeichnet nur wenige Stücke neu, nur nasse Arme animieren', async ({ page }) => {
  test.setTimeout(60000);
  await gotoApp(page);
  await startGame(page, 'rip');
  expect(await page.evaluate(() => window.__cns.state.puzzle.rows)).toBe(12);
  const anim = () => page.evaluate(() => document.querySelectorAll('.pp-arm').length && document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.matches('.pp-arm i')).length);
  const wetArms = () => page.evaluate(() => document.querySelectorAll('.pp-tile.wet .pp-arm').length);
  expect(await anim()).toBe(await wetArms());
  expect(await anim()).toBeLessThan(await page.locator('.pp-arm').count());
  // Ein Stück fern der Quelle drehen: höchstens eine Handvoll Stücke zeichnet sich neu.
  const i = await page.evaluate(() => { const s = window.__cns.state; const p = s.puzzle; for (let k = p.tiles.length - 1; k >= 0; k--) if (k !== p.source && !s.pipeLock[k]) return k; return 0; });
  for (let n = 0; n < 4; n++) {
    const before = await page.evaluate(() => window.__cns.cellRenders());
    await page.evaluate((k) => window.__cns.rotatePipe(k), i);
    await page.waitForTimeout(120);
    const delta = (await page.evaluate(() => window.__cns.cellRenders())) - before;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(30);
  }
  // Die Drehung selbst ist eine Web Animation, die ohne Reste endet.
  await page.evaluate((k) => window.__cns.rotatePipe(k), i);
  const rotEl = page.locator('.pp-tile').nth(i).locator('.pp-rot');
  expect(await rotEl.evaluate((el) => el.getAnimations().length)).toBe(1);
  await page.waitForTimeout(400);
  expect(await rotEl.evaluate((el) => [el.getAnimations().length, getComputedStyle(el).transform])).toEqual([0, 'none']);
  // Ein Zufluss-Arm läuft rückwärts (Punkte zur Mitte).
  const dirs = await page.evaluate(() => [...document.querySelectorAll('.pp-tile.wet .pp-arm.inn i')].slice(0, 3).map((e) => getComputedStyle(e).animationDirection));
  expect(dirs.length).toBeGreaterThan(0);
  expect(new Set(dirs)).toEqual(new Set(['reverse']));
});
