import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers.js';

// Nutzerwunsch: „Schriften ueberlappen sich niemals, alle Buttons haben feste
// Positionen und verschieben sich nie dynamisch." Gemessen wurde vorher: die
// Startseite war vertikal zentriert — erschien ein Fortsetzen-Knopf, rutschten
// Scheibe, Titel und alle Modus-Knoepfe um ~30 px; der Offline-Chip lag ueber
// dem Serien-Zaehler und die Marke „Offline" in laengeren Sprachen ueber der
// Beschriftung des Coop-Knopfs.

const FIXED = ['.gw-item.on', '.brand-title', '.home-profile-chip', '.home-actions .btn-primary',
  '.home-actions .btn-coop', '.home-actions .race-btn', '.home-grid', '.home-missions-btn', '.home-settings-btn'];

async function boxes(page) {
  return page.evaluate((sel) => Object.fromEntries(sel.map((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return [s, [r.x, r.y, r.width, r.height].map(Math.round).join(',')];
  })), FIXED);
}

// Alle sichtbaren Textstuecke auf der Startseite (beschnitten auf ihre
// Scroll-/Clip-Container) — keine zwei verschiedenen Elemente duerfen sich treffen.
async function textOverlaps(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.screen.home');
    const visible = (el) => {
      for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (+c.opacity < 0.05 || c.display === 'none' || c.visibility === 'hidden') return false;
      }
      return true;
    };
    const clipOf = (el) => {
      let r = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
      for (let p = el.parentElement; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.overflowX !== 'visible' || c.overflowY !== 'visible') {
          const b = p.getBoundingClientRect();
          r = { l: Math.max(r.l, b.left), t: Math.max(r.t, b.top), r: Math.min(r.r, b.right), b: Math.min(r.b, b.bottom) };
        }
      }
      return r;
    };
    const items = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.textContent.trim() || !visible(n.parentElement)) continue;
      const cl = clipOf(n.parentElement);
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const b of rg.getClientRects()) {
        const bb = [Math.max(b.left, cl.l), Math.max(b.top, cl.t), Math.min(b.right, cl.r), Math.min(b.bottom, cl.b)];
        if (bb[2] - bb[0] > 1 && bb[3] - bb[1] > 1) items.push({ t: n.textContent.trim(), b: bb, el: n.parentElement });
      }
    }
    const out = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], c = items[j];
      if (a.el === c.el) continue;
      const x = Math.min(a.b[2], c.b[2]) - Math.max(a.b[0], c.b[0]);
      const y = Math.min(a.b[3], c.b[3]) - Math.max(a.b[1], c.b[1]);
      if (x > 2 && y > 2) out.push(`${a.t} × ${c.t}`);
    }
    return out;
  });
}

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`Startseite: Knoepfe bleiben stehen, wenn Fortsetzen/Offline/Serie erscheinen (${w}x${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await gotoApp(page);
    await page.waitForTimeout(400);
    const base = await boxes(page);
    expect(await textOverlaps(page)).toEqual([]);

    await page.evaluate(() => {
      const s = window.__cns.state;
      s.streak.currentStreak = 123;
      s.resumeAvailable = { difficulty: 'mittel', rows: 8, cols: 8, elapsed: 61000 };
      s.resumeAvailableCoop = { difficulty: 'mittel', rows: 8, cols: 8, elapsed: 61000 };
      s.net = 'offline';
    });
    await expect(page.locator('.resume-stack .btn-resume')).toHaveCount(2);
    await expect(page.locator('.offline-chip')).toBeVisible();
    await page.waitForTimeout(400);
    expect(await boxes(page)).toEqual(base);
    expect(await textOverlaps(page)).toEqual([]);

    // ... und wieder weg: auch dann rutscht nichts zurueck.
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.resumeAvailable = null; s.resumeAvailableCoop = null; s.net = 'online';
    });
    await expect(page.locator('.resume-stack')).toHaveCount(0);
    await page.waitForTimeout(400);
    expect(await boxes(page)).toEqual(base);
  });
}

test('Startseite: der Spielwechsel verschiebt die Knoepfe nicht', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page);
  await page.evaluate(() => { window.__cns.state.settings.divStyle = 'obelus'; });
  await page.waitForTimeout(400);
  const base = await boxes(page);
  await page.locator('.gw-item[data-game="mathcross"]').click();
  await page.waitForFunction(() => window.__cns.gameId === 'mathcross');
  await page.waitForTimeout(800);
  expect(await boxes(page)).toEqual(base);
});

test.describe('lange Beschriftungen', () => {
  test.use({ locale: 'fr-FR' });
  test('Marke „Hors ligne" liegt nicht ueber „Mode coopératif"', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoApp(page);
    await page.evaluate(() => { window.__cns.state.net = 'offline'; window.__cns.state.streak.currentStreak = 123; });
    await expect(page.locator('.btn-coop .badge-soon')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await textOverlaps(page)).toEqual([]);
  });
});
