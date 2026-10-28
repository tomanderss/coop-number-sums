// games/index.js — alle Spiele mit ihrer vollen Beschreibung.
//
// Die Schale (js/app.js) holt sich das laufende Spiel ueber `activeGame()` und
// ruft dessen Funktionen auf, statt ein bestimmtes Spiel direkt zu importieren.
// Ein neues Spiel braucht genau zwei Schritte: ein Modul
// `js/games/<id>/index.js` mit derselben Form, und einen Eintrag hier sowie in
// `registry.js`.
//
// Unterschied zu `registry.js`: dort stehen nur die Stammdaten (Kennung, Name,
// Icon) OHNE schwere Importe — `js/storage.js` braucht die Kennung fuer die
// spieleigenen Cloud-Knoten und darf dafuer nicht Solver und Generator
// mitladen.

import numbersums from './numbersums/index.js';
import mathcross from './mathcross/index.js';
import rectangles from './rectangles/index.js';
import numberpath from './numberpath/index.js';
import gems from './gems/index.js';
import pipes from './pipes/index.js';
import { activeGameId, setActiveGameId, DEFAULT_GAME_ID, GAME_IDS, isGameId } from './registry.js';

const BY_ID = { numbersums, mathcross, rectangles, numberpath, gems, pipes };

/** Alle Spiele in Anzeige-Reihenfolge. */
export const GAMES = GAME_IDS.map((id) => BY_ID[id]).filter(Boolean);

/** Ein Spiel nach Kennung; unbekannt ⇒ Standardspiel (die App bleibt spielbar). */
export function gameById(id) { return BY_ID[id] || BY_ID[DEFAULT_GAME_ID]; }

/** Das laufende Spiel. */
export function activeGame() { return gameById(activeGameId()); }

export { activeGameId, setActiveGameId, DEFAULT_GAME_ID, GAME_IDS, isGameId };
