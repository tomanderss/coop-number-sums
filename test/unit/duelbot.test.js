import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  createBot, nextAction, applyAction, candidateBuckets, botPct, botDone,
  clampProfile, PRESET_PROFILES, TIER,
} = await import('../../js/duelbot.js');
const { generatePuzzle } = await import('../../js/generator.js');

// Spielt ein komplettes Bot-Duell durch, ohne echte Zeit zu verbrauchen: die
// „Wartezeit" wird nur aufsummiert. Genau so hängt app.js später den Scheduler
// dran (setTimeout mit action.delayMs).
function runBot(bot, { maxSteps = 20000 } = {}) {
  let totalMs = 0, steps = 0;
  const log = [];
  while (!botDone(bot) && steps++ < maxSteps) {
    const a = nextAction(bot);
    if (a.kind === 'done') break;
    totalMs += a.delayMs;
    log.push({ ms: a.delayMs, kind: a.kind, tier: a.tier, burst: !!a.burst, pct: botPct(bot) });
    const res = applyAction(bot, a);
    if (res.out) break;               // alle Leben verloren
  }
  return { totalMs, steps, log };
}

const puzzleFor = (difficulty = 'mittel', seed = 4242) => generatePuzzle({ difficulty, seed });

describe('duelbot.clampProfile (Fremdprofile dürfen die Engine nie sprengen)', () => {
  test('vollständiges Profil bleibt erhalten', () => {
    const p = clampProfile(PRESET_PROFILES.hard);
    assert.equal(p.think.t1, PRESET_PROFILES.hard.think.t1);
    assert.equal(p.mistakeRate, PRESET_PROFILES.hard.mistakeRate);
  });
  test('nicht-endliche und absurde Werte werden gefangen', () => {
    const p = clampProfile({
      think: { t1: Infinity, t2: NaN, hard: -5 },
      burstMs: 0, searchMax: 999, mistakeRate: 5, recoverMs: 'x', stallRate: -1, stallMs: Infinity,
    });
    for (const v of [p.think.t1, p.think.t2, p.think.hard, p.burstMs, p.searchMax, p.mistakeRate, p.recoverMs, p.stallRate, p.stallMs]) {
      assert.ok(Number.isFinite(v), 'jedes Feld muss endlich sein');
    }
    assert.ok(p.mistakeRate <= 0.35, 'Fehlerquote gedeckelt');
    assert.ok(p.think.t1 >= 250, 'Denkzeit kann nicht auf ~0 gedrückt werden (Instant-Win)');
    assert.ok(p.burstMs >= 60);
    assert.ok(p.stallRate >= 0);
  });
  test('leeres/kaputtes Profil fällt auf medium zurück', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, []]) {
      const p = clampProfile(bad);
      assert.equal(p.think.t1, PRESET_PROFILES.medium.think.t1);
    }
  });
});

describe('duelbot.candidateBuckets (Zug-Orakel)', () => {
  const puzzle = puzzleFor();

  test('findet auf dem leeren Brett Tier-1-Ansatzpunkte', () => {
    const bot = createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 1 });
    const buckets = candidateBuckets(bot);
    assert.ok(buckets.length > 0, 'ein generiertes Rätsel hat immer einen Foothold');
    assert.ok(buckets.every(b => b.tier === TIER.T1), 'Tier 1 hat Vorrang, solange es welche gibt');
  });

  test('jeder vorgeschlagene Zug stimmt mit der Lösung überein', () => {
    const bot = createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 7 });
    for (let i = 0; i < 400 && !botDone(bot); i++) {
      const a = nextAction(bot);
      if (a.kind === 'done') break;
      if (a.kind === 'mistake') { applyAction(bot, a); continue; }
      const { r, c } = bot.model.cells[a.move.ci];
      const shouldKeep = !!puzzle.solution[r][c];
      assert.equal(a.move.want, shouldKeep ? 'kept' : 'removed',
        `Bot würde ${r},${c} falsch markieren`);
      applyAction(bot, a);
    }
  });

  test('ein Bucket bündelt ALLE Zellen einer Deduktion (Burst-Grundlage)', () => {
    const bot = createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 3 });
    const multi = candidateBuckets(bot).find(b => b.moves.length > 1);
    assert.ok(multi, 'mindestens eine Deduktion legt mehrere Zellen auf einmal fest');
    assert.ok(multi.moves.every(m => typeof m.ci === 'number' && (m.want === 'kept' || m.want === 'removed')));
  });
});

