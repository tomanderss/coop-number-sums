import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Coop-Robustheit: (1) kein Blackscreen mehr, wenn der Spiel-Screen ohne Brett
// erreicht wird / ein kaputtes INIT eintrifft, (2) Coop-Offline-Rettung: das
// Brett wird als eigenständiges Solo-Spiel weitergespielt/gespeichert,
// (3) Tipp-Indikator (drei Punkte) am Chat-Button + im Chat.
const PUZZLE = (difficulty) => ({
  rows: 4, cols: 4,
  rowTargets: [1, 1, 1, 1], colTargets: [1, 1, 1, 1],
  values: Array.from({ length: 4 }, () => Array(4).fill(1)),
  solution: Array.from({ length: 4 }, () => Array(4).fill(true)),
  regions: [], difficulty,
});

async function asGuestInGame(page) {
  await page.evaluate((p) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'Hosti', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'g1', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now() - 5000, lives: 3, maxLives: 3 });
  }, PUZZLE('sehrleicht'));
  await page.waitForSelector('.screen.game .board');
}

test.describe('coop robustness', () => {
  test('game screen without a board shows the recovery screen instead of a black screen', async ({ page }) => {
    await gotoApp(page);
    // Kaputter Zustand direkt erzwingen: Spiel-Screen ohne Puzzle.
    await page.evaluate(() => { const s = window.__cns.state; s.puzzle = null; s.screen = 'game'; });
    await expect(page.locator('.game-recover')).toBeVisible();
    // Die App LEBT: der Ausweg-Knopf führt zurück ins Menü.
    await page.locator('.game-recover .btn-ghost').click();
    await page.waitForSelector('.screen.home');
  });

  test('an INIT with a broken puzzle is rejected instead of half-loading (no crash)', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
      // Puzzle ohne values/solution → früher Crash mitten im Laden.
      window.__cns.handleCoopMsg({ type: 'init', gameId: 'bad', running: true, puzzle: { rows: 4, cols: 4 }, startTime: Date.now() });
    });
    // Kein Brett geladen, Screen nicht gewechselt, App reagiert weiter.
    expect(await page.evaluate(() => window.__cns.state.puzzle)).toBe(null);
    expect(await page.evaluate(() => window.__cns.state.screen)).not.toBe('game');
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  test('a resync request makes the host re-broadcast the running round', async ({ page }) => {
    await gotoApp(page);
    // Host mit laufender Runde simulieren; Coop.send ist ohne Firebase ein No-op,
    // daher prüfen wir den Handler-Pfad über den Log-Eintrag.
    await page.evaluate((p) => {
      const s = window.__cns.state;
      s.coop.active = true; s.coop.role = 'host'; s.coop.myId = 'me'; s.coop.awaitingStart = false;
      s.coop.players = [{ id: 'me', name: 'Ich' }, { id: 'g1', name: 'Gast' }];
      window.__cns.handleCoopMsg({ type: 'init', gameId: 'g1', running: true, puzzle: p, marks: null, markedBy: null, startTime: Date.now() - 1000, lives: 3, maxLives: 3 });
      // Als Host betrachten (der INIT-Handler setzt guest-typische Flags zurück).
      s.coop.role = 'host';
      window.__cns.handleCoopMsg({ type: 'resync', author: 'g1' });
    }, PUZZLE('sehrleicht'));
    const hasLog = await page.evaluate(() => JSON.parse(localStorage.getItem('cns_debuglog') || '[]').some((e) => String(e.message || '').includes('RESYNC-Anfrage')));
    expect(hasLog).toBe(true);
  });

  test('coop offline: "continue alone" converts the board into a saved standalone solo game', async ({ page }) => {
    await gotoApp(page);
    await asGuestInGame(page);
    // Ein paar Partner-Züge, dann Verbindung tot.
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'move', r: 0, c: 0, mark: 'kept', from: 'host' });
      window.__cns.state.coop.online = false;
    });
    // Pausenmenü zeigt die Rettung.
    await page.locator('.game-top .icon-btn:not(.chat-btn)').first().click();
    await page.waitForSelector('.pause-overlay');
    const btn = page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'Allein weiterspielen' });
    await expect(btn).toBeVisible();
    await btn.click();
    // Jetzt eigenständiges Solo-Spiel: Coop aus, Solo-Slot, Marks gehören „mir".
    await page.waitForFunction(() => !window.__cns.state.coop.active && window.__cns.state.saveSlot === 'solo');
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
    expect(await page.evaluate(() => window.__cns.state.markedBy[0][0])).toBe('local');
    // Persistiert im SOLO-Slot (Fortsetzen nach App-Neustart möglich).
    expect(await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('cns_active_game') || 'null'); return g && g.puzzle ? g.puzzle.rows : null; })).toBe(4);
  });

  test('coop offline: leaving to the menu automatically rescues the board as a solo save', async ({ page }) => {
    await gotoApp(page);
    await asGuestInGame(page);
    await page.evaluate(() => { window.__cns.state.coop.online = false; });
    // Pausieren → Zum Menü (ohne explizite Rettung).
    await page.locator('.game-top .icon-btn:not(.chat-btn)').first().click();
    await page.locator('.pause-overlay').getByText('Zum Menü').click();
    await page.waitForSelector('.screen.home');
    // Automatisch als Solo gerettet: Fortsetzen-Knopf da, Coop-Slot leer.
    expect(await page.evaluate(() => !!window.__cns.state.resumeAvailable)).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cns_active_game_coop') || 'null'))).toBe(null);
  });

  test('typing indicator: dots appear on the chat button and as a bubble in the chat', async ({ page }) => {
    await gotoApp(page);
    await asGuestInGame(page);
    // Mitspieler tippt (Transport-Callback simuliert).
    await page.evaluate(() => { window.__cns.state.chat.typingUids = ['host']; });
    await expect(page.locator('.chat-btn .chat-typing-dots')).toBeVisible();
    // Im Chat: Tipp-Blase mit Name in Spielerfarbe.
    await page.locator('.chat-btn').click();
    await expect(page.locator('.chat-typing-row .chat-typing-bubble')).toBeVisible();
    await expect(page.locator('.chat-typing-row .chat-name')).toHaveText('Hosti');
    // Tippen endet → Punkte verschwinden überall.
    await page.evaluate(() => { window.__cns.state.chat.typingUids = []; });
    await expect(page.locator('.chat-typing-row')).toHaveCount(0);
  });

  // Redesign des Ergebnis-Screens: selbst der VOLLSTE Fall (Coop-Endlos-Sieg,
  // 4 Spieler mit Verteilungs-Zeilen, Münzen + Multiplikator + Streak-Bonus,
  // Perfekt- + Bestzeit-Badge, Leben-Zeile) passt KOMPLETT auf den Bildschirm.
  test('the fullest possible win card (coop endless, 4 players, all extras) fits the viewport', async ({ page }) => {
    await gotoApp(page);
    await asGuestInGame(page);
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.coop.players = [
        { id: 'host', name: 'Hosti', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' },
        { id: 'p3', name: 'Spielerin Drei', color: '#7bd389' }, { id: 'p4', name: 'Vierter', color: '#e5b567' },
      ];
      // Züge auf alle vier verteilen, damit die Verteilung 4 Zeilen hat.
      const ids = ['host', 'me', 'p3', 'p4'];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { s.marks[r][c] = 'kept'; s.markedBy[r][c] = ids[(r * 4 + c) % 4]; }
      s.coop.mistakesByPlayer = { host: 1, me: 0, p3: 2, p4: 0 };
      s.endless.active = true; s.endless.coop = true; s.endless.score = 7;
      s.lives = 1; s.maxLives = 3; s.coop.lifeLossBy = ['host', 'p3', null];
      s.lastCoinReward = 264; s.lastCoinMult = 4; s.lastStreakUsed = 30;
      s.perfectWin = true; s.newHighscore = true;
      s.status = 'won';
    });
    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.result-card.win .perf-line')).toHaveCount(4);
    await expect(page.locator('.result-card.win .perf-stack')).toBeVisible();
    await expect(page.locator('.result-card.win .coin-reward')).toBeVisible();
    await expect(page.locator('.result-card.win .endless-lives-row')).toBeVisible();
    // Kernforderung: Karte ragt weder oben noch unten raus.
    const card = await page.locator('.result-card.win').boundingBox();
    const viewport = page.viewportSize();
    expect(card.height).toBeLessThanOrEqual(viewport.height - 20);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(viewport.height);
  });
});
