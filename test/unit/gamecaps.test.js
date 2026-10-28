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
