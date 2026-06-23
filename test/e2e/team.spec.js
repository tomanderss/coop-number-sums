import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Team-vs-Team (Feature 12b) reuses the existing 4-player coop room/lobby --
// we never simulate a real second Firebase client. Within-team gameplay sync
// is exercised indirectly (it just reroutes through coopSend(), already
// covered by the existing coop tests); what's specific to this feature is the
// team-toggle/-assignment lobby UI and the TEAM_START/TEAM_DONE state
// machine, which we drive directly via window.__cns (state + the exposed
// handleCoopMsg) to simulate messages a real opposing-team client would send.
test.describe('team vs team', () => {
  // Team-vs-Team is now only reachable through the unified Race entry point
  // (home -> "Race-Modus" -> "2 gegen 2" choice), not via a separate in-lobby
  // toggle on the plain Coop screen.
  async function goToCoopHostChoice(page) {
    await gotoApp(page);
    await page.locator('.race-btn').click();
    await page.locator('.modal-bg .btn-ghost').first().click(); // "2 vs 2" choice
    await page.waitForSelector('.screen.coop-screen');
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click(); // confirm identity
    await page.locator('.coop-body .btn-primary').click(); // "Host" option
  }

  // Multi-step team-assignment flows take long enough that the real (live,
  // sandbox-unreachable) Firebase round-trip from clicking "start hosting"
  // can fail and revert state.coop.waitingForGuest mid-test. So -- same
  // workaround as coop.spec.js's guest-flow test -- we set exactly the flags
  // a successful hostGame()/onOpen() round-trip would set, instead of
  // clicking through the real network call.
  async function simulateHostedTeamLobby(page) {
    await goToCoopHostChoice(page);
    await page.evaluate(() => {
      const s = window.__cns.state.coop;
      s.role = 'host';
      s.code = '123456';
      s.teamMode = true;
      s.waitingForGuest = true;
      s.myId = 'fake-host';
      s.hostId = 'fake-host';
      s.players = [
        { id: 'fake-host', name: 'Tom', color: '#0a0', team: null },
        { id: 'fake-guest-1', name: 'Mara', color: '#f00', team: null },
        { id: 'fake-guest-2', name: 'Alex', color: '#00f', team: null },
      ];
    });
  }

  test('choosing 2v2 from the race menu starts a team host lobby directly, without a separate toggle', async ({ page }) => {
    await goToCoopHostChoice(page);
    await page.locator('.coop-input').fill('123456');
    expect(await page.evaluate(() => window.__cns.state.coop.teamMode)).toBe(true);
    await expect(page.locator('.coop-body .set-row')).toHaveCount(0);
  });

  test('hosted team lobby shows a team-assignable roster that gates the start button', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const teamChips = page.locator('.coop-roster .team-chip');
    await expect(teamChips).toHaveCount(3);
    // No one is assigned to a team yet -- start must stay disabled.
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    // Own chip + one guest chip -> both Team A. Cycle the guest chip once
    // more -> Team B, which satisfies "at least one player per team".
    await teamChips.nth(0).click();
    await teamChips.nth(1).click();
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled(); // both on Team A, no Team B yet
    await teamChips.nth(1).click(); // cycles Team A -> Team B
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();

    expect(await page.evaluate(() => window.__cns.state.coop.players.map(p => p.team))).toEqual(['A', 'B', null]);
  });

  test('starting a team match navigates to the game with a team chip and opponent progress', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const teamChips = page.locator('.coop-roster .team-chip');
    await teamChips.nth(0).click(); // me -> Team A
    await teamChips.nth(2).click(); // guest2 -> Team A
    await teamChips.nth(2).click(); // guest2 -> Team B
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
    await page.locator('.coop-body .btn-primary').click(); // "start match"

    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click(); // dismiss "ready?" lobby
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.team.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.team.myTeam)).toBe('A');
    await expect(page.locator('.coop-chip', { hasText: 'Team A' })).toBeVisible();
    await expect(page.locator('.coop-chip', { hasText: 'Gegner' })).toBeVisible();
  });

  test('the opposing team finishing first ends the match immediately and hides the rematch buttons', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const teamChips = page.locator('.coop-roster .team-chip');
    await teamChips.nth(0).click(); // me -> Team A
    await teamChips.nth(2).click(); // guest2 -> Team A
    await teamChips.nth(2).click(); // guest2 -> Team B
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    // Simulate Team B (the opposing team) finishing first with a win --
    // my still-playing Team A client must be forced to lose immediately.
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'teamDone', team: 'B', outcome: 'won', author: 'fake-opponent' });
    });

    await expect(page.locator('.result-card.lose')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.team.matchOver)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.team.winningTeam)).toBe('B');
    // No "retry"/"new game" buttons in team mode -- the match is simply over.
    await expect(page.locator('.result-card.lose .btn-primary')).toHaveCount(0);
  });

  test('the opposing team giving up awards the win to my still-playing team by default', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const teamChips = page.locator('.coop-roster .team-chip');
    await teamChips.nth(0).click(); // me -> Team A
    await teamChips.nth(2).click(); // guest2 -> Team A
    await teamChips.nth(2).click(); // guest2 -> Team B
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'teamDone', team: 'B', outcome: 'gaveup', author: 'fake-opponent' });
    });

    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.team.winningTeam)).toBe('A');
  });
});
