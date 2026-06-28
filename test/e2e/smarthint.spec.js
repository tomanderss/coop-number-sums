import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Dreistufiger Hinweis — schon Stufe 1 kostet die Bestzeit, daher kommt die
// einmalige Warnung VOR Stufe 1:
//  Stufe 1 (1. Tipp, nach Warnung): markiert NUR den relevanten Bereich
//    (Highlight), kein Banner. hintsUsed +1.
//  Stufe 2 (2. Tipp): blendet zusätzlich die Leitfrage ein (Banner). Keine
//    weitere Strafe. Per X wegklickbar.
//  Stufe 3 ("Auflösen"/3. Tipp): deckt die Zelle auf. Keine zweite Warnung.
// Der Hinweis-Knopf ist das letzte .round-btn der Werkzeugleiste (nach Undo).
const hintBtn = (page) => page.locator('.toolbar .round-btn').last();

// Löst das ganze Rätsel korrekt bis auf die beiden Eck-Zellen (0,0) und
// (R-1,C-1) -> ein Tier-1-Schritt ist garantiert verfügbar, seedunabhängig.
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

// Stufe 1 auslösen inkl. Bestätigen der einmaligen Bestzeit-Warnung.
async function startStage1(page) {
  await hintBtn(page).click();
  await expect(page.locator('.modal-bg')).toBeVisible();
  await page.locator('.modal-bg .btn-danger').click();
}

test('Stufe 1: warnt zuerst, markiert dann nur den Bereich und kostet die Bestzeit', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startStage1(page);

  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);
  await expect(page.locator('.hint-banner')).toBeHidden(); // Stufe 1 zeigt KEIN Banner
  expect(await page.evaluate(() => window.__cns.state.hintNudge?.stage)).toBe(1);
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1); // Strafe schon hier
});

test('Stufe 2: zweiter Tipp blendet die Leitfrage ein, ohne weitere Strafe', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startStage1(page);
  await hintBtn(page).click(); // Stufe 2

  await expect(page.locator('.hint-banner')).toBeVisible();
  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__cns.state.hintNudge?.stage)).toBe(2);
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1); // unverändert
});

test('X klickt das Banner weg und gibt die Werkzeugleiste frei', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startStage1(page);
  await hintBtn(page).click(); // Stufe 2
  await expect(page.locator('.hint-banner')).toBeVisible();

  await page.locator('.hint-dismiss').click();

  await expect(page.locator('.hint-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);
  expect(await page.locator('.cell.hint-group').count()).toBe(0);
});

test('Stufe 3: "Auflösen" deckt die Zelle auf, ohne zweite Warnung', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startStage1(page);
  await hintBtn(page).click(); // Stufe 2
  await expect(page.locator('.hint-banner')).toBeVisible();

  const target = await page.evaluate(() => {
    const n = window.__cns.state.hintNudge;
    return { r: n.r, c: n.c, want: n.want };
  });

  await page.locator('.hint-banner .btn').click(); // "Auflösen"

  // Keine zweite Bestzeit-Warnung, Zelle ist aufgedeckt, Strafe bleibt bei 1.
  await expect(page.locator('.modal-bg')).toBeHidden();
  await expect(page.locator('.hint-banner')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1);
  expect(await page.evaluate(({ r, c }) => window.__cns.state.marks[r][c], target)).toBe(target.want);
});

test('Nach dem Auflösen beginnt der nächste Hinweis wieder bei Stufe 1 (nicht instant Stufe 3)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  // Kompletter Durchlauf bis Stufe 3 (Auflösen).
  await startStage1(page);
  await hintBtn(page).click();              // Stufe 2
  await page.locator('.hint-banner .btn').click(); // "Auflösen" -> Zelle gelöst, Hinweis verworfen
  expect(await page.evaluate(() => window.__cns.state.hintNudge)).toBe(null);

  // Neuer Tipp MUSS wieder bei Stufe 1 starten: nur Highlight, kein Banner,
  // kein sofortiges Auflösen.
  await hintBtn(page).click();
  expect(await page.evaluate(() => window.__cns.state.hintNudge?.stage)).toBe(1);
  await expect(page.locator('.hint-banner')).toBeHidden();
});

test('Coop-Sync: Ziel ist deterministisch und ein abweichender/veralteter Hinweis löst NICHT sofort auf, sondern startet neu bei Stufe 1', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);
  await startStage1(page);
  const A = await page.evaluate(() => ({ r: window.__cns.state.hintNudge.r, c: window.__cns.state.hintNudge.c }));

  // Determinismus: Nudge zurücksetzen, erneut tippen -> exakt dieselbe Zielzelle
  // (kein Zufall mehr) -> alle Coop-Spieler bekommen dasselbe Hinweisfeld.
  await page.evaluate(() => { window.__cns.state.hintNudge = null; window.__cns.state.hintsLeft = 99; });
  await hintBtn(page).click();
  expect(await page.evaluate(() => ({ r: window.__cns.state.hintNudge.r, c: window.__cns.state.hintNudge.c }))).toEqual(A);

  // Abweichender (veralteter) Nudge auf der ANDEREN offenen Eckzelle B (Stufe 1,
  // damit kein Banner den Knopf überdeckt). Tippen darf B NICHT auflösen, sondern
  // muss frisch bei Stufe 1 auf dem deterministischen Ziel A neu beginnen.
  const before = await page.evaluate((A) => {
    const s = window.__cns.state, p = s.puzzle;
    const B = (A.r === 0 && A.c === 0) ? { r: p.rows - 1, c: p.cols - 1 } : { r: 0, c: 0 };
    s.hintNudge = { r: B.r, c: B.c, want: 'kept', stage: 1, group: { kind: 'region', ref: 0, target: null }, reason: 'generic', rem: null };
    return { B, markB: s.cellMeta[B.r][B.c].hintMark };
  }, A);
  await hintBtn(page).click();
  const after = await page.evaluate((before) => {
    const s = window.__cns.state;
    return { nudge: { r: s.hintNudge.r, c: s.hintNudge.c, stage: s.hintNudge.stage }, markB: s.cellMeta[before.B.r][before.B.c].hintMark };
  }, before);
  expect(after.nudge).toEqual({ r: A.r, c: A.c, stage: 1 }); // zurück aufs Ziel, Stufe 1
  expect(after.markB).toBe(before.markB);                    // B NICHT aufgelöst
});

test('Eigener Zug verwirft den Hinweis (auch in Stufe 1)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startStage1(page);
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
