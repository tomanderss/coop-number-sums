import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './mathcross-helpers.js';

// Das Geteilt-Zeichen ist reine Anzeige (gerechnet wird immer mit '/'). Der
// Obelus ist in vielen Schriften so eng gesetzt, dass er auf kleinen Feldern wie
// ein Plus aussieht (gemeldet) — deshalb selbst gezeichnet, und es gibt die
// beiden schriftunabhaengigen Alternativen ':' und '/'.
//
// Die FRAGE haengt bewusst an nichts als dem App-Start (eigenes Flag
// state.showDivStyle, wie „Was ist neu") — nicht an einem Spielstart, einer
// Schwierigkeit oder daran, ob gerade ein anderes Fenster offen ist. Vorher war
// sie an all das gekoppelt und ein Nutzer hat sie NIE zu Gesicht bekommen,
// obwohl jeder einzelne Pfad lokal ausloeste.
test.describe('Geteilt-Zeichen', () => {
  // Wie gotoApp, aber OHNE die Wahl vorzubelegen — hier geht es ja genau darum.
  async function startenOhneVorbelegung(page) {
    // Math Cross als aktives Spiel (die Frage gehört nur zu diesem Spiel).
    await page.addInitScript(() => {
      try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('mathcross')); } catch {}
    });
    await page.goto('/');
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 });
    const whatsNew = page.locator('.whatsnew-badge');
    if (await whatsNew.isVisible().catch(() => false)) await page.locator('.modal-bg .btn-primary').first().click();
    await page.locator('.skin-unlock-modal .btn-ghost').click({ timeout: 2000 }).catch(() => {});
  }
  // Eigene Klasse statt Textsuche: der Update-Dialog listet die Aenderung
  // „Geteilt-Zeichen …" mit auf und wuerde eine Textsuche mit treffen.
  // „Schwer" teilt fast immer, aber NICHT garantiert — wer ein Brett mit einer
  // Division braucht, laedt sonst ein frisches. (Ohne das war der Test je nach
  // erzeugtem Raetsel mal gruen, mal rot.) Setzt eine bereits getroffene Wahl
  // voraus, sonst belegte gotoApp sie hier vor.
  async function brettMitDivision(page) {
    for (let versuch = 0; versuch < 5; versuch++) {
      if (versuch) await gotoApp(page);
      await startNewGame(page, 'schwer');
      const hat = await page.evaluate(() => window.__cns.state.puzzle.equations.some((e) => (e.ops || []).includes('/')));
      if (hat) return true;
    }
    return false;
  }
  const frage = (page) => page.locator('.modal-bg .modal-divstyle');

  test('die Frage kommt beim Start und ist nach der Antwort fuer immer weg', async ({ page }) => {
    test.setTimeout(120000);
    await startenOhneVorbelegung(page);
    await expect(frage(page), 'die Frage kommt ohne jedes Zutun').toBeVisible();

    await frage(page).getByText('Doppelpunkt').click();
    expect(await page.evaluate(() => window.__cns.state.settings.divStyle)).toBe('colon');
    await expect(frage(page)).toHaveCount(0);

    // Das Brett zeigt ':' und keinen gezeichneten Obelus mehr.
    expect(await brettMitDivision(page), 'kein Brett mit Division gefunden').toBe(true);
    expect(await page.locator('.board .op-obelus').count(), 'kein Obelus mehr').toBe(0);
    await expect(page.locator('.board .opcell', { hasText: ':' }).first()).toBeVisible();

    // Neustart der App: die Frage kommt nicht wieder.
    await startenOhneVorbelegung(page);
    expect(await page.evaluate(() => window.__cns.state.settings.divStyle), 'Wahl ueberlebt den Neustart').toBe('colon');
    await expect(frage(page)).toHaveCount(0);
  });

  // DER Fall, auf den es ankommt: ein Bestandsnutzer, der die App AKTUALISIERT.
  // Seine gespeicherten Einstellungen kennen `divStyle` gar nicht.
  test('ein Bestandsnutzer ohne gespeicherte Wahl wird nach dem Update gefragt', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => {
      if (!localStorage.getItem('cns_settings')) {
        localStorage.setItem('cns_settings', JSON.stringify({
          themeMode: 'dark', coopName: 'Alt', markColor: '#f2c024', dragScale: 1,
          appTheme: 'standard', numberFont: 'classic', updatedAt: Date.now() - 86400000,
        }));
      }
    });
    await startenOhneVorbelegung(page);
    expect(await page.evaluate(() => window.__cns.state.settings.divStyle), 'Alt-Stand kennt das Feld nicht').toBeNull();
    expect(await page.evaluate(() => window.__cns.state.settings.coopName), 'der uebrige Alt-Stand bleibt erhalten').toBe('Alt');
    await expect(frage(page), 'die Frage kommt').toBeVisible();
  });

  // Die Frage darf nicht unter dem Update-Dialog liegen — sonst sieht man sie
  // beim ersten Start nach einem Update gar nicht.
  test('der Update-Dialog hat Vorrang, die Frage kommt danach', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => {
      try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('mathcross')); } catch {}
    });
    await page.goto('/');
    await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 });
    // Frischer Kontext: „Was ist neu" liegt obenauf, die Frage wartet dahinter.
    expect(await page.evaluate(() => window.__cns.state.showWhatsNew), 'Update-Dialog steht').toBe(true);
    expect(await page.evaluate(() => window.__cns.state.showDivStyle), 'die Frage ist vorgemerkt').toBe(true);
    await expect(frage(page), 'aber noch nicht sichtbar').toHaveCount(0);

    await page.locator('.modal-bg .btn-primary').first().click();
    await page.locator('.skin-unlock-modal .btn-ghost').click({ timeout: 2000 }).catch(() => {});
    await expect(frage(page), 'jetzt kommt sie').toBeVisible();
  });

  test('ohne Wahl zeichnet das Brett den Obelus selbst', async ({ page }) => {
    test.setTimeout(120000);
    await startenOhneVorbelegung(page);
    await frage(page).getByText('Obelus').click();
    expect(await brettMitDivision(page), 'kein Brett mit Division gefunden').toBe(true);
    const obelus = page.locator('.board .op-obelus').first();
    await expect(obelus).toBeVisible();
    // Kein Schriftzeichen, sondern gezeichnet — die Punkte sitzen als
    // Pseudo-Elemente deutlich weiter aussen als im Font-Obelus.
    const mass = await obelus.evaluate((el) => ({ text: el.textContent, hoehe: el.getBoundingClientRect().height }));
    expect(mass.text, 'kein Textinhalt — reine Zeichnung').toBe('');
    expect(mass.hoehe).toBeGreaterThan(0);
  });

  test('die Einstellung laesst sich spaeter aendern und wirkt sofort', async ({ page }) => {
    test.setTimeout(120000);
    await gotoApp(page);   // belegt 'obelus' vor
    expect(await brettMitDivision(page), 'kein Brett mit Division gefunden').toBe(true);
    expect(await page.locator('.board .op-obelus').count()).toBeGreaterThan(0);

    await page.evaluate(() => window.__cns.setSetting('divStyle', 'slash'));
    expect(await page.locator('.board .op-obelus').count(), 'Umschalten wirkt am laufenden Brett').toBe(0);
    await expect(page.locator('.board .opcell', { hasText: '/' }).first()).toBeVisible();
  });
});
