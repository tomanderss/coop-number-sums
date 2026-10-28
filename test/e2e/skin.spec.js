import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame } from './helpers.js';

// Verifies the 1.0 "dynamic skin": unlock via the secret code, then the
// rotating gradient ring/outline actually renders (conic-gradient background on
// the marked cell's ::after, board carries the skin-dynamic/style classes).

test.describe('dynamic skin', () => {
  test('the secret code unlocks the skin and the editor appears', async ({ page }) => {
    await gotoApp(page);
    // EXKLUSIVITÄT: Neuinstallationen bekommen den Skin NICHT mehr automatisch —
    // nur Bestandsspieler mit 1.0-Versionssprung (bzw. Code/Admin-Geschenk).
    expect(await page.evaluate(() => !!window.__cns.state.inventory.dynamicColor)).toBe(false);

    await page.evaluate(() => { const s = window.__cns.state; s.screen = 'settings'; s.settingsTab = 'farbe'; });
    const codeInput = page.getByPlaceholder('Freischaltcode');
    await expect(codeInput).toBeVisible();

    // A wrong code does not unlock.
    await codeInput.fill('nope');
    await page.locator('.account-search .btn-primary').click();
    expect(await page.evaluate(() => !!window.__cns.state.inventory.dynamicColor)).toBe(false);

    // The real code (case/space-insensitive) unlocks it.
    await codeInput.fill('  supporter SEIT tag 1 ');
    await page.locator('.account-search .btn-primary').click();
    await expect.poll(() => page.evaluate(() => !!window.__cns.state.inventory.dynamicColor)).toBe(true);

    // Editor + live preview now render.
    await expect(page.locator('.skin-preview')).toBeVisible();
  });

  test('the unlocked skin renders a conic-gradient ring on a kept cell in-game', async ({ page }) => {
    await gotoApp(page);
    // Unlock directly (equivalent to the version-jump/code path) and start a game.
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.inventory = { dynamicColor: { acquiredAt: 1, source: 'test' } };
      s.settings.skinEnabled = true; s.settings.skinStyle = 'gradient'; s.settings.skinSpeed = 2;
    });
    await startNewGame(page, 'sehrleicht');

    // Mark one correct cell as kept (pen on a solution cell).
    await page.evaluate(() => {
      const { state, onCellTap } = window.__cns;
      const p = state.puzzle;
      outer: for (let r = 0; r < p.rows; r++)
        for (let c = 0; c < p.cols; c++)
          if (p.solution[r][c] && state.marks[r][c] === 'none') { state.tool = 'pen'; onCellTap(r, c); break outer; }
    });

    // Board carries the skin classes.
    await expect(page.locator('.board.skin-dynamic.skin-style-gradient')).toBeVisible();

    // The kept cell's ::after paints a conic-gradient (the rotating ring).
    const bg = await page.evaluate(() => {
      const cell = document.querySelector('.board .cell.kept.coop-mark');
      return cell ? getComputedStyle(cell, '::after').backgroundImage : null;
    });
    expect(bg).toContain('conic-gradient');
  });

  // Nutzerwunsch: der Skin ist je Spiel einstellbar und separat aktivierbar.
  test('der Skin gilt je Spiel: in Math Cross aus, in Number Sums an', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const s = window.__cns.state;
      s.inventory = { dynamicColor: { acquiredAt: 1, source: 'test' } };
      s.screen = 'settings'; s.settingsTab = 'farbe';
    });
    await expect(page.locator('.skin-game-hint')).toContainText('Number Sums');
    // In Number Sums einschalten (Einstellungen-Schalter).
    const sw = page.locator('.set-row', { hasText: 'Skin aktiv' }).first();
    await sw.click();
    expect(await page.evaluate(() => window.__cns.state.settings.skinByGame.numbersums.skinEnabled)).toBe(true);
    expect(await page.evaluate(() => window.__cns.board.skinActive.value)).toBe(true);
    // Math Cross hat seinen eigenen Stand: aus.
    await page.evaluate(() => { window.__cns.state.screen = 'home'; window.__cns.setSetting('divStyle', 'obelus'); });
    await page.evaluate(() => window.__cns.switchGame('mathcross'));
    expect(await page.evaluate(() => window.__cns.board.skinActive.value)).toBe(false);
    await page.evaluate(() => { const s = window.__cns.state; s.screen = 'settings'; s.settingsTab = 'farbe'; });
    await expect(page.locator('.skin-game-hint')).toContainText('Math Cross');
    await expect(page.locator('.set-row', { hasText: 'Skin aktiv' }).first().locator('.switch')).not.toHaveClass(/\bon\b/);
    // Ein Stil-Wechsel in Math Cross ändert Number Sums nicht.
    await page.locator('.seg button', { hasText: 'Regenbogen' }).click();
    const sb = await page.evaluate(() => window.__cns.state.settings.skinByGame);
    expect(sb.mathcross.skinStyle).toBe('rainbow');
    expect(sb.numbersums.skinStyle).toBeUndefined();
  });
});
