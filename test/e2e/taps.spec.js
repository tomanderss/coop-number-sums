import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Gemeldet: „Ich muss Zahlen teils doppelt antippen, das Spiel hängt hinterher
// und erkennt nicht jeden Tipp — tippe ich dann nochmal, ist es ein Fehler."
// Ein Tipp zählt deshalb beim BERÜHREN (pointerdown) statt beim click, und ein
// Zug zeichnet nur noch die getroffene Zelle neu statt des ganzen Bretts.

test.use({ hasTouch: true, isMobile: true });

// Mittelpunkte unmarkierter Zellen mit gewünschter Lösung (true = einkreisen).
async function cells(page, keep, n) {
  return page.evaluate(({ keep, n }) => {
    const s = window.__cns.state; const P = s.puzzle;
    const els = document.querySelectorAll('.board .cell');
    const out = [];
    let i = 0;
    for (let r = 0; r < P.rows; r++) for (let c = 0; c < P.cols; c++) {
      const el = els[i++];
      if (out.length < n && !!P.solution[r][c] === keep && s.marks[r][c] === 'none') {
        const b = el.getBoundingClientRect();
        out.push({ r, c, x: b.x + b.width / 2, y: b.y + b.height / 2 });
      }
    }
    return out;
  }, { keep, n });
}
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await startNewGame(page, 'mittel');
  await page.evaluate(() => { window.__cns.state.tool = 'pen'; });
});

test('ueberlappende Tipps mit zwei Daumen zaehlen beide', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  const [a, b, c, d] = await cells(page, true, 4);
  // A runter, B runter (A noch unten), A hoch, B hoch — beim click-Weg ging hier
  // mindestens ein Tipp verloren.
  await touch(cdp, 'touchStart', [{ x: a.x, y: a.y, id: 1 }]);
  await touch(cdp, 'touchStart', [{ x: a.x, y: a.y, id: 1 }, { x: b.x, y: b.y, id: 2 }]);
  await touch(cdp, 'touchEnd', [{ x: b.x, y: b.y, id: 2 }]);
  await touch(cdp, 'touchEnd', []);
  // Ein Finger, der beim Tippen etwas rutscht.
  await touch(cdp, 'touchStart', [{ x: c.x, y: c.y }]);
  await touch(cdp, 'touchMove', [{ x: c.x + 7, y: c.y + 6 }]);
  await touch(cdp, 'touchEnd', []);
  await touch(cdp, 'touchStart', [{ x: d.x, y: d.y }]);
  await touch(cdp, 'touchEnd', []);
  const marks = await page.evaluate((ts) => ts.map((t) => window.__cns.state.marks[t.r][t.c]), [a, b, c, d]);
  expect(marks).toEqual(['kept', 'kept', 'kept', 'kept']);
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(0);
});

test('ein Tipp zaehlt genau einmal (kein zweiter Zug durch den nachfolgenden click)', async ({ page }) => {
  const [wrong] = await cells(page, false, 1);
  await page.touchscreen.tap(wrong.x, wrong.y);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(1);
  const [ok] = await cells(page, true, 1);
  await page.mouse.click(ok.x, ok.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate((t) => window.__cns.state.marks[t.r][t.c], ok)).toBe('kept');
  expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(1);
});

test('ein Zug zeichnet nur die getroffene Zelle neu', async ({ page }) => {
  const [a] = await cells(page, true, 1);
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__cns.cellRenders());
  await page.touchscreen.tap(a.x, a.y);
  await page.waitForTimeout(300);
  const delta = await page.evaluate((n) => window.__cns.cellRenders() - n, before);
  // Die Zelle selbst (+ evtl. Puls-Zellen, falls der Zug etwas aufloest) — nie das Brett.
  expect(delta).toBeGreaterThan(0);
  expect(delta).toBeLessThan(20);
});

test('eine schnelle Tipp-Folge wird vollstaendig gespeichert', async ({ page }) => {
  const ts = await cells(page, true, 5);
  for (const t of ts) await page.touchscreen.tap(t.x, t.y);
  await page.waitForTimeout(700);
  const saved = await page.evaluate((ts) => {
    const g = JSON.parse(localStorage.getItem('cns_active_game'));
    return ts.map((t) => g.marks[t.r][t.c]);
  }, ts);
  expect(saved).toEqual(ts.map(() => 'kept'));
});
