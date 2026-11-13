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

// „Hilfe holen": ein Story-Level wird über „Mitspieler einladen" zum Coop-Spiel —
// der Freund spielt GENAU dieses Level mit, gemeinsam gelöst gibt es 1 Stern.
test.describe('Story: Hilfe holen', () => {
  test('Story-Level → Coop, Gast sieht das Level, Sieg zählt mit 1 Stern', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .story-btn').click();
    await page.locator('.story-tile[data-level="1"]').click();
    await page.waitForFunction(() => window.__cns.state.screen === 'game' && window.__cns.state.story);
    await expect(page.locator('.meta-chips .story-chip')).toContainText('Level 1');
    await page.locator('.game-top .icon-btn').first().click();   // Pause
    await expect(page.locator('.pause-overlay .btn', { hasText: 'Mitspieler einladen' })).toBeVisible();
    await page.evaluate(() => {
      window.__cns.state.settings.coopName = 'Tom';
      window.__cns.onSoloInviteRoomOpen('fake-me', '123456');
      window.__cns.onSoloInviteJoin('fake-guest', { name: 'Mara', color: '#f00' });
    });
    const s = await page.evaluate(() => ({ slot: window.__cns.state.saveSlot, helped: window.__cns.state.story.helped, coop: window.__cns.state.coop.active }));
    expect(s).toEqual({ slot: 'coop', helped: true, coop: true });
    expect(await page.evaluate(() => localStorage.getItem('cns_story_run'))).toBeNull();
    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.storyResult);
    expect(await page.evaluate(() => window.__cns.state.storyResult.stars)).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_story')).numbersums[1].s)).toBe(1);
    // Allein noch einmal gelöst, zählen die besseren Sterne.
    expect(await page.evaluate(() => localStorage.getItem('cns_active_game'))).toBeNull();
  });

  test('der Gast sieht, welches Story-Level er mitspielt', async ({ page }) => {
    await gotoApp(page);
    const puzzle = await page.evaluate(async () => (await (await fetch('data/story/numbersums/00.json')).json()).levels[33]?.puzzle || (await (await fetch('data/story/numbersums/00.json')).json()).levels[0].puzzle);
    await page.evaluate((p) => {
      const s = window.__cns.state;
      s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me'; s.coop.hostId = 'host';
      s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
      window.__cns.handleCoopMsg({ type: 'init', author: 'host', gameId: 'g-story', running: true, puzzle: p, startTime: Date.now(), story: { key: 'numbersums', level: 34 } }, '-K1');
    }, puzzle);
    await page.waitForFunction(() => window.__cns.state.screen === 'game' && window.__cns.state.puzzle);
    await expect(page.locator('.meta-chips .story-chip')).toContainText('Level 34');
    // Der Gast bekommt keinen Story-Fortschritt gutgeschrieben (es ist nicht sein Level).
    expect(await page.evaluate(() => window.__cns.state.story)).toBeNull();
  });
});
