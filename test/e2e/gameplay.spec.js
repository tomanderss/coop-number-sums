import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, solveActivePuzzle, commitMistakes, dismissStreakModal } from './helpers.js';

test.describe('gameplay', () => {
  // Regression: the player's chosen color (settings.coopMyColor) used to only
  // tint marks during an active coop session (cellStyle()/cellClasses() were
  // gated on state.coop.active). It must now also tint your own marks in solo,
  // since the setting was generalized from "coop color" to "my color".
  test('the chosen player color tints a kept mark even outside coop', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => { window.__cns.state.settings.coopMyColor = '#ff00aa'; });
    await startNewGame(page, 'sehrleicht');

    const result = await page.evaluate(() => {
      const { state, onCellTap, cellStyle, cellClasses } = window.__cns;
      const p = state.puzzle;
      let r, c;
      outer: for (r = 0; r < p.rows; r++) for (c = 0; c < p.cols; c++) if (p.solution[r][c]) break outer;
      state.tool = 'pen';
      onCellTap(r, c);
      return { markedColor: cellStyle(r, c)['--markcol'], coopMark: !!cellClasses(r, c)['coop-mark'] };
    });

    expect(result.coopMark).toBe(true);
    expect(result.markedColor).toBe('#ff00aa');
  });

  // Der „Zufall"-Knopf im Solo-Setup würfelt NICHT nur die Schwierigkeit, sondern
  // startet die Runde sofort (kein Zwischenschritt „schau, was gewählt wurde").
  test('the random button starts the game immediately with the rolled difficulty', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'sehrleicht'; });
    // Zufall drücken → direkt im Spiel, ohne den Start-Knopf zu berühren.
    await page.locator('.diff-random').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
    // Die gestartete Schwierigkeit ist eine ANDERE als die vorgewählte (immer verschieden).
    expect(await page.evaluate(() => window.__cns.state.puzzle.difficulty)).not.toBe('sehrleicht');
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  });

  test('solving the puzzle shows the win screen and records a highscore', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.highscore-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click(); // "Zum Menü"
    await expect(page.locator('.screen.home')).toBeVisible();

    await page.locator('.home-grid .btn-ghost').nth(0).click();
    // Die per-Level-Tabelle steckt jetzt im "Solo"-Reiter (Stats öffnen auf "Allgemein").
    await page.locator('.stats-tabs button').nth(1).click();
    await expect(page.locator('.diff-row').first().locator('.chip').first()).toContainText('1 / 1');
  });

  // Graded win animation (Punkt 10): ein makelloser Sieg (0 Fehler, 0 Hinweise)
  // bekommt zusätzlich zum normalen Konfetti einen goldenen Schimmer + Badge --
  // ein Sieg MIT Fehler bekommt explizit keines von beidem.
  test('a flawless win shows the perfect-win badge and shine, a win with a mistake does not', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await solveActivePuzzle(page);
    await dismissStreakModal(page);

    await expect(page.locator('.result-card.win.perfect')).toBeVisible();
    await expect(page.locator('.perfect-badge')).toBeVisible();

    await page.locator('.result-card.win .btn-ghost', { hasText: '' }).last().click();
    await expect(page.locator('.screen.home')).toBeVisible();
    await startNewGame(page, 'sehrleicht');

    await commitMistakes(page, 1);
    await solveActivePuzzle(page);

    await expect(page.locator('.result-card.win')).toBeVisible();
    await expect(page.locator('.result-card.win.perfect')).toHaveCount(0);
    await expect(page.locator('.perfect-badge')).toHaveCount(0);
  });

  test('three deliberate mistakes (lives enabled) trigger the loss screen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await commitMistakes(page, 3);

    await expect(page.locator('.result-card.lose')).toBeVisible();
  });

  test('the lives HUD shows one fewer heart after each mistake', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');

    const emptyHeartsBefore = await page.locator('.heart.empty').count();
    await commitMistakes(page, 1);
    await expect.poll(() => page.locator('.heart.empty').count()).toBe(emptyHeartsBefore + 1);
  });

  test('the zoom reset button appears only after zooming and restores the default zoom', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    // Bei Standardzoom (1) ist der Reset-Knopf ausgeblendet.
    await expect(page.locator('.zoom-reset')).toHaveCount(0);
    await page.locator('.zoomctl .zoom-btn', { hasText: '+' }).click();
    await expect(page.locator('.zoom-reset')).toBeVisible();
    await page.locator('.zoom-reset').click();
    await expect(page.locator('.zoom-reset')).toHaveCount(0);
    expect(await page.evaluate(() => window.__cns.state.zoom)).toBe(1);
  });

  // Der Undo-Knopf ist entfernt (Nutzerwunsch) — in der Werkzeugleiste bleibt
  // nur der Hinweis-Knopf als .round-btn; der Werkzeug-Umschalter sitzt trotzdem
  // EXAKT mittig (unsichtbarer Ausgleichs-Spacer in Hinweis-Knopf-Breite).
  test('the toolbar has no undo button anymore and the tool toggle stays centered', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    await expect(page.locator('.toolbar .round-btn')).toHaveCount(1);
    await expect(page.locator('.toolbar .round-btn')).toHaveAttribute('title', 'Hinweis');
    const bar = await page.locator('.toolbar').boundingBox();
    const toggle = await page.locator('.toolbar .tool-toggle').boundingBox();
    const barCenter = bar.x + bar.width / 2;
    const toggleCenter = toggle.x + toggle.width / 2;
    expect(Math.abs(toggleCenter - barCenter)).toBeLessThanOrEqual(2);
  });

  test('resuming from pause runs a 1.5s bar countdown before the game continues', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    // Pausieren → Fortsetzen tippen.
    await page.locator('.game-top .icon-btn').first().click();
    await page.waitForSelector('.pause-overlay');
    await page.locator('.pause-overlay .btn-primary').click();
    // Countdown läuft: Karte NUR mit „Weiter geht's"-Text + Balken (keine Ziffer),
    // Spiel bleibt PAUSIERT (kein versehentlicher Tap ins Brett, Timer eingefroren).
    await expect(page.locator('.resume-count-card')).toBeVisible();
    await expect(page.locator('.resume-count-digit')).toHaveCount(0);
    await expect(page.locator('.resume-count-bar span')).toBeVisible();
    expect(await page.evaluate(() => window.__cns.state.paused)).toBe(true);
    expect(await page.evaluate(() => window.__cns.state.resumeCountdown)).toBe(1);
    // Countdown zu Ende → Spiel läuft wieder, Overlay weg.
    await page.waitForFunction(() => !window.__cns.state.paused, null, { timeout: 6000 });
    await expect(page.locator('.pause-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => window.__cns.state.resumeCountdown)).toBe(null);
    expect(await page.evaluate(() => window.__cns.state.status)).toBe('playing');
  });
  // Jede Kopf-Zeile ist auf dem Handy Brettflaeche: die Werkzeuge haben deshalb
  // KEINE eigene Reihe mehr, sondern sitzen in der Kopfleiste, und die Info-Chips
  // teilen sich die zweite Zeile mit dem Fortschrittsbalken. Vor dem Umbau begann
  // das Brett bei 150 px, jetzt bei 88 — auf einem kurzen Display (360x560, dort
  // ist die HOEHE die bindende Achse) waechst die Zelle dadurch messbar mit.
  test('die Kopfleiste bleibt einzeilig und laesst dem Brett Platz', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'rip');   // groesstes Brett = der kritische Fall
    const m = await page.evaluate(() => {
      const kopf = document.querySelector('.topbar.game-top');
      const yWerte = [...kopf.children].map((c) => Math.round(c.getBoundingClientRect().y));
      return {
        kopfHoehe: Math.round(kopf.getBoundingClientRect().height),
        // Zwei Kinder auf STARK verschiedenen Hoehen = umgebrochen. Eine kleine
        // Differenz ist blosse vertikale Zentrierung unterschiedlich hoher Kinder.
        umbruch: Math.max(...yWerte) - Math.min(...yWerte) > 20,
        brettOben: Math.round(document.querySelector('.board-wrap').getBoundingClientRect().y),
        werkzeugeImKopf: !!kopf.querySelector('.zoomctl'),
        chipsBeimFortschritt: !!document.querySelector('.meta-row .meta-chips') && !!document.querySelector('.meta-row .progress-row'),
        alteReiheWeg: !document.querySelector('.game-meta'),
      };
    });
    expect(m.werkzeugeImKopf, 'die Werkzeuge sitzen in der Kopfleiste').toBe(true);
    expect(m.chipsBeimFortschritt, 'Chips teilen die Zeile mit dem Fortschritt').toBe(true);
    expect(m.alteReiheWeg, 'die eigene Chip-/Werkzeug-Reihe ist weg').toBe(true);
    expect(m.umbruch, 'die Kopfleiste bricht im Solo nicht um').toBe(false);
    expect(m.kopfHoehe, 'Kopfleiste bleibt flach').toBeLessThanOrEqual(56);
    // Vor dem Umbau begann das Brett bei 150 px.
    expect(m.brettOben, 'das Brett beginnt weit oben').toBeLessThan(120);
  });

  // Der Zuruecksetzen-Knopf erscheint und verschwindet, sein PLATZ bleibt aber
  // stehen (.tool-slot fester Breite): sonst wanderten − / + beim ersten Zoom
  // unter dem Daumen weg und schnelles, wiederholtes Tippen traf daneben.
  test('der Zoom-Reset verschiebt minus und plus nicht', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'sehrleicht');
    const kasten = (txt) => page.locator('.zoomctl .zoom-btn', { hasText: txt }).boundingBox();
    const minusVorher = await kasten('−');
    const plusVorher = await kasten('+');
    await page.locator('.zoomctl .zoom-btn', { hasText: '+' }).click();
    await expect(page.locator('.zoom-reset')).toBeVisible();
    const minusNachher = await kasten('−');
    const plusNachher = await kasten('+');
    expect(Math.abs(minusNachher.x - minusVorher.x), '− bleibt stehen').toBeLessThan(2);
    expect(Math.abs(plusNachher.x - plusVorher.x), '+ bleibt stehen').toBeLessThan(2);
    // Und der Reset sitzt links von − (angestammter Platz).
    const reset = await page.locator('.zoom-reset').boundingBox();
    expect(reset.x, 'Reset sitzt links von −').toBeLessThan(minusNachher.x);
  });
  // Gemeldet: beim Sprung 9:59 -> 10:00 kam EIN Zeichen dazu, der Zeit-Kasten
  // wuchs, die Kopfzeile wurde breiter und die Zoom-Leiste rutschte "eine Etage
  // tiefer", war also nicht mehr buendig. tabular-nums macht nur die ZIFFERN
  // gleich breit, nicht ihre ANZAHL — deshalb eine feste Zeit-Box plus eine
  // Kopfzeile, die gar nicht mehr umbricht (statt ihrer wickelt das HUD intern).
  test('die Zeit-Box bleibt bei jeder Laenge gleich breit und die Leiste buendig', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const messen = async (ms) => {
      await page.evaluate((v) => {
        const s = window.__cns.state;
        s.startTime = Date.now() - v;   // der Timer liest die Zeit aus startTime
        s.elapsed = v;
      }, ms);
      await page.waitForTimeout(260);   // Sekunden-Tick abwarten
      return page.evaluate(() => {
        const t = document.querySelector('.hud-item.timer').getBoundingClientRect();
        const z = document.querySelector('.zoomctl').getBoundingClientRect();
        const kopf = document.querySelector('.topbar.game-top');
        const ys = [...kopf.children].map((c) => Math.round(c.getBoundingClientRect().y));
        return {
          text: document.querySelector('.hud-item.timer').textContent.trim(),
          boxW: Math.round(t.width),
          zoomX: Math.round(z.x), zoomY: Math.round(z.y),
          umbruch: Math.max(...ys) - Math.min(...ys) > 20,
        };
      });
    };
    const a = await messen(599000);     // 9:59
    const b = await messen(600000);     // 10:00  <- der gemeldete Sprung
    const c = await messen(6000000);    // 100:00 (dreistellige Minuten)
    const d = await messen(59999000);   // 999:59 (oberes Ende der Reserve)

    expect(a.text).toContain('9:59');
    expect(b.text).toContain('10:00');
    expect(d.text).toContain('999:59');
    for (const [name, m] of [['10:00', b], ['100:00', c], ['999:59', d]]) {
      expect(m.boxW, `Zeit-Box bleibt bei ${name} gleich breit`).toBe(a.boxW);
      expect(m.zoomX, `Zoom-Leiste bleibt bei ${name} an ihrem Platz (x)`).toBe(a.zoomX);
      expect(m.zoomY, `Zoom-Leiste rutscht bei ${name} keine Etage tiefer (y)`).toBe(a.zoomY);
      expect(m.umbruch, `die Kopfzeile bricht bei ${name} nicht um`).toBe(false);
    }
  });

});

