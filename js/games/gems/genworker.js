// games/gems/genworker.js — Hintergrund-Thread für die Rätselgenerierung (s.
// numberpath/genworker.js; dasselbe Protokoll { reqId, opts } → { reqId, puzzle }).

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
