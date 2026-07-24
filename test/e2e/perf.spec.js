import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Regression für den KERN-PERFORMANCEFIX (BoardGrid-Child-Komponente): App-Renders
// (Werkzeug-Umschalter, Sekunden-Tick) dürfen das Brett (~200 Zellen) NICHT mehr
// mitrendern — das war die gemeldete Tap-Latenz („Einkreisen/Löschen reagiert
// nicht", Züge im falschen Modus). window.__cns.boardRenders() zählt die
// tatsächlichen Brett-Renders.
test.describe('board render isolation', () => {
  test('tool switching and timer ticks do NOT re-render the board; real moves do', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);

    // Ein paar Markierungen setzen (realistischer Brettzustand).
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      let n = 0;
      outer: for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        if (n >= 4) break outer;
        state.tool = p.solution[r][c] ? 'pen' : 'eraser';
        onCellTap(r, c); n++;
      }
    });
    await page.waitForTimeout(150);
    const r0 = await page.evaluate(() => window.__cns.boardRenders());
    expect(r0).toBeGreaterThan(0);

    // 1) Werkzeug 6× umschalten → Brett rendert NICHT (nur der kleine Umschalter).
    for (let i = 0; i < 6; i++) await page.evaluate(() => window.__cns.toggleTool());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__cns.boardRenders())).toBe(r0);
    // … und der Umschalter selbst HAT reagiert (UI-Feedback da).
    const toolBefore = await page.evaluate(() => window.__cns.state.tool);
    await page.evaluate(() => window.__cns.toggleTool());
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__cns.state.tool)).not.toBe(toolBefore);
    await expect(page.locator('.tool-toggle .tool-ic.active')).toHaveCount(1);

    // 2) Sekunden-Tick simulieren → Brett rendert NICHT.
    const r1 = await page.evaluate(() => window.__cns.boardRenders());
    await page.evaluate(() => { window.__cns.state.elapsed += 1000; });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__cns.boardRenders())).toBe(r1);

    // 3) ECHTER Zug → Brett rendert (Korrektheits-Gegenprobe).
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      outer: for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        if (state.marks[r][c] === 'none') { state.tool = p.solution[r][c] ? 'pen' : 'eraser'; onCellTap(r, c); break outer; }
      }
    });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__cns.boardRenders())).toBeGreaterThan(r1);
  });

  test('debounced settings persist still lands in localStorage', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_settings') || '{}').confirmTool || 'pen');
    await page.evaluate(() => window.__cns.toggleTool());
    // Entprellt (250 ms) — nach kurzer Wartezeit MUSS der Wert persistiert sein.
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_settings') || '{}').confirmTool);
    expect(after).not.toBe(before);
  });
});
