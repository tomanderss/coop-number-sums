import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { analyzeGame, buildProfile, median, MIN_GAMES, BURST_MAX_MS, STALL_MIN_MS } =
  await import('../../js/playstyle.js');
const { generatePuzzle } = await import('../../js/generator.js');
const { createBot, nextAction, applyAction, botDone, PRESET_PROFILES, targetMsFor } =
  await import('../../js/duelbot.js');

// Einen „Spieler" mit BEKANNTEM Profil simulieren und dabei aufzeichnen. Damit
// lässt sich prüfen, ob die Analyse den Stil wirklich zurückgewinnt — das ist
// der eigentliche Zweck des Moduls, und ohne diesen Round-Trip wäre jede
// Kalibrierung Behauptung statt Nachweis.
function playAndRecord(difficulty, profile, seed) {
  const puzzle = generatePuzzle({ difficulty, seed: seed * 71 });
  const bot = createBot({ puzzle, profile, seed, targetMs: targetMsFor({ difficulty }) });
  const moves = [];
  let t = 0, mistakes = 0;
  while (!botDone(bot)) {
    const a = nextAction(bot);
    if (a.kind === 'done') break;
    t += a.delayMs;
    if (a.kind === 'mistake') {
      mistakes++;
      const r = applyAction(bot, a);
      if (r.out) break;          // wie im echten Spiel: bei 0 Leben ist Schluss
      continue;
    }
    const cell = bot.model.cells[a.move.ci];
    moves.push({ r: cell.r, c: cell.c, want: a.move.want, t });
    applyAction(bot, a);
  }
  return { puzzle, moves, mistakes, totalMs: t, difficulty };
}

const samplesFor = (profile, n = 10, difficulty = 'mittel') => {
  const out = [];
  for (let s = 1; s <= n; s++) {
    const sample = analyzeGame(playAndRecord(difficulty, profile, s));
    if (sample) out.push(sample);
  }
  return out;
};

describe('playstyle.median', () => {
  test('ungerade und gerade Länge', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 3);       // gerundetes Mittel der Mitte
  });
  test('leer/ungültig ist 0, nicht NaN', () => {
    assert.equal(median([]), 0);
    assert.equal(median(null), 0);
    assert.equal(median([NaN, Infinity]), 0);
  });
});

describe('playstyle.analyzeGame', () => {
  test('zu kurze oder fehlende Eingaben liefern null statt Müll', () => {
    assert.equal(analyzeGame(), null);
    assert.equal(analyzeGame({ puzzle: null, moves: [] }), null);
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht', seed: 5 });
    assert.equal(analyzeGame({ puzzle, moves: [{ r: 0, c: 0, want: 'kept', t: 1 }] }), null);
  });

  test('liefert nur Aggregate — keine Brettinhalte, keine Zugfolge', () => {
    const s = analyzeGame(playAndRecord('mittel', PRESET_PROFILES.medium, 3));
    assert.ok(s, 'Stichprobe entsteht');
    // Was drin sein MUSS …
    for (const k of ['ts', 'difficulty', 'cells', 'totalMs', 'mistakes', 'think', 'burstMs', 'thinkCount']) {
      assert.ok(k in s, `Feld ${k} fehlt`);
    }
    // … und was NICHT (der Snapshot synct mit, er darf nicht aufblähen).
    const json = JSON.stringify(s);
    assert.ok(!json.includes('solution'), 'keine Lösung');
    assert.ok(!json.includes('marks'), 'keine Marken');
    assert.ok(json.length < 400, `Stichprobe muss kompakt bleiben (${json.length} Zeichen)`);
  });

  test('trennt Bursts, Denkzüge und Hänger anhand der Schwellen', () => {
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht', seed: 9 });
    // Künstliche Zeitreihe: abwechselnd schnelle Folgeeinträge und Denkpausen,
    // plus eine sehr lange Unterbrechung.
    const moves = [];
    let t = 0;
    for (let i = 0; i < 20; i++) {
      t += (i % 3 === 0) ? 4000 : 300;             // Denkzug bzw. Burst
      if (i === 10) t += STALL_MIN_MS + 1000;      // eine echte Unterbrechung
      moves.push({ r: Math.floor(i / puzzle.cols), c: i % puzzle.cols, want: 'kept', t });
    }
    const s = analyzeGame({ puzzle, moves, mistakes: 1, totalMs: t });
    assert.ok(s);
    assert.ok(s.stalls >= 1, 'die lange Unterbrechung zählt als Hänger, nicht als Denkzeit');
    assert.ok(s.burstMs > 0 && s.burstMs <= BURST_MAX_MS, 'Burst-Tempo im erwarteten Bereich');
  });
});

