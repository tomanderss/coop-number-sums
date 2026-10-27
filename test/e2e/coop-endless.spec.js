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

  test('solving a level shows the win screen and a non-host waits for the host (no Fortsetzen button)', async ({ page }) => {
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
    // NORMALER Gewinn-Screen (status='won') — der Gast wartet auf den Host, kein
    // „Fortsetzen"-Knopf, kein Ergebnis-Screen (Lauf läuft weiter).
    await page.waitForFunction(() => window.__cns.state.status === 'won');
    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.endless.score)).toBe(1);
    await expect(page.locator('.result-card .btn-primary')).toHaveCount(0);
    await expect(page.locator('.endless-lives-row')).toBeVisible();
    expect(await page.evaluate(() => !!window.__cns.state.endlessSummary)).toBe(false);

    // Host schickt Level 2 → Gast steigt ein (status='playing', Level 2).
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl2', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 3, maxLives: 3, endless: true, endlessLevel: 2 }), PUZZLE('leicht'));
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(2);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  });

  // Regression aus einem echten Diagnoseprotokoll: der Spieler hatte einen EIGENEN
  // Solo-Endlos-Lauf auf Level 5 offen, trat der Coop-Endlos-Runde einer Freundin
  // bei und verließ sie wieder — danach war sein eigener, völlig unbeteiligter Lauf
  // verschwunden. Ursache: endlessAbort() räumte den Fortsetzen-Slot bedingungslos,
  // obwohl ein Coop-Endlos-Lauf dort nie liegt (Live-Session). endlessCoopGameOver
  // fasst den Slot aus genau diesem Grund nicht an.
  test('das Verlassen einer Coop-Endlos-Runde loescht NICHT den eigenen Solo-Endlos-Stand', async ({ page }) => {
    await gotoApp(page);
    // Einen eigenen Solo-Endlos-Stand hinterlegen (wie nach „Endlos fortsetzen").
    await page.evaluate(() => {
      localStorage.setItem('cns_active_game_endless', JSON.stringify({
        ts: Date.now(), pending: true,
        endless: { level: 5, lives: 2, hints: 3, score: 4, bigNumbers: false, accumMs: 123456, coins: 400 },
      }));
    });
    await asGuest(page);
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'cl1', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 3, maxLives: 3, endless: true, endlessLevel: 3 }), PUZZLE('mittel'));
    await page.waitForSelector('.screen.game');
    expect(await page.evaluate(() => window.__cns.state.endless.coop)).toBe(true);

    // Über das Pausenmenü zurück ins Hauptmenü — genau der Weg aus dem Protokoll.
    // Im Multiplayer steht der Chat-Knopf VOR dem Pause-Knopf, daher `.last()`.
    await page.locator('.game-top .icon-btn').last().click();
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await expect(page.locator('.screen.home')).toBeVisible();

    const slot = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_active_game_endless') || 'null'));
    expect(slot, 'der eigene Solo-Endlos-Stand muss den Coop-Abbruch überleben').not.toBeNull();
    expect(slot.endless.level).toBe(5);
  });
});

