import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Kern des Features: ein NEUES Spiel darf einen alten Stand nicht mehr
// ueberschreiben. Frueher gab es genau einen Solo-Slot — wer ein neues Spiel
// anfing, verlor den vorherigen Fortschritt ersatzlos.
async function playAFewCells(page, n = 3) {
  await page.evaluate((count) => {
    const { state, onCellTap } = window.__cns;
    state.tool = 'pen';
    let done = 0;
    for (let r = 0; r < state.puzzle.rows && done < count; r++) {
      for (let c = 0; c < state.puzzle.cols && done < count; c++) {
        if (state.puzzle.solution[r][c]) { onCellTap(r, c); done++; }
      }
    }
  }, n);
  // Autosave ist auf 400 ms gedrosselt.
  await page.waitForTimeout(600);
  await page.evaluate(() => { const { state, onCellTap } = window.__cns; onCellTap(state.puzzle.rows - 1, state.puzzle.cols - 1); });
  await page.waitForTimeout(200);
}

test.describe('Spielstand-Bibliothek', () => {
  test('ein zweites Spiel ueberschreibt den ersten Stand NICHT', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);
    await playAFewCells(page);
    const first = await page.evaluate(() => window.__cns.state.gameId);

    // Zurueck ins Hauptmenue (wie App schliessen/oeffnen) und ein ZWEITES Spiel starten.
    await page.goto('/');
    await page.waitForFunction(() => !!window.__cns);
    await startNewGame(page);
    await playAFewCells(page);
    const second = await page.evaluate(() => window.__cns.state.gameId);
    expect(second).not.toBe(first);

    const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_saves') || '[]').map((g) => g.id));
    expect(ids, 'beide Partien muessen in der Bibliothek liegen').toContain(first);
    expect(ids).toContain(second);
  });

  test('die Liste zeigt Fortschritt und laesst einen Stand loeschen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);
    await playAFewCells(page);
    await page.goto('/');
    await page.waitForFunction(() => !!window.__cns);
    await startNewGame(page);
    await playAFewCells(page);

    // Ins Hauptmenue und die Bibliothek oeffnen.
    await page.goto('/');
    await page.waitForFunction(() => !!window.__cns);
    await page.locator('.saves-link').click();
    await expect(page.locator('.saves-modal')).toBeVisible();

    const rows = page.locator('.save-row');
    await expect(rows).toHaveCount(2);
    // Jede Zeile traegt einen Fortschrittsbalken mit echter Breite.
    const pct = await page.evaluate(() => Array.from(document.querySelectorAll('.save-bar i')).map((el) => el.style.width));
    expect(pct.every((w) => /^\d+%$/.test(w))).toBe(true);

    // Loeschen fragt nach und entfernt danach genau EINEN Eintrag.
    await rows.first().locator('.save-del').click();
    await expect(page.locator('.modal-bg', { hasText: 'Spielstand löschen?' })).toBeVisible();
    await page.locator('.modal .btn-danger').first().click();
    await expect(page.locator('.save-row')).toHaveCount(1);
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_saves') || '[]').length);
    expect(left).toBe(1);
  });

  test('ein gespeicherter Stand laesst sich gezielt fortsetzen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);
    await playAFewCells(page);
    const older = await page.evaluate(() => window.__cns.state.gameId);
    await page.goto('/');
    await page.waitForFunction(() => !!window.__cns);
    await startNewGame(page);
    await playAFewCells(page);

    await page.goto('/');
    await page.waitForFunction(() => !!window.__cns);
    await page.locator('.saves-link').click();
    // Den AELTEREN Stand waehlen (er steht hinten, weil neueste zuerst kommen).
    await page.locator('.save-row').last().locator('.save-main').click();
    await page.waitForSelector('.screen.game');
    expect(await page.evaluate(() => window.__cns.state.gameId)).toBe(older);
  });
});