describe('playstyle.buildProfile — Round-Trip: Stil wird zurückgewonnen', () => {
  // DAS ist der Kern-Nachweis. Ein bekanntes Profil spielt Partien, die Analyse
  // baut daraus ein Profil, und die VERHÄLTNISSE müssen wieder passen. Die
  // absoluten Zeiten sind egal — createBot skaliert ohnehin auf die Zielzeit.
  test('Verhältnis Teilsummen/direkt kommt zurück', () => {
    const src = PRESET_PROFILES.medium;
    const { profile, ready } = buildProfile(samplesFor(src, 10));
    assert.ok(ready, 'genug Partien für einen Klon');
    const want = src.think.t2 / src.think.t1;
    const got = profile.think.t2 / profile.think.t1;
    // Ohne Herausrechnen des Suchaufwands lag dieser Wert bei ~1,4 statt ~2,6 —
    // deshalb die enge Schranke.
    assert.ok(Math.abs(got - want) / want < 0.35,
      `t2/t1 soll ~${want.toFixed(2)} sein, ist ${got.toFixed(2)}`);
  });

  test('Eintragetempo (Bursts) kommt zurück', () => {
    const src = PRESET_PROFILES.medium;
    const { profile } = buildProfile(samplesFor(src, 10));
    const want = src.burstMs / src.think.t1;
    const got = profile.burstMs / profile.think.t1;
    assert.ok(Math.abs(got - want) / want < 0.4,
      `burst/t1 soll ~${want.toFixed(3)} sein, ist ${got.toFixed(3)}`);
  });

  test('ein langsamer, fehleranfälliger Spieler wird als solcher erkannt', () => {
    const slow = buildProfile(samplesFor(PRESET_PROFILES.easy, 10));
    const fast = buildProfile(samplesFor(PRESET_PROFILES.brutal, 10));
    assert.ok(slow.profile.mistakesPerGame > fast.profile.mistakesPerGame,
      `mehr Fehler erwartet (langsam ${slow.profile.mistakesPerGame} vs schnell ${fast.profile.mistakesPerGame})`);
  });

  test('zu wenige Partien ⇒ ready=false, aber der Fortschritt wird gezählt', () => {
    const r = buildProfile(samplesFor(PRESET_PROFILES.medium, 3));
    assert.equal(r.ready, false);
    assert.equal(r.games, 3);
    assert.ok(r.profile, 'ein vorläufiges Profil gibt es trotzdem (für die Anzeige)');
    assert.ok(MIN_GAMES > 3);
  });

  test('ohne Stichproben: kein Profil, sauber leer statt Absturz', () => {
    for (const bad of [[], null, undefined, [null, {}]]) {
      const r = buildProfile(bad);
      assert.equal(r.ready, false);
      assert.equal(r.games, 0);
      assert.equal(r.profile, null);
    }
  });

  test('das Ergebnis ist ein für duelbot brauchbares Profil', () => {
    const { profile } = buildProfile(samplesFor(PRESET_PROFILES.medium, 10));
    for (const v of [profile.think.t1, profile.think.t2, profile.think.hard, profile.burstMs, profile.mistakesPerGame, profile.stallRate]) {
      assert.ok(Number.isFinite(v) && v >= 0, 'jedes Feld endlich und nicht negativ');
    }
    // Der Bot muss damit ein Rätsel vollständig lösen können.
    const puzzle = generatePuzzle({ difficulty: 'sehrleicht', seed: 21 });
    const bot = createBot({ puzzle, profile: { ...PRESET_PROFILES.medium, ...profile, mistakesPerGame: 0 }, seed: 4 });
    let guard = 0;
    while (!botDone(bot) && guard++ < 5000) {
      const a = nextAction(bot);
      if (a.kind === 'done') break;
      applyAction(bot, a);
    }
    assert.ok(botDone(bot), 'Klon-Profil führt zu einem lösbaren Bot');
  });
});
