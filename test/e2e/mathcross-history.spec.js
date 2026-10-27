import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, dismissStreakModal, commitMistakes } from './mathcross-helpers.js';

// home-grid now only holds stats/history (settings is a top-right gear icon,
// howto is a top-left "?" icon, changelog moved into settings) — see js/app.js.
const historyBtn = (page) => page.locator('.home-grid .btn-ghost').nth(1);

test.describe('history', () => {
  test('shows an empty state before any puzzle has been solved', async ({ page }) => {
    await gotoApp(page);
    await historyBtn(page).click();
    await expect(page.locator('.screen.history')).toBeVisible();
    await expect(page.locator('.history-body .empty')).toBeVisible();
    await expect(page.locator('.history-row')).toHaveCount(0);
  });

  test('records a solved puzzle and offers to view or replay it', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    const seedBefore = await page.evaluate(() => window.__cns.state.puzzle.seed);
    await solveActivePuzzle(page);
    await dismissStreakModal(page);
    await expect(page.locator('.result-card.win')).toBeVisible();
    await page.locator('.result-card.win .btn-ghost').last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await historyBtn(page).click();
    await expect(page.locator('.screen.history')).toBeVisible();
    const row = page.locator('.history-row').first();
    await expect(row).toBeVisible();
    await expect(row.locator('.history-outcome .ico-trophy')).toBeVisible();

    // "Ansehen" opens a read-only board overlay without touching the live game state
    // (state.puzzle/state.status, which quitToHome/goNextPuzzle rely on for resuming).
    await row.locator('.btn-ghost', { hasText: 'Ansehen' }).click();
    await expect(page.locator('.modal-history')).toBeVisible();
    const liveState = await page.evaluate(() => ({ puzzle: window.__cns.state.puzzle, status: window.__cns.state.status }));
    expect(liveState.puzzle.seed).toBe(seedBefore);
    expect(liveState.status).toBe('won');
    await page.locator('.modal-history .btn-primary').click();
    await expect(page.locator('.modal-history')).not.toBeVisible();

    // "Erneut spielen" regenerates the exact same puzzle from the stored seed.
    await row.locator('.btn-primary', { hasText: 'Erneut spielen' }).click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    const seedAfter = await page.evaluate(() => window.__cns.state.puzzle.seed);
    expect(seedAfter).toBe(seedBefore);
  });

  test('a lost puzzle is recorded with the lost outcome', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await page.evaluate(() => { window.__cns.state.lives = 1; window.__cns.state.maxLives = 1; window.__cns.state.settings.livesEnabled = true; });
    // A single mistake with 1 life left immediately ends the round as lost.
    await commitMistakes(page, 1);
    await dismissStreakModal(page);
    await expect(page.locator('.result-card.lose')).toBeVisible();
    await page.locator('.result-card.lose .btn-ghost', { hasText: 'Menü' }).click();
    await expect(page.locator('.screen.home')).toBeVisible();

    await historyBtn(page).click();
    const row = page.locator('.history-row').first();
    await expect(row.locator('.history-outcome .ico-heart-broken')).toBeVisible();
  });
});

