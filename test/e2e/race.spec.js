import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Race-/Duell-Modus (Feature 11) reuses the existing coop room/lobby, capped
// to 2 players client-side, but never sets state.coop.active during the live
// match -- per-cell moves/mistakes/checks are therefore never broadcast (only
// the throttled progress percentage is). We never simulate a real second
// Firebase client; the opponent's RACE_START/RACE_DONE messages are driven
// directly via window.__cns.handleCoopMsg, same approach as team.spec.js.
test.describe('race mode', () => {
  async function goToRaceHostChoice(page) {
    await gotoApp(page);
    await page.locator('.race-btn').click();
    await page.waitForSelector('.screen.coop-screen');
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click(); // confirm identity
    await page.locator('.coop-body .btn-primary').click(); // "Host" option
  }

  // Same workaround as team.spec.js/coop.spec.js -- the real hostGame()/
  // onOpen() Firebase round-trip is unreachable in this sandbox, so we set
  // exactly the flags a successful host flow would have set.
  async function simulateHostedRaceLobby(page) {
    await goToRaceHostChoice(page);
    await page.evaluate(() => {
      const s = window.__cns.state.coop;
      s.role = 'host';
      s.code = '123456';
      s.raceMode = true;
      s.waitingForGuest = true;
      s.myId = 'fake-host';
      s.hostId = 'fake-host';
      s.players = [
        { id: 'fake-host', name: 'Tom', color: '#0a0' },
        { id: 'fake-guest-1', name: 'Mara', color: '#f00' },
      ];
    });
  }

  test('the team toggle is not offered in a race lobby', async ({ page }) => {
    await goToRaceHostChoice(page);
    await page.locator('.coop-input').fill('123456');
    await expect(page.locator('.coop-body .set-row')).toHaveCount(0);
  });

  test('hosted race lobby caps the player count display at 2 and gates the start button', async ({ page }) => {
    await goToRaceHostChoice(page);
    await page.evaluate(() => {
      const s = window.__cns.state.coop;
      s.role = 'host';
      s.code = '123456';
      s.raceMode = true;
      s.waitingForGuest = true;
      s.myId = 'fake-host';
      s.hostId = 'fake-host';
      s.players = [{ id: 'fake-host', name: 'Tom', color: '#0a0' }];
    });
    await expect(page.locator('.coop-subtext', { hasText: '1' })).toContainText('2');
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.evaluate(() => {
      window.__cns.state.coop.players.push({ id: 'fake-guest-1', name: 'Mara', color: '#f00' });
    });
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
  });

  test('starting a race match navigates to the game with an opponent chip and progress', async ({ page }) => {
    await simulateHostedRaceLobby(page);

    await page.locator('.coop-body .btn-primary').click(); // "start race"
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click(); // dismiss "ready?" lobby
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.race.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.isRaceGame)).toBe(true);
    await expect(page.locator('.coop-chip', { hasText: 'Mara' })).toBeVisible();
    await expect(page.locator('.coop-chip', { hasText: '0%' })).toBeVisible();
  });

  test('the opponent finishing first ends the match immediately and hides the rematch buttons', async ({ page }) => {
    await simulateHostedRaceLobby(page);

    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'raceDone', outcome: 'won', from: 'fake-guest-1' });
    });

    await expect(page.locator('.result-card.lose')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.race.matchOver)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.race.winner)).toBe('opponent');
    // No "retry"/"new game" buttons in race mode -- the match is simply over.
    await expect(page.locator('.result-card.lose .btn-primary')).toHaveCount(0);
  });

  test('the opponent giving up awards the win to me', async ({ page }) => {
    await simulateHostedRaceLobby(page);

    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'raceDone', outcome: 'gaveup', from: 'fake-guest-1' });
    });

    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.race.winner)).toBe('me');
  });
});
