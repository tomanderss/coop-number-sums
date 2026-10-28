// games/gems/index.js — die Spiel-Beschreibung von „Gem Hunt" (Prinzip
// „Star Battle"/„Queens": je Zeile, Spalte und Farbkäfig genau ein Edelstein,
// Edelsteine berühren sich nie). Dieselbe Form wie die anderen Spiele.

import { generatePuzzle } from './generator.js';
import { validPuzzleShape as shapeOk, normalizePuzzle } from './model.js';
import * as board from './board.js';
import { BoardGrid, initBoard, isFullyTier1Solvable } from './board.js';
import { DIFFICULTIES, DIFF_BY_ID, bigNumbersAllowed } from './difficulty.js';
import { GAME_META } from '../registry.js';
import messages from './i18n.js';

export const GAME = {
  ...GAME_META.gems,

  // Struktur-Prüfung eines per Coop-INIT empfangenen Rätsels (Blackscreen-Schutz).
  model: {
    validPuzzleShape: (p) => shapeOk(normalizePuzzle(p)),
  },

  // Nichts unter dem Brett, kein Rückgängig, keine Tipps — wie Rectangles.
  // Das Training bleibt.
  BoardGrid,
  initBoard,
  board,

  DIFFICULTIES,
  DIFF_BY_ID,
  bigNumbersAllowed,

  generatePuzzle,
  isFullyTier1Solvable,

  features: {
    // Im Coop zeichnet immer nur einer, die anderen sehen live zu (app.js editLockActive).
    editLock: true,
    hints: false,
    toolToggle: false,
    markTools: false,
    divStyle: false,
    dragScale: false,
    markColor: false,
  },

  messages,

  workerUrl: () => new URL('./genworker.js', import.meta.url),
};

export default GAME;
