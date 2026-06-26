import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Sokratischer Hinweis = Zwei-Stufen-Hinweis:
//  Stufe 1 (erster Tipp): highlightet die betroffene Gruppe und stellt eine
//    Leitfrage, OHNE die Zelle/Aktion zu verraten — kostenlos (hintsUsed bleibt 0).
//  Stufe 2 (Auflösen): deckt die konkrete Zelle wirklich auf (hintsUsed +1).
// Die Werkzeugleiste hat zwei .round-btn (Undo + Hinweis); zu Spielbeginn ist
// Undo deaktiviert (kein Verlauf), daher ist :not([disabled]) eindeutig der
// Hinweis-Knopf.
const hintBtn = (page) => page.locator('.toolbar .round-btn:not([disabled])').last();

// Löst das ganze Rätsel korrekt bis auf die beiden Eck-Zellen (0,0) und
// (R-1,C-1). Dadurch hat mindestens eine Zeile/Spalte genau eine offene Zelle,
// sodass ein Tier-1-Schritt garantiert verfügbar ist — unabhängig vom Seed.
async function solveExceptCorners(page) {
  await page.evaluate(() => {
    const { state, onCellTap } = window.__cns;
    const p = state.puzzle;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        if ((r === 0 && c === 0) || (r === p.rows - 1 && c === p.cols - 1)) continue;
        if (state.marks[r][c] !== 'none') continue;
        state.tool = p.solution[r][c] ? 'pen' : 'eraser';
        onCellTap(r, c);
      }
    }
  });
}

test('Stufe 1: Leitfrage + Gruppen-Highlight, kostenlos und ohne Auflösung', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click();

  // Banner sichtbar, Gruppe gehighlightet, Nudge im State gesetzt.
  await expect(page.locator('.hint-banner')).toBeVisible();
  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => !!window.__cns.state.hintNudge)).toBe(true);
  // Gratis: kein Hinweis verbraucht, keine Zelle aufgedeckt, keine Bestätigung.
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(0);
  await expect(page.locator('.modal-bg')).toBeHidden();
});

test('Eigener Zug verwirft die offene Leitfrage', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click();
  await expect(page.locator('.hint-banner')).toBeVisible();

  // Eine der beiden offenen Eck-Zellen korrekt tippen -> Nudge muss verschwinden.
  await page.evaluate(() => {
    const { state, onCellTap } = window.__cns;
    const p = state.puzzle;
    state.tool = p.solution[0][0] ? 'pen' : 'eraser';
    onCellTap(0, 0);
  });

  await expect(page.locator('.hint-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);
  expect(await page.locator('.cell.hint-group').count()).toBe(0);
});

test('Stufe 2: "Auflösen" deckt die Zelle auf (nach einmaliger Bestzeit-Warnung)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click();
  await expect(page.locator('.hint-banner')).toBeVisible();

  // Auflösen -> einmalige Bestzeit-Warnung bestätigen.
  await page.locator('.hint-banner .btn').click();
  await expect(page.locator('.modal-bg')).toBeVisible();
  await page.locator('.modal-bg .btn-danger').click();

  // Zelle aufgedeckt: ein Hinweis verbraucht, Banner & Highlight weg.
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1);
  await expect(page.locator('.hint-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);
});
