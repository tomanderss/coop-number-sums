import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  STORY_LEVELS, STORY_CHUNK, STORY_BANDS, MIX_KEY, storyBandIndex, storyBandRange, storyDifficulty,
  storyChunkOf, storyChunkPath, storyStars, storyNext, storyUnlocked, recordStoryResult, mergeStory,
  storyStarsTotal, mixStoryGames, cleanPuzzle, storyParMs, STORY_SEC_PER_CELL,
} from '../../js/story.js';
import { GAMES, GAME_IDS } from '../../js/games/index.js';

describe('Story: Kurve', () => {
  test('schnell aus dem Leichten heraus, Spitze erst ab Level 251', () => {
    const ids = GAMES[0].DIFFICULTIES.map((d) => d.id);
    assert.equal(storyDifficulty(1, ids), ids[0]);
    assert.equal(storyDifficulty(25, ids), 'mittel', 'spätestens Level 25 ist Mittel erreicht');
    assert.equal(storyDifficulty(250, ids) === 'rip', false);
    assert.equal(storyDifficulty(251, ids), 'rip');
    assert.equal(storyDifficulty(500, ids), 'rip');
  });
  test('die Stufe steigt nie wieder ab', () => {
    let prev = 0;
    for (let L = 1; L <= STORY_LEVELS; L++) { const i = storyBandIndex(L); assert.ok(i >= prev); prev = i; }
  });
  test('Bänder lückenlos', () => {
    let next = 1;
    STORY_BANDS.forEach((_, i) => { const r = storyBandRange(i); assert.equal(r.from, next); next = r.to + 1; });
    assert.equal(next, STORY_LEVELS + 1);
  });
  test('Pakete', () => {
    assert.equal(storyChunkOf(1), 0); assert.equal(storyChunkOf(STORY_CHUNK), 0); assert.equal(storyChunkOf(STORY_CHUNK + 1), 1);
    assert.equal(storyChunkPath('pipes', 3), 'data/story/pipes/03.json');
  });
});

describe('Story: Sterne', () => {
  test('mit Leben zählen Fehler und Tipps', () => {
    assert.equal(storyStars({ lives: true, mistakes: 0 }), 3);
    assert.equal(storyStars({ lives: true, mistakes: 1 }), 2);
    assert.equal(storyStars({ lives: true, mistakes: 0, hints: 1 }), 2);
    assert.equal(storyStars({ lives: true, mistakes: 2 }), 1);
  });
  test('ohne Leben zählt die Zeit (grob)', () => {
    const base = { lives: false, cells: 64, bandIndex: 2, game: 'pipes' };
    assert.equal(storyStars({ ...base, elapsedMs: 10_000 }), 3);
    assert.equal(storyStars({ ...base, elapsedMs: 30 * 60_000 }), 1);
  });
  // Kalibriert an den Zeiten eines erfahrenen Spielers (s. story.js): auf den
  // unveränderten leichten Stufen bringt seine Bestzeit 3★, sein Durchschnitt nicht.
  test('Kalibrierung: Bestzeit = 3★, Durchschnitt nicht, anderthalbfacher Durchschnitt noch 2★', () => {
    const cases = [
      // [Spiel, Stufe, Zellen, Bestzeit s, Durchschnitt s]
      ['numberlink', 0, 25, 4.3, 7.7],
      ['numberpath', 0, 25, 7.2, 24.3],
      ['pipes', 1, 36, 39.5, 70.1],
    ];
    for (const [game, bandIndex, cells, best, avg] of cases) {
      const st = (sec) => storyStars({ lives: false, game, bandIndex, cells, elapsedMs: sec * 1000 });
      assert.equal(st(best), 3, `${game} Bestzeit`);
      assert.equal(st(avg), 2, `${game} Durchschnitt`);
      assert.equal(st(avg * 1.5), 2, `${game} 1,5 × Durchschnitt`);
    }
  });
  test('ab „Mittel“ mit Aufschlag für die schwereren Rätsel, Werte steigen mit der Stufe', () => {
    for (const g of Object.keys(STORY_SEC_PER_CELL)) {
      let prev = 0;
      for (let b = 0; b < 9; b++) {
        const par = storyParMs(100, b, g) / 100;
        assert.ok(par >= prev, `${g} Stufe ${b}`);
        prev = par;
      }
      assert.ok(storyParMs(100, 2, g) > storyParMs(100, 1, g) * 2 - 1, g);
    }
  });
});

