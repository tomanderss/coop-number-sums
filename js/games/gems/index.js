// games/gems/index.js — die Spiel-Beschreibung von „Gem Hunt" (Prinzip
// „Star Battle"/„Queens": je Zeile, Spalte und Farbkäfig genau ein Edelstein,
// Edelsteine berühren sich nie). Dieselbe Form wie die anderen Spiele.

import { generatePuzzle } from './generator.js';
import { validPuzzleShape as shapeOk, normalizePuzzle } from './model.js';
import * as board from './board.js';
import { BoardGrid, GemTools, initBoard, isFullyTier1Solvable } from './board.js';
import { DIFFICULTIES, DIFF_BY_ID, bigNumbersAllowed } from './difficulty.js';
import { GAME_META } from '../registry.js';
import messages from './i18n.js';

export const GAME = {
  ...GAME_META.gems,

  // Struktur-Prüfung eines per Coop-INIT empfangenen Rätsels (Blackscreen-Schutz).
  model: {
    validPuzzleShape: (p) => shapeOk(normalizePuzzle(p)),
  },

  // Unter dem Brett der Werkzeug-Umschalter Stein/Kreuz; kein Rückgängig,
  // keine Tipps — wie Rectangles. Das Training bleibt.
  BoardGrid,
  BoardBelow: GemTools,
  initBoard,
  board,

  DIFFICULTIES,
  DIFF_BY_ID,
  bigNumbersAllowed,

  generatePuzzle,
  isFullyTier1Solvable,

  features: {
    // Im Coop sehen die anderen live, was einer gerade zieht (app.js liveActive).
    liveDrafts: true,
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
