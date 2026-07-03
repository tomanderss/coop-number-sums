#!/usr/bin/env node
// admin-set-password.js — setzt das Firebase-Auth-Passwort eines Nutzers direkt
// (ohne Reset-Mail, ohne Cloud Function, ohne Blaze-Tarif). Läuft LOKAL auf dem
// Rechner des Projekt-Admins mit einem Dienstkonto-Schlüssel — die PWA selbst
// kann fremde Passwörter prinzipiell nicht ändern (Firebase-Sicherheitsgrenze:
// nur das serverseitige Admin SDK darf das).
//
// EINMALIGE EINRICHTUNG
//   1. Firebase Console → ⚙️ Projekteinstellungen → Dienstkonten →
//      „Neuen privaten Schlüssel generieren" → Datei als
//      serviceAccountKey.json  ins Repo-Wurzelverzeichnis legen
//      (ist gitignored — NIEMALS committen/teilen, der Schlüssel ist ein
//      Vollzugriff aufs Projekt).
//   2. npm install --no-save firebase-admin
//      (bewusst nicht in package.json — bläht sonst jedes CI-npm-ci auf)
//
// BENUTZUNG
//   node scripts/admin-set-password.js <email|username|uid> [neuesPasswort]
//     z.B.  node scripts/admin-set-password.js tom@example.com
//           node scripts/admin-set-password.js tomanders geheim99
//   Ohne zweites Argument wird das Standardpasswort "123456" gesetzt
//   (Firebase verlangt mindestens 6 Zeichen — "12345" wäre zu kurz).

const path = require('path');
const fs = require('fs');

const DEFAULT_PASSWORD = '123456';
const KEY_FILE = path.join(__dirname, '..', 'serviceAccountKey.json');
const DB_URL = 'https://coop-number-sums-default-rtdb.europe-west1.firebasedatabase.app';

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }

const who = process.argv[2];
const password = process.argv[3] || DEFAULT_PASSWORD;
if (!who) fail('Aufruf: node scripts/admin-set-password.js <email|username|uid> [neuesPasswort]');
if (password.length < 6) fail('Firebase verlangt mindestens 6 Zeichen als Passwort.');
if (!fs.existsSync(KEY_FILE)) fail('serviceAccountKey.json fehlt im Repo-Wurzelverzeichnis (Console → Projekteinstellungen → Dienstkonten → Schlüssel generieren).');

let admin;
try { admin = require('firebase-admin'); }
catch { fail('firebase-admin fehlt — einmalig installieren: npm install --no-save firebase-admin'); }

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_FILE)),
  databaseURL: DB_URL,
});

// <who> auflösen: E-Mail → direkt; uid → direkt; sonst Username über den
// /usernames-Index der RTDB (Punkt wird dort als '_' abgelegt, s. account.js).
async function resolveUser(w) {
  if (w.includes('@')) return admin.auth().getUserByEmail(w.trim().toLowerCase());
  try { return await admin.auth().getUser(w); } catch (_) { /* keine uid — als Username versuchen */ }
  const key = w.trim().toLowerCase().replace(/[.$#\[\]/]/g, '_');
  const snap = await admin.database().ref(`usernames/${key}`).get();
  if (!snap.exists()) throw new Error(`Kein Nutzer mit E-Mail/uid/Username "${w}" gefunden.`);
  return admin.auth().getUser(snap.val());
}

(async () => {
  const user = await resolveUser(who);
  await admin.auth().updateUser(user.uid, { password });
  const nameSnap = await admin.database().ref(`users/${user.uid}/profile/username`).get().catch(() => null);
  console.log(`✓ Passwort gesetzt für ${nameSnap && nameSnap.exists() ? nameSnap.val() : user.email || user.uid}`);
  console.log(`  E-Mail: ${user.email || '—'}  |  uid: ${user.uid}`);
  console.log(`  Neues Passwort: ${password}${process.argv[3] ? '' : ' (Standard)'}`);
  console.log('  Der Nutzer kann sich sofort damit anmelden und es in der App unter Konto ▸ Passwort ändern selbst neu setzen.');
  process.exit(0);
})().catch((e) => fail(e.message || String(e)));
