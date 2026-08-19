import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideSessionSync, sessionIsDead, shouldGrantReward, nextRev, isActiveStatus, SESSION_SCHEMA } from '../../js/session.js';

const D = 'devA';
const OTHER = 'devB';

test('leere Cloud: lokales Spiel wird hochgeladen', () => {
  assert.equal(decideSessionSync({ local: { gameId: 'g1', rev: 1, status: 'playing', updatedAt: 10 }, cloud: null, selfDevice: D }).action, 'uploadLocal');
});

test('leere Cloud + kein lokales Spiel: inSync', () => {
  assert.equal(decideSessionSync({ local: null, cloud: null, selfDevice: D }).action, 'inSync');
});

test('neueres Cloud-Schema erzwingt Reload (kein payload-Parse)', () => {
  const r = decideSessionSync({ local: { gameId: 'g1', rev: 1, status: 'playing', updatedAt: 10 }, cloud: { gameId: 'g1', rev: 5, status: 'playing', updatedAt: 20, schema: SESSION_SCHEMA + 1, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'reloadRequired');
});

test('kein lokales Spiel, Cloud aktiv auf anderem Gerät: Nur-Lese übernehmen', () => {
  const r = decideSessionSync({ local: null, cloud: { gameId: 'g1', rev: 3, status: 'playing', updatedAt: 20, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'takeCloudReadonly');
});

test('kein lokales Spiel, Cloud aktiv auf DIESEM Gerät: normal übernehmen', () => {
  const r = decideSessionSync({ local: null, cloud: { gameId: 'g1', rev: 3, status: 'paused', updatedAt: 20, deviceId: D }, selfDevice: D });
  assert.equal(r.action, 'takeCloud');
});

test('kein lokales Spiel, Cloud beendet: inSync (nichts offen)', () => {
  const r = decideSessionSync({ local: null, cloud: { gameId: 'g1', rev: 3, status: 'done', updatedAt: 20, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'inSync');
});

test('selbe Partie, Cloud beendet (rev höher): lokal defunct — DER Kernfall', () => {
  // Handy hält g1 offen (rev 4). PC hat g1 beendet (rev 7, done).
  const r = decideSessionSync({ local: { gameId: 'g1', rev: 4, status: 'playing', updatedAt: 10 }, cloud: { gameId: 'g1', rev: 7, status: 'done', updatedAt: 30, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'defunct');
});

test('selbe Partie, Cloud weiter (rev höher, aktiv, anderes Gerät): Nur-Lese-Übernahme', () => {
  const r = decideSessionSync({ local: { gameId: 'g1', rev: 4, status: 'playing', updatedAt: 10 }, cloud: { gameId: 'g1', rev: 6, status: 'playing', updatedAt: 30, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'takeCloudReadonly');
});

test('selbe Partie, lokal neuer (rev höher): hochladen', () => {
  const r = decideSessionSync({ local: { gameId: 'g1', rev: 9, status: 'playing', updatedAt: 40 }, cloud: { gameId: 'g1', rev: 6, status: 'playing', updatedAt: 30, deviceId: D }, selfDevice: D });
  assert.equal(r.action, 'uploadLocal');
});

test('selbe Partie, gleiche rev: inSync', () => {
  const r = decideSessionSync({ local: { gameId: 'g1', rev: 6, status: 'playing', updatedAt: 30 }, cloud: { gameId: 'g1', rev: 6, status: 'playing', updatedAt: 30, deviceId: D }, selfDevice: D });
  assert.equal(r.action, 'inSync');
});

test('andere gameId, Cloud jünger: lokal defunct + Backup', () => {
  const r = decideSessionSync({ local: { gameId: 'g1', rev: 3, status: 'playing', updatedAt: 10 }, cloud: { gameId: 'g2', rev: 2, status: 'playing', updatedAt: 50, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'defunct');
  assert.equal(r.backupLocal, true);
});

test('andere gameId, lokal jünger: hochladen + Backup', () => {
  const r = decideSessionSync({ local: { gameId: 'g2', rev: 3, status: 'playing', updatedAt: 60 }, cloud: { gameId: 'g1', rev: 5, status: 'playing', updatedAt: 20, deviceId: OTHER }, selfDevice: D });
  assert.equal(r.action, 'uploadLocal');
  assert.equal(r.backupLocal, true);
});

test('shouldGrantReward: neue gameId → true, bereits abgerechnet → false', () => {
  assert.equal(shouldGrantReward('g1', new Set()), true);
  assert.equal(shouldGrantReward('g1', new Set(['g1'])), false);
  assert.equal(shouldGrantReward('g1', ['g0', 'g1']), false);
  assert.equal(shouldGrantReward(null, new Set(['g1'])), true); // ohne Identität wie bisher
});

test('nextRev: strikt monoton über das Maximum von lokal/Cloud', () => {
  assert.equal(nextRev(3, 7), 8);
  assert.equal(nextRev(9, 2), 10);
  assert.equal(nextRev(0, 0), 1);
  assert.equal(nextRev(null, undefined), 1);
});

test('isActiveStatus', () => {
  assert.equal(isActiveStatus('playing'), true);
  assert.equal(isActiveStatus('paused'), true);
  assert.equal(isActiveStatus('done'), false);
  assert.equal(isActiveStatus('none'), false);
});

// Regression: eine Cloud-Session, die sich als aktiv ausgibt, deren payload aber
// nichts Spielbares mehr enthaelt, heilt NIE von selbst — sie wird von jedem
// Geraet erneut gezogen, lokal als geloest verworfen und bleibt in der Cloud auf
// „playing". Im Diagnoseprotokoll 14-mal in 90 Minuten („tote Spiele werden
// staendig wiederbelebt"). Deshalb muss sie als tot ERKENNBAR sein.
test('sessionIsDead erkennt nicht mehr fortsetzbare Cloud-Sessions', () => {
  const withBoard = { status: 'playing', payload: { puzzle: { rows: 4, cols: 4 } } };
  // Lebendig: aktives Brett, nicht geloest.
  assert.equal(sessionIsDead(withBoard, false), false);
  // Tot: dasselbe Brett, aber bereits vollstaendig geloest.
  assert.equal(sessionIsDead(withBoard, true), true);
  // Tot: aktiv gemeldet, aber gar kein Brett im payload.
  assert.equal(sessionIsDead({ status: 'playing', payload: null }), true);
  assert.equal(sessionIsDead({ status: 'paused', payload: {} }), true);
  // Pausiert MIT Brett bleibt fortsetzbar.
  assert.equal(sessionIsDead({ status: 'paused', payload: { puzzle: { rows: 4, cols: 4 } } }, false), false);
});

test('sessionIsDead fasst bereits beendete oder fehlende Sessions nicht an', () => {
  // Nichts zu beenden — sonst wuerde jeder Reconcile einen sinnlosen Schreibvorgang
  // ausloesen (und die rev bei jedem Sichtbarwerden hochzaehlen).
  for (const st of ['done', 'none']) {
    assert.equal(sessionIsDead({ status: st, payload: null }), false);
  }
  assert.equal(sessionIsDead(null), false);
  assert.equal(sessionIsDead(undefined, true), false);
});
