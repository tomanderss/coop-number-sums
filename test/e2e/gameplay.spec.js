import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, commitMistakes, dismissStreakModal } from './helpers.js';

test.describe('gameplay', () => {
  // Regression: the player's chosen color (settings.coopMyColor) used to only
  // tint marks during an active coop session (cellStyle()/cellClasses() were
  // gated on state.coop.active). It must now also tint your own marks in solo,
  // since the setting was generalized from "coop color" to "my color".
  test('the chosen player color tints a kept mark even outside coop', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => { window.__cns.state.settings.coopMyColor = '#ff00aa'; });
    await startNewGame(page, 'sehrleicht');

    const result = await page.evaluate(() => {
      const { state, onCellTap, cellStyle, cellClasses } = window.__cns;
      const p = state.puzzle;
      let r, c;
      outer: for (r = 0; r < p.rows; r++) for (c = 0; c < p.cols; c++) if (p.solution[r][c]) break outer;
      state.tool = 'pen';
      onCellTap(r, c);
      return { markedColor: cellStyle(r, c)['--markcol'], coopMark: !!cellClasses(r, c)['coop-mark'] };
    });

    expect(result.coopMark).toBe(true);
    expect(result.markedColor).toBe('#ff00aa');
  });

  // Der „Zufall"-Knopf im Solo-Setup würfelt NICHT nur die Schwierigkeit, sondern
  // startet die Runde sofort (kein Zwischenschritt „schau, was gewählt wurde").
  test('the random button starts the game immediately with the rolled difficulty', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'sehrleicht'; });
    // Zufall drücken → direkt im Spiel, ohne den Start-Knopf zu berühren.
    await page.locator('.diff-random').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // Die gestartete Schwierigkeit ist eine ANDERE als die vorgewählte (immer verschieden).
    expect(await page.evaluate(() => window.__cns.state.puzzle.difficulty)).not.toBe('sehrleicht');
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  });

  test('solving the puzzle shows the win screen and records a highscore', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.highscore-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await page.locator('.home-grid .btn-ghost').nth(0).click();
    // Die per-Level-Tabelle steckt jetzt im "Solo"-Reiter (Stats öffnen auf "Allgemein").
    await page.locator('.stats-tabs button').nth(1).click();
    await expect(page.locator('.diff-row').first().locator('.chip').first()).toContainText('1 / 1');
  });

  // Graded win animation (Punkt 10): ein makelloser Sieg (0 Fehler, 0 Hinweise)
  // bekommt zusätzlich zum normalen Konfetti einen goldenen Schimmer + Badge --
  // ein Sieg MIT Fehler bekommt explizit keines von beidem.
  test('a flawless win shows the perfect-win badge and shine, a win with a mistake does not', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);

    await expect(page.locator('.result-card.win.perfect')).toBeVisible();
    await expect(page.locator('.perfect-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click();
    await expect(page.locator('.screen.home')).toBeVisible();
    await startNewGame(page, 'sehrleicht');

    await commitMistakes(page, 1);
    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.result-card.win.perfect')).toHaveCount(0);
    await expect(page.locator('.perfect-badge')).toHaveCount(0);
  });

  test('three deliberate mistakes (lives enabled) trigger the loss screen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await commitMistakes(page, 3);

    await expect(page.locator('.result-card.lose')).toBeVisible();
  });

  test('the lives HUD shows one fewer heart after each mistake', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');

    const emptyHeartsBefore = await page.locator('.heart.empty').count();
    await commitMistakes(page, 1);
    await expect.poll(() => page.locator('.heart.empty').count()).toBe(emptyHeartsBefore + 1);
  });

  test('the zoom reset button appears only after zooming and restores the default zoom', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    // Bei Standardzoom (1) ist der Reset-Knopf ausgeblendet.
    await expect(page.locator('.zoom-reset')).toHaveCount(0);
    await page.locator('.zoomctl .zoom-btn', { hasText: '+' }).click();
    await expect(page.locator('.zoom-reset')).toBeVisible();
    await page.locator('.zoom-reset').click();
    await expect(page.locator('.zoom-reset')).toHaveCount(0);
    expect(await page.evaluate(() => window.__cns.state.zoom)).toBe(1);
  });

  test('undo reverts the last mark', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');

    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      state.tool = p.solution[0][0] ? 'pen' : 'eraser';
      onCellTap(0, 0);
    });
    const markedAfterTap = await page.evaluate(() => window.__cns.state.marks[0][0]);
    expect(markedAfterTap).not.toBe('none');

    await page.locator('.toolbar .round-btn').first().click(); // undo
    const markedAfterUndo = await page.evaluate(() => window.__cns.state.marks[0][0]);
    expect(markedAfterUndo).toBe('none');
  });

  test('resuming from pause runs a 3-2-1 countdown before the game continues', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    // Pausieren → Fortsetzen tippen.
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    await page.locator('.pause-overlay .btn-primary').click();
    // Countdown läuft: Karte mit Ziffer + Balken, Spiel bleibt PAUSIERT (kein
    // versehentlicher Tap ins Brett, Timer eingefroren).
    await expect(page.locator('.resume-count-card')).toBeVisible();
    await expect(page.locator('.resume-count-digit')).toHaveText('3');
    await expect(page.locator('.resume-count-bar span')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    // Nach einer Sekunde: 2 — und immer noch pausiert.
    await page.waitForFunction(() => window.__cns.state.resumeCountdown === 2);
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    // Countdown zu Ende → Spiel läuft wieder, Overlay weg.
    await page.waitForFunction(() => !window.__cns.state.paused, null, { timeout: 6000 });
    await expect(page.locator('.pause-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => window.__cns.state.resumeCountdown)).toBe(null);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  });
});

// „Big Numbers"-Modus (Zellwerte 10–19): der Umschalter erscheint nur für
// kleine Felder (6×6–9×9), erzeugt ein Brett mit zweistelligen Werten, und die
// komplette Spiel-Schleife (generieren → lösen → gewinnen) funktioniert.
test.describe('big numbers mode', () => {
  test('toggle generates a 10–19 board and it can be solved to a win', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'sehrleicht'; });
    // „Große Zahlen"-Umschalter sichtbar (6×6 erlaubt) → einschalten. (Der Endlos-
    // Toggle ist ein zweiter .mode-toggle, daher gezielt über den Titel ansprechen.)
    const bigToggle = page.locator('.mode-toggle', { hasText: 'Große Zahlen' });
    await expect(bigToggle).toBeVisible();
    await bigToggle.click();
    expect(await page.evaluate(() => window.__cns.state.sel.bigNumbers)).toBe(true);

    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    // Alle Zellwerte im Bereich 10–19, Puzzle als big markiert, Brett trägt die Klasse.
    const info = await page.evaluate(() => {
      const p = window.__cns.state.puzzle;
      let min = 99, max = 0;
      for (const row of p.values) for (const v of row) { min = Math.min(min, v); max = Math.max(max, v); }
      return { big: p.bigNumbers, min, max };
    });
    expect(info).toEqual({ big: true, min: expect.any(Number), max: expect.any(Number) });
    expect(info.min).toBeGreaterThanOrEqual(10);
    expect(info.max).toBeLessThanOrEqual(19);
    await expect(page.locator('.board.big-num')).toBeVisible();

    await solveActivePuzzle(page);
    await expect(page.locator('.result-card.win')).toBeVisible({ timeout: 20000 });
  });

  test('the toggle is available for large fields too (all dimensions)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'rip'; }); // 14×14
    await expect(page.locator('.mode-toggle', { hasText: 'Große Zahlen' })).toBeVisible();
  });
});
