import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle, dismissStreakModal, commitMistakes } from './helpers.js';

// Story-Modus: 500 feste Level je Spiel, für alle gleich (data/story/…).
test.describe('Story-Modus', () => {
  test('Level 1 spielen, Sterne bekommen, Level 2 wird frei, weiter zum nächsten', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .story-btn').click();
    await expect(page.locator('.screen.story-screen')).toBeVisible();
    await expect(page.locator('.story-tile[data-level="1"]')).toHaveClass(/next/);
    await expect(page.locator('.story-tile[data-level="2"]')).toBeDisabled();

    await page.locator('.story-tile[data-level="1"]').click();
    await page.waitForFunction(() => window.__cns.state.screen === 'game' && window.__cns.state.puzzle && window.__cns.state.story);
    expect(await page.evaluate(() => window.__cns.state.story.level)).toBe(1);
    // Level 1 ist für alle dasselbe Rätsel (aus den Daten, nicht vom Generator).
    const data = await page.evaluate(async () => (await (await fetch('data/story/numbersums/00.json')).json()).levels[0].puzzle);
    expect(await page.evaluate(() => JSON.stringify(window.__cns.state.puzzle.values))).toBe(JSON.stringify(data.values));

    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    await page.waitForFunction(() => window.__cns.state.storyResult);
    expect(await page.evaluate(() => window.__cns.state.storyResult.stars)).toBe(3);
    await dismissStreakModal(page);
    await expect(page.locator('.story-result .sr-star.on')).toHaveCount(3);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_story')).numbersums[1].s)).toBe(3);

    await page.locator('.result-card .story-next').click();
    await page.waitForFunction(() => window.__cns.state.story && window.__cns.state.story.level === 2 && window.__cns.state.status === 'playing');
  });

  test('Fehler kosten Sterne; ein angefangenes Level ist fortsetzbar', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .story-btn').click();
    await page.locator('.story-tile[data-level="1"]').click();
    await page.waitForFunction(() => window.__cns.state.screen === 'game' && window.__cns.state.story);
    await commitMistakes(page, 1);
    // Verlassen → im Story-Screen „Weiter: Level 1".
    await page.evaluate(() => window.__cns.quitToHome());
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_story_run')).level)).toBe(1);
    await page.locator('.home-actions .story-btn').click();
    await expect(page.locator('.story-resume')).toBeVisible();
    await page.locator('.story-resume').click();
    await page.waitForFunction(() => window.__cns.state.story && window.__cns.state.status === 'playing');
    expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(1);
    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.storyResult);
    expect(await page.evaluate(() => window.__cns.state.storyResult.stars)).toBe(2);
    // Ein Story-Level landet nicht im normalen Solo-Fortsetzen.
    expect(await page.evaluate(() => localStorage.getItem('cns_active_game'))).toBeNull();
  });

  test('Mix-Story: das Spiel des Levels kommt aus den Daten', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cns_mix_on', 'true'));
    await gotoApp(page);
    await page.locator('.home-mix .story-btn').click();
    await expect(page.locator('.screen.story-screen')).toBeVisible();
    const game = await page.evaluate(async () => (await (await fetch('data/story/mix/00.json')).json()).levels[0].game);
    await page.locator('.story-tile[data-level="1"]').click();
    await page.waitForFunction(() => window.__cns.state.screen === 'game' && window.__cns.state.story);
    expect(await page.evaluate(() => window.__cns.gameId)).toBe(game);
    expect(await page.evaluate(() => window.__cns.state.story.key)).toBe('mix');
  });
});
