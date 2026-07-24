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

// ── Rückwirkende Zerlegung ALTER Endlos-Läufe (einmalige Migration) ───────────
// Vor dem Einzelspiel-Umbau wurden Endlos-Level NICHT als individuelle Siege
// verbucht — aber jeder Lauf hinterließ im (syncten) Geldverlauf einen Eintrag
// `{reason:'endless', meta:{score, mode:'endless'|'endlessCoop', aborted?}}`.
// Daraus lässt sich exakt rekonstruieren, WELCHE Level (= Schwierigkeiten der
// Leiter) gewonnen wurden: Lauf mit score N ⇒ Level 1..N geschafft; endete er
// NICHT per Abbruch, war Level N+1 zusätzlich eine Niederlage. Alte Läufe
// kletterten mit DECKEL-Semantik (oben stehen bleiben, kein Wrap) — deshalb hier
// bewusst min(len-1, L-1) statt endlessDiffIndex. NICHT rekonstruierbar (und
// bewusst nicht erfunden): per-Level-Zeiten, Fehler/Hinweise (⇒ perfekt),
// Bestzeiten, Multiplikator-Münzen (Basis-Münzen wurden damals bereits gezahlt).
export function reconstructEndlessRuns(walletLog, diffIds) {
  const out = { runCount: 0, wins: 0, coopWins: 0, losses: 0, coopLosses: 0, perDiff: {} };
  if (!Array.isArray(walletLog) || !Array.isArray(diffIds) || !diffIds.length) return out;
  const capId = (L) => diffIds[Math.min(diffIds.length - 1, Math.max(0, Math.floor(L) - 1))];
  const bucket = (id) => out.perDiff[id] || (out.perDiff[id] = { won: 0, coopWon: 0, lost: 0, coopLost: 0 });
  for (const en of walletLog) {
    if (!en || en.reason !== 'endless' || !en.meta) continue;
    const score = Math.floor(en.meta.score || 0);
    if (score <= 0) continue;
    out.runCount++;
    const coop = en.meta.mode === 'endlessCoop';
    for (let L = 1; L <= score; L++) {
      const d = bucket(capId(L));
      if (coop) { d.coopWon++; out.coopWins++; } else { d.won++; out.wins++; }
    }
    if (!en.meta.aborted) {   // Lauf endete durch Leben-Aus → Schluss-Level = Niederlage
      const d = bucket(capId(score + 1));
      if (coop) { d.coopLost++; out.coopLosses++; } else { d.lost++; out.losses++; }
    }
  }
  return out;
}
