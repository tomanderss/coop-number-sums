import { test, expect } from '@playwright/test';
import { gotoApp, solveActivePuzzle } from './helpers.js';

// KI-Duell: ein vollwertiges Race-Match gegen einen lokalen Bot — ohne Firebase,
// ohne Lobby, damit es auch offline läuft. Geprüft wird der komplette Weg
// (Einstieg → Setup → Match → Ergebnis) sowie beide Ausgänge und die Buchung in
// die EIGENE Statistik-Kategorie 'ai'.
async function openAiSetup(page) {
  await gotoApp(page);
  await page.locator('.race-btn').click();
  await page.locator('.modal-bg .btn-ghost', { hasText: 'Duell gegen KI' }).click();
  await page.waitForSelector('.screen.setup .ai-setup');
}

// Startet ein KI-Duell auf dem kleinsten Brett. `targetMs` überschreibt die
// Zielzeit des Bots, damit ein Test ihn gezielt schnell oder langsam machen kann.
async function startDuel(page, { difficulty = 'sehrleicht', level = 'medium' } = {}) {
  await page.evaluate(([d, lv]) => {
    window.__cns.state.sel.difficulty = d;
    window.__cns.state.race.aiLevel = lv;
  }, [difficulty, level]);
  await page.locator('.diff-start').click();
  await page.waitForFunction(() => window.__cns.state.puzzle && !window.__cns.state.generating, null, { timeout: 30000 });
}

// Die KOMPLETTE Nachbereitung einer Partie (Statistik, Achievements, Muenzen)
// laeuft in win()/lose() innerhalb von afterPaint — also NACH dem Statuswechsel.
// Auf status==='won'/'lost' zu warten reicht deshalb nicht, um raceStats zu
// lesen; genau daran sind hier schon zwei Tests in CI gescheitert (lokal war es
// immer schnell genug). Immer auf die BUCHUNG selbst warten.
async function waitForAiBooking(page, field) {
  await page.waitForFunction(
    (f) => (window.__cns.state.raceStats?.ai?.[f] || 0) > 0,
    field, { timeout: 15000 });
}

