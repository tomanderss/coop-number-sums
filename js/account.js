// account.js — optionale E-Mail+Username+Passwort-Accounts mit Cloud-Sync (RTDB).
//
// Lazy wie coop.js: Firebase wird nur bei tatsächlicher Account-Nutzung geladen.
// "Anonymous-first": OHNE Login bleibt die App rein lokal/anonym — diese Datei
// wird dann nie importiert/aktiv. Bei Login werden die lokalen cns_*-Daten nach
// /users/{uid} gespiegelt und umgekehrt (Erstbesitz/Union beim Inventar).
//
// WICHTIG (bewusste Vereinfachung, siehe Plan/Decision-Log):
//  • Nach Sign-in/Sign-up/Sign-out wird die Seite neu geladen (location.reload),
//    damit der EINE Firebase-/Auth-Singleton (den auch coop.js nutzt) garantiert
//    mit der korrekten uid neu initialisiert — sonst könnte coop mit einer
//    veralteten uid schreiben und an den RTDB-Rules (author===auth.uid) scheitern.
//  • Sync-Semantik: erste Anmeldung lädt lokal -> Cloud hoch; danach ist die Cloud
//    bei Settings/Stats führend, Inventar wird vereinigt (kein Unlock geht verloren),
//    Wallet nimmt das höhere Guthaben. Reicht für ein Hobby-Spiel; später verfeinerbar.

import { ensureFirebase } from './firebase.js';
import { log } from './debuglog.js';
import {
  collectExportData, importFromFile, mergeInventory, loadInventory,
  loadWallet, loadProfile, saveProfile,
} from './storage.js';

