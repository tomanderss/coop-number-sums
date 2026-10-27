// games/mathcross/index.js — die Spiel-Beschreibung von „Math Cross".
//
// Dieselbe Form wie games/numbersums/index.js: die Schale findet hier alles,
// was dieses Spiel kann. Die Logik stammt aus Coop Math Cross (Rechenkreuz:
// ein Kreuzwort aus Gleichungen, die Lücken füllt man mit Steinen aus einem
// Vorrat).

import { generatePuzzle } from './generator.js';
import { validPuzzleShape as shapeOk } from './equations.js';
import { normalizePuzzle, DIV_STYLES } from './model.js';
import * as board from './board.js';
import { BoardGrid, TrayBar, initBoard, isFullyTier1Solvable } from './board.js';
import { DIFFICULTIES, DIFF_BY_ID, bigNumbersAllowed } from './difficulty.js';
import { GAME_META } from '../registry.js';
import messages from './i18n.js';

export const GAME = {
  ...GAME_META.mathcross,

  // Was die Schale vom Brett-MODELL braucht: die Struktur-Prüfung eines per
  // Coop-INIT empfangenen Rätsels (Blackscreen-Schutz). Ein aus der RTDB
  // gekommenes Rätsel hat Löcher im slots-Raster — erst heilen, dann prüfen.
  model: {
    validPuzzleShape: (p) => shapeOk(normalizePuzzle(p)),
  },

  // Brett-Darstellung + Brett-Schnittstelle (s. board.js). `BoardBelow` steht
  // unter dem Brett: hier der Vorrat mit den noch zu legenden Steinen.
  BoardGrid,
  BoardBelow: TrayBar,
  initBoard,
  board,

  DIFFICULTIES,
  DIFF_BY_ID,
  // „Große Zahlen" = deutlich größerer Zahlenraum, auf allen Stufen erlaubt.
  bigNumbersAllowed,

  generatePuzzle,
  isFullyTier1Solvable,

  // Was die Schale je Spiel ein- oder ausblendet. Math Cross hat KEINE
  // Tipps, keinen Werkzeug-Umschalter und (noch) kein KI-Duell — dafür die
  // persönlichen Farb-Markierungen, das wählbare Geteilt-Zeichen und die
  // Zieh-Reichweite.
  features: {
    hints: false,
    toolToggle: false,
    aiDuel: false,
    markTools: true,
    divStyle: true,
    dragScale: true,
    markColor: true,
  },

  // Auswahl des Geteilt-Zeichens (Einstellungen + einmalige Frage).
  divStyles: DIV_STYLES,

  // Spieleigene Texte als Ebene über den gemeinsamen (s. i18n.js).
  messages,

  workerUrl: () => new URL('./genworker.js', import.meta.url),
};

export default GAME;
