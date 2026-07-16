// endless.js — reine Logik für den „Endlos-Aufstieg"-Solo-Modus.
//
// Endlos-Aufstieg: immer schwerere Rätsel HINTEREINANDER auf einem GEMEINSAMEN
// Leben-Pool, bis man scheitert. Score = Anzahl geschaffter Level. Der Modus ist
// komplett lokal (kein Firebase); nur der Bestwert wird (in den Statistiken)
// gespeichert und mit-gesynct.
//
// Hier NUR die reine, DOM-/zustandsfreie Logik (unit-getestet). Das Wiring
// (Generierung, Brett laden, HUD, Belohnung) liegt in app.js.

// Grundparameter des Laufs. lifeRefillEvery: alle N geschafften Level gibt es ein
// Extra-Leben (bis maxLives) — hält lange Läufe fair, ohne die Spannung zu nehmen.
export const ENDLESS_CFG = { startLives: 3, maxLives: 5, startHints: 3, lifeRefillEvery: 3 };

// Schwierigkeits-INDEX (0-basiert) für ein 1-basiertes Level: klettert genau eine
// Stufe pro Level und bleibt oben auf der höchsten Stufe stehen.
export function endlessDiffIndex(level, ladderLen) {
  const i = Math.floor(level) - 1;
  if (i < 0) return 0;
  return Math.min(ladderLen - 1, i);
}

// Schwierigkeits-ID für ein Level aus der geordneten Leiter (ids[0] = leichteste).
export function endlessDiffId(level, ids) {
  if (!Array.isArray(ids) || !ids.length) return null;
  return ids[endlessDiffIndex(level, ids.length)];
}

// Gewährt das gerade GESCHAFFTE Level ein Extra-Leben? (alle lifeRefillEvery Level)
export function endlessGrantsLife(level, cfg = ENDLESS_CFG) {
  return cfg.lifeRefillEvery > 0 && level > 0 && level % cfg.lifeRefillEvery === 0;
}

// Leben-Pool NACH dem Schaffen von `level` (aktueller Rest + evtl. Refill, gedeckelt).
export function endlessLivesAfter(curLives, level, cfg = ENDLESS_CFG) {
  const next = curLives + (endlessGrantsLife(level, cfg) ? 1 : 0);
  return Math.max(0, Math.min(cfg.maxLives, next));
}

// Münzen für einen ganzen Lauf: Summe der Schwierigkeits-Basiswerte je geschafftem
// Level (coinBaseForIndex wird von außen — config.js — reingereicht, damit dieses
// Modul rein/testbar bleibt).
export function endlessRunCoins(score, ladderLen, coinBaseForIndex) {
  let sum = 0;
  for (let L = 1; L <= score; L++) sum += coinBaseForIndex(endlessDiffIndex(L, ladderLen)) || 0;
  return sum;
}

// Neuer Bestwert? (rein, für Anzeige „Neuer Rekord!")
export function endlessIsRecord(score, prevBest) {
  return score > 0 && score > (prevBest || 0);
}
