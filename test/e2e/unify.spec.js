import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// Einheitliche Spiel-DNA: was in einem Spiel gilt, gilt in allen.

test.use({ hasTouch: true, isMobile: true });

async function gotoGame(page, game) {
  await page.addInitScript((g) => { try { localStorage.setItem('cns_game', JSON.stringify(g)); } catch {} }, game);
  await gotoHome(page);
}
async function openSetup(page) {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
}
async function startGame(page, difficulty = 'leicht') {
  await openSetup(page);
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .board');
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
}

test('Herzen nur in Spielen mit Leben — Pipes zeigt keine, Endlos schon; Ergebnis ohne Fehler-/Hinweis-Zeile', async ({ page }) => {
  await gotoGame(page, 'pipes');
  await startGame(page);
  await expect(page.locator('.game-top .hud-item.lives')).toHaveCount(0);
  await page.evaluate(() => window.__cns.solvePipes());
  await expect(page.locator('.overlay .result-card')).toBeVisible({ timeout: 8000 });
  const labels = await page.locator('.overlay .result-card .result-stats small').allTextContents();
  expect(labels.join('|')).not.toMatch(/Fehler|Hinweis/);
  // Endlos-Lauf: der Leben-Pool läuft über die Level → Herzen sichtbar.
  await page.evaluate(() => { window.__cns.state.endless.active = true; });
  await expect(page.locator('.game-top .hud-item.lives')).toHaveCount(1);
});

test('Number Sums behält Herzen und Fehler-/Hinweis-Zeile', async ({ page }) => {
  await gotoGame(page, 'numbersums');
  await startGame(page);
  await expect(page.locator('.game-top .hud-item.lives')).toHaveCount(1);
});

test('Auswahl-Screen: Medaillon, Regler und Start-Knopf stehen in jedem Spiel an derselben Stelle', async ({ page }) => {
  test.setTimeout(90000);
  const boxes = {};
  for (const g of ['numbersums', 'pipes', 'numberlink']) {
    await gotoGame(page, g);
    await openSetup(page);
    await page.waitForTimeout(400);
    const y = async (sel) => Math.round((await page.locator(sel).first().boundingBox()).y);
    boxes[g] = [await y('.setup-slider .diff-medallion'), await y('.setup-slider .diff-start')];
  }
  expect(boxes.pipes).toEqual(boxes.numbersums);
  expect(boxes.numberlink).toEqual(boxes.numbersums);
});

test('Startseite: der Profil-Chip zeigt ohne Namen kein „?“', async ({ page }) => {
  await gotoGame(page, 'numbersums');
  await page.evaluate(() => { window.__cns.state.settings.coopName = ''; });
  await expect(page.locator('.home-profile-chip .hpc-name')).not.toHaveText('?');
});

test('Leiste unter dem Brett: in jedem Spiel gleich hoch und an derselben Stelle', async ({ page }) => {
  test.setTimeout(120000); // fünf Spiele nacheinander erzeugen
  const docks = {};
  for (const g of ['numbersums', 'gems', 'pipes', 'rectangles', 'numberlink']) {
    await gotoGame(page, g);
    await startGame(page);
    const box = await page.locator('.screen.game .toolbar, .gm-tools-wrap, .pp-tools-wrap, .board-dock-spacer').first().boundingBox();
    docks[g] = [Math.round(box.y), Math.round(box.height)];
  }
  for (const g of Object.keys(docks)) expect(docks[g], g).toEqual(docks.numbersums);
});