// „Big Numbers"-Modus (Zellwerte 10–19): der Umschalter erscheint nur für
// kleine Felder (6×6–9×9), erzeugt ein Brett mit zweistelligen Werten, und die
// komplette Spiel-Schleife (generieren → lösen → gewinnen) funktioniert.
test.describe('big numbers mode', () => {
  test('toggle generates a 10–19 board and it can be solved to a win', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'sehrleicht'; });
    // „Große Zahlen"-Umschalter sichtbar (6×6 erlaubt) → einschalten. (Der Endlos-
    // Toggle ist ein zweiter .mode-toggle, daher gezielt über den Titel ansprechen.)
    const bigToggle = page.locator('.mode-toggle', { hasText: 'Große Zahlen' });
    await expect(bigToggle).toBeVisible();
    await bigToggle.click();
    expect(await page.evaluate(() => window.__cns.state.sel.bigNumbers)).toBe(true);

    await page.locator('.diff-start').click();
    await page.waitForSelector('.screen.game');
    await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);

    // Alle Zellwerte im Bereich 10–19, Puzzle als big markiert, Brett trägt die Klasse.
    const info = await page.evaluate(() => {
      const p = window.__cns.state.puzzle;
      let min = 99, max = 0;
      for (const row of p.values) for (const v of row) { min = Math.min(min, v); max = Math.max(max, v); }
      return { big: p.bigNumbers, min, max };
    });
    expect(info).toEqual({ big: true, min: expect.any(Number), max: expect.any(Number) });
    expect(info.min).toBeGreaterThanOrEqual(10);
    expect(info.max).toBeLessThanOrEqual(19);
    await expect(page.locator('.board.big-num')).toBeVisible();

    await solveActivePuzzle(page);
    await expect(page.locator('.result-card.win')).toBeVisible({ timeout: 20000 });
  });

  test('the toggle is available for large fields too (all dimensions)', async ({ page }) => {
    await gotoApp(page);
    await page.locator('.home-actions .btn-primary').click();
    await page.waitForSelector('.screen.setup');
    await page.evaluate(() => { window.__cns.state.sel.difficulty = 'rip'; }); // 14×14
    await expect(page.locator('.mode-toggle', { hasText: 'Große Zahlen' })).toBeVisible();
  });

});