describe('Story: Fortschritt', () => {
  test('nächstes Level, Freischaltung, Bestwerte', () => {
    let p = {};
    assert.equal(storyNext(p, 'pipes'), 1);
    assert.equal(storyUnlocked(p, 'pipes', 2), false);
    p = recordStoryResult(p, 'pipes', 1, { stars: 2, ms: 9000 });
    p = recordStoryResult(p, 'pipes', 1, { stars: 1, ms: 5000 });
    assert.deepEqual(p.pipes[1], { s: 2, t: 5000 }, 'bessere Sterne bleiben, schnellere Zeit gewinnt');
    assert.equal(storyNext(p, 'pipes'), 2);
    assert.equal(storyUnlocked(p, 'pipes', 2), true);
    assert.equal(storyStarsTotal(p, 'pipes'), 2);
  });
  test('Geräte-Abgleich nimmt je Level das Bessere', () => {
    const a = { gems: { 1: { s: 3, t: 9000 }, 2: { s: 1, t: 4000 } } };
    const b = { gems: { 2: { s: 2, t: 6000 }, 3: { s: 1, t: 1000 } }, pipes: { 1: { s: 1, t: 1 } } };
    const m = mergeStory(a, b);
    assert.deepEqual(m.gems, { 1: { s: 3, t: 9000 }, 2: { s: 2, t: 4000 }, 3: { s: 1, t: 1000 } });
    assert.deepEqual(m.pipes, { 1: { s: 1, t: 1 } });
  });
});

describe('Story: Mix', () => {
  test('feste Folge, jedes Spiel je Runde, nie zweimal hintereinander', () => {
    const a = mixStoryGames(GAME_IDS), b = mixStoryGames(GAME_IDS);
    assert.deepEqual(a, b);
    assert.equal(a.length, STORY_LEVELS);
    for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1]);
    assert.deepEqual([...new Set(a.slice(0, GAME_IDS.length))].sort(), [...GAME_IDS].sort());
  });
  test('volatile Felder fallen weg', () => {
    assert.deepEqual(cleanPuzzle({ a: 1, genMs: 3, attempts: 2 }), { a: 1 });
  });
});

// Die ausgelieferten Level-Daten: vollständig, in der Kurve, gültige Rätsel.
describe('Story: Level-Daten', () => {
  for (const key of [...GAME_IDS, MIX_KEY]) {
    test(`${key}: 500 Level, Stufe passt zur Kurve, Rätsel gültig`, () => {
      const first = new URL(`../../${storyChunkPath(key, 0)}`, import.meta.url);
      if (!existsSync(first)) return;   // (noch) nicht erzeugt
      const mixOrder = key === MIX_KEY ? mixStoryGames(GAME_IDS) : null;
      let L = 0;
      for (let c = 0; c * STORY_CHUNK < STORY_LEVELS; c++) {
        const f = JSON.parse(readFileSync(new URL(`../../${storyChunkPath(key, c)}`, import.meta.url), 'utf8'));
        assert.equal(f.key, key);
        for (const e of f.levels) {
          L++;
          assert.equal(e.level, L, `Lücke vor Level ${L}`);
          const game = GAMES.find((g) => g.id === e.game);
          assert.ok(game, `unbekanntes Spiel ${e.game}`);
          if (mixOrder) assert.equal(e.game, mixOrder[L - 1]); else assert.equal(e.game, key);
          assert.equal(e.difficulty, storyDifficulty(L, game.DIFFICULTIES.map((d) => d.id)), `Level ${L}: Stufe`);
          assert.ok(game.model.validPuzzleShape(e.puzzle), `Level ${L}: Rätsel ungültig`);
        }
      }
      assert.equal(L, STORY_LEVELS);
    });
  }
});

import { storyBoardBetter, sortStoryBoard, storyBoardView } from '../../js/story.js';
describe('Story: Bestenliste', () => {
  test('mehr Sterne schlagen schnellere Zeit, bei Gleichstand gewinnt die Zeit', () => {
    assert.equal(storyBoardBetter({ stars: 3, timeMs: 300000 }, { stars: 2, timeMs: 1000 }), true);
    assert.equal(storyBoardBetter({ stars: 2, timeMs: 1000 }, { stars: 3, timeMs: 300000 }), false);
    assert.equal(storyBoardBetter({ stars: 3, timeMs: 900 }, { stars: 3, timeMs: 1000 }), true);
    assert.equal(storyBoardBetter({ stars: 3, timeMs: 1000 }, { stars: 3, timeMs: 1000 }), false);
    assert.equal(storyBoardBetter({ stars: 1, timeMs: 5 }, null), true);
    assert.equal(storyBoardBetter({ stars: 0, timeMs: 5 }, null), false);
    assert.equal(storyBoardBetter({ stars: 2, timeMs: 0 }, null), false);
  });
  test('Sortierung und Anzeige: Top 3 + eigener Platz', () => {
    const e = [
      { uid: 'a', username: 'A', stars: 2, timeMs: 100 },
      { uid: 'b', username: 'B', stars: 3, timeMs: 900 },
      { uid: 'c', username: 'C', stars: 3, timeMs: 500 },
      { uid: 'd', username: 'D', stars: 1, timeMs: 50 },
      { uid: 'x', username: 'X', stars: 2, timeMs: Infinity },
      null,
    ];
    assert.deepEqual(sortStoryBoard(e).map((x) => x.uid), ['c', 'b', 'a', 'd']);
    const v = storyBoardView(e, 'd', 3);
    assert.deepEqual(v.rows.map((x) => x.rank), [1, 2, 3]);
    assert.equal(v.mine.uid, 'd');
    assert.equal(v.mine.rank, 4);
    assert.equal(v.total, 4);
    const top = storyBoardView(e, 'b', 3);
    assert.equal(top.mine, null);
    assert.equal(top.rows[1].me, true);
  });
});
