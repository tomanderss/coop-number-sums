import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle, dismissStreakModal } from './helpers.js';

test.describe('endless climb', () => {
  test('setup endless toggle starts a run, clearing a level advances, losing shows the summary', async ({ page }) => {
    await gotoApp(page);
    // Home → Setup (direkt). Endlos-Aufstieg ist ein Toggle im Setup.
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    // Endlos-Toggle einschalten (letzter .mode-toggle) → starten.
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await expect(page.locator('.mode-toggle.on')).toBeVisible();

    // „Endlos starten" → direkt im Spiel, Level 1
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.endless.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(1);
    await expect(page.locator('.hud-item.endless-lvl')).toBeVisible();

    // Level 1 lösen → NORMALER Gewinn-Screen mit „Fortsetzen" (kein Auto-Weiter)
    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.endless.score)).toBe(1);
    // KERN: das Level ist ein VOLLWERTIGER Einzelsieg — Zähler + volle Münz-
    // Belohnung (Buchhaltung läuft nach dem ersten Frame → warten).
    await page.waitForFunction(() => (window.__cns.state.stats.won || 0) === 1);
    const diff1 = await page.evaluate(() => window.__cns.state.puzzle.difficulty);
    expect(await page.evaluate((d) => window.__cns.state.stats.byDifficulty[d]?.won || 0, diff1)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.lastCoinReward)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__cns.state.wallet.balance)).toBeGreaterThan(0);
    // Erstes Spiel des Tages → Streak-Feier-Screen wegklicken, dann weiter.
    await dismissStreakModal(page);
    // „Fortsetzen" lädt erst das nächste (schwerere) Level → Level 2
    await page.locator('.result-card .btn-primary').click();
    await page.waitForFunction(() => window.__cns.state.endless.level === 2 && window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');

    // Leben aufbrauchen → Lauf endet, Endlos-Ergebnis-Screen
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      let r = -1, c = -1;
      outer: for (let i = 0; i < p.rows; i++) for (let j = 0; j < p.cols; j++) { if (state.marks[i][j] === 'none') { r = i; c = j; break outer; } }
      state.tool = p.solution[r][c] ? 'eraser' : 'pen'; // absichtlich falsch
      for (let k = 0; k < 8; k++) onCellTap(r, c);
    });
    await expect(page.locator('.endless-reached')).toBeVisible();
    expect(await page.evaluate(() => !!window.__cns.state.endlessSummary)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endlessSummary.score)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.stats.endlessBest)).toBe(1);
    // Das GESCHEITERTE Schluss-Level zählt als individuelle Niederlage; die
    // Summary zeigt die Summe der bereits je Level geflossenen Münzen.
    expect(await page.evaluate(() => window.__cns.state.stats.lost || 0)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.stats.played || 0)).toBe(2);
    expect(await page.evaluate(() => window.__cns.state.endlessSummary.coins)).toBeGreaterThan(0);
    // „Neues Spiel" startet einen frischen Lauf.
    await page.locator('.result-card .btn-primary').click();
    await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
    expect(await page.evaluate(() => window.__cns.state.endless.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(1);
  });

  test('shows a separate total-run timer that accumulates across levels', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // Zwei Timer im HUD: Level-Timer + Gesamt-Timer (Sanduhr).
    await expect(page.locator('.hud-item.timer')).toHaveCount(2);
    await expect(page.locator('.hud-item.timer.total')).toBeVisible();

    // Level 1 mit „verstrichener" Zeit lösen → die Zeit landet im Gesamt-Timer.
    await page.evaluate(() => { window.__cns.state.startTime = Date.now() - 5000; });
    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    const accum1 = await page.evaluate(() => window.__cns.state.endless.accumMs);
    expect(accum1).toBeGreaterThanOrEqual(4000);

    // Nächstes Level: Gesamt-Timer trägt die Zeit von Level 1 WEITER (accumMs bleibt),
    // während der Level-Timer bei 0 neu startet. (Streak-Feier des ersten
    // Tagesspiels vorher wegklicken — sie liegt über dem Fortsetzen-Knopf.)
    await dismissStreakModal(page);
    await page.locator('.result-card .btn-primary').click();
    await page.waitForFunction(() => window.__cns.state.endless.level === 2 && window.__cns.state.puzzle && !window.__cns.state.generating);
    const accum2 = await page.evaluate(() => window.__cns.state.endless.accumMs);
    expect(accum2).toBeGreaterThanOrEqual(accum1);
    expect(await page.evaluate(() => window.__cns.state.elapsed)).toBeLessThan(2000); // Level-Timer frisch
  });

  test('a perfect endless level counts as a FULL individual win (best time, counters, coins)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.endless = true; window.__cns.state.sel.difficulty = 'sehrleicht'; });
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    const diff = await page.evaluate(() => window.__cns.state.puzzle.difficulty);

    // Level fehlerfrei lösen → vollwertiger Einzelsieg (Buchhaltung nach dem 1. Frame).
    await solveActivePuzzle(page);
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    await page.waitForFunction(() => (window.__cns.state.stats.won || 0) === 1);
    // Bestzeit + „Neue Bestzeit!" (perfekt gilt pro Level).
    const best = await page.evaluate((d) => window.__cns.state.stats.byDifficulty[d]?.bestTimeMs, diff);
    expect(best).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__cns.state.newHighscore)).toBe(true);
    // VOLLE Zähler: 1 Sieg global + je Schwierigkeit, 1 gespielt, Zeit-Summe.
    expect(await page.evaluate((d) => window.__cns.state.stats.byDifficulty[d]?.won || 0, diff)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.stats.played || 0)).toBe(1);
    expect(await page.evaluate((d) => window.__cns.state.stats.byDifficulty[d]?.sumTimeMs || 0, diff)).toBeGreaterThan(0);
    // VOLLE Münzbelohnung mit Multiplikatoren (perfekt ×2, Bestzeit ×2 → ≥ ×4).
    expect(await page.evaluate(() => window.__cns.state.lastCoinReward)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__cns.state.lastCoinMult)).toBeGreaterThanOrEqual(4);
    // Der Sieg landet im Verlauf (jedes Level = dokumentiertes Einzelspiel).
    expect(await page.evaluate(() => window.__cns.state.puzzleHistory.length)).toBe(1);
    // „Neue Bestzeit!"-Badge ist im Level-Gewinn-Screen sichtbar.
    await expect(page.locator('.result-card .highscore-badge')).toBeVisible();
  });

  test('old endless runs are credited retroactively as individual games (one-time backfill)', async ({ page }) => {
    // Geldverlauf VOR dem App-Start seeden: zwei alte Endlos-Läufe — einer bis
    // Level 3 (Leben-Aus → zusätzlich 1 Niederlage), einer bis Level 1 abgebrochen.
    await page.addInitScript(() => {
      localStorage.setItem('cns_wallet_log', JSON.stringify([
        { id: 'bk-a', ts: 1000, amount: 60, reason: 'endless', balance: 60, meta: { mode: 'endless', score: 3 } },
        { id: 'bk-b', ts: 2000, amount: 20, reason: 'endless', balance: 80, meta: { mode: 'endless', score: 1, aborted: true } },
      ]));
    });
    await gotoApp(page);
    // 4 nachgebuchte Siege (3+1), 1 Niederlage (nur der nicht abgebrochene Lauf).
    await page.waitForFunction(() => (window.__cns.state.stats.won || 0) === 4);
    expect(await page.evaluate(() => window.__cns.state.stats.lost || 0)).toBe(1);
    expect(await page.evaluate(() => window.__cns.state.stats.played || 0)).toBe(5);
    // Je Schwierigkeit entlang der Leiter: Level 1 zweimal (beide Läufe), Level 2/3 je einmal.
    const ladder = await page.evaluate(() => {
      const by = window.__cns.state.stats.byDifficulty;
      return Object.entries(by).filter(([, v]) => (v.won || 0) + (v.lost || 0) > 0).map(([id, v]) => [id, v.won || 0, v.lost || 0]);
    });
    expect(ladder.length).toBe(4); // 3 Sieg-Stufen + 1 Niederlage-Stufe
    // Flag verhindert Doppel-Buchung: Neustart der App ändert NICHTS.
    await page.reload();
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => window.__cns && window.__cns.state.stats);
    expect(await page.evaluate(() => window.__cns.state.stats.won || 0)).toBe(4);
    expect(await page.evaluate(() => window.__cns.state.stats.played || 0)).toBe(5);
  });

  test('endless never leaves a solo resume game behind', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await page.locator('.diff-start').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // saveSlot ist 'endless' (nicht 'solo') und es liegt kein Solo-Fortsetzen-Stand vor.
    expect(await page.evaluate(() => window.__cns.state.saveSlot)).toBe('endless');
    await page.evaluate(() => window.__cns.state.paused = false);
    await page.evaluate(() => window.__cns.state); // no-op
    expect(await page.evaluate(() => { const g = localStorage.getItem('cns_active_game'); return g && g !== 'null'; })).toBeFalsy();
  });

  test('a solo endless run offers "invite a player" in the pause menu', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.endless = true; });
    await page.locator('.diff-start').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // Einen Zug machen (Status bleibt playing), dann pausieren.
    await page.evaluate(() => { const s = window.__cns.state, p = s.puzzle; s.tool = p.solution[0][0] ? 'pen' : 'eraser'; window.__cns.onCellTap(0, 0); });
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    // „Mitspieler einladen" ist im Endlos-Lauf verfügbar (Live-Umwandlung zu Coop-Endlos).
    await expect(page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'einladen' })).toBeVisible();
  });

  test('a solo endless run can be resumed after leaving to the menu (incl. big numbers)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { const s = window.__cns.state; s.sel.endless = true; s.sel.bigNumbers = true; });
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
    const before = await page.evaluate(() => ({ big: window.__cns.state.puzzle.bigNumbers, seed: window.__cns.state.puzzle.seed, level: window.__cns.state.endless.level }));
    // einen Zug machen, dann pausieren und zum Menü.
    await page.evaluate(() => { const s = window.__cns.state; s.tool = 'pen'; window.__cns.onCellTap(0, 0); });
    await page.locator('.game-top .icon-btn').first().click();
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await page.waitForSelector('.screen.home');
    // Endlos-Fortsetzen-Knopf erscheint und ist klar als Endlos gekennzeichnet
    // (eigene .endless-Klasse + „Endlos"-Ecken-Chip).
    expect(await page.evaluate(() => !!window.__cns.state.resumeAvailableEndless)).toBe(true);
    await expect(page.locator('.resume-row .btn-resume.endless')).toHaveCount(1);
    await expect(page.locator('.resume-row .btn-resume.endless .badge-endless')).toBeVisible();
    // Fortsetzen → derselbe Lauf (Level, Große Zahlen, Seed), Endlos wieder aktiv.
    await page.locator('.resume-row .btn-resume').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating);
    const after = await page.evaluate(() => ({ big: window.__cns.state.puzzle.bigNumbers, seed: window.__cns.state.puzzle.seed, level: window.__cns.state.endless.level, active: window.__cns.state.endless.active }));
    expect(after).toEqual({ big: before.big, seed: before.seed, level: before.level, active: true });
    expect(after.big).toBe(true);
  });
});
