import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_META, GAME_IDS, DEFAULT_GAME_ID, isGameId, activeGameId, setActiveGameId, gameMeta } from '../../js/games/registry.js';
import { GAMES, gameById, activeGame } from '../../js/games/index.js';
import { hasIcon } from '../../js/icons.js';
import de from '../../js/i18n/de.js';

// Die Spiel-Registry ist die Naht, an der die Schale (js/) vom einzelnen Spiel
// (js/games/<id>/) getrennt ist. Was hier schiefgeht, faellt sonst erst auf,
// wenn ein zweites Spiel dazukommt — oder, schlimmer, wenn Cloud-Daten unter
// einer falschen Kennung landen.
describe('Spiel-Registry', () => {
  test('jedes Spiel hat Kennung, i18n-Name und ein vorhandenes Icon', () => {
    assert.ok(GAME_IDS.length >= 1);
    for (const id of GAME_IDS) {
      const m = GAME_META[id];
      assert.equal(m.id, id, 'die Kennung im Eintrag muss zum Schluessel passen');
      assert.ok(hasIcon(m.icon), `Icon "${m.icon}" von ${id} fehlt in js/icons.js`);
      // Der Name muss in der Fallback-Sprache aufloesen, sonst zeigt die
      // Spielauswahl den rohen Schluessel (s. CLAUDE.md: nie rohe Keys in der UI).
      const wert = m.nameKey.split('.').reduce((o, k) => (o || {})[k], de);
      assert.equal(typeof wert, 'string', `i18n-Schluessel "${m.nameKey}" fehlt in de.js`);
      assert.ok(wert.length > 0);
    }
  });

  test('das Standardspiel existiert und ist das aktive Spiel beim Start', () => {
    assert.ok(isGameId(DEFAULT_GAME_ID));
    assert.equal(activeGameId(), DEFAULT_GAME_ID);
  });

  test('eine unbekannte Kennung wird ignoriert statt uebernommen', () => {
    // Ein alter oder manipulierter Wert darf die App nie in einen Zustand ohne
    // Spiel bringen — davon haengt u.a. der Cloud-Knoten der Spieldaten ab.
    const vorher = activeGameId();
    assert.equal(setActiveGameId('gibtsnicht'), vorher);
    assert.equal(activeGameId(), vorher);
    assert.equal(setActiveGameId(null), vorher);
    assert.equal(gameMeta('gibtsnicht').id, DEFAULT_GAME_ID);
  });

  test('jedes gelistete Spiel bringt die Funktionen mit, die die Schale aufruft', () => {
    assert.equal(GAMES.length, GAME_IDS.length, 'jede Kennung braucht ein geladenes Modul');
    for (const g of GAMES) {
      assert.ok(isGameId(g.id));
      for (const fn of ['generatePuzzle', 'remapColorsForMarkVisibility', 'buildHintTutorial',
                        'findTrainingStep', 'isFullyTier1Solvable', 'workerUrl']) {
        assert.equal(typeof g[fn], 'function', `${g.id} fehlt die Funktion ${fn}()`);
      }
      // Der Generierungs-Worker gehoert zum Spiel, nicht zur Schale.
      assert.match(String(g.workerUrl()), new RegExp(`js/games/${g.id}/genworker\\.js$`));
    }
  });

  test('gameById faellt bei Unbekanntem auf das Standardspiel zurueck', () => {
    assert.equal(gameById('numbersums').id, 'numbersums');
    assert.equal(gameById('gibtsnicht').id, DEFAULT_GAME_ID);
    assert.equal(activeGame().id, activeGameId());
  });
});
