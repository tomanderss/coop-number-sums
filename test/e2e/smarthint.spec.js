import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Dreistufiger Hinweis:
//  Stufe 1 (1. Tipp): markiert NUR den relevanten Bereich (Highlight), kein
//    Banner, kostenlos.
//  Stufe 2 (2. Tipp): blendet zusätzlich die Leitfrage ein (Banner), weiterhin
//    kostenlos. Per X wegklickbar.
//  Stufe 3 ("Auflösen"/3. Tipp): deckt die Zelle wirklich auf (hintsUsed +1).
// Der Hinweis-Knopf ist das letzte .round-btn der Werkzeugleiste (nach Undo).
const hintBtn = (page) => page.locator('.toolbar .round-btn').last();

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

test('Stufe 1: nur der Bereich wird markiert, kein Banner, kostenlos', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click();

  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);
  await expect(page.locator('.hint-banner')).toBeHidden(); // Stufe 1 zeigt KEIN Banner
  expect(await page.evaluate(() => window.__cns.state.hintNudge?.stage)).toBe(1);
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(0);
});

test('Stufe 2: zweiter Tipp blendet die Leitfrage ein (Highlight bleibt)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click(); // Stufe 1
  await hintBtn(page).click(); // Stufe 2

  await expect(page.locator('.hint-banner')).toBeVisible();
  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__cns.state.hintNudge?.stage)).toBe(2);
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(0); // immer noch gratis
});

test('X klickt das Banner weg und gibt die Werkzeugleiste frei', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click();
  await hintBtn(page).click();
  await expect(page.locator('.hint-banner')).toBeVisible();

  await page.locator('.hint-dismiss').click();

  await expect(page.locator('.hint-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);
  expect(await page.locator('.cell.hint-group').count()).toBe(0);
});

test('Stufe 3: "Auflösen" deckt die Zelle auf (nach einmaliger Bestzeit-Warnung)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click();
  await hintBtn(page).click();
  await expect(page.locator('.hint-banner')).toBeVisible();

  await page.locator('.hint-banner .btn').click(); // "Auflösen"
  await expect(page.locator('.modal-bg')).toBeVisible();
  await page.locator('.modal-bg .btn-danger').click(); // Bestzeit-Warnung bestätigen

  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1);
  await expect(page.locator('.hint-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);
});

test('Eigener Zug verwirft den Hinweis (auch in Stufe 1)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await hintBtn(page).click(); // Stufe 1: nur Highlight
  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);

  await page.evaluate(() => {
    const { state, onCellTap } = window.__cns;
    const p = state.puzzle;
    state.tool = p.solution[0][0] ? 'pen' : 'eraser';
    onCellTap(0, 0);
  });

  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);
  expect(await page.locator('.cell.hint-group').count()).toBe(0);
});
