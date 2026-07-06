import { test, expect } from '@playwright/test';
import { gotoApp, commitMistakes, dismissStreakModal } from './helpers.js';

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
    await page.locator('.modal-bg .btn-primary').click(); // "1 vs 1" choice
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
    await page.locator('.setup-codeinput').fill('123456');
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
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' }));
    await page.locator('.coop-lobby-overlay .btn-primary').click(); // dismiss "ready?" lobby
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.state.race.active)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.isRaceGame)).toBe(true);
    // Subtiler Akzent-Streifen je Modus (Punkt 14): der Game-Screen bekommt im
    // Race-Match die race-mode-Klasse, nicht die team-mode-Klasse.
    await expect(page.locator('.screen.game')).toHaveClass(/race-mode/);
    await expect(page.locator('.screen.game')).not.toHaveClass(/team-mode/);
    await expect(page.locator('.coop-chip', { hasText: 'Mara' })).toBeVisible();
    // Eigener + Gegner-Fortschrittsbalken liegen im Race-Modus übereinander,
    // darunter eine dritte Zeile mit der Gegner-Lebensanzeige (Herzen statt Balken).
    await expect(page.locator('.progress-row .progress-line')).toHaveCount(3);
    await expect(page.locator('.progress-row .progress-pct', { hasText: '0%' })).toHaveCount(2);
    // Bei 0% ist die Füllung selbst absichtlich leer (siehe Plan: "leeres
    // Rechteck, das sich auffüllt") -- nur der Balken-Rahmen muss sichtbar sein.
    await expect(page.locator('.progress-row .progress-bar').nth(1)).toBeVisible();
  });

  test('the opponent finishing first ends the match immediately and offers a rematch instead of retry/new game', async ({ page }) => {
    await simulateHostedRaceLobby(page);

    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' }));
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'raceDone', outcome: 'won', from: 'fake-guest-1' });
    });

    await expect(page.locator('.result-card.lose')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.race.matchOver)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.race.winner)).toBe('opponent');
    // Solo "retry"/"new game" buttons stay hidden in race mode -- only the
    // race-specific rematch button (host) takes their place.
    await expect(page.locator('.result-card.lose .btn-primary')).toHaveCount(1);

    await dismissStreakModal(page);
    await page.locator('.result-card.lose .btn-primary').click();
    await expect(page.locator('.screen.coop-screen')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.race.active)).toBe(false);
    expect(await page.evaluate(() => window.__cns.state.coop.waitingForGuest)).toBe(true);
  });

  test('the opponent losing all lives awards the win to me', async ({ page }) => {
    await simulateHostedRaceLobby(page);

    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' }));
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'raceDone', outcome: 'lost', from: 'fake-guest-1' });
    });

    await expect(page.locator('.result-card.win')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.race.winner)).toBe('me');

    // Winning offers the same host-side rematch button as losing does --
    // no separate "next puzzle"/"new game" path in race mode.
    await expect(page.locator('.result-card.win .btn-primary')).toHaveCount(1);

    await dismissStreakModal(page);
    await page.locator('.result-card.win .btn-primary').click();
    await expect(page.locator('.screen.coop-screen')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.race.active)).toBe(false);
    expect(await page.evaluate(() => window.__cns.state.coop.waitingForGuest)).toBe(true);
  });

  // Regression: registerMistake()/applyRemoteMistake()/doCheck() used to skip
  // life-loss entirely whenever state.isRaceGame was true, so the hearts row
  // rendered (gated only on settings.livesEnabled, default on) but never
  // changed -- mistakes were tracked but never cost a heart. Race now follows
  // the same settings.livesEnabled rule as solo/coop instead of special-casing
  // itself out of it.
  test('a mistake in race mode deducts a heart, and running out of hearts ends the race in a loss', async ({ page }) => {
    await simulateHostedRaceLobby(page);
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' }));
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await expect(page.locator('.hud-item.lives')).toBeVisible();
    const initialLives = await page.evaluate(() => window.__cns.state.lives);
    expect(initialLives).toBeGreaterThan(0);

    await commitMistakes(page, 1);
    expect(await page.evaluate(() => window.__cns.state.lives)).toBe(initialLives - 1);
    expect(await page.locator('.heart.empty').count()).toBe(1);

    await commitMistakes(page, initialLives - 1);
    expect(await page.evaluate(() => window.__cns.state.lives)).toBe(0);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('lost');
    await expect(page.locator('.result-card.lose')).toBeVisible();
    // Confirms a lives-based loss still goes through the race-specific result
    // branch (state.race.active), not the generic solo "loss.title"/"loss.msg".
    expect(await page.evaluate(() => window.__cns.state.race.matchOver)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.race.winner)).toBe('opponent');
  });

  // Regression: a wrong move returns early out of setMark() via
  // registerMistake() and never reaches afterMove() -- the function that
  // normally pushes the throttled progress update. The opponent used to only
  // learn about a mistake once a subsequent CORRECT move ran afterMove().
  // registerMistake() now pushes an unthrottled update of its own; we can't
  // spy on the (frozen, no-op-in-tests) Coop.setRaceProgress call directly,
  // so we assert on the internal throttle timestamp it stamps immediately
  // before attempting the push.
  test('a mistake immediately resets the race progress throttle instead of waiting for the next correct move', async ({ page }) => {
    await simulateHostedRaceLobby(page);
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' }));
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    expect(await page.evaluate(() => window.__cns.getProgressThrottle().race)).toBe(0);
    await commitMistakes(page, 1);
    const throttledAt = await page.evaluate(() => window.__cns.getProgressThrottle().race);
    expect(Date.now() - throttledAt).toBeLessThan(2000);
  });

  // Regression: pauseGame()/resumeFromPause() only ever broadcast via
  // coopSend(), which is a no-op during a race match (state.coop.active stays
  // false by design -- see state.race comment). The receiving side already
  // handled MSG.PAUSE unconditionally (handleCoopMsg doesn't gate on
  // coop.active), so simulating an incoming PAUSE from the opponent -- exactly
  // what the fixed sending side now actually transmits via Coop.send() -- must
  // pause this client and freeze its elapsed time at the broadcast value.
  test('a PAUSE message from the opponent pauses the race and syncs the frozen elapsed time', async ({ page }) => {
    await simulateHostedRaceLobby(page);
    await page.locator('.coop-body .btn-primary').click();
    await page.waitForSelector('.screen.game');
    await page.evaluate(() => window.__cns.handleCoopMsg({ type: 'ready', author: 'fake-guest-1' }));
    await page.locator('.coop-lobby-overlay .btn-primary').click();
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'pause', paused: true, elapsed: 12345 });
    });
    await expect(page.locator('.pause-overlay')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.elapsed)).toBe(12345);

    await page.evaluate(() => {
      window.__cns.handleCoopMsg({ type: 'pause', paused: false });
    });
    await expect(page.locator('.pause-overlay')).not.toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(false);
  });
});
