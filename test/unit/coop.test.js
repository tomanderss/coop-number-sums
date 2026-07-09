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
import { computeJoinAnchor } from '../../js/coop.js';

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
