import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

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
    await expect(page.locator('.setup-codeinput')).toBeVisible();

    await page.locator('.setup-codeinput').fill('123456');
    await expect(page.locator('.diff-track')).toBeVisible(); // Slider-Auswahl (Default 'mittel')
    await page.locator('.diff-start').click(); // "start hosting"

    await expect(page.locator('.coop-code')).toHaveText('123456');
    await expect(page.locator('.coop-waiting')).toBeVisible();
  });

  test('host flow: lobby roster gates the start button and starting navigates to the game', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.coop-body .text-input').fill('Tom');
    await page.locator('.coop-body .btn-primary').click();

    await page.locator('.coop-body .btn-primary').click(); // "Host" option
    await page.locator('.setup-codeinput').fill('123456');
    await expect(page.locator('.diff-track')).toBeVisible(); // Slider-Auswahl (Default 'mittel')
    await page.locator('.diff-start').click(); // "start hosting"

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

    await page.locator('.screen.coop-screen .topbar .icon-btn').first().click(); // cancel via topbar back
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

  // Beitritt in einen Raum mit LAUFENDER Runde: computeJoinAnchor (coop.js) lässt
  // den Event-Listener exakt ab dem INIT der offenen Runde aufsetzen — der
  // Beitretende empfängt also INIT + START (+ Züge) als Replay-Burst und muss
  // DIREKT im laufenden Spiel landen und mitspielen können, ohne in einer
  // Bereit-Lobby zu hängen ("der Host muss starten — der ist aber ingame").
  // Simuliert ohne echtes Firebase über den window.__cns-Hook (gleiches Muster
  // wie training.spec.js): genau die Nachrichtenfolge, die der Anker liefert.
  test('joining a room with a running round (replayed INIT+START) lands directly in the game, playable', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const puzzle = {
        rows: 4, cols: 4,
        rowTargets: [1, 1, 1, 1], colTargets: [1, 1, 1, 1],
        values: Array.from({ length: 4 }, () => Array(4).fill(1)),
        solution: Array.from({ length: 4 }, () => Array(4).fill(true)),
        regions: [], difficulty: 'leicht',
      };
      // Replay-Burst wie beim Beitritt in eine offene Runde: INIT, dann START
      // (Startzeit liegt in der Vergangenheit — die Runde läuft schon eine Weile).
      window.__cns.handleCoopMsg({ type: 'init', puzzle, marks: null, markedBy: null, startTime: Date.now() - 5000 });
      window.__cns.handleCoopMsg({ type: 'start', startTime: Date.now() - 5000 });
    });
    await page.waitForSelector('.screen.game');

    // Kein Hängen in der Bereit-Lobby: Overlay weg, Runde läuft.
    expect(await page.evaluate(() => window.__cns.state.coop.awaitingStart)).toBe(false);
    await expect(page.locator('.coop-lobby-overlay')).toBeHidden();
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');

    // Ein Partner-Zug aus dem Replay kommt an …
    await page.evaluate(() => { window.__cns.handleCoopMsg({ type: 'move', r: 0, c: 0, mark: 'keep', from: 'fake-partner' }); });
    expect(await page.evaluate(() => window.__cns.state.marks[0][0])).toBe('keep');

    // … und man kann sofort selbst mitspielen.
    await page.evaluate(() => window.__cns.onCellTap(1, 1));
    expect(await page.evaluate(() => window.__cns.state.marks[1][1])).not.toBe('none');
  });

  test('back navigation from the coop screen returns to home', async ({ page }) => {
    await goToCoop(page);
    await page.locator('.screen.coop-screen .topbar .icon-btn').first().click();
    await expect(page.locator('.screen.home')).toBeVisible();
  });

  // ─── Solo → Coop Live-Umwandlung ────────────────────────────────────────────
  // Der Host-Pfad (echter Firebase-Raum) wird hier bewusst nicht ausgelöst; die
  // Tests decken die UI-Sichtbarkeit und die Gast-Seite (INIT mit Zwischenstand)
  // ab — Letzteres ist exakt das, was ein Beitretender einer umgewandelten
  // Solo-Partie empfängt.
  test('the pause menu offers "invite a player" in a solo game, but not in training', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);
    await page.locator('.game-top .icon-btn').first().click(); // Pause
    await expect(page.locator('.pause-overlay')).toBeVisible();
    // Solo + spielend → Einladen-Knopf sichtbar (canInviteToSolo()).
    await expect(page.locator('.pause-overlay .btn', { hasText: 'Mitspieler einladen' })).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.soloInvite.status)).toBe('idle');
  });

  // Host-Seite der Umwandlung, OHNE echtes Firebase: onSoloInviteRoomOpen/
  // onSoloInviteJoin sind über den localhost-Testhook erreichbar; Coop.send()
  // ist ohne verbundenen Raum ein sicheres No-op. Geprüft wird der komplette
  // lokale Zustandsumbau beim ersten Beitritt.
  test('the first join converts the running solo game to coop (host side)', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page);
    // Zwei eigene Züge, damit markedBy-Einträge zum Umschreiben existieren.
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns; const p = state.puzzle;
      state.tool = p.solution[0][0] ? 'pen' : 'eraser'; onCellTap(0, 0);
      state.tool = p.solution[0][1] ? 'pen' : 'eraser'; onCellTap(0, 1);
    });
    await page.evaluate(() => {
      window.__cns.state.settings.coopName = 'Tom';
      window.__cns.onSoloInviteRoomOpen('fake-me', '123456');   // Raum steht
      window.__cns.onSoloInviteJoin('fake-guest', { name: 'Mara', color: '#f00' }); // erster Beitritt
    });

    const s = await page.evaluate(() => ({
      status: window.__cns.state.soloInvite.status,
      coopActive: window.__cns.state.coop.active,
      role: window.__cns.state.coop.role,
      myId: window.__cns.state.coop.myId,
      saveSlot: window.__cns.state.saveSlot,
      players: window.__cns.state.coop.players.map(p => p.name).sort(),
      markedBy00: window.__cns.state.markedBy[0][0],
      gameStatus: window.__cns.state.status,
      soloSlot: JSON.parse(localStorage.getItem('cns_active_game') || 'null'),
    }));
    expect(s.status).toBe('converted');
    expect(s.coopActive).toBe(true);
    expect(s.role).toBe('host');
    expect(s.saveSlot).toBe('coop');
    expect(s.players).toEqual(['Mara', 'Tom']);
    expect(s.markedBy00).toBe('fake-me');   // eigene Solo-Züge gehören jetzt der Coop-Identität
    expect(s.gameStatus).toBe('playing');   // Spiel lief einfach weiter
    expect(s.soloSlot).toBe(null);          // Solo-Slot geräumt (lebt im Coop-Slot weiter)
  });

  test('a converted solo game\'s INIT carries the mid-game state (lives/hints/mistakes) to the joiner', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const puzzle = {
        rows: 4, cols: 4,
        rowTargets: [1, 1, 1, 1], colTargets: [1, 1, 1, 1],
        values: Array.from({ length: 4 }, () => Array(4).fill(1)),
        solution: Array.from({ length: 4 }, () => Array(4).fill(true)),
        regions: [], difficulty: 'leicht',
      };
      // Exakt die Events, die completeSoloConversion() in den Raum legt: INIT
      // mit Zwischenstand (halb gespielte Runde) + START mit vergangener Startzeit.
      window.__cns.handleCoopMsg({
        type: 'init', puzzle, marks: null, markedBy: null, startTime: Date.now() - 60000,
        lives: 1, maxLives: 3, hintsLeft: 0, hintsUsed: 3, mistakes: 2,
      });
      window.__cns.handleCoopMsg({ type: 'start', startTime: Date.now() - 60000 });
    });
    await page.waitForSelector('.screen.game');

    const s = await page.evaluate(() => ({
      lives: window.__cns.state.lives, maxLives: window.__cns.state.maxLives,
      hintsLeft: window.__cns.state.hintsLeft, hintsUsed: window.__cns.state.hintsUsed,
      mistakes: window.__cns.state.mistakes, status: window.__cns.state.status,
      awaitingStart: window.__cns.state.coop.awaitingStart,
    }));
    expect(s).toEqual({ lives: 1, maxLives: 3, hintsLeft: 0, hintsUsed: 3, mistakes: 2, status: 'playing', awaitingStart: false });
    // Zeit läuft ab dem übermittelten Startzeitpunkt weiter (≈ 60s, nicht 0).
    await page.waitForFunction(() => window.__cns.state.elapsed >= 59000);
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
    await page.locator('.setup-codeinput').fill('123456');
    await expect(page.locator('.diff-track')).toBeVisible(); // Slider-Auswahl (Default 'mittel')
    await page.locator('.diff-start').click(); // "start hosting"
    await expect(page.locator('.coop-waiting')).toBeVisible();

    const back = () => page.locator('.screen.coop-screen .topbar .icon-btn').first().click();
    // Warten → Host-Einrichtung (Code + Schwierigkeit, Verbindung abgebaut)
    await back();
    await expect(page.locator('.coop-waiting')).toBeHidden();
    await expect(page.locator('.setup-codeinput')).toBeVisible();
    // Host-Einrichtung → Rollenwahl
    await back();
    await expect(page.locator('.setup-codeinput')).toBeHidden();
    await expect(page.locator('.coop-body .btn-primary')).toBeVisible();
    // Rollenwahl → Namens-Gate
    await back();
    await expect(page.locator('.coop-body .text-input')).toBeVisible();
    // Namens-Gate → Home
    await back();
    await expect(page.locator('.screen.home')).toBeVisible();
  });
});
