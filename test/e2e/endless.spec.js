import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle } from './helpers.js';

test.describe('endless climb', () => {
  test('setup endless toggle starts a run, clearing a level advances, losing shows the summary', async ({ page }) => {
    await gotoApp(page);
    // Home → Setup (direkt). Endlos-Aufstieg ist ein Toggle im Setup.
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    // Endlos-Toggle einschalten (letzter .mode-toggle) → starten.
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await expect(page.locator('.mode-toggle.on')).toBeVisible();

    // „Endlos starten" → direkt im Spiel, Level 1
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.endless.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(1);
    await expect(page.locator('.hud-item.endless-lvl')).toBeVisible();

    // Level 1 lösen → NORMALER Gewinn-Screen mit „Fortsetzen" (kein Auto-Weiter)
    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.endless.score)).toBe(1);
    // „Fortsetzen" lädt erst das nächste (schwerere) Level → Level 2
    await page.locator('.result-card .btn-primary').click();
    await page.waitForFunction(() => window.__cns.state.endless.level === 2 && window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');

    // Leben aufbrauchen → Lauf endet, Endlos-Ergebnis-Screen
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      let r = -1, c = -1;
      outer: for (let i = 0; i < p.rows; i++) for (let j = 0; j < p.cols; j++) { if (state.marks[i][j] === 'none') { r = i; c = j; break outer; } }
      state.tool = p.solution[r][c] ? 'eraser' : 'pen'; // absichtlich falsch
      for (let k = 0; k < 8; k++) onCellTap(r, c);
    });
    await expect(page.locator('.endless-reached')).toBeVisible();
    expect(await page.evaluate(() => !!window.__cns.state.endlessSummary)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endlessSummary.score)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.stats.endlessBest)).toBe(1);
    // „Neues Spiel" startet einen frischen Lauf.
    await page.locator('.result-card .btn-primary').click();
    await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.endless.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(1);
  });

  test('endless never leaves a solo resume game behind', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await page.locator('.diff-start').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // saveSlot ist 'endless' (nicht 'solo') und es liegt kein Solo-Fortsetzen-Stand vor.
    expect(await page.evaluate(() => window.__cns.state.saveSlot)).toBe('endless');
    await page.evaluate(() => window.__cns.state.paused = false);
    await page.evaluate(() => window.__cns.state); // no-op
    expect(await page.evaluate(() => { const g = localStorage.getItem('cns_active_game'); return g && g !== 'null'; })).toBeFalsy();
  });

  test('a solo endless run offers "invite a player" in the pause menu', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await page.locator('.diff-start').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // Einen Zug machen (Status bleibt playing), dann pausieren.
    await page.evaluate(() => { const s = window.__cns.state, p = s.puzzle; s.tool = p.solution[0][0] ? 'pen' : 'eraser'; window.__cns.onCellTap(0, 0); });
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    // „Mitspieler einladen" ist im Endlos-Lauf verfügbar (Live-Umwandlung zu Coop-Endlos).
    await expect(page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'einladen' })).toBeVisible();
  });

  test('a solo endless run can be resumed after leaving to the menu (incl. big numbers)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { const s = window.__cns.state; s.sel.endless = true; s.sel.bigNumbers = true; });
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
    const before = await page.evaluate(() => ({ big: window.__cns.state.puzzle.bigNumbers, seed: window.__cns.state.puzzle.seed, level: window.__cns.state.endless.level }));
    // einen Zug machen, dann pausieren und zum Menü.
    await page.evaluate(() => { const s = window.__cns.state; s.tool = 'pen'; window.__cns.onCellTap(0, 0); });
    await page.locator('.game-top .icon-btn').first().click();
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await page.waitForSelector('.screen.home');
    // Endlos-Fortsetzen-Knopf erscheint.
    expect(await page.evaluate(() => !!window.__cns.state.resumeAvailableEndless)).toBe(true);
    await expect(page.locator('.resume-row .btn-resume')).toHaveCount(1);
    // Fortsetzen → derselbe Lauf (Level, Große Zahlen, Seed), Endlos wieder aktiv.
    await page.locator('.resume-row .btn-resume').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
    const after = await page.evaluate(() => ({ big: window.__cns.state.puzzle.bigNumbers, seed: window.__cns.state.puzzle.seed, level: window.__cns.state.endless.level, active: window.__cns.state.endless.active }));
    expect(after).toEqual({ big: before.big, seed: before.seed, level: before.level, active: true });
    expect(after.big).toBe(true);
  });
});
