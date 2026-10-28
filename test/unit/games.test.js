import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_META, GAME_IDS, DEFAULT_GAME_ID, isGameId, activeGameId, setActiveGameId, gameMeta } from '../../js/games/registry.js';
import { GAMES, gameById, activeGame } from '../../js/games/index.js';
import { hasIcon } from '../../js/icons.js';
import { DIFFICULTY_LADDER } from '../../js/config.js';
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

  test('index.html kennt dieselben Spiele wie die Registry (Spiel-CSS + Splash beim Start)', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const m = /var GAMES = \[([^\]]*)\]/.exec(html);
    assert.ok(m, 'GAMES-Liste in index.html fehlt');
    assert.deepEqual(m[1].split(',').map((x) => x.trim().replace(/'/g, '')), GAME_IDS);
  });

  test('jedes gelistete Spiel bringt die Funktionen mit, die die Schale aufruft', () => {
    assert.equal(GAMES.length, GAME_IDS.length, 'jede Kennung braucht ein geladenes Modul');
    for (const g of GAMES) {
      assert.ok(isGameId(g.id));
      for (const fn of ['generatePuzzle', 'isFullyTier1Solvable', 'workerUrl', 'initBoard']) {
        assert.equal(typeof g[fn], 'function', `${g.id} fehlt die Funktion ${fn}()`);
      }
      // Vom Brett-Modell braucht die Schale nur noch die Struktur-Pruefung eines
      // empfangenen Raetsels (Blackscreen-Schutz beim Coop-INIT).
      assert.equal(typeof g.model.validPuzzleShape, 'function', `${g.id}: model.validPuzzleShape() fehlt`);
      // Die BRETT-SCHNITTSTELLE: ueber genau diese Namen spricht die Schale den
      // Brett-Zustand an. Fehlt einer, bricht die Schale erst zur Laufzeit.
      for (const fn of ['normalizePuzzle', 'loadBoard', 'boardFields', 'boardFieldsFrom', 'boardSolved',
                        'boardProgressPct', 'boardFilledCount', 'boardProgressCounts', 'playerCorrect',
                        'wrongCells', 'applyRemoteMove', 'applyRemoteHint', 'undoLast', 'clearStaleTutor',
                        'buildHint', 'trainingStep', 'applyTrainingStep', 'trainingText',
                        'onPlayerColorsChanged', 'fitBoard', 'resetCellStyleCache', 'boardRenders', 'historyExtras']) {
        assert.equal(typeof g.board[fn], 'function', `${g.id}: board.${fn}() fehlt`);
      }
      assert.ok(g.board.HistoryBoard && typeof g.board.HistoryBoard.template === 'string', `${g.id}: board.HistoryBoard fehlt`);
      // Feature-Schalter: jedes Spiel beantwortet ALLE Schalter ausdruecklich.
      for (const f of ['hints', 'toolToggle', 'markTools', 'divStyle', 'dragScale', 'markColor', 'undo']) {
        assert.equal(typeof g.features[f], 'boolean', `${g.id}: features.${f} fehlt`);
      }
      assert.ok(g.BoardGrid && typeof g.BoardGrid.setup === 'function' && typeof g.BoardGrid.template === 'string',
        `${g.id} bringt keine Brett-Komponente mit`);
      // Die Leiter ist in allen Spielen dieselbe — jedes Spiel muss sie
      // vollstaendig belegen, sonst zeigt der Schwierigkeits-Slider Luecken.
      assert.deepEqual(g.DIFFICULTIES.map((d) => d.id), DIFFICULTY_LADDER.map((d) => d.id), `${g.id}: unvollstaendige Leiter`);
      for (const d of g.DIFFICULTIES) {
        assert.ok(d.dim && d.dim.r > 0 && d.dim.c > 0, `${g.id}/${d.id}: keine Brettmasse`);
        assert.equal(g.DIFF_BY_ID[d.id], d);
      }
      assert.equal(typeof g.bigNumbersAllowed, 'function');
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