// Regression: ein bereits GELÖSTES Brett landete (über einen veralteten Cloud-
// Stand/Session) im Fortsetzen-Slot und wurde als „Spiel fortsetzen" angeboten
// — angetippt lud es ein 100%-Brett, das keine Interaktion mehr zuließ und
// keinen Sieg auslöste. refreshResume() verwirft solche Stände beim Start.
test.describe('resume', () => {
  test('a fully-solved saved game is never offered as resume and is cleared on start', async ({ page }) => {
    await page.addInitScript(() => {
      // 3 + 4 = 7 mit beiden Operanden als Lücke — komplett gelegt.
      const puzzle = {
        rows: 1, cols: 3,
        slots: [[{ v: 3, given: false }, { v: 4, given: false }, { v: 7, given: true }]],
        equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
        tray: [3, 4], difficulty: 'leicht', seed: 1,
      };
      const solved = {
        puzzle,
        placed: [[3, 4, null]],
        tray: [{ v: 3, used: true }, { v: 4, used: true }],
        markedBy: [[null, null, null]],
        elapsed: 5000, ts: Date.now(),
      };
      localStorage.setItem('cmc_active_game', JSON.stringify(solved));
    });
    await gotoApp(page);
    // Kein Fortsetzen-Button, und der gelöste Slot wurde aufgeräumt.
    await expect(page.locator('.btn-resume')).toHaveCount(0);
    expect(await page.evaluate(() => window.__cns.state.resumeAvailable)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('cmc_active_game'))).toBeNull();
  });

  test('an unsolved saved game IS offered as resume', async ({ page }) => {
    await page.addInitScript(() => {
      const puzzle = {
        rows: 1, cols: 3,
        slots: [[{ v: 3, given: false }, { v: 4, given: false }, { v: 7, given: true }]],
        equations: [{ dir: 'h', r: 0, c: 0, n: 2, ops: ['+'] }],
        tray: [3, 4], difficulty: 'leicht', seed: 1,
      };
      const unsolved = {
        puzzle,
        placed: [[null, null, null]],
        tray: [{ v: 3, used: false }, { v: 4, used: false }],
        markedBy: [[null, null, null]],
        elapsed: 5000, ts: Date.now(),
      };
      localStorage.setItem('cmc_active_game', JSON.stringify(unsolved));
    });
    await gotoApp(page);
    await expect(page.locator('.btn-resume')).toBeVisible();
  });
});

// Gemeldet: „wenn nur ein Spielstand da ist, sehe ich die Flaeche zum Verwalten
// nicht" — und damit gibt es keinen Weg, ihn zu loeschen. Aktivspiel-Slot und
// Bibliothek sind zwei getrennte Quellen; laeuft die Bibliothek leer, waehrend
// der Slot noch einen Stand haelt, bot der Knopf nichts an. refreshResume traegt
// so einen Stand jetzt nach.
test.describe('Fortsetzbares ist immer verwaltbar', () => {
  test('ein Stand nur im Aktivspiel-Slot taucht in der Bibliothek auf', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await page.evaluate(() => window.__cns.placeOne());
    await page.waitForTimeout(600);

    // Die Bibliothek leeren, OHNE dass die App sie gleich wieder fuellt: beim
    // Neuladen schreibt pagehide zuerst den laufenden Stand zurueck. Das Leeren
    // muss also NACH pagehide und VOR dem App-Start passieren — genau dafuer ist
    // addInitScript da. So bootet die App mit vollem Aktivspiel-Slot und leerer
    // Bibliothek: die Lage, in der der Verwalten-Knopf verschwand.
    await page.addInitScript(() => localStorage.setItem('cmc_saves', '[]'));
    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => window.__cns && window.__cns.state.saves);

    const st = await page.evaluate(() => ({
      saves: window.__cns.state.saves.length,
      resume: !!window.__cns.state.resumeAvailable,
    }));
    expect(st.resume, 'der Stand wird weiterhin zum Fortsetzen angeboten').toBe(true);
    expect(st.saves, 'und steht dafuer auch in der Bibliothek').toBeGreaterThan(0);
    await expect(page.locator('.saves-expand'), 'der Zugang zum Verwalten ist da').toHaveCount(1);
  });

  test('ein geloeschter Stand kommt ueber diesen Weg NICHT zurueck', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await page.evaluate(() => window.__cns.placeOne());
    await page.waitForTimeout(600);
    const id = await page.evaluate(() => window.__cns.state.gameId);

    // Loeschen wie im Bibliotheks-Dialog: Grabstein + Aktivspiel-Slot raeumen.
    await page.evaluate((gid) => {
      localStorage.setItem('cmc_saves_gone', JSON.stringify({ [gid]: Date.now() }));
    }, id);
    // Wie oben: erst nach pagehide leeren, sonst schreibt die App beides zurueck.
    await page.addInitScript(() => {
      localStorage.setItem('cmc_saves', '[]');
      localStorage.setItem('cmc_active_game', JSON.stringify(null));
    });
    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => window.__cns && window.__cns.state.saves);
    expect(await page.evaluate(() => window.__cns.state.saves.length), 'bleibt geloescht').toBe(0);
  });
});
