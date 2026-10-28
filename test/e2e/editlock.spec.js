import { test, expect } from '@playwright/test';
import { gotoApp as gotoHome } from './helpers.js';

// Bearbeiten-Sperre (features.editLock): im Coop zeichnet immer nur EINER, die
// anderen sehen live zu, können anfragen; der Halter gibt ab oder behält —
// ohne Antwort wird automatisch übergeben. Ohne Firebase wird der Stand der
// Sperre über den Test-Haken onEditState eingespielt (wie Coop.onEdit).

async function boot(page) {
  await page.addInitScript(() => { try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('rectangles')); } catch {} });
  await gotoHome(page);
  const p = await page.evaluate(async () => {
    const { generatePuzzle } = await import('/js/games/rectangles/generator.js');
    return generatePuzzle({ difficulty: 'leicht', seed: 11 });
  });
  await page.evaluate((puzzle) => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me'; s.coop.connected = true;
    s.coop.players = [{ id: 'host', name: 'Hanna', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'init', gameId: 'el1', running: true, puzzle, rects: [], startTime: Date.now() - 5000, lives: 3, maxLives: 3, mistakes: 0 });
  }, p);
  await page.waitForSelector('.screen.game .rect-board');
  return p;
}
const rectCount = (page) => page.evaluate(() => window.__cns.state.rects.length);

test('frei: wer zeichnet, nimmt die Sperre; Freigeben macht sie wieder frei', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.edit-chip.free')).toBeVisible();
  await page.evaluate(() => window.__cns.drawRect(0, 0, 0, 1));
  expect(await rectCount(page)).toBe(1);
  expect(await page.evaluate(() => window.__cns.state.coop.edit.uid)).toBe('me');
  await expect(page.locator('.edit-chip.me')).toContainText('Du zeichnest');
  await page.locator('.edit-chip').click();
  expect(await page.evaluate(() => window.__cns.state.coop.edit)).toBeNull();
  await expect(page.locator('.edit-chip.free')).toBeVisible();
});

test('gesperrt: der andere zeichnet live, ich kann nur anfragen', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__cns.onEditState({ uid: 'host', name: 'Hanna', at: Date.now() }));
  await expect(page.locator('.edit-chip.other')).toContainText('Hanna');
  await expect(page.locator('.board-wrap.edit-locked')).toBeVisible();
  await page.evaluate(() => window.__cns.drawRect(0, 0, 0, 1));
  expect(await rectCount(page)).toBe(0);
  // Live: was Hanna gerade zieht, erscheint in ihrer Farbe.
  await page.evaluate(() => window.__cns.setLiveState({ host: { box: { r: 1, c: 1, h: 2, w: 3 }, cur: 7, c: '#e5679a' } }));
  await expect(page.locator('.live-box')).toBeVisible();
  await expect(page.locator('.live-cursor')).toBeVisible();
  await page.evaluate(() => window.__cns.setLiveState({}));
  await expect(page.locator('.live-box')).toHaveCount(0);
  // Anfragen.
  await page.evaluate(() => window.__cns.clearSentLog());
  await page.locator('.edit-chip').click();
  await expect(page.locator('.edit-chip.asked')).toBeVisible();
  expect((await page.evaluate(() => window.__cns.sentLog())).map((x) => x.type)).toContain('editRequest');
  // Hanna gibt ab → ich bin dran.
  await page.evaluate(() => window.__cns.onEditState({ uid: 'me', name: 'Ich', at: Date.now() }));
  await expect(page.locator('.edit-chip.me')).toBeVisible();
  await expect(page.locator('.board-wrap.edit-locked')).toHaveCount(0);
  await page.evaluate(() => window.__cns.drawRect(0, 0, 0, 1));
  expect(await rectCount(page)).toBe(1);
});

test('eine Anfrage an mich: abgeben, behalten oder automatisch nach 10 s', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__cns.drawRect(0, 0, 0, 1));   // ich halte die Sperre
  const ask = (at) => page.evaluate((at) => window.__cns.onEditState({ uid: 'me', name: 'Ich', at: Date.now(), req: { uid: 'host', name: 'Hanna', at } }), at);
  await ask(1);
  await expect(page.locator('.edit-req')).toContainText('Hanna möchte zeichnen');
  await page.locator('.edit-req .btn-ghost').click();          // behalten
  await expect(page.locator('.edit-req')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cns.state.coop.edit.uid)).toBe('me');
  await ask(2);
  await page.locator('.edit-req .btn-primary').click();        // abgeben
  expect(await page.evaluate(() => window.__cns.state.coop.edit.uid)).toBe('host');
  await expect(page.locator('.edit-chip.other')).toBeVisible();
  // Wieder bei mir, neue Anfrage, keine Antwort → nach 10 s automatisch abgegeben.
  await page.evaluate(() => window.__cns.onEditState({ uid: 'me', name: 'Ich', at: Date.now() }));
  await ask(3);
  await page.waitForFunction(() => window.__cns.state.coop.edit && window.__cns.state.coop.edit.uid === 'host', null, { timeout: 13000 });
});

test('Solo und Zahlen-Spiele kennen keine Sperre', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('cns_game', JSON.stringify('numbersums')); } catch {} });
  await gotoHome(page);
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game .board');
  await expect(page.locator('.edit-chip')).toHaveCount(0);
});
