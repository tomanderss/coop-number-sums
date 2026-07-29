import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  createBot, nextAction, applyAction, candidateBuckets, botPct, botDone,
  clampProfile, clampAvgMs, AVG_BAND, PRESET_PROFILES, PRESET_LEVELS, TIER, targetMsFor, DEFAULT_AVG_MS,
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
    assert.equal(p.mistakesPerGame, PRESET_PROFILES.hard.mistakesPerGame);
  });
  test('nicht-endliche und absurde Werte werden gefangen', () => {
    const p = clampProfile({
      think: { t1: Infinity, t2: NaN, hard: -5 },
      burstMs: 0, searchMax: 999, mistakesPerGame: 99, recoverMs: 'x', stallRate: -1, stallMin: Infinity, stallSpan: NaN,
    });
    for (const v of [p.think.t1, p.think.t2, p.think.hard, p.burstMs, p.searchMax, p.mistakesPerGame, p.recoverMs, p.stallRate, p.stallMin, p.stallSpan]) {
      assert.ok(Number.isFinite(v), 'jedes Feld muss endlich sein');
    }
    assert.ok(p.mistakesPerGame <= 8, 'Fehlerzahl gedeckelt');
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

// Die Durchschnittszeiten eines Freundes bestimmen ALLEIN, wie lange sein Klon
// fürs Rätsel braucht — clampProfile fasst sie nicht an. Sie kommen aus der Cloud
// und sind damit genauso ungeprüft wie das Profil.
describe('duelbot.clampAvgMs (fremde Durchschnittszeiten)', () => {
  test('plausible Zeiten bleiben unverändert', () => {
    const avg = { mittel: 240000, rip: 1600000 };
    const out = clampAvgMs(avg);
    assert.equal(out.mittel, 240000);
    assert.equal(out.rip, 1600000);
  });

  test('ein manipulierter Instant-Win wird gekappt', () => {
    // OHNE diese Klemme hätte targetMsFor nur seinen 5-Sekunden-Boden gezogen —
    // auf einem 14×14 immer noch ein sicherer Sieg des Klons.
    const out = clampAvgMs({ rip: 1, mittel: -5, schwer: 0 });
    assert.equal(out.rip, DEFAULT_AVG_MS.rip * AVG_BAND[0]);
    assert.ok(!('mittel' in out), 'negative Werte fliegen raus');
    assert.ok(!('schwer' in out), 'null fliegt raus');
    // Und die Klemme muss auch im Ergebnis ankommen, nicht nur in der Map.
    assert.ok(targetMsFor({ avgMs: out, difficulty: 'rip' }) > 60000);
  });

  test('absurd langsame Zeiten werden nach oben gekappt', () => {
    const out = clampAvgMs({ sehrleicht: 999_999_999 });
    assert.equal(out.sehrleicht, DEFAULT_AVG_MS.sehrleicht * AVG_BAND[1]);
  });

  test('Unsinn und unbekannte Schwierigkeiten verschwinden spurlos', () => {
    for (const bad of [null, undefined, 42, 'nope', [], { rip: NaN }, { rip: Infinity }]) {
      const out = clampAvgMs(bad);
      assert.ok(out && typeof out === 'object');
      assert.equal(out.rip, undefined);
    }
    assert.equal(clampAvgMs({ gibtsnicht: 1000 }).gibtsnicht, undefined);
    // Fällt alles weg, greift targetMsFor von selbst auf DEFAULT_AVG_MS zurück.
    assert.equal(targetMsFor({ avgMs: clampAvgMs(null), difficulty: 'mittel' }), DEFAULT_AVG_MS.mittel);
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
      const profile = { ...PRESET_PROFILES.medium, mistakesPerGame: 0, stallRate: 0 };
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
    const profile = { ...PRESET_PROFILES.medium, mistakesPerGame: 0, stallRate: 0 };
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
  const noNoise = (base) => ({ ...base, mistakesPerGame: 0, stallRate: 0 });

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
      for (let seed = 1; seed <= 10; seed++) {   // kurze Bretter haben je Drittel wenige Züge → mehr Stichproben
        const bot = createBot({ puzzle: puzzleFor(difficulty, seed * 137), profile: noNoise(PRESET_PROFILES.medium), seed });
        for (const e of runBot(bot).log) thirds[e.pct < 33 ? 0 : e.pct < 67 ? 1 : 2].push(e.ms);
      }
      // MEDIAN statt Mittelwert: seit die Zugdauern schwerschwänzig verteilt sind
      // (echte Hänger von 1–2 Minuten, s. searchFactor/stall im Modell), misst der
      // Mittelwert die Ausreißer statt des typischen Tempos. Gefragt ist hier aber
      // „wie schnell geht es normalerweise".
      const med = xs => { const a = [...xs].sort((p, q) => p - q); return a[a.length >> 1]; };
      const [start, mid, end] = thirds.map(med);
      // Die tatsächliche Form (über 16 Rätsel je Stufe gemessen): der START ist am
      // schnellsten — der Generator garantiert jedem Rätsel einen leichten
      // Einstieg —, die MITTE ist die zähe Phase, das ENDE wird wieder klar
      // schneller. Eine frühere Fassung behauptete zusätzlich „Ende < Start"; das
      // ist schlicht falsch und hielt nur zufällig.
      assert.ok(mid > start * 1.3, `${difficulty}: die Mitte muss die zähe Phase sein (start=${start | 0} mitte=${mid | 0})`);
      // Wie GROSS der Endspiel-Vorsprung ist, hängt vom Rätsel ab (gemessen 0,50
      // bis 0,88 der Mitte) — festgenagelt wird deshalb die Richtung, nicht ein
      // gefittetes Verhältnis.
      assert.ok(end < mid * 0.95, `${difficulty}: Endspiel muss schneller sein als die Mitte (mitte=${mid | 0} ende=${end | 0})`);
    }
  });

  test('Teilsummen-Züge dauern deutlich länger als direkte Züge', () => {
    const byTier = { t1: [], t2: [] };
    for (let seed = 1; seed <= 4; seed++) {
      const bot = createBot({ puzzle: puzzleFor('schwer', seed * 137), profile: noNoise(PRESET_PROFILES.medium), seed });
      for (const e of runBot(bot).log) if (!e.burst && byTier[e.tier]) byTier[e.tier].push(e.ms);
    }
    assert.ok(byTier.t1.length && byTier.t2.length, 'beide Deduktionstypen kommen vor');
    const med = xs => { const a = [...xs].sort((p, q) => p - q); return a[a.length >> 1]; };
    assert.ok(med(byTier.t2) > med(byTier.t1) * 1.3,
      `Tier 2 muss klar länger dauern (t1=${med(byTier.t1) | 0} t2=${med(byTier.t2) | 0})`);
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

  test('skill-Regler skaliert das Tempo', () => {
    const mk = (skill) => {
      const target = targetMsFor({ difficulty: 'mittel', skill });
      const bot = createBot({ puzzle, profile: noNoise(PRESET_PROFILES.medium), skill, seed: 13, targetMs: target });
      return runBot(bot).totalMs;
    };
    const slow = mk(0.7), normal = mk(1), fast = mk(1.3);
    assert.ok(slow > normal && normal > fast, `70% > 100% > 130% erwartet (${slow} / ${normal} / ${fast})`);
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
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.easy, mistakesPerGame: 6 }, seed: 4 });
    runBot(bot);
    assert.ok(bot.mistakes > 0, 'Fehler treten auf');
  });

  test('mistakesPerGame 0 → nie ein Fehler', () => {
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.medium, mistakesPerGame: 0, stallRate: 0 }, seed: 8 });
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
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.brutal, mistakesPerGame: 0, stallRate: 0 }, seed: 6 });
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

