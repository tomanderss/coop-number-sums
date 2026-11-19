import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStaleBests, BEST_RESETS } from '../../js/storage.js';
import { mergeSnapshots } from '../../js/account.js';

const cfg = BEST_RESETS.pipes;
const since = cfg.since;

describe('Bestzeiten nach einem Schwierigkeits-Umbau', () => {
  test('alte Bestzeit (ohne Stempel) fällt weg, Verlauf nach dem Umbau ersetzt sie', () => {
    const stats = { byDifficulty: {
      extrem: { bestTimeMs: 178757, coopBestTimeMs: 103727 },
      leicht: { bestTimeMs: 33667 },
      rip: { bestTimeMs: 400000, bestAt: since + 10 },
    } };
    const hist = [
      { difficulty: 'extrem', outcome: 'won', coop: false, timeMs: 572000, ts: since + 5 },
      { difficulty: 'extrem', outcome: 'won', coop: false, timeMs: 571000, ts: since + 6 },
      { difficulty: 'extrem', outcome: 'won', coop: false, timeMs: 100000, ts: since - 5 },  // vor dem Umbau
      { difficulty: 'extrem', outcome: 'lost', coop: false, timeMs: 1000, ts: since + 7 },
    ];
    const r = cleanStaleBests(stats, hist, cfg);
    assert.equal(r.changed, true);
    assert.equal(stats.byDifficulty.extrem.bestTimeMs, 571000);
    assert.equal(stats.byDifficulty.extrem.bestAt, since + 6);
    assert.equal(stats.byDifficulty.extrem.coopBestTimeMs, null, 'kein Coop-Sieg nach dem Umbau');
    assert.equal(stats.byDifficulty.leicht.bestTimeMs, 33667, 'nicht betroffene Stufe bleibt');
    assert.equal(stats.byDifficulty.rip.bestTimeMs, 400000, 'gestempelte neue Bestzeit bleibt');
    assert.equal(cleanStaleBests(stats, hist, cfg).changed, false, 'beim zweiten Mal nichts mehr');
  });
  test('Cloud-Abgleich bringt die alte Bestzeit nicht zurück (Stempel gehört zur Zeit)', () => {
    const local = { stats: { byDifficulty: { extrem: { bestTimeMs: 571000, bestAt: since + 6 } } } };
    const cloud = { stats: { byDifficulty: { extrem: { bestTimeMs: 178757 } } } };
    const m = mergeSnapshots(local, cloud).stats;
    assert.equal(m.byDifficulty.extrem.bestTimeMs, 178757, 'Minimum wie bisher');
    assert.equal(m.byDifficulty.extrem.bestAt ?? null, null, 'aber ohne Stempel → beim Laden wieder verworfen');
    cleanStaleBests(m, [{ difficulty: 'extrem', outcome: 'won', timeMs: 571000, ts: since + 6 }], cfg);
    assert.equal(m.byDifficulty.extrem.bestTimeMs, 571000);
  });
  test('neue schnellere Bestzeit gewinnt samt Stempel', () => {
    const local = { stats: { byDifficulty: { rip: { bestTimeMs: 2000000, bestAt: since + 1 } } } };
    const cloud = { stats: { byDifficulty: { rip: { bestTimeMs: 1500000, bestAt: since + 9 } } } };
    const m = mergeSnapshots(local, cloud).stats.byDifficulty.rip;
    assert.deepEqual([m.bestTimeMs, m.bestAt], [1500000, since + 9]);
  });
});
