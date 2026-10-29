import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../../js/games/index.js';
import * as Coop from '../../js/coop.js';

describe('Live-Entwürfe im Coop', () => {
  test('genau die Zieh-Spiele zeigen den Entwurf der anderen live', () => {
    const on = GAMES.filter((g) => g.features && g.features.liveDrafts).map((g) => g.id).sort();
    assert.deepEqual(on, ['gems', 'numberpath', 'pipes', 'rectangles']);
  });
  test('keine Bearbeiten-Sperre mehr: alle zeichnen gleichzeitig', () => {
    for (const g of GAMES) assert.ok(!(g.features && g.features.editLock), g.id + ': editLock');
    for (const fn of ['claimEdit', 'releaseEdit', 'requestEdit', 'grantEdit', 'onEdit']) assert.equal(Coop[fn], undefined, fn);
    assert.equal(typeof Coop.setLive, 'function');
    assert.equal(typeof Coop.onLive, 'function');
  });
});
