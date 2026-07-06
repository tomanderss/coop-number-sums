import { test, expect } from '@playwright/test';
import { gotoApp, commitMistakes } from './helpers.js';

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
    await page.locator('.modal-bg button', { hasText: '2 gegen 2' }).click(); // "2 vs 2" choice (nicht der FFA-Button)
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
    await page.locator('.setup-codeinput').fill('123456');
    expect(await page.evaluate(() => window.__cns.state.coop.teamMode)).toBe(true);
    await expect(page.locator('.coop-body .set-row')).toHaveCount(0);
  });

  test('hosted team lobby shows a team-assignable roster that gates the start button', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const mid = page.locator('.team-picker .team-slot-mid');
    await expect(mid).toHaveCount(3);
    // No one is assigned to a team yet -- start must stay disabled.
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    // Own slot + one guest slot -> both Team A via the left ("move to A") arrow.
    // Swap the guest's arrow once more -> Team B, which satisfies "at least
    // one player per team".
    await mid.nth(0).locator('.team-arrow-btn').nth(0).click(); // me -> A
    await mid.nth(1).locator('.team-arrow-btn').nth(0).click(); // guest1 -> A
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled(); // both on Team A, no Team B yet
    await mid.nth(1).locator('.team-swap-btn').click(); // guest1: A -> B
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();

    expect(await page.evaluate(() => window.__cns.state.coop.players.map(p => p.team))).toEqual(['A', 'B', null]);
  });

  test('starting a team match navigates to the game with a team chip and opponent progress', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const mid = page.locator('.team-picker .team-slot-mid');
    await mid.nth(0).locator('.team-arrow-btn').nth(0).click(); // me -> A
    await mid.nth(2).locator('.team-arrow-btn').nth(0).click(); // guest2 -> A
    await mid.nth(2).locator('.team-swap-btn').click(); // guest2: A -> B
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
    await page.locator('.coop-body .btn-primary').click(); // "start match"

    await page.waitForSelector('.screen.game');
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' });
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-2' });
    });
    await page.locator('.coop-lobby-overlay .btn-primary').click(); // dismiss "ready?" lobby
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.team.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.team.myTeam)).toBe('A');
    await expect(page.locator('.coop-chip', { hasText: 'Team A' })).toBeVisible();
    // Gegner-Team wird jetzt (wie in den anderen Wettkampfmodi) als
    // Fortschrittsbalken mit Lebensanzeige gezeigt, nicht mehr als Chip:
    // eigener Balken "Team A" + Gegner-Balken "Team B" + Gegner-Leben-Zeile.
    await expect(page.locator('.progress-line .progress-label', { hasText: 'Team A' })).toBeVisible();
    await expect(page.locator('.progress-line .progress-label', { hasText: 'Team B' })).toBeVisible();
    await expect(page.locator('.progress-line.opponent-lives-line')).toBeVisible();
    // Subtiler Akzent-Streifen je Modus (Punkt 14): Team-Match -> team-mode,
    // nicht race-mode.
    await expect(page.locator('.screen.game')).toHaveClass(/team-mode/);
    await expect(page.locator('.screen.game')).not.toHaveClass(/race-mode/);
  });

  // Regression: a wrong move returns early out of setMark() via
  // registerMistake() and never reaches afterMove() -- the function that
  // normally pushes the throttled team progress update. The opposing team
  // used to only learn about a mistake once a subsequent CORRECT move ran
  // afterMove(). registerMistake() now pushes an unthrottled update of its
  // own; Coop.setTeamProgress itself is a frozen module-namespace export and
  // a no-op in this sandbox, so we assert on the internal throttle timestamp
  // it stamps immediately before attempting the push.
  test('a mistake immediately resets the team progress throttle instead of waiting for the next correct move', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const mid = page.locator('.team-picker .team-slot-mid');
    await mid.nth(0).locator('.team-arrow-btn').nth(0).click(); // me -> A
    await mid.nth(2).locator('.team-arrow-btn').nth(0).click(); // guest2 -> A
    await mid.nth(2).locator('.team-swap-btn').click(); // guest2: A -> B
    await page.locator('.coop-body .btn-primary').click(); // "start match"

    await page.waitForSelector('.screen.game');
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' });
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-2' });
    });
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.getProgressThrottle().team)).toBe(0);
    await commitMistakes(page, 1);
    const throttledAt = await page.evaluate(() => window.__cns.getProgressThrottle().team);
    expect(Date.now() - throttledAt).toBeLessThan(2000);
  });

  test('the opposing team finishing first ends the match immediately and hides the rematch buttons', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const mid = page.locator('.team-picker .team-slot-mid');
    await mid.nth(0).locator('.team-arrow-btn').nth(0).click(); // me -> A
    await mid.nth(2).locator('.team-arrow-btn').nth(0).click(); // guest2 -> A
    await mid.nth(2).locator('.team-swap-btn').click(); // guest2: A -> B
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' });
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-2' });
    });
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

  test('the opposing team losing all lives awards the win to my still-playing team by default', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const mid = page.locator('.team-picker .team-slot-mid');
    await mid.nth(0).locator('.team-arrow-btn').nth(0).click(); // me -> A
    await mid.nth(2).locator('.team-arrow-btn').nth(0).click(); // guest2 -> A
    await mid.nth(2).locator('.team-swap-btn').click(); // guest2: A -> B
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' });
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-2' });
    });
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'teamDone', team: 'B', outcome: 'lost', author: 'fake-opponent' });
    });

    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.team.winningTeam)).toBe('A');
  });

  // Regression: useHint() only ever checked state.isRaceGame, so hints stayed
  // fully available in 2v2 team matches even though they're correctly
  // disabled in 1v1 races -- a player could get logic-puzzle help in a
  // competitive mode meant to have none. The hint button must now be hidden
  // in team mode too (mirrors the existing race-mode v-if).
  test('the hint button is hidden during an active team match', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    const mid = page.locator('.team-picker .team-slot-mid');
    await mid.nth(0).locator('.team-arrow-btn').nth(0).click(); // me -> A
    await mid.nth(2).locator('.team-arrow-btn').nth(0).click(); // guest2 -> A
    await mid.nth(2).locator('.team-swap-btn').click(); // guest2: A -> B
    await page.locator('.coop-body .btn-primary').click(); // "start match"

    await page.waitForSelector('.screen.game');
    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' });
      window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-2' });
    });
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.team.active)).toBe(true);
    // Only the undo button remains -- the hint button (also a .round-btn) is gone.
    await expect(page.locator('.toolbar .round-btn')).toHaveCount(1);
  });

  test('the randomize button splits all players into non-null teams, balanced to within one', async ({ page }) => {
    await simulateHostedTeamLobby(page);

    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();
    await page.locator('.randomize-teams-btn').click();

    const teams = await page.evaluate(() => window.__cns.state.coop.players.map(p => p.team));
    expect(teams.every(t => t === 'A' || t === 'B')).toBe(true);
    const countA = teams.filter(t => t === 'A').length;
    const countB = teams.filter(t => t === 'B').length;
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(1);
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
  });
});
