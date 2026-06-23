import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Training mode now starts from inside the how-to modal (home-grid -> "?").
// .training-btn is a stable hook independent of any other class toggling.
async function openHowtoModal(page) {
  await page.locator('.home-grid .btn-ghost').nth(1).click();
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
  for (let i = 0; i < cellCount + 1; i++) {
    const stillPlaying = await page.evaluate(() => window.__cns.state.status === 'playing');
    if (!stillPlaying) break;
    const applyBtn = page.locator('.training-banner .btn-primary');
    if (!(await applyBtn.isVisible().catch(() => false))) break;
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

    await expect(page.locator('.result-card.win')).toBeVisible();
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

    await expect(page.locator('.result-card.win')).toBeVisible();
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
});
