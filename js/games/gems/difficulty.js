// games/gems/difficulty.js — die Schwierigkeitsstufen von „Gem Hunt".
//
// Die LEITER (neun Stufen) ist in allen Spielen dieselbe (js/config.js). Hier
// nur die Werte dieses Spiels:
//   size      Kantenlänge (5×5 … 11×11; so viele Käfige und Edelsteine)
//   maxTier   höchste Schlussstufe des Lösers (1 = einfache Schlüsse, 2 = Schubfach)
//   blocks    ob „würde alles blockieren" vorkommen darf (sieht man nicht auf
//             einen Blick) — die drei leichten Stufen kommen ohne aus
//   minBlocks so viele „blockiert"-Schlüsse verlangt die Stufe mindestens (sonst
//             wäre „Schwer" oft so leicht wie „Mittel")
//   minTier2  so viele Schubfach-Schlüsse verlangt die Stufe mindestens
//   entry     so viele Steine muss man GANZ AM ANFANG allein mit Blick-Schlüssen
//             finden (Nutzerwunsch: „man muss gut Fuß fassen können" — vorher
//             hatte „Schwer" nie einen solchen Einstieg)
// Gemessen (Worker): s. Median/Max in CLAUDE.md — jedes Rätsel eindeutig und
// ohne Raten lösbar.

import { mergeLadder } from '../../config.js';

const PARAMS = {
  sehrleicht: { dim: { r: 5, c: 5 },   size: 5,  maxTier: 1, blocks: false, minBlocks: 0, minTier2: 0, entry: 1 },
  leicht:     { dim: { r: 6, c: 6 },   size: 6,  maxTier: 1, blocks: false, minBlocks: 0, minTier2: 0, entry: 1 },
  mittel:     { dim: { r: 7, c: 7 },   size: 7,  maxTier: 1, blocks: false, minBlocks: 0, minTier2: 0, entry: 1 },
  schwer:     { dim: { r: 7, c: 7 },   size: 7,  maxTier: 1, blocks: true,  minBlocks: 1, minTier2: 0, entry: 2 },
  extrem:     { dim: { r: 8, c: 8 },   size: 8,  maxTier: 1, blocks: true,  minBlocks: 2, minTier2: 0, entry: 2 },
  mashallah:  { dim: { r: 9, c: 9 },   size: 9,  maxTier: 2, blocks: true,  minBlocks: 2, minTier2: 0, entry: 2 },
  dikkawas:   { dim: { r: 9, c: 9 },   size: 9,  maxTier: 2, blocks: true,  minBlocks: 2, minTier2: 1, entry: 1 },
  bismillah:  { dim: { r: 10, c: 10 }, size: 10, maxTier: 2, blocks: true,  minBlocks: 2, minTier2: 0, entry: 1 },
  rip:        { dim: { r: 11, c: 11 }, size: 11, maxTier: 2, blocks: true,  minBlocks: 2, minTier2: 0, entry: 1 },
};

export const DIFFICULTIES = mergeLadder(PARAMS);
export const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// „Große Zahlen" gibt es hier nicht.
export function bigNumbersAllowed() { return false; }

export function genOptionsFor(diffId) {
  const d = DIFF_BY_ID[diffId] || DIFFICULTIES[0];
  return { difficulty: d.id, size: d.size, maxTier: d.maxTier, blocks: d.blocks, minBlocks: d.minBlocks, minTier2: d.minTier2, entry: d.entry, tries: 30 };
}
