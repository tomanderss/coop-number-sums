// endless.js — reine Logik für den „Endlos-Aufstieg"-Solo-Modus.
//
// Endlos-Aufstieg: immer schwerere Rätsel HINTEREINANDER auf einem GEMEINSAMEN
// Leben-Pool, bis man scheitert. Score = Anzahl geschaffter Level. Der Modus ist
// komplett lokal (kein Firebase); nur der Bestwert wird (in den Statistiken)
// gespeichert und mit-gesynct.
//
// Hier NUR die reine, DOM-/zustandsfreie Logik (unit-getestet). Das Wiring
// (Generierung, Brett laden, HUD, Belohnung) liegt in app.js.

// Grundparameter des Laufs. 3 Leben, KEIN Extra-Leben/Refill (lifeRefillEvery:0) —
// identisch zum Coop-Endlos: reine Ausdauer, jeder Fehler zählt. (Die Refill-
// Mechanik bleibt in endlessGrantsLife/endlessLivesAfter erhalten, ist per Default
// aber deaktiviert; ein explizites cfg mit lifeRefillEvery>0 aktiviert sie wieder.)
export const ENDLESS_CFG = { startLives: 3, maxLives: 3, startHints: 3, lifeRefillEvery: 0 };

// Schwierigkeits-INDEX (0-basiert) für ein 1-basiertes Level: klettert genau eine
// Stufe pro Level und WICKELT nach der höchsten Stufe wieder auf die leichteste um
// (nach 14×14 geht es bei 6×6 weiter) — so ist der Modus wirklich endlos.
export function endlessDiffIndex(level, ladderLen) {
  const i = Math.floor(level) - 1;
  if (i < 0 || !(ladderLen > 0)) return 0;
  return i % ladderLen;
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

// (endlessRunCoins ist ENTFERNT: Münzen fließen seit dem Einzelspiel-Umbau je
// Level direkt in endlessLevelSolved — mit vollen Multiplikatoren wie ein
// normaler Sieg — statt als Basiswert-Summe am Laufende.)

// Neuer Bestwert? (rein, für Anzeige „Neuer Rekord!")
export function endlessIsRecord(score, prevBest) {
  return score > 0 && score > (prevBest || 0);
}