// In Coop Math Cross gemeldet (Desktop; derselbe Aufbau steckte hier): nach ein paar Zügen legte sich ein roter Vollbild-Fehler
// über die laufende Partie — „ResizeObserver loop completed with undelivered
// notifications". Das ist KEIN Fehler, sondern die Meldung des Browsers, dass er
// Größen-Benachrichtigungen auf den nächsten Frame verschoben hat. Ursache war
// eine Rückkopplung (Beobachter → Zellgröße → Brett ändert sich → …).
test.describe('Desktop: Größen-Rückkopplung', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('mehrere Züge lösen keinen Vollbild-Fehler aus', async ({ page }) => {
    const resizeWarnungen = [];
    page.on('pageerror', (e) => { if (String(e.message).includes('ResizeObserver loop')) resizeWarnungen.push(e.message); });

    await gotoApp(page);
    await startNewGame(page, 'mittel');
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => {
        const { state, onCellTap } = window.__cns;
        const p = state.puzzle;
        for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
          if (state.marks[r][c] !== 'none') continue;
          state.tool = p.solution[r][c] ? 'pen' : 'eraser';
          onCellTap(r, c);
          return;
        }
      });
      await page.waitForTimeout(60);
    }
    await expect(page.locator('#err')).toBeHidden();
    expect(resizeWarnungen, 'keine Rückkopplungs-Warnung während der Züge').toEqual([]);
  });

  test('die harmlose Warnung blendet den Fehler-Bildschirm nicht ein, ein echter Fehler schon', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => window.onerror('ResizeObserver loop completed with undelivered notifications', location.href, 0, 0, null));
    await expect(page.locator('#err'), 'harmlose Warnung bleibt unsichtbar').toBeHidden();

    await page.evaluate(() => window.onerror('Kaputt', location.href, 1, 1, new Error('Kaputt')));
    await expect(page.locator('#err'), 'ein echter Fehler wird weiterhin gezeigt').toBeVisible();
  });
});
