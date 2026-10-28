// games/rectangles/index.js — die Spiel-Beschreibung von „Rectangles" (im
// Original: Shikaku, Nikoli). Dieselbe Form wie games/numbersums/index.js und
// games/mathcross/index.js: die Schale findet hier alles, was dieses Spiel kann.

import { generatePuzzle } from './generator.js';
import { validPuzzleShape as shapeOk, normalizePuzzle } from './model.js';
import * as board from './board.js';
import { BoardGrid, RectStatus, initBoard, isFullyTier1Solvable } from './board.js';
import { DIFFICULTIES, DIFF_BY_ID, bigNumbersAllowed } from './difficulty.js';
import { GAME_META } from '../registry.js';
import messages from './i18n.js';

export const GAME = {
  ...GAME_META.rectangles,

  // Struktur-Prüfung eines per Coop-INIT empfangenen Rätsels (Blackscreen-Schutz).
  model: {
    validPuzzleShape: (p) => shapeOk(normalizePuzzle(p)),
  },

  BoardGrid,
  // Unter dem Brett: eine Zeile fester Höhe mit Bedienhinweis bzw. „geht nicht auf".
  BoardBelow: RectStatus,
  initBoard,
  board,

  DIFFICULTIES,
  DIFF_BY_ID,
  bigNumbersAllowed,

  generatePuzzle,
  isFullyTier1Solvable,

  // Kein Werkzeug-Umschalter (Ziehen und Tippen genügen), dafür Rückgängig.
  // Tipps folgen mit dem Tipp-Tutor.
  features: {
    hints: false,
    toolToggle: false,
    markTools: false,
    divStyle: false,
    dragScale: false,
    markColor: false,
    undo: true,
  },

  messages,

  workerUrl: () => new URL('./genworker.js', import.meta.url),
};

export default GAME;
