// Helfer für die Math-Cross-E2E-Tests (übernommen aus Coop Math Cross,
// test/e2e/helpers.js). Einziger Unterschied: gotoApp wählt vorher Math Cross
// als aktives Spiel, und die Generator-Importe zeigen ins Spielmodul.
// Speicher-Schlüssel: die spieleigenen Daten von Math Cross liegen hier unter
// `cns_<name>__mathcross` (in Coop Math Cross waren es `cmc_<name>`), die
// kontoweiten (Einstellungen, Guthaben …) unter `cns_<name>`.
// Shared helpers for the Playwright E2E suite. The app exposes a debug hook
// (window.__cns = { state, placeAt, placeOne, isSolved, … }) gated to localhost/127.0.0.1
// in js/app.js -- our webServer always runs on 127.0.0.1, so every test can
// drive/inspect the full Vue reactive state without any extra instrumentation.

// Math Cross ist eines von mehreren Spielen der App. Die Wahl liegt geräteweit in
// localStorage (cns_game) und wird VOR dem ersten Skript gesetzt — genau so, wie
// sie nach der Spielauswahl im Menü stünde.
export async function gotoApp(page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('cns_game')) localStorage.setItem('cns_game', JSON.stringify('mathcross')); } catch {}
  });
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
  // Beim ersten Raetsel MIT Division fragt die App einmalig nach dem
  // Geteilt-Zeichen (settings.divStyle). Fuer jeden anderen Test ist dieses
  // Pop-up nur ein Overlay, das Klicks abfaengt — deshalb hier einmal
  // vorbelegen, genau wie „Was ist neu" und die Skin-Feier oben weggeklickt
  // werden. divstyle.spec.js setzt es bewusst auf null zurueck und prueft die
  // Frage selbst.
  // NUR vorbelegen, wenn noch nichts gewaehlt ist — sonst ueberschriebe ein
  // Reload mitten im Test die gerade getroffene Wahl (genau so einmal rot
  // geworden).
  await page.evaluate(() => {
    if (window.__cns && !window.__cns.state.settings.divStyle) window.__cns.setSetting('divStyle', 'obelus');
  });
  await page.waitForSelector('.screen.home');
  await installTestPuzzle(page);
}

// Legt ein ECHTES Rätsel als window.__testPuzzle ab. Die Coop-Tests spielen
// INIT-Nachrichten von Hand ein und brauchen dafür ein Brett, das exakt dem
// Modell entspricht — handgeschriebene Attrappen veralten sonst bei jeder
// Modelländerung.
export async function installTestPuzzle(page, difficulty = 'sehrleicht', seed = 4711) {
  await page.evaluate(async ({ difficulty, seed }) => {
    const [{ generatePuzzle }, { genOptionsFor }] = await Promise.all([
      import('/js/games/mathcross/generator.js'),
      import('/js/games/mathcross/difficulty.js'),
    ]);
    window.__testPuzzle = JSON.parse(JSON.stringify(generatePuzzle({ ...genOptionsFor(difficulty), seed })));
  }, { difficulty, seed });
}

// Klappt eine Einstellungs-Karte (Accordion) per sichtbarem Label auf (z.B.
// 'Ton', 'Daten', 'Darstellung', 'Farbe'). Setzt voraus, dass der Einstellungen-
// Screen bereits offen ist. Ersetzt die frühere Drawer-Navigation.
export async function gotoSettingsSection(page, label) {
  await page.locator('.screen.settings .admin-acc-head', { hasText: label }).click();
}

