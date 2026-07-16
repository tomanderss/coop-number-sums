import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasIcon } from '../../js/icons.js';
import {
  currentWeekKey, MISSION_POOL, weeklyMissions, missionStateFor, missionValue,
  isMissionComplete, isMissionClaimable, allMissionsComplete, claimableCount, applyMissionEvent,
} from '../../js/missions.js';

describe('missions.pool', () => {
  test('every mission has a drawn icon and sane target/reward', () => {
    for (const m of MISSION_POOL) {
      assert.ok(m.icon && hasIcon(m.icon), `mission '${m.id}' needs a drawn icon`);
      assert.ok(m.target >= 1 && m.reward > 0, m.id);
      assert.equal(typeof m.inc, 'function');
    }
  });
  test('mission ids are unique', () => {
    const ids = MISSION_POOL.map(m => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('missions.weekKey', () => {
  test('is stable within a week and advances across weeks', () => {
    const day = 86400000;
    // Auf einen Wochen-Anfang ausrichten (formel-konsistent zurückgehen).
    let d = Math.floor(Date.UTC(2026, 0, 5) / day);
    const B = currentWeekKey(d * day);
    while (currentWeekKey((d - 1) * day) === B) d--;
    const start = d * day;
    assert.equal(currentWeekKey(start), B);
    assert.equal(currentWeekKey(start + 6 * day), B);       // selbe Woche
    assert.equal(currentWeekKey(start + 7 * day), B + 1);   // nächste Woche
    assert.equal(currentWeekKey(start - 1), B - 1);         // Tag davor = Vorwoche
  });
});

describe('missions.weeklyMissions', () => {
  test('picks a deterministic, stable set per week', () => {
    const a = weeklyMissions(100, 4).map(m => m.id);
    const b = weeklyMissions(100, 4).map(m => m.id);
    assert.deepEqual(a, b);
    assert.equal(a.length, 4);
    assert.equal(new Set(a).size, 4); // keine Doppelten
  });
  test('different weeks generally differ', () => {
    const a = weeklyMissions(100, 4).map(m => m.id).join();
    const c = weeklyMissions(101, 4).map(m => m.id).join();
    assert.notEqual(a, c);
  });
});

describe('missions.state + progress', () => {
  test('missionStateFor resets when the week changed', () => {
    const stored = { weekKey: 5, progress: { winAny5: 3 }, claimed: { winAny5: true } };
    assert.deepEqual(missionStateFor(stored, 5).progress, { winAny5: 3 });      // gleiche Woche → behalten
    assert.deepEqual(missionStateFor(stored, 6), { weekKey: 6, progress: {}, claimed: {} }); // neue Woche → frisch
  });
  test('applyMissionEvent increments matching missions, capped at target', () => {
    const missions = [MISSION_POOL.find(m => m.id === 'winAny5'), MISSION_POOL.find(m => m.id === 'perfect3')];
    let p = {};
    p = applyMissionEvent(missions, p, { won: true, perfect: true });
    assert.equal(p.winAny5, 1);
    assert.equal(p.perfect3, 1);
    // Niederlage bewegt nichts
    p = applyMissionEvent(missions, p, { won: false });
    assert.equal(p.winAny5, 1);
    // Deckelung auf target
    for (let i = 0; i < 20; i++) p = applyMissionEvent(missions, p, { won: true, perfect: true });
    assert.equal(p.winAny5, 5);
    assert.equal(p.perfect3, 3);
  });
  test('complete/claimable/allComplete', () => {
    const missions = [MISSION_POOL.find(m => m.id === 'ripWin1')];
    const progress = { ripWin1: 1 };
    assert.equal(isMissionComplete(missions[0], progress), true);
    assert.equal(isMissionClaimable(missions[0], progress, {}), true);
    assert.equal(isMissionClaimable(missions[0], progress, { ripWin1: true }), false); // schon eingelöst
    assert.equal(missionValue(missions[0], progress), 1);
    assert.equal(allMissionsComplete(missions, progress), true);
    assert.equal(claimableCount(missions, progress, {}), 1);
    assert.equal(claimableCount(missions, progress, { ripWin1: true }), 0);
  });
  test('endless/streak/hard missions use threshold semantics', () => {
    const hard = MISSION_POOL.find(m => m.id === 'hardWin1');
    const endless = MISSION_POOL.find(m => m.id === 'endless3');
    assert.equal(hard.inc({ won: true, diffIndex: 3 }), 1);   // Schwer (Index 3)
    assert.equal(hard.inc({ won: true, diffIndex: 2 }), 0);   // nur Mittel
    assert.equal(endless.inc({ endlessScore: 3 }), 1);
    assert.equal(endless.inc({ endlessScore: 2 }), 0);
  });
});
