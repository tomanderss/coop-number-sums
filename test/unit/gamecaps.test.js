import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_POOL, missionPoolFor, weeklyMissions } from '../../js/missions.js';
import { ACHIEVEMENTS, achievementsFor } from '../../js/achievements.js';

// Missionen und Erfolge hängen an Fähigkeiten des Spiels. Rectangles kennt keine
// „Großen Zahlen": dort darf weder eine solche Mission ausgelost noch ein solcher
// Erfolg angezeigt werden — beides wäre unerreichbar.
describe('Missionen und Erfolge je Spiel', () => {
  test('ohne „Große Zahlen" wird die Große-Zahlen-Mission nie ausgelost', () => {
    const pool = missionPoolFor({});
    assert.ok(!pool.some((m) => m.id === 'bigWin2'));
    for (let wk = 0; wk < 500; wk++) assert.ok(!weeklyMissions(wk, 4, pool).some((m) => m.requires));
  });

  test('Spiele mit allen Fähigkeiten behalten exakt die bisherige Wochenauswahl', () => {
    const full = missionPoolFor({ bigNumbers: true });
    assert.equal(full.length, MISSION_POOL.length);
    for (let wk = 0; wk < 200; wk++) {
      assert.deepEqual(weeklyMissions(wk, 4, full).map((m) => m.id), weeklyMissions(wk).map((m) => m.id));
    }
  });

  test('ohne „Große Zahlen" erscheinen die drei Große-Zahlen-Erfolge nicht', () => {
    const list = achievementsFor({});
    assert.equal(list.length, ACHIEVEMENTS.length - 3);
    assert.ok(!list.some((a) => a.id.startsWith('big')));
    assert.equal(achievementsFor({ bigNumbers: true }).length, ACHIEVEMENTS.length);
  });

  test('jede Fähigkeit, die verlangt wird, ist bekannt', () => {
    const known = new Set(['bigNumbers']);
    for (const x of [...MISSION_POOL, ...ACHIEVEMENTS]) if (x.requires) assert.ok(known.has(x.requires), x.id);
  });
});

// Nutzerwunsch: EIN Satz Herausforderungen für alle Spiele, erfüllbar in jedem Spiel.
import { SHARED_MISSION_POOL, mergeMissions } from '../../js/missions.js';
import { ACCOUNT_FIELDS, GAME_FIELDS, joinSnapshot } from '../../js/storage.js';
describe('Missionen spielübergreifend', () => {
  test('der gemeinsame Topf enthält nur Missionen, die jedes Spiel voranbringt', () => {
    assert.ok(SHARED_MISSION_POOL.length >= 4);
    assert.ok(!SHARED_MISSION_POOL.some((m) => m.requires));
    for (let wk = 0; wk < 300; wk++) assert.equal(weeklyMissions(wk, 4, SHARED_MISSION_POOL).length, 4);
  });
  test('Missionen sind ein Konto-Feld, kein Spiel-Feld', () => {
    assert.ok(ACCOUNT_FIELDS.includes('missions'));
    assert.ok(!GAME_FIELDS.includes('missions'));
  });
  test('Alt-Stände aus der Spiel-Hälfte werden verlustfrei eingemischt', () => {
    const acc = { missions: { weekKey: 9, progress: { winAny5: 2 }, claimed: { play8: true } } };
    const game = { missions: { weekKey: 9, progress: { winAny5: 4, perfect3: 1 }, claimed: {} } };
    assert.deepEqual(joinSnapshot(acc, game).missions, { weekKey: 9, progress: { winAny5: 4, perfect3: 1 }, claimed: { play8: true } });
    // Ältere Woche in der Spiel-Hälfte verliert.
    assert.deepEqual(joinSnapshot(acc, { missions: { weekKey: 8, progress: { winAny5: 5 } } }).missions, acc.missions);
    assert.deepEqual(joinSnapshot({}, game).missions, game.missions);
    assert.deepEqual(mergeMissions({}, game.missions), game.missions);
  });
});
