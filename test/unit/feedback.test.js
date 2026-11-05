import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hapticPattern, haptic, initFeedback } from '../../js/games/feedback.js';

test('Vibrationsmuster: jede Art hat ein Muster, unbekannt = place', () => {
  for (const k of ['tap', 'place', 'lock', 'done', 'error', 'win']) assert.ok(hapticPattern(k), k);
  assert.equal(hapticPattern('quatsch'), hapticPattern('place'));
});

test('Vibration lässt sich abschalten und schweigt ohne navigator.vibrate', () => {
  const calls = [];
  const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
  setNav({ vibrate: (p) => calls.push(p) });
  initFeedback(() => ({ haptics: true }));
  assert.equal(haptic('error'), true);
  initFeedback(() => ({ haptics: false }));
  assert.equal(haptic('error'), false);
  assert.equal(calls.length, 1);
  setNav({});
  initFeedback(() => ({}));
  assert.equal(haptic('tap'), false);
});
