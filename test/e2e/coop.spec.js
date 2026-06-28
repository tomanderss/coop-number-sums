import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Coop.isAvailable() only checks for a fetch-capable browser, so the coop
// button is never disabled in this suite. We deliberately do NOT attempt a
// real two-client Firebase sync (that hits the live RTDB project) -- these
// tests cover the UI/state machine up to the point a real round-trip would
// be required (host waiting-for-guest spinner, guest connecting spinner).
// The lone exception is the "unreachable code" test below, which does let a
// real Firebase lookup resolve (fast: a single RTDB read for a code with no
// active room).
test.describe('coop', () => {
  async function goToCoop(page) {
    await gotoApp(page);
    await page.locator('.btn-coop').click();
    await page.waitForSelector('.screen.coop-screen');
  }

  test('identity gate requires a name before continuing', async ({ page }) => {
    await goToCoop(page);
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-body .text-input').fill('Tom');
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();

    await page.locator('.coop-body .btn-primary').click();
    await expect(page.locator('.coop-body .coop-tagline')).toBeVisible();
  });

  test('host flow: set a code, pick a difficulty, start hosting shows waiting state', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-primary').click(); // "Host" option
    await expect(page.locator('.coop-code-label')).toBeVisible();

    await page.locator('.coop-input').fill('123456');
    await page.locator('.option-grid .opt-card').first().click();
    await page.locator('.coop-body .btn-primary').click(); // "start hosting"

    await expect(page.locator('.coop-code')).toHaveText('123456');
    await expect(page.locator('.coop-waiting')).toBeVisible();
  });

  test('host flow: lobby roster gates the start button and starting navigates to the game', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-primary').click(); // "Host" option
    await page.locator('.coop-input').fill('123456');
    await page.locator('.option-grid .opt-card').first().click();
    await page.locator('.coop-body .btn-primary').click(); // "start hosting"

    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    // Simulate a second (and third) player joining the lobby without a real
    // second Firebase client -- canStartCoopMatch() only cares about the
    // roster length, so pushing directly into the reactive state is enough
    // to exercise the start-button gating and the roster/count rendering.
    await page.evaluate(() => {
      window.__cns.state.coop.players.push(
        { id: 'fake-guest-1', name: 'Mara', color: '#f00' },
        { id: 'fake-guest-2', name: 'Alex', color: '#00f' },
      );
    });

    expect(await page.locator('.coop-roster .player-chip').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();

    await page.locator('.coop-body .btn-primary').click(); // "start match"
    await page.waitForSelector('.screen.game');
    await expect(page.locator('.coop-lobby-overlay')).toBeVisible();
  });

  test('guest flow: shows roster and "waiting for host to start" once connected', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    await page.locator('.coop-body .btn-ghost').click(); // "Join" option

    // Simulate a successful join without a real Firebase round-trip: set the
    // exact flags startJoining()'s onOpen would set, then assert the template
    // renders the new "waiting for host" state + roster instead of the old
    // connecting spinner / connect button.
    await page.evaluate(() => {
      const s = window.__cns.state.coop;
      s.waitingForGuest = true;
      s.myId = 'fake-me';
      s.players.push(
        { id: 'fake-me', name: 'Tom', color: '#000' },
        { id: 'fake-host', name: 'Mara', color: '#f00' },
      );
    });

    await expect(page.locator('.coop-roster .player-chip')).toHaveCount(2);
    await expect(page.locator('.coop-body .btn-primary')).toHaveText('Warte auf Start durch Host…');
  });

  test('host flow: cancel returns to the host/join choice', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    await page.locator('.coop-body .btn-primary').click(); // "Host" option

    await page.locator('.coop-body .btn-ghost').click(); // cancel
    await expect(page.locator('.coop-body .coop-tagline')).toBeVisible();
    await expect(page.locator('.coop-body .btn-primary')).toBeVisible();
    await expect(page.locator('.coop-body .btn-ghost')).toBeVisible();
  });

  test('guest flow: connect button stays disabled until a 6-digit code is entered', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-ghost').click(); // "Join" option
    await expect(page.locator('.coop-code-label')).toBeVisible();
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-input').fill('123');
    await expect(page.locator('.coop-body .btn-primary')).toBeDisabled();

    await page.locator('.coop-input').fill('123456');
    await expect(page.locator('.coop-body .btn-primary')).toBeEnabled();
  });

  test('guest flow: connecting shows a connecting state and an eventual error for an unreachable code', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    await page.locator('.coop-body .btn-ghost').click(); // "Join" option

    await page.locator('.coop-input').fill('999999');
    await page.locator('.coop-body .btn-primary').click();

    await expect(page.locator('.coop-error')).toBeVisible({ timeout: 20000 });
  });

  test('back navigation from the coop screen returns to home', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.screen.coop-screen .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  // Bildschirme verhalten sich wie ein Stack: Zurück führt Schritt für Schritt
  // zur jeweils vorherigen Ansicht, nicht pauschal nach Home.
  test('back from the host/join choice returns to the name gate, then home', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    // Auf der Rollenwahl: Zurück öffnet wieder das Namens-Gate (vorheriger Schritt).
    await page.locator('.screen.coop-screen .topbar .icon-btn').first().click();
    await expect(page.locator('.coop-body .text-input')).toBeVisible();
    // Noch einmal Zurück verlässt Coop ganz → Home.
    await page.locator('.screen.coop-screen .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  // Der gesamte Host-Pfad muss sich Schritt für Schritt zurück begehen lassen:
  // Warten → Host-Einrichtung → Rollenwahl → Namens-Gate → Home.
  test('back steps through the full host chain one screen at a time', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();
    await page.locator('.coop-body .btn-primary').click(); // "Host"
    await page.locator('.coop-input').fill('123456');
    await page.locator('.option-grid .opt-card').first().click();
    await page.locator('.coop-body .btn-primary').click(); // "start hosting"
    await expect(page.locator('.coop-waiting')).toBeVisible();

    const back = () => page.locator('.screen.coop-screen .topbar .icon-btn').first().click();
    // Warten → Host-Einrichtung (Code + Schwierigkeit, Verbindung abgebaut)
    await back();
    await expect(page.locator('.coop-waiting')).toBeHidden();
    await expect(page.locator('.coop-input')).toBeVisible();
    // Host-Einrichtung → Rollenwahl
    await back();
    await expect(page.locator('.coop-input')).toBeHidden();
    await expect(page.locator('.coop-body .btn-primary')).toBeVisible();
    // Rollenwahl → Namens-Gate
    await back();
    await expect(page.locator('.coop-body .text-input')).toBeVisible();
    // Namens-Gate → Home
    await back();
    await expect(page.locator('.screen.home')).toBeVisible();
  });
});