// ─── Reine Validierung (unit-testbar, ohne Firebase) ──────────────────────────
export function normalizeUsername(name) { return String(name || '').trim().toLowerCase(); }
// 3–20 Zeichen, a–z, 0–9, Unterstrich, Punkt. Bewusst eng, damit der Username als
// stabiler /usernames-Index-Key (RTDB erlaubt . nicht als Key!) taugt → siehe
// usernameKey(): der Punkt wird für den Key zu '_' normalisiert.
export function isValidUsername(name) { return /^[a-z0-9_.]{3,20}$/.test(normalizeUsername(name)); }
export function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()); }
// Firebase verlangt ≥6 Zeichen; gib einen i18n-Schlüssel-Suffix zurück oder null.
export function passwordIssue(pw) { if (!pw || String(pw).length < 6) return 'tooShort'; return null; }
// RTDB-Keys dürfen . $ # [ ] / nicht enthalten — Username für den Index sicher machen.
export function usernameKey(name) { return normalizeUsername(name).replace(/[.$#\[\]/]/g, '_'); }

// ─── Hilfen ───────────────────────────────────────────────────────────────────
function currentUser(fb) { return fb.auth && fb.auth.currentUser; }
function userRef(fb, uid, sub) { return fb.ref(fb.db, `users/${uid}${sub ? '/' + sub : ''}`); }
function usernameIndexRef(fb, name) { return fb.ref(fb.db, `usernames/${usernameKey(name)}`); }

// Aktueller Auth-Status für die UI (ohne Firebase zu laden, wenn nie verbunden).
export async function authState() {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (u && !u.isAnonymous) {
      const prof = (await fb.get(userRef(fb, u.uid, 'profile'))).val() || {};
      return { signedIn: true, uid: u.uid, email: u.email, username: prof.username || u.displayName || '', role: prof.role || 'user' };
    }
    return { signedIn: false, uid: u ? u.uid : null, anonymous: true };
  } catch (e) {
    log('account', 'authState fehlgeschlagen', e);
    return { signedIn: false, error: errKey(e) };
  }
}

// Firebase-Fehlercodes auf knappe i18n-Suffixe abbilden (UI zeigt t('account.err.'+suffix)).
export function errKey(e) {
  const c = (e && e.code) || '';
  if (c.includes('email-already-in-use')) return 'emailInUse';
  if (c.includes('invalid-email')) return 'invalidEmail';
  if (c.includes('weak-password')) return 'weakPassword';
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'wrongPassword';
  if (c.includes('user-not-found')) return 'userNotFound';
  if (c.includes('too-many-requests')) return 'tooMany';
  if (c.includes('network')) return 'network';
  if (c.includes('operation-not-allowed')) return 'notEnabled'; // E-Mail/PW in der Console nicht aktiviert
  if (c.includes('requires-recent-login')) return 'reauth';
  return 'generic';
}

// ─── Registrierung ────────────────────────────────────────────────────────────
// Username muss eindeutig sein; ist der aktuelle Nutzer anonym, wird der Account
// per Linking auf DIESELBE uid gehoben (lokaler Fortschritt bleibt, coop-Identität
// stabil). Sonst frischer Account. Lädt anschließend die lokalen Daten hoch.
export async function signUp({ email, username, password }) {
  if (!isValidEmail(email)) return { ok: false, err: 'invalidEmail' };
  if (!isValidUsername(username)) return { ok: false, err: 'invalidUsername' };
  const pwIssue = passwordIssue(password);
  if (pwIssue) return { ok: false, err: pwIssue === 'tooShort' ? 'weakPassword' : pwIssue };
  try {
    const fb = await ensureFirebase();
    const a = fb.authMod;
    // Username-Eindeutigkeit prüfen
    const taken = (await fb.get(usernameIndexRef(fb, username))).val();
    if (taken) return { ok: false, err: 'usernameTaken' };
    const u = currentUser(fb);
    let cred;
    if (u && u.isAnonymous) {
      cred = await a.linkWithCredential(u, a.EmailAuthProvider.credential(email, password));
    } else {
      cred = await a.createUserWithEmailAndPassword(fb.auth, email, password);
    }
    const uid = cred.user.uid;
    try { await a.updateProfile(cred.user, { displayName: username }); } catch (_) {}
    await fb.set(usernameIndexRef(fb, username), uid);
    saveProfile({ displayName: username, accountId: uid, createdAt: Date.now() });
    await fb.set(userRef(fb, uid, 'profile'), {
      username, usernameKey: usernameKey(username), role: 'user', createdAt: fb.serverTimestamp(),
    });
    await uploadLocal(fb, uid);
    log('account', 'Registrierung erfolgreich', { uid });
    return { ok: true, reload: true };
  } catch (e) {
    log('account', 'Registrierung fehlgeschlagen', e);
    return { ok: false, err: errKey(e) };
  }
}

// ─── Anmeldung (bestehender Account, evtl. anderes Gerät) ──────────────────────
export async function signIn({ email, password }) {
  if (!isValidEmail(email)) return { ok: false, err: 'invalidEmail' };
  try {
    const fb = await ensureFirebase();
    const cred = await fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
    const uid = cred.user.uid;
    await syncDown(fb, uid);  // Cloud -> lokal (mit Inventar-Union)
    log('account', 'Anmeldung erfolgreich', { uid });
    return { ok: true, reload: true };
  } catch (e) {
    log('account', 'Anmeldung fehlgeschlagen', e);
    return { ok: false, err: errKey(e) };
  }
}

export async function signOutAccount() {
  try {
    const fb = await ensureFirebase();
    await fb.authMod.signOut(fb.auth);
    saveProfile({ accountId: null });
    return { ok: true, reload: true };
  } catch (e) { log('account', 'Abmelden fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

export async function resetPassword(email) {
  if (!isValidEmail(email)) return { ok: false, err: 'invalidEmail' };
  try {
    const fb = await ensureFirebase();
    await fb.authMod.sendPasswordResetEmail(fb.auth, email);
    return { ok: true };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}

// Account + Cloud-Daten löschen (DSGVO: Recht auf Vergessenwerden, clientseitig).
export async function deleteAccount() {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, err: 'notSignedIn' };
    const prof = (await fb.get(userRef(fb, u.uid, 'profile'))).val() || {};
    if (prof.username) { try { await fb.remove(usernameIndexRef(fb, prof.username)); } catch (_) {} }
    await fb.remove(userRef(fb, u.uid));
    await fb.authMod.deleteUser(u);  // kann requires-recent-login werfen
    saveProfile({ accountId: null });
    return { ok: true, reload: true };
  } catch (e) { log('account', 'Account-Löschung fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// ─── Cloud-Sync ───────────────────────────────────────────────────────────────
// Das Inventar liegt BEWUSST in einem eigenen Knoten /users/{uid}/inventory und
// wird nur VEREINIGT (nie durch einen Client-Upload überschrieben) — so gehen
// Admin-Geschenke nicht verloren, selbst wenn ein anderes Gerät kurz darauf
// seinen Stand hochlädt. Der restliche Snapshot (Settings/Stats/…) liegt unter
// /users/{uid}/data.
async function mergeCloudInventory(fb, uid) {
  try { const cloud = (await fb.get(userRef(fb, uid, 'inventory'))).val(); if (cloud) mergeInventory(cloud); } catch (_) {}
}
async function uploadLocal(fb, uid) {
  await mergeCloudInventory(fb, uid);                 // erst fremde/Geschenk-Items aufnehmen …
  await fb.set(userRef(fb, uid, 'data'), collectExportData('sync'));
  await fb.set(userRef(fb, uid, 'inventory'), loadInventory());  // … dann die Union schreiben
}
// Cloud -> lokal. Erste Anmeldung (keine Cloud-Daten): lokal hochladen. Sonst
// Cloud übernehmen, aber Inventar vereinigen + höheres Wallet behalten.
async function syncDown(fb, uid) {
  const snap = (await fb.get(userRef(fb, uid, 'data'))).val();
  const localInv = loadInventory();
  const localBal = loadWallet().balance;
  if (snap) {
    importFromFile(JSON.stringify(snap));      // Settings/Stats/History/etc. aus der Cloud
    mergeInventory(localInv);                  // lokale Unlocks NICHT verlieren
    const merged = loadWallet();
    if (localBal > merged.balance) {
      const { grantCurrency } = await import('./storage.js');
      grantCurrency(localBal - merged.balance, 'syncKeepHigher');
    }
  }
  await mergeCloudInventory(fb, uid);          // Geschenke/Cosmetics aus dem eigenen Knoten
  await uploadLocal(fb, uid);                  // konsolidierten Stand zurückschreiben
}

// Beim App-Start (eingeloggt) Geschenke/Cosmetics nachziehen. Liefert das
// (ggf. erweiterte) lokale Inventar oder null, wenn nicht eingeloggt.
export async function pullInventory() {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (u && !u.isAnonymous) { await mergeCloudInventory(fb, u.uid); return loadInventory(); }
  } catch (e) { log('account', 'pullInventory fehlgeschlagen', e); }
  return null;
}

// Best-effort Upload des aktuellen Stands (debounced vom Aufrufer). No-op ohne Login.
let _syncTimer = null;
export function scheduleSyncUp() {
  if (_syncTimer) return;
  _syncTimer = setTimeout(async () => {
    _syncTimer = null;
    try {
      const fb = await ensureFirebase();
      const u = currentUser(fb);
      if (u && !u.isAnonymous) { await uploadLocal(fb, u.uid); log('account', 'Cloud-Sync hochgeladen', { uid: u.uid }); }
    } catch (e) { log('account', 'Cloud-Sync fehlgeschlagen', e); }
  }, 4000);
}

// ─── Admin (nur wirksam, wenn die eigene Rolle 'admin' ist — RTDB-Rules erzwingen
// das serverseitig; die UI blendet die Funktionen nur entsprechend ein). ───────
export async function adminFindUser(username) {
  if (!isValidUsername(username)) return { ok: false, err: 'invalidUsername' };
  try {
    const fb = await ensureFirebase();
    const uid = (await fb.get(usernameIndexRef(fb, username))).val();
    if (!uid) return { ok: false, err: 'userNotFound' };
    const profile = (await fb.get(userRef(fb, uid, 'profile'))).val() || {};
    const inventory = (await fb.get(userRef(fb, uid, 'inventory'))).val() || {};
    const data = (await fb.get(userRef(fb, uid, 'data'))).val() || {};
    return { ok: true, uid, profile, inventory, wallet: data.wallet || { balance: 0 } };
  } catch (e) { log('account', 'adminFindUser fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}
export async function adminGrantItem(uid, itemId) {
  try {
    const fb = await ensureFirebase();
    await fb.set(fb.ref(fb.db, `users/${uid}/inventory/${itemId}`), { acquiredAt: fb.serverTimestamp(), source: 'gift' });
    log('account', 'Admin: Item vergeben', { uid, itemId });
    return { ok: true };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
export async function adminRevokeItem(uid, itemId) {
  try {
    const fb = await ensureFirebase();
    await fb.remove(fb.ref(fb.db, `users/${uid}/inventory/${itemId}`));
    return { ok: true };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
export async function adminSetRole(uid, role) {
  if (role !== 'user' && role !== 'admin') return { ok: false, err: 'generic' };
  try {
    const fb = await ensureFirebase();
    await fb.set(fb.ref(fb.db, `users/${uid}/profile/role`), role);
    log('account', 'Admin: Rolle gesetzt', { uid, role });
    return { ok: true };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
export async function adminGrantCurrency(uid, amount) {
  const n = Math.max(0, Math.floor(amount || 0));
  try {
    const fb = await ensureFirebase();
    const data = (await fb.get(userRef(fb, uid, 'data'))).val() || {};
    const wallet = data.wallet || { balance: 0 };
    wallet.balance = (wallet.balance || 0) + n; wallet.updatedAt = Date.now();
    await fb.set(userRef(fb, uid, 'data/wallet'), wallet);
    return { ok: true, balance: wallet.balance };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
