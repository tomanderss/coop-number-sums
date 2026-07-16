import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Coop-Endlos aus Gast-Sicht (host-autoritativ): der Host schickt je Level ein
// laufendes INIT mit endless-Marker + geteilten Rest-Leben; das Lösen erkennt der
// Gast über sein Brett, das Leben-Aus über die MISTAKE-Sync. Reales 2-Client-
// Firebase testet die Suite bewusst nicht — wir simulieren die Events via
// window.__cns.handleCoopMsg (wie coop.spec.js).
const PUZZLE = (difficulty) => ({
  rows: 4, cols: 4,
  rowTargets: [1, 1, 1, 1], colTargets: [1, 1, 1, 1],
  values: Array.from({ length: 4 }, () => Array(4).fill(1)),
  solution: Array.from({ length: 4 }, () => Array(4).fill(true)),
  regions: [], difficulty,
});

async function asGuest(page) {
  await page.evaluate(() => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
  });
}

test.describe('coop endless climb', () => {
  test('a guest joins an endless level, the level chip shows, and 0 shared lives ends the run', async ({ page }) => {
    await gotoApp(page);
    await asGuest(page);
    // Level 1 als laufendes Endlos-INIT (3 geteilte Leben).
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl1', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now() - 1000, lives: 3, maxLives: 3, endless: true, endlessLevel: 1 }), PUZZLE('sehrleicht'));
    await page.waitForSelector('.screen.game');
    expect(await page.evaluate(() => window.__cns.state.endless.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.coop)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.lives)).toBe(3);
    await expect(page.locator('.hud-item.endless-lvl')).toBeVisible();

    // Host schaltet auf Level 2 weiter (frische gameId, 2 Rest-Leben).
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl2', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 2, maxLives: 3, endless: true, endlessLevel: 2 }), PUZZLE('leicht'));
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(2);
    expect(await page.evaluate(() => window.__cns.state.lives)).toBe(2);

    // Geteilte Leben via Partner-Fehler aufbrauchen → Lauf endet, Coop-Ergebnis.
    await page.evaluate(() => { for (let i = 0; i < 2; i++) window.__cns.handleCoopMsg({ type: 'mistake', by: 'host', n: 1 }); });
    await expect(page.locator('.endless-reached')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.endlessSummary.coop)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endlessSummary.score)).toBe(1); // Level 1 geschafft
    expect(await page.evaluate(() => window.__cns.state.stats.endlessCoopBest)).toBe(1);
    // Kein „Neues Spiel" im Coop-Ergebnis (nur Zum Menü).
    await expect(page.locator('.result-card .btn-primary')).toHaveCount(0);
  });

  test('solving a level makes a non-host wait for the next INIT (no local generation)', async ({ page }) => {
    await gotoApp(page);
    await asGuest(page);
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl1', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now() - 1000, lives: 3, maxLives: 3, endless: true, endlessLevel: 1 }), PUZZLE('sehrleicht'));
    await page.waitForSelector('.screen.game');
    // Brett lösen (alle Zellen behalten = Lösung all-true).
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      state.tool = 'pen';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) onCellTap(r, c);
    });
    // Gast steigt NICHT selbst auf: advancing=true, „Level geschafft"-Einblendung, wartet.
    expect(await page.evaluate(() => window.__cns.state.endless.advancing)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.score)).toBe(1);
    await expect(page.locator('.endless-flash')).toBeVisible();
    // Kein Ergebnis-Screen (Lauf läuft weiter), kein Sieg-Screen.
    expect(await page.evaluate(() => !!window.__cns.state.endlessSummary)).toBe(false);
    expect(await page.evaluate(() => window.__cns.state.status)).not.toBe('won');

    // Host schickt Level 2 → Gast steigt ein, advancing zurückgesetzt.
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl2', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 3, maxLives: 3, endless: true, endlessLevel: 2 }), PUZZLE('leicht'));
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(2);
    expect(await page.evaluate(() => window.__cns.state.endless.advancing)).toBe(false);
  });
});