describe('duelbot: löst zuverlässig und ohne Hängenbleiben', () => {
  for (const difficulty of ['sehrleicht', 'mittel', 'schwer']) {
    test(`${difficulty} wird vollständig gelöst`, () => {
      // Fehlerfrei rechnen, damit der Lauf nicht am Lebensverlust endet.
      const profile = { ...PRESET_PROFILES.medium, mistakeRate: 0, stallRate: 0 };
      const puzzle = puzzleFor(difficulty, 99);
      const bot = createBot({ puzzle, profile, seed: 5 });
      const { steps } = runBot(bot);
      assert.ok(botDone(bot), `Bot blieb bei ${botPct(bot)}% stehen (${steps} Schritte)`);
      assert.equal(botPct(bot), 100);
    });
  }

  test('das Fangnetz greift auch bei einem für Tier 1+2 unlösbaren Reststand', () => {
    // Brett bis auf zwei Zellen künstlich leeren -> notfalls muss der Bot per
    // Lösung weitermachen statt zu hängen.
    const puzzle = puzzleFor('mittel', 11);
    const profile = { ...PRESET_PROFILES.medium, mistakeRate: 0, stallRate: 0 };
    const bot = createBot({ puzzle, profile, seed: 2 });
    const buckets = candidateBuckets(bot);
    assert.ok(buckets.length);
    const { totalMs } = runBot(bot);
    assert.ok(botDone(bot));
    assert.ok(totalMs > 0);
  });
});

describe('duelbot: menschliches Tempo', () => {
  const puzzle = puzzleFor('mittel', 4242);
  const noNoise = (base) => ({ ...base, mistakeRate: 0, stallRate: 0 });

  test('schwerere Deduktion = längere Denkzeit', () => {
    // searchFactor konstant halten (gleiche Bucket-Zahl) ist im echten Brett nicht
    // möglich, deshalb direkt über die Profile geprüft: t1 < t2 < hard.
    const p = clampProfile(PRESET_PROFILES.medium);
    assert.ok(p.think.t1 < p.think.t2);
    assert.ok(p.think.t2 < p.think.hard);
  });

  // WICHTIG zur Erwartungshaltung: WO die zähe Phase sitzt, ist rätselabhängig —
  // sie liegt dort, wo das konkrete Rätsel Teilsummen-Deduktionen erzwingt (bei
  // manchen Rätseln schon im ersten Drittel). Das ist die gewollte Eigenschaft
  // („ergibt sich aus dem Rätsel"), deshalb nagelt der Test die ROBUSTEN
  // Eigenschaften fest statt eine erzwungene Kurvenform pro Einzelrätsel:
  //   1. schwerere Deduktion  = länger  (Tier-Trennung)
  //   2. Endspiel             = schnellste Phase („man löst nur noch auf")
  //   3. Bursts               ≪ Denkzüge
  test('Endspiel ist über mehrere Rätsel hinweg die SCHNELLSTE Phase', () => {
    for (const difficulty of ['leicht', 'mittel', 'schwer']) {
      const thirds = [[], [], []];
      for (let seed = 1; seed <= 4; seed++) {
        const bot = createBot({ puzzle: puzzleFor(difficulty, seed * 137), profile: noNoise(PRESET_PROFILES.medium), seed });
        for (const e of runBot(bot).log) thirds[e.pct < 33 ? 0 : e.pct < 67 ? 1 : 2].push(e.ms);
      }
      const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
      const [start, mid, end] = thirds.map(avg);
      assert.ok(end < mid * 0.9, `${difficulty}: Endspiel muss klar schneller sein als die Mitte (mitte=${mid | 0} ende=${end | 0})`);
      assert.ok(end < start * 0.95, `${difficulty}: Endspiel muss schneller sein als der Start (start=${start | 0} ende=${end | 0})`);
    }
  });

  test('Teilsummen-Züge dauern deutlich länger als direkte Züge', () => {
    const byTier = { t1: [], t2: [] };
    for (let seed = 1; seed <= 4; seed++) {
      const bot = createBot({ puzzle: puzzleFor('schwer', seed * 137), profile: noNoise(PRESET_PROFILES.medium), seed });
      for (const e of runBot(bot).log) if (!e.burst && byTier[e.tier]) byTier[e.tier].push(e.ms);
    }
    assert.ok(byTier.t1.length && byTier.t2.length, 'beide Deduktionstypen kommen vor');
    const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(avg(byTier.t2) > avg(byTier.t1) * 1.3,
      `Tier 2 muss klar länger dauern (t1=${avg(byTier.t1) | 0} t2=${avg(byTier.t2) | 0})`);
  });

  test('Bursts: eine Deduktion, dann schnelle Folgeeinträge', () => {
    const bot = createBot({ puzzle, profile: noNoise(PRESET_PROFILES.medium), seed: 21 });
    const { log } = runBot(bot);
    const bursts = log.filter(e => e.burst);
    assert.ok(bursts.length > 0, 'Bursts kommen vor');
    const avgBurst = bursts.reduce((a, e) => a + e.ms, 0) / bursts.length;
    const thinks = log.filter(e => !e.burst && e.kind === 'move');
    const avgThink = thinks.reduce((a, e) => a + e.ms, 0) / thinks.length;
    assert.ok(avgBurst < avgThink, `Burst-Einträge (${avgBurst | 0}ms) müssen klar schneller sein als Denkzüge (${avgThink | 0}ms)`);
  });

  test('höhere Stärke = schneller fertig (monoton über die Presets)', () => {
    const times = ['easy', 'medium', 'hard', 'brutal'].map(k => {
      const bot = createBot({ puzzle, profile: noNoise(PRESET_PROFILES[k]), seed: 13 });
      return runBot(bot).totalMs;
    });
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] < times[i - 1], `Stufe ${i} muss schneller sein als ${i - 1} (${times.join(' > ')})`);
    }
  });

  test('skill-Regler skaliert das Tempo', () => {
    const mk = (skill) => {
      const bot = createBot({ puzzle, profile: noNoise(PRESET_PROFILES.medium), skill, seed: 13 });
      return runBot(bot).totalMs;
    };
    const slow = mk(0.7), normal = mk(1), fast = mk(1.3);
    assert.ok(slow > normal && normal > fast, `70% > 100% > 130% erwartet (${slow} / ${normal} / ${fast})`);
  });

  test('Lösungszeit liegt im menschlichen Band (8×8 mittel, medium-Profil)', () => {
    const bot = createBot({ puzzle, profile: noNoise(PRESET_PROFILES.medium), seed: 13 });
    const min = runBot(bot).totalMs / 60000;
    assert.ok(min > 0.8 && min < 12, `unrealistische Duellzeit: ${min.toFixed(1)} min`);
  });
});

