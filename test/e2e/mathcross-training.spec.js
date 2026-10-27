import { test, expect } from '@playwright/test';
import { gotoApp } from './mathcross-helpers.js';

// Der Trainingsmodus rief zwei Funktionen aus Number Sums auf, die es in Math
// Cross nie gab (isFullyTier1Solvable, setMark): „Training" blieb auf einem
// leeren Spielbildschirm haengen, und „Anwenden" haette ebenfalls geworfen.
test('Training startet ein Raetsel und der Tutor legt die erklaerten Steine', async ({ page }) => {
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.modal = 'howto'; });
  await page.locator('.training-btn').click();
  await page.waitForFunction(() => window.__cns.state.puzzle && window.__cns.state.isTrainingGame && !window.__cns.state.generating, null, { timeout: 15000 });
  await expect(page.locator('.training-banner')).toBeVisible();

  const gelegt = () => page.evaluate(() => window.__cns.state.placed.flat().filter((v) => v != null).length);
  expect(await gelegt()).toBe(0);
  for (let i = 0; i < 3; i++) {
    await page.locator('.training-banner .btn-primary').click();
    await expect.poll(gelegt).toBe(i + 1);
  }
  // Der Tutor legt nur RICHTIGE Steine.
  const falsch = await page.evaluate(() => {
    const s = window.__cns.state;
    let n = 0;
    for (let r = 0; r < s.puzzle.rows; r++) for (let c = 0; c < s.puzzle.cols; c++) {
      const v = s.placed[r][c];
      if (v != null && v !== s.puzzle.slots[r][c].v) n++;
    }
    return n;
  });
  expect(falsch).toBe(0);
  expect(fehler).toEqual([]);
});
