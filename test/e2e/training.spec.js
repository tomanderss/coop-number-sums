import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Training mode starts from inside the how-to modal, now reached via
// Settings ▸ tab "Spiel" ▸ "Spielanleitung" (the old home "?" icon was removed).
// .training-btn is a stable hook independent of any other class toggling.
async function openHowtoModal(page) {
  await page.locator('.home-settings-btn').click();
  await expect(page.locator('.screen.settings')).toBeVisible();
  // Einstellungen starten komplett zugeklappt — Spiel-Karte erst aufklappen.
  await page.locator('.screen.settings .admin-acc-head', { hasText: 'Spiel' }).click();
  await page.locator('.set-howto-btn').click();
  await expect(page.locator('.modal .rules')).toBeVisible();
}
const trainingBtn = (page) => page.locator('.modal .training-btn');

// Clicks the training banner's "apply" button repeatedly until the puzzle is
// solved (each click applies exactly one logically forced step). The
// generator is guaranteed (see TRAINING_GEN_BUDGET in app.js) to pick a
// puzzle that is fully solvable this way, so the loop always terminates well
// before the cell-count upper bound used as a safety cap here.
async function applyAllTrainingSteps(page) {
  const cellCount = await page.evaluate(() => {
    const p = window.__cns.state.puzzle;
    return p.rows * p.cols;
  });
  const applyBtn = page.locator('.training-banner .btn-primary');
  const playing = () => page.evaluate(() => window.__cns.state.status === 'playing');
  for (let i = 0; i < cellCount + 1; i++) {
    if (!(await playing())) break;
    // Der Schritt-Button verschwindet unter CI-Last kurz zwischen zwei Schritten,
    // während der nächste erzwungene Zug berechnet/animiert wird. Früher brach die
    // Schleife dann sofort ab (isVisible()===false) -> das Rätsel blieb ungelöst,
    // die Win-Karte erschien nie (der bekannte Flake). Jetzt WARTEN wir, bis der
    // Button wiederkommt; ist das Spiel derweil gewonnen, greift die playing-Prüfung.
    try {
      await applyBtn.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      if (!(await playing())) break;   // gewonnen -> fertig
      continue;                         // sonst: Button kam noch nicht zurück, erneut versuchen
    }
    await applyBtn.click();
  }
}

test.describe('training mode', () => {
  test('starts a puzzle that is fully explainable via forced steps', async ({ page }) => {
    await gotoApp(page);
    await openHowtoModal(page);
    await expect(trainingBtn(page)).toBeVisible();
    await trainingBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.isTrainingGame)).toBe(true);
    await expect(page.locator('.training-banner')).toBeVisible();
    await expect(page.locator('.training-banner .btn-primary')).toBeVisible();
  });

  test('applying every forced step solves the puzzle without affecting stats', async ({ page }) => {
    await gotoApp(page);
    const statsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_stats') || 'null'));

    await openHowtoModal(page);
    await trainingBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await applyAllTrainingSteps(page);

    await expect(page.locator('.result-card.win')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.result-card.win .highscore-badge')).not.toBeVisible();

    const statsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_stats') || 'null'));
    expect(statsAfter).toEqual(statsBefore);
  });

  test('the win screen offers another training example instead of "next puzzle"', async ({ page }) => {
    await gotoApp(page);
    await openHowtoModal(page);
    await trainingBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await applyAllTrainingSteps(page);

    // Unter CI-Last dauert die Anwendung aller Schritte + der Win-Übergang
    // gelegentlich >5s (Default) — großzügigerer Timeout gegen Flakiness.
    await expect(page.locator('.result-card.win')).toBeVisible({ timeout: 20000 });
    await page.locator('.result-card.win .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.isTrainingGame)).toBe(true);
  });

  test('cell taps are ignored while a forced step is pending', async ({ page }) => {
    await gotoApp(page);
    await openHowtoModal(page);
    await trainingBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    const marksBefore = await page.evaluate(() => JSON.stringify(window.__cns.state.marks));
    await page.evaluate(() => window.__cns.onCellTap(0, 0));
    const marksAfter = await page.evaluate(() => JSON.stringify(window.__cns.state.marks));
    expect(marksAfter).toBe(marksBefore);
  });

  // Regression: only newGame() ever reset state.isTrainingGame back to false.
  // Quitting training mid-puzzle (back button -> quitToHome()) left it stuck
  // true; any *other* game-start path that doesn't go through newGame() --
  // joining/hosting coop, race, team-vs-team -- never reset it either, so the
  // training banner resurfaced in that next "normal" game. All of those paths
  // funnel through handleCoopMsg's INIT case (loadPuzzleIntoState), which is
  // reachable here via the window.__cns test hook without needing a real
  // Firebase round-trip (same UI/state-machine boundary as the coop e2e tests).
  test('quitting training mid-puzzle does not leak the training banner into a subsequent coop game', async ({ page }) => {
    await gotoApp(page);
    await openHowtoModal(page);
    await trainingBtn(page).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    await expect(page.locator('.training-banner')).toBeVisible();

    // Abort the tutorial mid-puzzle via the pause menu ("Zum Menü" -> quitToHome()),
    // then simulate receiving a coop INIT message for a fresh, unrelated game --
    // exactly what a guest joining a room (or a team/race match start) does.
    await page.locator('.game-top .icon-btn').first().click(); // Pause
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await expect(page.locator('.screen.home')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.isTrainingGame)).toBe(true);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({
        type: 'init',
        puzzle: { rows: 4, cols: 4, rowTargets: [1, 1, 1, 1], colTargets: [1, 1, 1, 1], values: Array.from({ length: 4 }, () => Array(4).fill(1)), solution: Array.from({ length: 4 }, () => Array(4).fill(true)), regions: [], difficulty: 'leicht' },
        marks: null, markedBy: null, startTime: Date.now(),
      });
    });
    await page.waitForSelector('.screen.game');

    expect(await page.evaluate(() => window.__cns.state.isTrainingGame)).toBe(false);
    await expect(page.locator('.training-banner')).not.toBeVisible();
  });
});