test.describe('KI-Duell', () => {
  test('Einstieg, Setup und Start funktionieren (ohne Lobby, ohne Netz)', async ({ page }) => {
    await openAiSetup(page);
    expect(await page.evaluate(() => window.__cns.state.screen)).toBe('aiduel');
    // Vier feste Stärke-Stufen — bewusst KEIN zusätzlicher Prozent-Regler:
    // innerhalb einer Stufe brachte er keine sinnvolle Unterscheidung.
    await expect(page.locator('.ai-lv')).toHaveCount(4);
    await expect(page.locator('.ai-skill')).toHaveCount(0);
    // Gegner-Auswahl: Standard-Stufen ODER der eigene Klon. Ohne aufgezeichnete
    // Partien ist der Klon gesperrt und zeigt stattdessen den Lernfortschritt.
    await expect(page.locator('.ai-opp')).toHaveCount(2);
    await expect(page.locator('.ai-opp.ai-clone')).toBeDisabled();
    await expect(page.locator('.ai-opp.ai-clone')).toContainText('lernt noch');
    // Die erwartete Gegnerzeit wird angezeigt und ist eine echte Zeit.
    await expect(page.locator('.ai-target')).toContainText(/\d+:\d\d/);

    await startDuel(page);
    const st = await page.evaluate(() => {
      const s = window.__cns.state;
      return { screen: s.screen, ai: s.race.ai, isRace: s.isRaceGame, active: s.race.active, opp: s.race.opponents.length, target: s.race.aiTargetMs };
    });
    expect(st.screen).toBe('game');
    expect(st.ai).toBe(true);
    expect(st.isRace).toBe(true);      // damit alle Duell-Achievements greifen
    expect(st.active).toBe(true);
    expect(st.opp).toBe(1);
    expect(st.target).toBeGreaterThan(0);
  });

  test('die Stärke-Stufe verändert die erwartete Gegnerzeit', async ({ page }) => {
    await openAiSetup(page);
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'mittel'; window.__cns.state.race.aiLevel = 'medium'; });
    await page.waitForTimeout(120);
    const medium = await page.locator('.ai-target').innerText();
    await page.evaluate(() => { window.__cns.state.race.aiLevel = 'brutal'; });
    await page.waitForTimeout(120);
    const brutal = await page.locator('.ai-target').innerText();
    expect(brutal).not.toBe(medium);
  });

  test('der Bot macht Fortschritt und bleibt in der Pause stehen', async ({ page }) => {
    await openAiSetup(page);
    await startDuel(page);
    // Fortschritt: der Bot arbeitet sich sichtbar vor.
    await page.waitForFunction(() => window.__cns.state.race.opponents[0].pct > 0, null, { timeout: 20000 });
    await page.evaluate(() => { window.__cns.state.paused = true; });
    const before = await page.evaluate(() => window.__cns.state.race.opponents[0].pct);
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => window.__cns.state.race.opponents[0].pct);
    // Fairness: solange die eigene Uhr steht, darf der Gegner nicht weiterlaufen.
    expect(after).toBe(before);
    await page.evaluate(() => { window.__cns.state.paused = false; });
  });

  test('selbst lösen → Sieg, Duell-Grafik und Buchung als KI-Duell', async ({ page }) => {
    await openAiSetup(page);
    await startDuel(page);
    await solveActivePuzzle(page);
    await expect(page.locator('.result-card')).toBeVisible();
    await waitForAiBooking(page, 'racesWon');
    const res = await page.evaluate(() => {
      const s = window.__cns.state;
      return { status: s.status, winner: s.race.winner, ai: s.raceStats.ai, human: s.raceStats['1v1'] };
    });
    expect(res.status).toBe('won');
    expect(res.winner).toBe('me');
    // Eigene Kategorie: der Sieg landet in 'ai', NICHT in der Menschen-Bilanz.
    expect(res.ai.racesWon).toBe(1);
    expect(res.ai.racesPlayed).toBe(1);
    expect(res.human.racesPlayed).toBe(0);
    // Die Duell-Grafik zeigt beide Parteien (ich + Bot).
    await expect(page.locator('.duel-graph .duel-row')).toHaveCount(2);
  });

  test('Bot löst zuerst → Niederlage, gebucht als KI-Duell', async ({ page }) => {
    await openAiSetup(page);
    await startDuel(page);
    // Testhaken: den Bot bis 100 % vorspulen statt in Echtzeit zu warten.
    expect(await page.evaluate(() => window.__cns.aiBotFastForward())).toBe(true);
    await page.waitForFunction(() => window.__cns.state.status === 'lost', null, { timeout: 15000 });
    await waitForAiBooking(page, 'racesLost');
    const res = await page.evaluate(() => {
      const s = window.__cns.state;
      return { winner: s.race.winner, endReason: s.race.endReason, ai: s.raceStats.ai, oppPct: s.race.opponents[0].pct };
    });
    expect(res.winner).toBe('opponent');
    expect(res.endReason).toBe('won');
    expect(res.oppPct).toBe(100);
    expect(res.ai.racesLost).toBe(1);
    expect(res.ai.racesPlayed).toBe(1);
    await expect(page.locator('.result-card')).toBeVisible();
    await expect(page.locator('.duel-graph .duel-row')).toHaveCount(2);
  });

  test('Bot verliert alle Leben → er scheidet aus und ich gewinne', async ({ page }) => {
    await openAiSetup(page);
    await startDuel(page);
    expect(await page.evaluate(() => window.__cns.aiBotEliminate())).toBe(true);
    await page.waitForFunction(() => window.__cns.state.status === 'won', null, { timeout: 15000 });
    await waitForAiBooking(page, 'racesWon');
    const res = await page.evaluate(() => {
      const s = window.__cns.state;
      return { winner: s.race.winner, out: s.race.opponents[0].out, ai: s.raceStats.ai };
    });
    expect(res.winner).toBe('me');
    expect(res.out).toBe(true);
    expect(res.ai.racesWon).toBe(1);
  });

  test('KI-Duelle zählen für die Duell-Achievements mit', async ({ page }) => {
    await openAiSetup(page);
    await startDuel(page);
    await solveActivePuzzle(page);
    // Die Achievement-Buchung laeuft in afterPaint NACH dem Statuswechsel — auf
    // status==='won' zu pruefen reicht also nicht (in CI schlug genau das fehl).
    // raceFirstWin verlangt outcome 'won' + isRace; beides gilt im KI-Duell.
    await page.waitForFunction(
      () => !!(window.__cns.state.achievements || {}).raceFirstWin,
      null, { timeout: 15000 });
    const unlocked = await page.evaluate(() => Object.keys(window.__cns.state.achievements || {}));
    expect(unlocked).toContain('raceFirstWin');
  });
});
