import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canTakeEdit, EDIT_STALE_MS } from '../../js/coop.js';
import { GAMES } from '../../js/games/index.js';

describe('Bearbeiten-Sperre', () => {
  test('nehmen: frei, eigene oder abgelaufene Sperre — nie eine frische fremde', () => {
    const now = 1_000_000;
    assert.equal(canTakeEdit(null, 'a', now), true);
    assert.equal(canTakeEdit({ req: { uid: 'b' } }, 'a', now), true);          // nur eine Anfrage, kein Halter
    assert.equal(canTakeEdit({ uid: 'a', at: now }, 'a', now), true);
    assert.equal(canTakeEdit({ uid: 'b', at: now - 1000 }, 'a', now), false);
    assert.equal(canTakeEdit({ uid: 'b', at: now - EDIT_STALE_MS }, 'a', now), true);
  });
  test('genau die Spiele, in denen gleichzeitiges Bearbeiten schwer ist', () => {
    const on = GAMES.filter((g) => g.features && g.features.editLock).map((g) => g.id).sort();
    assert.deepEqual(on, ['gems', 'numberpath', 'pipes', 'rectangles']);
    for (const g of GAMES.filter((x) => x.features && x.features.editLock)) {
      assert.equal(typeof g.board.cancelLiveGesture, 'function', g.id + ': cancelLiveGesture fehlt');
    }
  });
});
