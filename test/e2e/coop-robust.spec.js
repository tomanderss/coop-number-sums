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
});
