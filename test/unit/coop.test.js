// Tests für die reine Beitritts-Anker-Logik des Coop-Transports:
// computeJoinAnchor() entscheidet, ab welchem Event-Key ein FRISCH Beitretender
// die Raum-Historie abspielt. Kernregeln:
// • offene Runde (letztes INIT ohne finales STATUS danach) → Replay AB diesem
//   INIT (afterKey = Key VOR dem INIT), damit der Beitretende den Rundenstand
//   deterministisch rekonstruiert;
// • keine offene Runde (Lobby, beendete Runde, Race/Team ohne INIT) → gesamte
//   Historie überspringen (afterKey = letzter Key) — sonst spielte ein altes
//   STATUS („won") die Sieganimation einer längst beendeten Runde ab und ein
//   altes INIT reaktivierte die Bereit-Lobby.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeJoinAnchor, sanitizeForFirebase } from '../../js/coop.js';

const ev = (key, type, extra = {}) => ({ key, val: { type, ...extra } });

test('leere Historie → kein Anker (nichts zu überspringen)', () => {
  assert.equal(computeJoinAnchor([]).afterKey, null);
});

test('laufende Runde: Replay setzt VOR dem letzten INIT auf', () => {
  const events = [
    ev('k1', 'identity'),
    ev('k2', 'init'),
    ev('k3', 'start'),
    ev('k4', 'move'),
  ];
  // afterKey = Key vor dem INIT → startAfter('k1') liefert INIT, START, MOVE.
  assert.equal(computeJoinAnchor(events).afterKey, 'k1');
});

test('INIT als allererstes Event: kompletter Replay (afterKey null)', () => {
  const events = [ev('k1', 'init'), ev('k2', 'start'), ev('k3', 'move')];
  assert.equal(computeJoinAnchor(events).afterKey, null);
});

test('beendete Runde (STATUS won nach INIT): gesamte Historie überspringen', () => {
  const events = [
    ev('k1', 'init'),
    ev('k2', 'start'),
    ev('k3', 'move'),
    ev('k4', 'status', { status: 'won' }),
  ];
  // Kein Replay der alten Runde — Sieganimation darf NICHT erneut abspielen.
  assert.equal(computeJoinAnchor(events).afterKey, 'k4');
});

test('beendete Runde (STATUS lost): ebenfalls überspringen', () => {
  const events = [ev('k1', 'init'), ev('k2', 'status', { status: 'lost' }), ev('k3', 'chat')];
  assert.equal(computeJoinAnchor(events).afterKey, 'k3');
});

test('zweite Runde läuft: alte Runde inkl. STATUS won wird übersprungen, neue ab INIT2 replayed', () => {
  const events = [
    ev('k1', 'init'),
    ev('k2', 'start'),
    ev('k3', 'move'),
    ev('k4', 'status', { status: 'won' }),   // Runde 1 gewonnen
    ev('k5', 'init'),                        // Runde 2 beginnt
    ev('k6', 'start'),
    ev('k7', 'move'),
  ];
  // startAfter('k4') → INIT2, START, MOVE — Runde 1 (samt Sieg) bleibt außen vor.
  assert.equal(computeJoinAnchor(events).afterKey, 'k4');
});

test('Race-/Team-Historie ohne INIT: alles überspringen (Start kommt live)', () => {
  const events = [ev('k1', 'identity'), ev('k2', 'raceStart'), ev('k3', 'chat')];
  assert.equal(computeJoinAnchor(events).afterKey, 'k3');
});

test('nicht-finales STATUS beendet die offene Runde nicht', () => {
  const events = [
    ev('k1', 'identity'),
    ev('k2', 'init'),
    ev('k3', 'status', { status: 'paused' }), // hypothetischer Nicht-End-Status
    ev('k4', 'move'),
  ];
  assert.equal(computeJoinAnchor(events).afterKey, 'k1');
});

test('defekte Einträge (val fehlt) werden übersprungen, Keys zählen trotzdem als Anker', () => {
  const events = [
    { key: 'k1', val: null },
    ev('k2', 'init'),
    ev('k3', 'move'),
  ];
  assert.equal(computeJoinAnchor(events).afterKey, 'k1');
});

// Regression (Diagnoseprotokoll v1.145): Ein Solo-Spiel hält hintsLeft = Infinity
// (HINTS in config.js). Landete das ungefiltert im Solo→Coop-INIT, verwarf
// Firebase RTDB den GESAMTEN Schreibvorgang (kein Infinity/NaN erlaubt) — das
// INIT kam nie beim Beitretenden an, nur das folgende START → „hängt in der
// Lobby". sanitizeForFirebase ersetzt nicht-endliche Zahlen durch null.
test('sanitizeForFirebase ersetzt Infinity/-Infinity/NaN durch null (verschachtelt)', () => {
  const init = {
    type: 'init', gameId: 'g1', running: true,
    lives: 3, maxLives: 3, hintsLeft: Infinity, hintsUsed: 2, mistakes: 1,
    startTime: 1700000000000,
    puzzle: { rows: 2, cols: 2, values: [[1, 2], [3, 4]] },
    marks: [['keep', 'none'], ['remove', 'none']],
  };
  const clean = sanitizeForFirebase(init);
  assert.equal(clean.hintsLeft, null);       // Infinity → null (RTDB verwirft den Key → Empfänger default HINTS)
  assert.equal(clean.lives, 3);              // endliche Zahlen bleiben
  assert.equal(clean.hintsUsed, 2);
  assert.equal(clean.running, true);         // Nicht-Zahlen unverändert
  assert.equal(clean.gameId, 'g1');
  assert.deepEqual(clean.puzzle.values, [[1, 2], [3, 4]]);
  assert.deepEqual(clean.marks, [['keep', 'none'], ['remove', 'none']]);
});

test('sanitizeForFirebase behandelt -Infinity und NaN', () => {
  assert.equal(sanitizeForFirebase(-Infinity), null);
  assert.equal(sanitizeForFirebase(NaN), null);
  assert.equal(sanitizeForFirebase(0), 0);
  assert.equal(sanitizeForFirebase(-5), -5);
  assert.deepEqual(sanitizeForFirebase([1, Infinity, 3]), [1, null, 3]);
});
