// genworker.js — Hintergrund-Thread für die Rätsel-Vorgenerierung (Prefetch).
//
// Läuft als ES-Module-Web-Worker (siehe initGenWorker() in app.js). Generiert auf
// Anfrage ein Rätsel mit dem normalen, synchronen Generator — aber eben auf einem
// eigenen Thread, sodass die (bei großen Feldern wie 13×13 spürbare) Generierung
// den Haupt-Thread/die UI nie blockiert. Importiert nur reine Logikmodule
// (generator → solver/config); kein DOM/Firebase nötig.
//
// Protokoll: Haupt-Thread schickt { diffId, opts } (Prefetch) bzw. { reqId, opts }
// (gezielte Einzel-Generierung, siehe generateAsync() in app.js). Der Worker
// antwortet mit { diffId|reqId, puzzle } bzw. { diffId|reqId, error } und gibt das
// jeweils gesetzte Korrelations-Feld unverändert zurück (so lässt sich jede
// Antwort eindeutig ihrer Anfrage zuordnen, auch wenn mehrere parallel laufen).

import { generatePuzzle } from './generator.js';

self.onmessage = (e) => {
  const { diffId, reqId, opts } = e.data || {};
  try {
    const puzzle = generatePuzzle(opts || { difficulty: diffId });
    self.postMessage({ diffId, reqId, puzzle });
  } catch (err) {
    self.postMessage({ diffId, reqId, error: String(err && err.message || err) });
  }
};