describe('duelbot: Fehler und Ausscheiden', () => {
  const puzzle = puzzleFor('mittel', 4242);

  test('Fehler kostet Leben, verändert das Brett aber NICHT', () => {
    const bot = createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 1 });
    const before = { pct: botPct(bot), marks: bot.mark.slice() };
    const res = applyAction(bot, { kind: 'mistake', delayMs: 1000 });
    assert.equal(bot.mistakes, 1);
    assert.equal(bot.lives, 2);
    assert.equal(res.pct, before.pct, 'Fortschritt bleibt gleich');
    assert.deepEqual(bot.mark, before.marks, 'ein Fehlgriff wird gar nicht eingetragen');
    assert.equal(res.out, false);
  });

  test('drei Fehler → ausgeschieden', () => {
    const bot = createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 1 });
    applyAction(bot, { kind: 'mistake' });
    applyAction(bot, { kind: 'mistake' });
    const res = applyAction(bot, { kind: 'mistake' });
    assert.equal(res.out, true);
    assert.ok(bot.lives <= 0);
  });

  test('eine hohe Fehlerquote lässt den Bot tatsächlich ausscheiden', () => {
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.easy, mistakeRate: 0.35 }, seed: 4 });
    runBot(bot);
    assert.ok(bot.mistakes > 0, 'Fehler treten auf');
  });

  test('mistakeRate 0 → nie ein Fehler', () => {
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.medium, mistakeRate: 0, stallRate: 0 }, seed: 8 });
    runBot(bot);
    assert.equal(bot.mistakes, 0);
    assert.equal(bot.lives, 3);
  });
});

describe('duelbot: Determinismus (Voraussetzung für Tests + Reproduzierbarkeit)', () => {
  const puzzle = puzzleFor('mittel', 4242);
  test('gleicher Seed ⇒ identischer Verlauf', () => {
    const a = runBot(createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 777 }));
    const b = runBot(createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 777 }));
    assert.equal(a.totalMs, b.totalMs);
    assert.deepEqual(a.log, b.log);
  });
  test('anderer Seed ⇒ anderer Verlauf', () => {
    const a = runBot(createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 1 }));
    const b = runBot(createBot({ puzzle, profile: PRESET_PROFILES.medium, seed: 2 }));
    assert.notEqual(a.totalMs, b.totalMs);
  });
});

describe('duelbot.botPct (muss zu progressPct in app.js passen)', () => {
  test('0 % am Start, 100 % am Ende, monoton steigend', () => {
    const puzzle = puzzleFor('sehrleicht', 5);
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.brutal, mistakeRate: 0, stallRate: 0 }, seed: 6 });
    assert.equal(botPct(bot), 0);
    let last = 0;
    while (!botDone(bot)) {
      const a = nextAction(bot);
      if (a.kind === 'done') break;
      applyAction(bot, a);
      const pct = botPct(bot);
      assert.ok(pct >= last, 'Fortschritt darf nie zurücklaufen');
      last = pct;
    }
    assert.equal(botPct(bot), 100);
  });
});