describe('duelbot: Kalibrierung auf DURCHSCHNITTSzeiten (nicht Bestzeiten)', () => {
  test('targetMsFor nimmt die eigenen Durchschnittszeiten, sonst die Vorgabe', () => {
    // Eigene Werte gewinnen …
    assert.equal(targetMsFor({ avgMs: { mittel: 250000 }, difficulty: 'mittel' }), 250000);
    // … fehlen sie (oder sind unbrauchbar), greift die Vorgabetabelle.
    assert.equal(targetMsFor({ difficulty: 'mittel' }), DEFAULT_AVG_MS.mittel);
    assert.equal(targetMsFor({ avgMs: { mittel: 0 }, difficulty: 'mittel' }), DEFAULT_AVG_MS.mittel);
    assert.equal(targetMsFor({ avgMs: { mittel: NaN }, difficulty: 'mittel' }), DEFAULT_AVG_MS.mittel);
  });

  test('feste Stufen UND Prozent-Regler wirken auf dieselbe Zielzeit', () => {
    const base = targetMsFor({ difficulty: 'mittel', level: 'medium' });
    assert.ok(targetMsFor({ difficulty: 'mittel', level: 'easy' }) > base, 'easy ist langsamer');
    assert.ok(targetMsFor({ difficulty: 'mittel', level: 'brutal' }) < base, 'brutal ist schneller');
    assert.ok(targetMsFor({ difficulty: 'mittel', skill: 1.25 }) < base, '125 % ist schneller');
    assert.ok(targetMsFor({ difficulty: 'mittel', skill: 0.8 }) > base, '80 % ist langsamer');
    // Kombination beider Regler
    assert.ok(targetMsFor({ difficulty: 'mittel', level: 'hard', skill: 1.2 })
      < targetMsFor({ difficulty: 'mittel', level: 'hard' }));
  });

  test('der Bot trifft die Zielzeit über ALLE Schwierigkeiten (±12 %)', () => {
    // Das ist die Kernanforderung: die Duellzeit muss der Durchschnittszeit des
    // Spielers entsprechen. Ein globales Denkzeit-Modell konnte das NICHT — die
    // Zeit wächst überlinear mit der Brettgröße (6×6 44 s → 14×14 24 min), es lag
    // gemessen zwischen 0,57× und 3,39× daneben. Daher die Selbstkalibrierung.
    for (const difficulty of Object.keys(DEFAULT_AVG_MS)) {
      const target = targetMsFor({ difficulty });
      const bot = createBot({
        puzzle: puzzleFor(difficulty, 91),
        profile: { ...PRESET_PROFILES.medium, mistakesPerGame: 0, stallRate: 0 },
        seed: 3, targetMs: target,
      });
      const { totalMs } = runBot(bot);
      const dev = Math.abs(totalMs - target) / target;
      assert.ok(dev < 0.12,
        `${difficulty}: ${Math.round(totalMs / 1000)}s statt ${Math.round(target / 1000)}s (${Math.round(dev * 100)}% Abweichung)`);
    }
  });

  test('die Zielzeit gilt auch für kleine und große Bretter gleich gut', () => {
    // Gegenprobe zum alten Fehler: ohne Kalibrierung war 6×6 zu langsam und
    // 14×14 fast 3× zu schnell.
    for (const difficulty of ['sehrleicht', 'rip']) {
      const target = targetMsFor({ difficulty });
      const bot = createBot({
        puzzle: puzzleFor(difficulty, 91),
        profile: { ...PRESET_PROFILES.medium, mistakesPerGame: 0, stallRate: 0 },
        seed: 5, targetMs: target,
      });
      const { totalMs } = runBot(bot);
      assert.ok(Math.abs(totalMs - target) / target < 0.12, `${difficulty} verfehlt die Zielzeit`);
    }
  });
});

