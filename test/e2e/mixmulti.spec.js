import { test, expect } from '@playwright/test';
import { gotoApp, dismissStreakModal } from './helpers.js';

// Mix im Mehrspieler (Nutzerwunsch): Coop (gemeinsam, je Level ein gezogenes
// Spiel) und Duell (dieselben Rätsel in derselben Reihenfolge; zuerst N gelöst
// oder die meisten in M Minuten). Ohne Firebase werden Raum und Mitspieler über
// die Test-Haken simuliert; was gesendet würde, steht im sentLog.

const POOL = { off: { numbersums: true, mathcross: true, gems: true, pipes: true } };   // nur Rectangles + Number Path (schnelle Löse-Haken)

async function boot(page) {
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('b')) { localStorage.setItem('cns_mix_on', 'true'); sessionStorage.setItem('b', '1'); } } catch {} });
  await gotoApp(page);
  await page.evaluate((pool) => window.__cns.setSetting('mixPool', pool), POOL);
}
async function solveLevel(page) {
  await page.evaluate(() => {
    const c = window.__cns;
    if (c.gameId === 'rectangles') c.solveRects();
    else if (c.gameId === 'numberpath') c.solvePath();
    else throw new Error('kein Löse-Haken für ' + c.gameId);
  });
}
const sent = (page) => page.evaluate(() => window.__cns.sentLog().map((x) => x.type));
const asHost = (page, mixMode) => page.evaluate((mixMode) => {
  const s = window.__cns.state;
  s.coop.role = 'host'; s.coop.myId = 'me'; s.coop.hostId = 'me'; s.coop.connected = true; s.coop.mixMode = mixMode;
  if (mixMode === 'duel') { s.coop.raceMode = true; s.coop.ffaMode = true; }
  s.coop.players = [{ id: 'me', name: 'Ich', color: '#67a3e5' }, { id: 'p2', name: 'Pia', color: '#e5679a' }];
}, mixMode);

test('Mix-Screen: Spielweise wählen, Duell-Ziel einstellen, Raum öffnen zeigt die Mix-Karte', async ({ page }) => {
  await boot(page);
  await page.locator('.mix-play-btn').click();
  await page.waitForSelector('.screen.mix-screen');
  await expect(page.locator('.mix-mode')).toHaveCount(3);
  await page.locator('.mix-mode', { hasText: 'Duell' }).click();
  await expect(page.locator('.mix-duel-cfg')).toBeVisible();
  await page.locator('.mix-duel-cfg .mdc-row').nth(1).locator('.mix-chip', { hasText: '10' }).click();
  await expect(page.locator('.mdc-sum')).toContainText('10 Minuten');
  await expect(page.locator('.mix-start')).toContainText('Duell-Raum');
  await page.locator('.mix-start').click();
  await page.waitForSelector('.screen.coop-screen');
  expect(await page.evaluate(() => window.__cns.state.coop.mixMode)).toBe('duel');
  // Namens-Gate → direkt die Host-Einrichtung mit der Mix-Karte statt Schwierigkeits-Slider.
  await page.locator('.screen.coop-screen input').first().fill('Tester');
  await page.locator('.screen.coop-screen .btn-primary').first().click();
  await expect(page.locator('.mix-lobby')).toBeVisible();
  await expect(page.locator('.mix-lobby')).toContainText('Mix · Duell');
  await expect(page.locator('.diff-track')).toHaveCount(0);
});

test('Coop-Mix (Host): Ziehung für alle, Level als INIT mit Spiel, nächstes Level wechselt das Spiel', async ({ page }) => {
  await boot(page);
  await asHost(page, 'coop');
  await page.evaluate(() => window.__cns.clearSentLog());
  await page.evaluate(() => window.__cns.startCoopMatch());
  await expect(page.locator('.mix-reveal')).toBeVisible();
  await page.waitForFunction(() => { const s = window.__cns.state; return s.puzzle && !s.generating && !s.mixReveal && s.status === 'playing'; }, null, { timeout: 20000 });
  const types = await sent(page);
  expect(types).toContain('mixPick');
  expect(types).toContain('init');
  const first = await page.evaluate(() => window.__cns.gameId);
  expect(['rectangles', 'numberpath']).toContain(first);
  expect(await page.evaluate(() => !!window.__cns.state.endless.mix && window.__cns.state.endless.coop)).toBe(true);
  await solveLevel(page);
  await page.waitForFunction(() => window.__cns.state.status === 'won');
  await dismissStreakModal(page);
  await page.evaluate(() => window.__cns.endlessContinue());
  await page.waitForFunction(() => { const s = window.__cns.state; return s.endless.level === 2 && s.puzzle && !s.generating && s.status === 'playing'; }, null, { timeout: 20000 });
  expect(await page.evaluate(() => window.__cns.gameId)).not.toBe(first);
  // Der Solo-Mix-Slot bleibt unberührt.
  expect(await page.evaluate(() => localStorage.getItem('cns_mix_run'))).toBeNull();
});

