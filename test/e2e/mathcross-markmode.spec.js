import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './mathcross-helpers.js';

// Markierungsmodus: eine SCHNELLERE Art zu markieren, kein neuer Zustand. Das
// lange Druecken bleibt daneben unveraendert; im Modus genuegt ein einfacher
// Tipp, dafuer sind Zahlen gesperrt (sonst laege bei jedem Tipp ein Stein
// daneben statt einer Markierung).
test.describe('Markierungsmodus', () => {
  const brush = (page) => page.locator('.mark-toggle');
  const muell = (page) => page.locator('.mark-clear');
  const zelle = (page, i) => page.locator('.cell[data-r]').nth(i);

  test('ein Tipp markiert, der naechste entmarkiert', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    expect(await page.evaluate(() => window.__cns.state.markMode), 'startet aus').toBe(false);

    await brush(page).click();
    expect(await page.evaluate(() => window.__cns.state.markMode)).toBe(true);
    await expect(brush(page)).toHaveClass(/on/);

    await zelle(page, 0).click();
    await zelle(page, 2).click();
    expect(await page.evaluate(() => window.__cns.state.hl.length), 'zwei Markierungen').toBe(2);
    await expect(zelle(page, 0)).toHaveClass(/marked/);

    await zelle(page, 0).click();   // derselbe Tipp nimmt sie wieder weg
    expect(await page.evaluate(() => window.__cns.state.hl.length)).toBe(1);
    await expect(zelle(page, 0)).not.toHaveClass(/marked/);
  });

  test('im Modus laesst sich keine Zahl anfassen und die Auswahl faellt weg', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    // Erst einen Stein aus dem Vorrat aufnehmen …
    await page.locator('.tray .tile').first().click();
    expect(await page.evaluate(() => !!window.__cns.state.pick), 'Stein liegt in der Hand').toBe(true);

    // … dann den Modus einschalten: die Hand wird geleert.
    await brush(page).click();
    expect(await page.evaluate(() => window.__cns.state.pick), 'Auswahl fallen gelassen').toBeNull();

    // Der Vorrat gibt jetzt nichts mehr her.
    await page.locator('.tray .tile').first().click();
    expect(await page.evaluate(() => !!window.__cns.state.pick), 'Vorrat ist gesperrt').toBe(false);

    // Und ein Tipp aufs Brett legt keine Zahl, sondern markiert.
    const vorher = await page.evaluate(() => window.__cns.placedCount ? 0 : JSON.stringify(window.__cns.state.placed));
    await zelle(page, 0).click();
    expect(await page.evaluate(() => window.__cns.state.hl.length), 'markiert statt gelegt').toBe(1);
    expect(await page.evaluate(() => JSON.stringify(window.__cns.state.placed)), 'kein Stein gelegt').toBe(vorher);
  });

  test('langes Druecken markiert weiterhin, auch nach dem Modus', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    await brush(page).click();
    await zelle(page, 0).click();
    await brush(page).click();   // Modus wieder aus
    expect(await page.evaluate(() => window.__cns.state.markMode)).toBe(false);

    const z = zelle(page, 2);
    const box = await z.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(z, 'langes Druecken funktioniert unveraendert').toHaveClass(/marked/);
    expect(await page.evaluate(() => window.__cns.state.hl.length)).toBe(2);
  });

  test('der Loeschen-Knopf erscheint erst mit Markierungen und fragt nach', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    await expect(muell(page), 'ohne Markierung kein Knopf').toHaveCount(0);

    await brush(page).click();
    await zelle(page, 0).click();
    await zelle(page, 2).click();
    await expect(muell(page), 'mit Markierung erscheint er').toBeVisible();

    // Rueckfrage: Abbrechen laesst alles stehen.
    await muell(page).click();
    await expect(page.locator('.modal-bg')).toBeVisible();
    await page.locator('.modal-bg .btn-ghost').first().click();
    expect(await page.evaluate(() => window.__cns.state.hl.length), 'Abbrechen loescht nichts').toBe(2);

    // Bestaetigen raeumt alles weg, der Knopf verschwindet wieder.
    await muell(page).click();
    await page.locator('.modal-bg .btn-danger').first().click();
    expect(await page.evaluate(() => window.__cns.state.hl.length)).toBe(0);
    await expect(muell(page)).toHaveCount(0);
  });

  // Die Leiste hat zwei Abteile mit festen Plaetzen: erscheint ein optionaler
  // Knopf, darf daneben NICHTS verrutschen (gemeldeter Wunsch).
  test('die Knoepfe bleiben an ihrem Platz, wenn andere erscheinen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const plus = page.locator('.toolgrp').nth(1).locator('.zoom-btn').last();
    const pinsel = brush(page);
    const vorher = { plus: (await plus.boundingBox()).x, pinsel: (await pinsel.boundingBox()).x };

    // Markierung setzen -> Muelleimer erscheint
    await pinsel.click();
    await zelle(page, 0).click();
    await expect(muell(page)).toBeVisible();
    expect((await plus.boundingBox()).x, 'Zoom-Plus bleibt stehen').toBe(vorher.plus);
    expect((await pinsel.boundingBox()).x, 'Pinsel bleibt stehen').toBe(vorher.pinsel);

    // Zoomen -> Zoom-Reset erscheint an seinem angestammten Platz links von − / +
    await plus.click();
    await expect(page.locator('.zoom-reset')).toBeVisible();
    expect((await plus.boundingBox()).x, 'Zoom-Plus bleibt weiterhin stehen').toBe(vorher.plus);
    expect((await pinsel.boundingBox()).x, 'Pinsel bleibt weiterhin stehen').toBe(vorher.pinsel);
    const reset = await page.locator('.zoom-reset').boundingBox();
    const minus = await page.locator('.toolgrp').nth(1).locator('.zoom-btn').nth(1).boundingBox();
    expect(reset.x, 'Reset sitzt links von −').toBeLessThan(minus.x);
  });

  // Jede Kopf-Zeile ist auf dem Handy Brettflaeche: die Werkzeuge haben deshalb
  // KEINE eigene Reihe, sondern sitzen in der Kopfleiste, und die Info-Chips
  // teilen sich die zweite Zeile mit dem Fortschrittsbalken. Gemeldet war genau
  // der umgekehrte Zustand (Werkzeuge in einer dritten Reihe, Brett kleiner) —
  // im Solo-Fall muss die Kopfleiste EINE Zeile bleiben.
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
      };
    });
    expect(m.werkzeugeImKopf, 'die Werkzeuge sitzen in der Kopfleiste').toBe(true);
    expect(m.chipsBeimFortschritt, 'Chips teilen die Zeile mit dem Fortschritt').toBe(true);
    expect(m.umbruch, 'die Kopfleiste bricht im Solo nicht um').toBe(false);
    expect(m.kopfHoehe, 'Kopfleiste bleibt flach').toBeLessThanOrEqual(56);
    // Vor dem Umbau begann das Brett bei 158-190 px.
    expect(m.brettOben, 'das Brett beginnt weit oben').toBeLessThan(120);
  });

  // Gemeldet: beim Sprung 9:59 -> 10:00 kam EIN Zeichen dazu, der Zeit-Kasten
  // wuchs, die Kopfzeile wurde breiter und die Werkzeugleiste rutschte "eine
  // Etage tiefer", war also nicht mehr buendig. tabular-nums macht nur die
  // ZIFFERN gleich breit, nicht ihre ANZAHL — deshalb eine feste Zeit-Box plus
  // eine Kopfzeile, die gar nicht mehr umbricht (statt ihrer wickelt das HUD
  // intern um).
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
      expect(m.zoomX, `Werkzeugleiste bleibt bei ${name} an ihrem Platz (x)`).toBe(a.zoomX);
      expect(m.zoomY, `Werkzeugleiste rutscht bei ${name} keine Etage tiefer (y)`).toBe(a.zoomY);
      expect(m.umbruch, `die Kopfzeile bricht bei ${name} nicht um`).toBe(false);
    }
  });
});
