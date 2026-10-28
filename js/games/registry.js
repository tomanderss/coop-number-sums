// games/registry.js — WELCHE Spiele es gibt, und welches gerade laeuft.
//
// Coop Number Sums und Coop Math Cross werden zu EINER App zusammengelegt
// („Coop Number Games"): bis auf die Spiellogik ist alles identisch oder sehr
// aehnlich — Firebase, Menue, Gestaltung, Farben, Tipp-Konzept, Kopfleiste,
// Duell, Fortschrittsleiste, Erfolge. Statt jede Aenderung von Hand ins zweite
// Projekt nachzuziehen, gibt es eine Schale (alles in `js/`) und je Spiel ein
// Modul (`js/games/<id>/`).
//
// Diese Datei haelt BEWUSST nur die Stammdaten und importiert NICHTS Schweres:
// `js/storage.js` braucht die Spiel-Kennung fuer die getrennten Cloud-Knoten
// (`users/{uid}/games/{id}`) und darf dafuer nicht die halbe Spiellogik
// (Solver, Generator) mitladen. Die vollen Spiel-Beschreibungen inklusive
// Raetsel-Funktionen stehen in `js/games/index.js`.

import { log } from '../debuglog.js';

/**
 * Stammdaten je Spiel. `id` ist der SCHLUESSEL der spieleigenen Cloud-Daten
 * und der Bestenliste — er darf sich nie mehr aendern. `nameKey` ist der
 * i18n-Schluessel des Anzeigenamens, `icon` ein Name aus js/icons.js, `logo`
 * das App-Logo des Spiels (Spielauswahl auf dem Startbildschirm, Splash).
 */
export const GAME_META = {
  numbersums: { id: 'numbersums', nameKey: 'games.numbersums', icon: 'grid', logo: './icons/games/numbersums-192.png' },
  mathcross: { id: 'mathcross', nameKey: 'games.mathcross', icon: 'plus', logo: './icons/games/mathcross-192.png' },
  rectangles: { id: 'rectangles', nameKey: 'games.rectangles', icon: 'box', logo: './icons/games/rectangles-192.png' },
};

/** Alle Spiel-Kennungen in Anzeige-Reihenfolge. */
export const GAME_IDS = Object.keys(GAME_META);

/** Welches Spiel laeuft, solange nichts anderes gewaehlt wurde. */
export const DEFAULT_GAME_ID = 'numbersums';

export function isGameId(id) { return !!id && Object.prototype.hasOwnProperty.call(GAME_META, id); }

let active = DEFAULT_GAME_ID;

/** Kennung des laufenden Spiels. */
export function activeGameId() { return active; }

/**
 * Spiel wechseln. Gibt die tatsaechlich gesetzte Kennung zurueck — eine
 * unbekannte Kennung wird IGNORIERT (ein alter oder manipulierter Wert darf die
 * App nie in einen Zustand ohne Spiel bringen).
 */
export function setActiveGameId(id) {
  if (!isGameId(id)) {
    // Diagnose: an diesem Pfad haengen die spieleigenen Cloud-Knoten. Wird eine
    // unbekannte Kennung abgewiesen, muss das im Protokoll stehen — sonst sucht
    // man die Ursache spaeter in den Daten statt in der Auswahl.
    if (id !== undefined && id !== null && id !== active) log('app', 'Unbekannte Spiel-Kennung abgewiesen', { id: String(id), aktiv: active });
    return active;
  }
  if (id !== active) {
    log('app', 'Spiel gewechselt', { von: active, nach: id });
    active = id;
  }
  return active;
}

/** Stammdaten eines Spiels; unbekannte Kennung faellt auf das Standardspiel zurueck. */
export function gameMeta(id = active) { return GAME_META[id] || GAME_META[DEFAULT_GAME_ID]; }
