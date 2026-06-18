// Shared helpers for the Playwright E2E suite. The app exposes a debug hook
// (window.__cns = { state, onCellTap, isSolved }) gated to localhost/127.0.0.1
// in js/app.js -- our webServer always runs on 127.0.0.1, so every test can
// drive/inspect the full Vue reactive state without any extra instrumentation.

export async function gotoApp(page) {
  await page.goto('/');
  await page.waitForSelector('#splash', { state: 'hidden', timeout: 10000 });
  // First load in a fresh context always has no seen version yet, so the
  // "what's new" modal covers the home screen -- dismiss it before continuing.
  const whatsNew = page.locator('.whatsnew-badge');
  if (await whatsNew.isVisible().catch(() => false)) {
    await page.locator('.modal-bg .btn-primary').click();
  }
  await page.waitForSelector('.screen.home');
}

// DIFFICULTIES (config.js) is ordered sehrleicht..mashallah, so its option
// cards render in that same order -- pick by position rather than by label
// text, since the visible label is translated.
const DIFFICULTY_INDEX = { sehrleicht: 0, leicht: 1, mittel: 2, schwer: 3, extrem: 4, mashallah: 5 };

export async function startNewGame(page, difficulty = 'sehrleicht') {
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  await page.locator('.option-grid .opt-card').nth(DIFFICULTY_INDEX[difficulty]).click();
  await page.locator('.btn-start').click();
  await page.waitForSelector('.screen.game');
  await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
}

// Programmatically solves the active puzzle via the window.__cns debug hook,
// mirroring exactly what a real tap does (tool selection -> onCellTap).
export async function solveActivePuzzle(page) {
  await page.evaluate(() => {
    const { state, onCellTap } = window.__cns;
    const p = state.puzzle;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        if (state.marks[r][c] !== 'none') continue;
        state.tool = p.solution[r][c] ? 'pen' : 'eraser';
        onCellTap(r, c);
      }
    }
  });
}

// Commits `count` deliberate wrong taps (errorReveal defaults to 'instant',
// where a wrong tap never sets the mark -- it only registers a mistake/loses
// a life -- so the same cell can be tapped repeatedly without side effects).
export async function commitMistakes(page, count) {
  await page.evaluate((n) => {
    const { state, onCellTap } = window.__cns;
    const p = state.puzzle;
    let wrongR = -1, wrongC = -1;
    outer: for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        if (state.marks[r][c] === 'none') { wrongR = r; wrongC = c; break outer; }
      }
    }
    state.tool = p.solution[wrongR][wrongC] ? 'eraser' : 'pen'; // deliberately wrong tool
    for (let i = 0; i < n; i++) onCellTap(wrongR, wrongC);
  }, count);
}