test('Coop-Mix (Gast): die Ziehung des Hosts erscheint, das INIT wechselt ins richtige Spiel', async ({ page }) => {
  await boot(page);
  const p = await page.evaluate(async () => (await import('/js/games/numberpath/generator.js')).generatePuzzle({ difficulty: 'leicht', seed: 3 }));
  await page.evaluate(() => {
    const s = window.__cns.state;
    s.coop.active = true; s.coop.role = 'guest'; s.coop.myId = 'me';
    s.coop.players = [{ id: 'host', name: 'Hanna', color: '#e5679a' }, { id: 'me', name: 'Ich', color: '#67a3e5' }];
    window.__cns.handleCoopMsg({ type: 'mixPick', game: 'numberpath', diff: 'leicht', level: 1, reel: ['rectangles', 'numberpath', 'rectangles', 'numberpath'] });
  });
  await expect(page.locator('.mix-reveal')).toBeVisible();
  await page.evaluate((puzzle) => window.__cns.handleCoopMsg({ type: 'init', gameId: 'm1', running: true, puzzle, startTime: Date.now(), lives: 3, maxLives: 3, endless: true, endlessLevel: 1, lifeLossBy: [], game: 'numberpath', mix: { diff: 'leicht', played: {} } }), p);
  await page.waitForSelector('.screen.game .np-board');
  expect(await page.evaluate(() => [window.__cns.gameId, !!window.__cns.state.endless.mix, window.__cns.state.mixReveal])).toEqual(['numberpath', true, null]);
});

test('Duell bis 3: dieselbe Folge, jedes gelöste Rätsel zählt, wer zuerst 3 hat, gewinnt', async ({ page }) => {
  await boot(page);
  await asHost(page, 'duel');
  await page.evaluate(() => { window.__cns.state.mixDuelGoal = { type: 'count', n: 3 }; window.__cns.clearSentLog(); window.__cns.startRaceMatch(); });
  await page.waitForFunction(() => { const s = window.__cns.state; return s.mixDuel.active && s.puzzle && !s.coop.generating; }, null, { timeout: 20000 });
  expect(await sent(page)).toContain('raceStart');
  // Die Folge stimmt mit der reinen Planung überein (jeder Client rechnet dieselbe).
  const ok = await page.evaluate(async () => {
    const { mixDuelPlan } = await import('/js/mix.js');
    const d = window.__cns.state.mixDuel;
    const plan = mixDuelPlan(d.seed, 5, d.pool, (await import('/js/mix.js')).mixCatalog((await import('/js/games/index.js')).GAMES));
    return plan[0].game === window.__cns.gameId && plan[0].seed === window.__cns.state.puzzle.seed;
  });
  expect(ok).toBe(true);
  await page.evaluate(() => window.__cns.startCoopGame(Date.now()));
  for (let i = 1; i <= 3; i++) {
    await page.waitForFunction(() => { const s = window.__cns.state; return s.status === 'playing' && !s.generating && !s.mixReveal; }, null, { timeout: 20000 });
    await solveLevel(page);
    if (i < 3) await page.waitForFunction((i) => window.__cns.state.mixDuel.solved === i && window.__cns.state.mixDuel.level === i + 1, i);
  }
  await page.waitForFunction(() => window.__cns.state.mixDuel.over && window.__cns.state.status === 'won');
  expect(await sent(page)).toContain('raceDone');
  await dismissStreakModal(page);
  await expect(page.locator('.duel-graph .duel-row').first()).toContainText('3 gelöst');
  await expect(page.locator('.duel-msg')).toContainText('Gewonnen');
});

test('Duell auf Zeit: nach Ablauf gewinnt, wer mehr gelöst hat', async ({ page }) => {
  await boot(page);
  await asHost(page, 'duel');
  await page.evaluate(() => { window.__cns.state.mixDuelGoal = { type: 'time', min: 5 }; window.__cns.startRaceMatch(); });
  await page.waitForFunction(() => { const s = window.__cns.state; return s.mixDuel.active && s.puzzle && !s.coop.generating; }, null, { timeout: 20000 });
  await page.evaluate(() => window.__cns.startCoopGame(Date.now()));
  await expect(page.locator('.duel-chip')).toBeVisible();
  // Pia hat schon zwei gelöst, ich keins — dann ist die Zeit um.
  await page.evaluate(() => { const s = window.__cns.state; s.race.opponents[0].solved = 2; s.mixDuel.deadline = Date.now() - 1000; });
  await page.waitForFunction(() => window.__cns.state.mixDuel.over, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__cns.state.status)).toBe('lost');
  await expect(page.locator('.duel-msg')).toContainText('Pia gewinnt');
});
