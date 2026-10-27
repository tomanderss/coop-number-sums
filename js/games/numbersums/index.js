// games/numbersums/index.js — die Spiel-Beschreibung von „Number Sums".
//
// EIN Ort, an dem die Schale (js/app.js) alles findet, was dieses Spiel kann:
// Raetsel erzeugen, Tipps erklaeren, Trainings-Schritte liefern, und den
// Hintergrund-Thread fuer die Generierung. Ein zweites Spiel legt daneben ein
// eigenes `js/games/<id>/index.js` mit DERSELBEN Form — die Schale muss dann
// nichts mehr ueber das einzelne Spiel wissen.
//
// Die reine Logik bleibt in den Nachbardateien (solver/generator/hinttutor/
// training/duelbot/playstyle); diese Datei buendelt sie nur.

import { generatePuzzle, remapColorsForMarkVisibility, findHintCell, makeRng } from './generator.js';
import { buildHintTutorial } from './hinttutor.js';
import { findTrainingStep, isFullyTier1Solvable } from './training.js';
import * as model from './model.js';
import { DIFFICULTIES, DIFF_BY_ID, bigNumbersAllowed } from './difficulty.js';
import * as board from './board.js';
import { BoardGrid, initBoard } from './board.js';
import { GAME_META } from '../registry.js';

export const GAME = {
  ...GAME_META.numbersums,

  // Das BRETT-MODELL: die Spielregeln als reine Funktionen von (puzzle, marks)
  // — Summen, Fertig-Status, Fortschritt, Zellen-Metadaten, Struktur-Pruefung.
  // Das ist der Teil, den ein zweites Spiel komplett anders beantwortet.
  model,

  // Die BRETT-DARSTELLUNG: die Vue-Komponente des Spielbretts samt ihren
  // Zell-Klassen/-Styles und Render-Caches (js/games/numbersums/board.js).
  // `initBoard(ctx)` uebergibt ihr einmalig, was sie von der Schale braucht.
  BoardGrid,
  initBoard,
  // Die BRETT-SCHNITTSTELLE (dasselbe Modul): laden, speichern, gelöst?,
  // Fortschritt, Züge von Mitspielern, Rückgängig, Training, Zellgröße. Die
  // Schale spricht den Brett-Zustand NUR hierüber an (s. Ende von board.js).
  board,

  // Die Schwierigkeitsstufen MIT den Brettmassen und Erzeugungs-Parametern
  // dieses Spiels (die Leiter selbst ist in allen Spielen gleich, s. config.js).
  DIFFICULTIES,
  DIFF_BY_ID,
  // „Grosse Zahlen" (10–19) gibt es nur hier; ein Spiel ohne diesen Modus
  // liefert immer false, die Schale blendet den Schalter dann aus.
  bigNumbersAllowed,

  // ── Raetsel ──
  generatePuzzle,
  remapColorsForMarkVisibility,
  findHintCell,
  makeRng,

  // ── Erklaeren & Lernen ──
  buildHintTutorial,
  findTrainingStep,
  isFullyTier1Solvable,

  // Der Generierungs-Worker gehoert zum SPIEL, nicht zur Schale: jedes Spiel
  // erzeugt seine Raetsel anders. Als Funktion, damit `import.meta.url` erst
  // beim Erzeugen des Workers aufgeloest wird (und relativ zu DIESER Datei).
  // Was die Schale je Spiel ein- oder ausblendet (s. mathcross/index.js).
  features: {
    hints: true,
    toolToggle: true,
    aiDuel: true,
    markTools: false,
    divStyle: false,
    dragScale: false,
    markColor: false,
  },

  workerUrl: () => new URL('./genworker.js', import.meta.url),
};

export default GAME;
