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

    // Raum voll (4 Spieler) → Knopf verschwindet (nichts mehr einzuladen).
    await page.locator('.modal .confirm-actions .btn-primary').click();
    await page.evaluate(() => {
      window.__cns.state.coop.players = [
        { id: 'me', name: 'Ich' }, { id: 'g1', name: 'A' }, { id: 'g2', name: 'B' }, { id: 'g3', name: 'C' },
      ];
    });
    await expect(inviteBtn).toHaveCount(0);
  });
});
