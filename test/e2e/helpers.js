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
  // Ab 1.0 bekommt JEDER (auch frische Kontexte) den „Feier des Tages"-Skin, dessen
  // einmaliges Feier-Modal sich NACH „Was ist neu" über den Home-Screen legt. Best
  // effort per „Später"-Knopf wegklicken, damit Klicks aufs Menü nicht abgefangen
  // werden; no-op, falls es (künftig) nicht erscheint.
  await page.locator('.skin-unlock-modal .btn-ghost').click({ timeout: 2000 }).catch(() => {});
  await page.waitForSelector('.screen.home');
}

// Klappt eine Einstellungs-Karte (Accordion) per sichtbarem Label auf (z.B.
// 'Ton', 'Daten', 'Darstellung', 'Farbe'). Setzt voraus, dass der Einstellungen-
// Screen bereits offen ist. Ersetzt die frühere Drawer-Navigation.
export async function gotoSettingsSection(page, label) {
  await page.locator('.screen.settings .admin-acc-head', { hasText: label }).click();
}

export async function startNewGame(page, difficulty = 'sehrleicht') {
  await page.locator('.home-actions .btn-primary').click();
  // Solo-Auswahl: „Klassisch" führt in den Schwierigkeits-Setup (Endlos = eigener Modus).
  await page.waitForSelector('.screen.solo-menu');
  await page.locator('.solo-card-classic').click();
  await page.waitForSelector('.screen.setup');
  // Solo-Setup ist ein Slider (keine Karten mehr): Schwierigkeit direkt über den
  // Debug-Hook wählen, dann starten. (Coop/Race/Team behalten das Kartenraster.)
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; }, difficulty);
  await page.locator('.diff-start').click();
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

// Nach dem ERSTEN abgeschlossenen Spiel eines Kalendertags legt sich der
// "Streak verlängert/gestartet"-Feier-Screen über die Ergebnis-Karte (siehe
// state.streakExtended in app.js). In Tests startet localStorage pro Test leer,
// also erscheint er beim ersten Sieg/Verlust und fängt sonst Klicks auf die
// Ergebnis-Karte/das Menü ab. Diese Helper-Funktion blendet ihn best effort weg;
// no-op, wenn er (z.B. beim zweiten Spiel desselben Tests) gar nicht erscheint.
export async function dismissStreakModal(page) {
  try { await page.locator('.streak-modal.extended .btn-primary').click({ timeout: 3000 }); } catch {}
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