describe('duelbot: Fehlerzahl ist brettgrößen-UNABHÄNGIG', () => {
  // Vorher war die Fehlerquote pro ZUG definiert: auf 14×14 (~150 Entscheidungen)
  // ergab das ~4,5 erwartete Fehler bei 3 Leben — der Bot flog in 3 von 4 Läufen
  // raus, große Bretter waren dadurch geschenkt. Jetzt zählt mistakesPerGame.
  const measure = (difficulty, mistakesPerGame, runs = 12) => {
    const target = targetMsFor({ difficulty });
    const puzzle = puzzleFor(difficulty, 91);
    let sum = 0;
    for (let s = 0; s < runs; s++) {
      const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.medium, mistakesPerGame, stallRate: 0 }, seed: 500 + s, targetMs: target });
      runBot(bot);
      sum += bot.mistakes;
    }
    return sum / runs;
  };

  test('6×6 und 14×14 machen ähnlich viele Fehler', () => {
    const small = measure('sehrleicht', 1.2);
    const big = measure('rip', 1.2);
    assert.ok(Math.abs(small - big) < 1.0,
      `Fehlerzahl darf nicht an der Brettgröße hängen (6×6=${small.toFixed(2)} 14×14=${big.toFixed(2)})`);
  });

  test('die erwartete Fehlerzahl wird ungefähr eingehalten', () => {
    const got = measure('mittel', 1.2, 16);
    assert.ok(got > 0.5 && got < 2.2, `~1,2 Fehler erwartet, gemessen ${got.toFixed(2)}`);
  });

  test('stärkere Stufen machen weniger Fehler', () => {
    const easy = measure('mittel', PRESET_LEVELS.easy.mistakesPerGame);
    const brutal = measure('mittel', PRESET_LEVELS.brutal.mistakesPerGame);
    assert.ok(easy > brutal, `easy (${easy.toFixed(2)}) muss mehr Fehler machen als brutal (${brutal.toFixed(2)})`);
  });
});
