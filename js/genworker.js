// genworker.js — Hintergrund-Thread für die Rätsel-Vorgenerierung (Prefetch).
//
// Läuft als ES-Module-Web-Worker (siehe initGenWorker() in app.js). Generiert auf
// Anfrage ein Rätsel mit dem normalen, synchronen Generator — aber eben auf einem
// eigenen Thread, sodass die (bei großen Feldern wie 13×13 spürbare) Generierung
// den Haupt-Thread/die UI nie blockiert. Importiert nur reine Logikmodule
// (generator → solver/config); kein DOM/Firebase nötig.
//
// Protokoll: Haupt-Thread schickt { diffId, opts }, Worker antwortet mit
// { diffId, puzzle } bzw. { diffId, error } bei einem Fehler.

import { generatePuzzle } from './generator.js';

self.onmessage = (e) => {
  const { diffId, opts } = e.data || {};
  try {
    const puzzle = generatePuzzle(opts || { difficulty: diffId });
    self.postMessage({ diffId, puzzle });
  } catch (err) {
    self.postMessage({ diffId, error: String(err && err.message || err) });
  }
};
