import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Tipp-Tutor (keine Stufen mehr): Ein Tipp startet nach der einmaligen
// Bestzeit-Warnung eine Schritt-für-Schritt-Erklärung mit den KONKRETEN Zahlen
// des Bretts. Jeder Schritt highlightet seine Zellen (Rest gedimmt) und wird
// per „Weiter" bestätigt; der LETZTE Schritt führt den erklärten Zug aus.
// Der Hinweis-Knopf ist der einzige .round-btn der Werkzeugleiste (Undo entfernt).
const hintBtn = (page) => page.locator('.toolbar .round-btn').last();
const nextBtn = (page) => page.locator('.tutor-card .btn');

// Löst das ganze Rätsel korrekt bis auf die beiden Eck-Zellen (0,0) und
// (R-1,C-1) -> ein einfach erklärbarer Schritt ist garantiert verfügbar.
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

// Tutor starten inkl. Bestätigen der einmaligen Bestzeit-Warnung.
async function startTutor(page) {
  await hintBtn(page).click();
  await expect(page.locator('.modal-bg')).toBeVisible();
  await page.locator('.modal-bg .btn-danger').click();
}

test('Tipp startet den Tutor: Warnung, dann Schritt 1 mit Highlight + konkretem Text', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startTutor(page);

  await expect(page.locator('.tutor-card')).toBeVisible();
  const tt = await page.evaluate(() => ({ i: window.__cns.state.hintTutor.i, steps: window.__cns.state.hintTutor.steps.length }));
  expect(tt.i).toBe(0);
  expect(tt.steps).toBeGreaterThanOrEqual(3);
  // Schritt 1 highlightet den Bereich, der Rest des Bretts ist gedimmt.
  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);
  await expect(page.locator('.board.tutor-dim')).toBeVisible();
  // Der Text ist KONKRET: enthält die Zielsumme (eine Zahl), kein generischer Satz.
  const text = await page.locator('.tutor-card .hint-text > span').textContent();
  expect(text).toMatch(/\d/);
  // Strafe fällt beim Start an.
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1);
});

test('„Weiter" schaltet die Schritte durch, der letzte Schritt führt den Zug aus', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startTutor(page);
  const info = await page.evaluate(() => {
    const tt = window.__cns.state.hintTutor;
    return { steps: tt.steps.length, target: tt.target };
  });

  // Durch alle Schritte klicken; das Highlight wechselt je Schritt.
  for (let i = 1; i < info.steps; i++) {
    await nextBtn(page).click();
    expect(await page.evaluate(() => window.__cns.state.hintTutor?.i)).toBe(i);
  }
  // Letzter Schritt zeigt den Ausführen-Knopf und wendet beim Klick den Zug an.
  await nextBtn(page).click();
  expect(await page.evaluate(() => window.__cns.state.hintTutor)).toBe(null);
  expect(await page.evaluate(({ r, c }) => window.__cns.state.marks[r][c], info.target)).toBe(info.target.want);
  // Keine weitere Strafe über den Start hinaus.
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1);
});

test('Auch der Hinweis-Knopf selbst schaltet weiter (wie „Weiter")', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startTutor(page);
  // Die Tutor-Karte liegt über der Werkzeugleiste — die Weiterschalt-Logik des
  // Knopfs (useHint → tutorNext) wird daher direkt über die App-API geprüft.
  await page.evaluate(() => window.__cns.useHint());
  expect(await page.evaluate(() => window.__cns.state.hintTutor?.i)).toBe(1);
  // Keine zusätzliche Strafe durchs Weiterschalten.
  expect(await page.evaluate(() => window.__cns.state.hintsUsed)).toBe(1);
});

test('X bricht den Tutor ab: kein Zug, Highlight weg, Werkzeugleiste frei', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startTutor(page);
  await expect(page.locator('.tutor-card')).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify(window.__cns.state.marks));

  await page.locator('.hint-dismiss').click();

  await expect(page.locator('.tutor-card')).toBeHidden();
  expect(await page.evaluate(() => window.__cns.state.hintTutor)).toBe(null);
  expect(await page.locator('.cell.hint-group').count()).toBe(0);
  expect(await page.evaluate(() => JSON.stringify(window.__cns.state.marks))).toBe(before);
});

test('Eigener Zug verwirft den offenen Tutor (Zahlen wären veraltet)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');
  await solveExceptCorners(page);

  await startTutor(page);
  expect(await page.locator('.cell.hint-group').count()).toBeGreaterThan(0);

  await page.evaluate(() => {
    const { state, onCellTap } = window.__cns;
    const p = state.puzzle;
    state.tool = p.solution[0][0] ? 'pen' : 'eraser';
    onCellTap(0, 0);
  });

  expect(await page.evaluate(() => window.__cns.state.hintTutor)).toBe(null);
  expect(await page.locator('.cell.hint-group').count()).toBe(0);
});

test('Der Tutor erklärt ein frisches Brett von Anfang an (voller Durchklick löst eine Zelle)', async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'sehrleicht');

  await startTutor(page);
  const steps = await page.evaluate(() => window.__cns.state.hintTutor.steps.length);
  for (let i = 1; i <= steps; i++) await nextBtn(page).click();
  // Genau eine Zelle wurde durch den Tutor gelöst.
  const solvedCount = await page.evaluate(() => {
    let n = 0;
    for (const row of window.__cns.state.marks) for (const m of row) if (m !== 'none') n++;
    return n;
  });
  expect(solvedCount).toBe(1);
});
