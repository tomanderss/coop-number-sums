import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Regression: nach der Solo→Coop-Umwandlung (jemand ist beigetreten) DARF der
// „Mitspieler einladen"-Knopf im Pausenmenü NICHT verschwinden — der Host muss
// jederzeit weitere Mitspieler holen können, bis der Raum voll ist (4 Spieler).
test.describe('coop invite stays available after first join', () => {
  test('invite button remains in the pause menu once the game is coop (host, room not full)', async ({ page }) => {
    await gotoApp(page);
    // Solo-Spiel starten.
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'sehrleicht'; window.__cns.state.sel.endless = false; });
    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    // Einen Zug machen (Status bleibt playing), dann pausieren.
    await page.evaluate(() => { const s = window.__cns.state, p = s.puzzle; s.tool = p.solution[0][0] ? 'pen' : 'eraser'; window.__cns.onCellTap(0, 0); });
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');

    // Vor der Umwandlung: Einladen-Knopf sichtbar.
    const inviteBtn = page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'einladen' });
    await expect(inviteBtn).toBeVisible();

    // Umwandlung simulieren: laufende Coop-Runde als Host mit EINEM beigetretenen
    // Gast (Raum NICHT voll). Genau der Zustand, in dem der Knopf früher verschwand.
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.coop.active = true;
      s.coop.role = 'host';
      s.coop.myId = 'me';
      s.coop.hostId = 'me';
      s.coop.code = '123456';
      s.coop.awaitingStart = false;
      s.coop.raceMode = false;
      s.coop.ffaMode = false;
      s.coop.players = [{ id: 'me', name: 'Ich' }, { id: 'g1', name: 'Gast' }];
      s.saveSlot = 'coop';
      s.soloInvite = { status: 'converted', code: '123456' };
    });

    // Knopf ist WEITERHIN da (canInviteMore) …
    await expect(inviteBtn).toBeVisible();
    // … und öffnet den Einladungs-Dialog mit dem laufenden Raumcode.
    await inviteBtn.click();
    await expect(page.locator('.modal .coop-code')).toHaveText('123456');
    // Kein „Zurückziehen" mehr in der laufenden Runde, nur Schließen.
    await expect(page.locator('.modal .confirm-actions .btn-ghost')).toHaveCount(0);

    // Raum voll (4 Spieler): einladen geht nicht mehr, der Knopf bleibt aber —
    // der Host kann darüber jemanden AUSLADEN (Nutzerwunsch).
    await page.locator('.modal .confirm-actions .btn-primary').click();
    await page.evaluate(() => {
      window.__cns.state.coop.players = [
        { id: 'me', name: 'Ich' }, { id: 'g1', name: 'A' }, { id: 'g2', name: 'B' }, { id: 'g3', name: 'C' },
      ];
    });
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();
    await expect(page.locator('.modal .ip-kick')).toHaveCount(3);
  });
});

// Nutzerwunsch: „in jedem Modus jemanden einladen können" — auch als Gast, in der
// Warte-Lobby (auch „Jeder gegen jeden"), in der Bereit-Lobby und im Mix.
test.describe('einladen überall, wo es geht', () => {
  async function startSolo(page, diff = 'sehrleicht') {
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate((d) => { window.__cns.state.sel.difficulty = d; window.__cns.state.sel.endless = false; }, diff);
    await page.locator('.diff-start').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating && window.__cns.state.status === 'playing');
  }

  test('auch ein Gast kann im laufenden Coop-Spiel einladen', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    await page.evaluate(() => {
      const s = window.__cns.state;
      Object.assign(s.coop, { active: true, role: 'guest', myId: 'g1', hostId: 'h', code: '654321', awaitingStart: false, raceMode: false, ffaMode: false });
      s.coop.players = [{ id: 'h', name: 'Host' }, { id: 'g1', name: 'Ich' }];
      s.saveSlot = 'coop';
    });
    const inviteBtn = page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'einladen' });
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();
    await expect(page.locator('.modal .coop-code')).toHaveText('654321');
  });

  test('Gast in der Warte-Lobby („Jeder gegen jeden") sieht „Freunde einladen", bis der Raum voll ist', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.screen = 'coop';
      Object.assign(s.coop, { identityConfirmed: true, role: 'guest', myId: 'g1', hostId: 'h', code: '111222', waitingForGuest: true, raceMode: true, ffaMode: true });
      s.coop.players = [{ id: 'h', name: 'Host' }, { id: 'g1', name: 'Ich' }];
    });
    const btn = page.locator('.lobby-invite-btn');
    await expect(btn).toBeVisible();
    await page.evaluate(() => { window.__cns.state.coop.players.push({ id: 'g2', name: 'B' }, { id: 'g3', name: 'C' }); });
    await expect(btn).toHaveCount(0);
  });

  test('Bereit-Lobby im Coop zeigt den Code zum Nachholen, im Duell nicht', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    await page.evaluate(() => {
      const s = window.__cns.state;
      Object.assign(s.coop, { active: true, role: 'host', myId: 'h', hostId: 'h', code: '333444', awaitingStart: true, raceMode: false, ffaMode: false, teamMode: false });
      s.coop.players = [{ id: 'h', name: 'Ich' }, { id: 'g1', name: 'Gast' }];
    });
    await expect(page.locator('.coop-lobby-overlay .ready-invite b')).toHaveText('333444');
    await page.evaluate(() => { const c = window.__cns.state.coop; c.raceMode = true; c.ffaMode = true; });
    await expect(page.locator('.coop-lobby-overlay .ready-invite')).toHaveCount(0);
  });

  test('ein Solo-Mix-Lauf lässt sich zum Coop öffnen', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    // Laufenden Solo-Mix-Lauf vortäuschen (Brett vorhanden, Lauf aktiv).
    await page.evaluate(() => {
      const s = window.__cns.state;
      Object.assign(s.endless, { active: true, coop: false, level: 2, lives: 3, score: 1, mix: { prev: 'numbersums', game: 'numbersums', diff: 'sehrleicht', played: { numbersums: 1 } } });
    });
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    expect(await page.evaluate(() => window.__cns.state.endless.mix && window.__cns.state.coop.active)).toBeFalsy();
    await expect(page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'einladen' })).toBeVisible();
  });
});

