// games/snapshots.js — die Spielstand-Regeln ALLER Spiele, nach Kennung.
//
// storage.js entscheidet über gespeicherte Stände (gelöst? Fortschritt? nach
// dem Laden heilen?), ohne das jeweilige Spiel zu laden. Die Regeln sind je
// Spiel verschieden (Number Sums: Markierungen gegen die Lösung, Math Cross:
// gelegte Steine in offenen Feldern) und hängen deshalb an der Kennung. Bewusst
// getrennt von games/index.js: das zieht Solver, Generator und Vue-Komponenten
// nach, storage.js darf davon nichts laden.

import { DEFAULT_GAME_ID } from './registry.js';
import * as numbersums from './numbersums/snapshot.js';
import * as mathcross from './mathcross/snapshot.js';

const RULES = { numbersums, mathcross };

// Unbekannte Kennung → Standardspiel (wie setActiveGameId): nie ohne Regeln.
export function snapshotRules(id) { return RULES[id] || RULES[DEFAULT_GAME_ID]; }
export const SNAPSHOT_GAME_IDS = Object.keys(RULES);