export async function startNewGame(page, difficulty = 'sehrleicht') {
  // „Neues Spiel" führt jetzt DIREKT in den Schwierigkeits-Setup (kein Solo-
  // Zwischenscreen mehr; Endlos ist ein Toggle im Setup).
  await page.locator('.home-actions .btn-primary').click();
  await page.waitForSelector('.screen.setup');
  // Solo-Setup ist ein Slider (keine Karten mehr): Schwierigkeit direkt über den
  // Debug-Hook wählen, dann starten. (Coop/Race/Team behalten das Kartenraster.)
  await page.evaluate((id) => { window.__cns.state.sel.difficulty = id; window.__cns.state.sel.endless = false; }, difficulty);
  await page.locator('.diff-start').click();
  await page.waitForSelector('.screen.game');
  await page.waitForFunction(() => window.__cns && window.__cns.state.puzzle && !window.__cns.state.generating);
}

// Löst das laufende Rätsel über den window.__cns-Debug-Hook — exakt derselbe
// Weg wie ein echter Drag&Drop (placeAt ist der Kern von dropOn).
export async function solveActivePuzzle(page) {
  await page.evaluate(() => {
    const { state, placeAt } = window.__cns;
    const p = state.puzzle;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        const sl = p.slots[r][c];
        if (!sl || sl.given || state.placed[r][c] != null) continue;
        placeAt(r, c, sl.v);
      }
    }
  });
}

// Legt EINEN Stein korrekt (erster freier Platz) — für Tests, die nur einen
// beliebigen Zug brauchen. Liefert { r, c, v } oder null.
export async function playOneMove(page) {
  return await page.evaluate(() => {
    const { state, placeAt } = window.__cns;
    const p = state.puzzle;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        const sl = p.slots[r][c];
        if (!sl || sl.given || state.placed[r][c] != null) continue;
        placeAt(r, c, sl.v);
        return { r, c, v: sl.v };
      }
    }
    return null;
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

// Begeht `count` absichtliche Fehler. Ein Fehler entsteht NUR, wenn ein Zug
// eine Rechnung vollständig UND falsch macht: dafür wird eine Gleichung bis auf
// EIN Feld korrekt gefüllt und dann eine falsche Zahl daraufgelegt. Der Stein
// wird dabei nie gesetzt (abgelehnt), also lässt sich derselbe Zug beliebig oft
// wiederholen.
export async function commitMistakes(page, count) {
  const ok = await page.evaluate((n) => {
    const { state, placeAt } = window.__cns;
    const p = state.puzzle;
    const cellsOf = (eq) => {
      const out = [];
      for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? [eq.r, eq.c + i] : [eq.r + i, eq.c]);
      return out;
    };
    for (const eq of p.equations) {
      const blanks = cellsOf(eq).filter(([r, c]) => !p.slots[r][c].given && state.placed[r][c] == null);
      if (!blanks.length) continue;
      const [tr, tc] = blanks[blanks.length - 1];
      for (const [r, c] of blanks.slice(0, -1)) placeAt(r, c, p.slots[r][c].v);
      const right = p.slots[tr][tc].v;
      const wrong = state.tray.filter(t => !t.used && t.v !== right).map(t => t.v)[0];
      if (wrong == null) continue;
      const before = state.lives;
      for (let i = 0; i < n; i++) placeAt(tr, tc, wrong);
      return state.lives < before;
    }
    return false;
  }, count);
  if (!ok) throw new Error('commitMistakes: kein Fehler-Zug gefunden');
}

// Erzeugt ein ECHTES Rätsel im Browser-Kontext (gleicher Generator wie die App)
// und liefert es als schlichtes JSON — so brauchen die Coop-Tests keine
// handgeschriebenen Brett-Attrappen, die bei jeder Modelländerung veralten.
export async function makePuzzle(page, difficulty = 'sehrleicht', seed = 1) {
  return await page.evaluate(async ({ difficulty, seed }) => {
    const [{ generatePuzzle }, { genOptionsFor }] = await Promise.all([
      import('/js/games/mathcross/generator.js'),
      import('/js/games/mathcross/difficulty.js'),
    ]);
    return JSON.parse(JSON.stringify(generatePuzzle({ ...genOptionsFor(difficulty), seed })));
  }, { difficulty, seed });
}