// Nutzerwunsch: jederzeit allein weiterspielen (nicht nur offline), Mitspieler
// ein- UND ausladen, Duelle über „Aufgeben" verlassen.
test.describe('allein weiterspielen, ausladen, aufgeben', () => {
  async function startSolo(page) {
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'sehrleicht'; window.__cns.state.sel.endless = false; });
    await page.locator('.diff-start').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating && window.__cns.state.status === 'playing');
  }
  const asCoop = (page, role) => page.evaluate((role) => {
    const s = window.__cns.state;
    Object.assign(s.coop, { active: true, role, myId: role === 'host' ? 'h' : 'g1', hostId: 'h', code: '777888', awaitingStart: false, raceMode: false, ffaMode: false, teamMode: false, online: true });
    s.coop.players = [{ id: 'h', name: 'Host', color: '#e5679a' }, { id: 'g1', name: 'Gast', color: '#67a3e5' }];
    s.saveSlot = 'coop';
  }, role);

  test('auch MIT Verbindung: „Allein weiterspielen" macht aus der Coop-Runde ein Solo-Spiel, ohne Toast', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    await asCoop(page, 'guest');
    await page.locator('.pause-overlay .continue-solo-btn').click();
    await page.waitForFunction(() => !window.__cns.state.coop.active && window.__cns.state.saveSlot === 'solo');
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('Host lädt einen Mitspieler aus', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    await asCoop(page, 'host');
    await page.evaluate(() => window.__cns.clearSentLog && window.__cns.clearSentLog());
    await page.locator('.pause-overlay .btn-ghost').filter({ hasText: 'einladen' }).click();
    await expect(page.locator('.invite-player')).toHaveCount(2);
    await expect(page.locator('.ip-kick')).toHaveCount(1);   // nur der Gast, nicht man selbst
    await page.locator('.ip-kick').click();
    await page.locator('.confirm-actions .btn-danger').click();
    await page.waitForFunction(() => window.__cns.state.coop.players.length === 1);
    expect(await page.evaluate(() => window.__cns.sentLog().some((m) => m.type === 'kick'))).toBe(true);
  });

  test('wer ausgeladen wird, behält das Brett als Solo-Spiel', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    await asCoop(page, 'guest');
    // Fremde (Nicht-Host) dürfen nicht ausladen.
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'kick', target: 'g1', author: 'x' }));
    expect(await page.evaluate(() => window.__cns.state.coop.active)).toBe(true);
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'kick', target: 'g1', author: 'h' }));
    await page.waitForFunction(() => !window.__cns.state.coop.active && window.__cns.state.saveSlot === 'solo' && !!window.__cns.state.puzzle);
    await expect(page.locator('.toast')).toContainText('ausgeladen');
  });

  test('im Duell heißt der Ausstieg im Pausenmenü „Aufgeben", allein weiterspielen gibt es dort nicht', async ({ page }) => {
    await gotoApp(page);
    await startSolo(page);
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    await page.evaluate(() => { const s = window.__cns.state; s.race.active = true; s.coop.raceMode = true; });
    await expect(page.locator('.pause-overlay .pause-quit')).toHaveText('Aufgeben');
    await expect(page.locator('.pause-overlay .continue-solo-btn')).toHaveCount(0);
  });
});