// ─── Das Fenster ZWISCHEN zwei Leveln ────────────────────────────────────────
// In Coop Math Cross gemeldet (derselbe Code steckte hier): „beim Fortsetzen war der Beitretende nicht mehr im Spiel und beim
// Reconnect-Versuch war er nur in dem Startbildschirm, wo man sich bereit machen
// kann und es ging einfach nicht."
//
// Ursache: nach dem Lösen eines Levels steht der Host auf dem Gewinn-Screen —
// status 'won', awaitingStart false. In diesem Fenster passte KEINE der beiden
// Bedingungen, unter denen der Host einem Gast etwas schickt: weder der laufende
// Rundenstand (verlangt status 'playing') noch das Lobby-INIT (verlangt
// awaitingStart). Eine RESYNC-Anfrage blieb damit vollständig unbeantwortet, und
// da das Fenster bewusst lang ist (es wartet auf den Host), ist es genau das
// Fenster, in dem ein Handy in den Hintergrund geht und die Verbindung abreisst.
test.describe('Coop-Endlos zwischen zwei Leveln', () => {
  async function alsHostZwischenLeveln(page) {
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.coop.active = true; s.coop.role = 'host'; s.coop.myId = 'host';
      s.coop.players = [{ id: 'host', name: 'H', color: '#e5679a' }, { id: 'gast', name: 'G', color: '#67a3e5' }];
      s.coop.awaitingStart = false;
      s.coop.lifeLossBy = ['gast'];
      s.endless = { active: true, coop: true, advancing: false, level: 3, lives: 2, score: 2, coins: 40, best: 0, accumMs: 90000 };
      s.status = 'won';           // Level-Gewinn-Screen: wartet auf „Fortsetzen"
      s.endlessSummary = null;
      window.__cns.clearSentLog();
    });
  }

  test('der Host beantwortet eine RESYNC-Anfrage zwischen zwei Leveln', async ({ page }) => {
    await gotoApp(page);
    // Ein Brett muss liegen — der RESYNC-Zweig verlangt state.puzzle (das gerade
    // geloeste Level). Ohne Brett griffe schon die aeussere Bedingung nicht.
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl3', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 2, maxLives: 3, endless: true, endlessLevel: 3 }), PUZZLE('sehrleicht'));
    await page.waitForSelector('.screen.game');
    await alsHostZwischenLeveln(page);

    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'resync', author: 'gast' }));
    const typen = await page.evaluate(() => window.__cns.sentLog().map((e) => e.type));
    expect(typen, 'der Host schickt den Warte-Stand statt zu schweigen').toContain('endlessWait');
  });

  test('ein neu registrierter Spieler bekommt zwischen zwei Leveln den Warte-Stand', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl3', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 2, maxLives: 3, endless: true, endlessLevel: 3 }), PUZZLE('sehrleicht'));
    await page.waitForSelector('.screen.game');
    await alsHostZwischenLeveln(page);

    // Rueckkehrer meldet sich (IDENTITY → hostRegisterPlayer).
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'identity', author: 'neu', name: 'N', color: '#7ad17a' }));
    const typen = await page.evaluate(() => window.__cns.sentLog().map((e) => e.type));
    expect(typen, 'der Rueckkehrer bekommt den Warte-Stand').toContain('endlessWait');
  });

  test('der Warte-Stand holt einen Gast aus der Bereit-Lobby und das naechste Level startet ihn', async ({ page }) => {
    await gotoApp(page);
    await asGuest(page);
    // Ausgangslage: der Gast haengt nach einem Reconnect in der Bereit-Lobby,
    // ohne Brett — genau der gemeldete Zustand.
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.coop.awaitingStart = true;
      s.puzzle = null;
    });

    await page.evaluate(() => window.__cns.handleCoopMsg({
      type: 'endlessWait', author: 'host', endlessLevel: 3, lives: 2, maxLives: 3,
      score: 2, accumMs: 90000, lifeLossBy: ['gast', ''],
    }));

    expect(await page.evaluate(() => window.__cns.state.coop.awaitingStart), 'raus aus der Bereit-Lobby').toBe(false);
    expect(await page.evaluate(() => window.__cns.state.coop.endlessWaiting)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(3);
    expect(await page.evaluate(() => window.__cns.state.endless.lives)).toBe(2);
    expect(await page.evaluate(() => window.__cns.state.endless.accumMs), 'die Gesamtzeit des Laufs bleibt erhalten').toBe(90000);
    await expect(page.locator('.game-recover')).toBeVisible();
    await expect(page.locator('.game-recover .loading-card p')).toContainText('Level 3');

    // Der Host drueckt „Fortsetzen" → Level 4 kommt als laufendes INIT.
    await page.evaluate((p) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'lvl4', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now(), lives: 2, maxLives: 3, endless: true, endlessLevel: 4 }), PUZZLE('leicht'));
    expect(await page.evaluate(() => window.__cns.state.coop.endlessWaiting), 'das Warten ist vorbei').toBe(false);
    expect(await page.evaluate(() => window.__cns.state.endless.level)).toBe(4);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
    await expect(page.locator('.board')).toBeVisible();
  });
});
