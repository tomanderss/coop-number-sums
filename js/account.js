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
  dataRev, setDataRev, syncedRev, setSyncedRev, hasLocalData, loadLastSync, saveLastSync,
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

// ─── Reine Sync-Entscheidung (git-artig, ohne Firebase — voll unit-testbar) ────
// localRev  : Zeitstempel der letzten LOKALEN Datenänderung
// cloudRev  : rev des Cloud-Snapshots (Änderungszeit auf irgendeinem Gerät)
// syncedRev : localRev beim letzten erfolgreichen Sync dieses Geräts (Basislinie); null = noch nie
// hasLocalData: ob lokal überhaupt nennenswerte Daten liegen
// Ergebnis: 'uploadLocal' | 'takeCloud' | 'inSync' (kein 'conflict' mehr).
// Regel: Cloud gewinnt bei jeder Divergenz; nur ein reiner lokaler Vorlauf
// (Cloud unverändert) wird hochgeladen, leere Cloud bekommt den Erst-Upload.
// Bei ECHTER Divergenz gewinnt IMMER die Cloud (Nutzerwunsch: nie einen
// Auswahldialog zeigen). Nur wenn die Cloud leer ist oder ausschließlich lokal
// etwas geändert wurde, werden lokale Daten hochgeladen — die Cloud wird also
// nie grundlos überschrieben, aber eine lokale Abweichung gegen einen geänderten
// Cloud-Stand wird zugunsten der Cloud verworfen (kein 'conflict' mehr).
export function decideSync({ cloudExists, localRev, cloudRev, syncedRev, hasLocalData }) {
  if (!cloudExists) return 'uploadLocal';            // Cloud leer → lokale Daten hoch (Erst-Upload)
  if (syncedRev == null) {                           // Erstkontakt dieses Geräts mit diesem Account
    if (localRev === cloudRev) return 'inSync';      // identische Revision → nichts zu tun
    return 'takeCloud';                              // sonst IMMER Cloud übernehmen
  }
  const localChanged = localRev !== syncedRev;
  const cloudChanged = cloudRev !== syncedRev;
  if (cloudChanged) return 'takeCloud';              // Cloud geändert (evtl. auch lokal) → Cloud gewinnt
  if (localChanged) return 'uploadLocal';            // nur lokal geändert → hochladen
  return 'inSync';
}

// ─── Freunde: reine Sortier-/Statuslogik (ohne Firebase — unit-testbar) ────────
// Präsenz eines Freundes → grober Aktivitätsrang für die Sortierung (im Spiel > online > offline).
export function friendActivityRank(presence) {
  if (!presence) return 0;
  if (presence.game) return 2;   // gerade in einer Partie
  if (presence.online) return 1; // online, aber nicht im Spiel
  return 0;                      // offline
}
// Freundesliste nach Aktivität (absteigend) und dann alphabetisch nach Username sortieren.
// friends: [{ uid, username }], presenceByUid: { uid: {online,game,...} }
export function sortFriends(friends, presenceByUid = {}) {
  return [...(friends || [])].sort((a, b) => {
    const ra = friendActivityRank(presenceByUid[a.uid]);
    const rb = friendActivityRank(presenceByUid[b.uid]);
    if (ra !== rb) return rb - ra;
    return String(a.username || '').localeCompare(String(b.username || ''));
  });
}

// Bestenliste nach Zeit AUFSTEIGEND (schnellste zuerst); ungültige/fehlende
// Zeiten ans Ende. Reine Funktion (unit-testbar, ohne Firebase).
export function sortLeaderboard(entries) {
  return [...(entries || [])].sort((a, b) => {
    const ta = Number(a && a.timeMs), tb = Number(b && b.timeMs);
    const va = Number.isFinite(ta) && ta > 0, vb = Number.isFinite(tb) && tb > 0;
    if (va && vb) return ta - tb || String(a.username || '').localeCompare(String(b.username || ''));
    if (va) return -1;
    if (vb) return 1;
    return 0;
  });
}

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
  const c = ((e && e.code) || '') + ' ' + ((e && e.message) || '');
  // RTDB lehnt Schreibvorgänge ohne passende/veröffentlichte Rules mit
  // PERMISSION_DENIED ab — das ist der häufigste „Sync klappt nicht"-Fall.
  if (/permission[_-]?denied|permission/i.test(c)) return 'permissionDenied';
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
      email,  // nur Owner/Admin lesbar (Rules) — erlaubt Admin, eine Passwort-Reset-Mail auszulösen
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
    // KEIN automatisches Überschreiben hier! Die Zusammenführung lokal↔Cloud
    // (inkl. Konflikt-Rückfrage) passiert beim nächsten Start über reconcile().
    // WICHTIG: accountId lokal festhalten, sonst zeigt die App nach dem Reload wieder
    // den Login (refreshAccountFromLocal liest loadProfile().accountId).
    saveProfile({ accountId: uid });
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
    setSyncedRev(null);  // Basislinie fällt weg → nächster Login ist wieder „Erstkontakt"
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

// Eigenen (eindeutigen) Username ändern: neuen /usernames-Index belegen, alten
// freigeben, /users/{uid}/profile/username(+Key) aktualisieren. Kollision wird
// abgefangen. Der freie Anzeigename (settings.coopName) bleibt davon unberührt.
export async function changeUsername(newName) {
  const norm = normalizeUsername(newName);
  if (!isValidUsername(norm)) return { ok: false, err: 'invalidUsername' };
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, err: 'notSignedIn' };
    const prof = (await fb.get(userRef(fb, u.uid, 'profile'))).val() || {};
    const oldName = prof.username || '';
    if (normalizeUsername(oldName) === norm) return { ok: true, unchanged: true, username: oldName };
    // Eindeutigkeit: neuer Key darf frei oder bereits mir gehören.
    const taken = (await fb.get(usernameIndexRef(fb, norm))).val();
    if (taken && taken !== u.uid) return { ok: false, err: 'usernameTaken' };
    await fb.set(usernameIndexRef(fb, norm), u.uid);          // neuen Index belegen
    if (oldName && usernameKey(oldName) !== usernameKey(norm)) {
      try { await fb.remove(usernameIndexRef(fb, oldName)); } catch (_) {}   // alten freigeben
    }
    await fb.set(userRef(fb, u.uid, 'profile/username'), norm);
    await fb.set(userRef(fb, u.uid, 'profile/usernameKey'), usernameKey(norm));
    try { await fb.authMod.updateProfile(u, { displayName: norm }); } catch (_) {}
    saveProfile({ displayName: norm });                        // lokal spiegeln (state.account.username)
    log('account', 'Username geändert', { uid: u.uid });
    return { ok: true, username: norm };
  } catch (e) { log('account', 'Username ändern fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Live-Verfügbarkeitsprüfung eines Usernames (für Eingabefeld während der Änderung).
// Liefert einen Status ohne etwas zu ändern:
//   'invalid'   – Formatregeln verletzt
//   'unchanged' – identisch zum aktuellen eigenen Namen
//   'available' – Key frei (oder gehört bereits mir)
//   'taken'     – Key gehört einem anderen Nutzer
//   'error'     – Netz-/Firebase-Fehler (Speichern nicht sperren, changeUsername prüft final)
export async function checkUsernameAvailable(newName, currentName = '') {
  const norm = normalizeUsername(newName);
  if (!isValidUsername(norm)) return { ok: false, state: 'invalid', name: norm };
  if (currentName && normalizeUsername(currentName) === norm) return { ok: true, state: 'unchanged', name: norm };
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, state: 'error', name: norm };
    if (!currentName) {
      const prof = (await fb.get(userRef(fb, u.uid, 'profile'))).val() || {};
      if (prof.username && normalizeUsername(prof.username) === norm) return { ok: true, state: 'unchanged', name: norm };
    }
    const taken = (await fb.get(usernameIndexRef(fb, norm))).val();
    if (taken && taken !== u.uid) return { ok: false, state: 'taken', name: norm };
    return { ok: true, state: 'available', name: norm };
  } catch (e) { log('account', 'Username-Verfügbarkeit prüfen fehlgeschlagen', e); return { ok: false, state: 'error', name: norm }; }
}

// ─── Freunde & Präsenz ─────────────────────────────────────────────────────────
// Datenmodell:
//   /users/{uid}/friends/{friendUid}         = { username, since }   (beidseitig)
//   /users/{uid}/friendRequests/{fromUid}    = { username, ts }      (eingehende Anfragen)
//   /status/{uid}                            = { online, lastActive, game:{mode,difficulty,size,startedAt,pct}|null }
// Die Rules (database.rules.json) erlauben gezielt: eine Anfrage IN den Posteingang eines
// anderen schreiben (auth.uid === $fromUid) und sich selbst in dessen friends-Liste eintragen
// (auth.uid === $friendUid) — so funktioniert der beidseitige Freundschafts-Handschlag ohne
// Cloud Functions. /status ist für alle Angemeldeten lesbar, nur der Eigentümer schreibt.

let presenceRef = null;  // eigener /status-Knoten (für Updates während des Spiels)

// Freundschaftsanfrage an einen Username schicken.
export async function sendFriendRequest(targetUsername) {
  const norm = normalizeUsername(targetUsername);
  if (!isValidUsername(norm)) return { ok: false, err: 'invalidUsername' };
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, err: 'notSignedIn' };
    const myProf = (await fb.get(userRef(fb, u.uid, 'profile'))).val() || {};
    if (normalizeUsername(myProf.username || '') === norm) return { ok: false, err: 'selfFriend' };
    const targetUid = (await fb.get(usernameIndexRef(fb, norm))).val();
    if (!targetUid) return { ok: false, err: 'userNotFound' };
    if ((await fb.get(userRef(fb, u.uid, `friends/${targetUid}`))).exists()) return { ok: false, err: 'alreadyFriends' };
    await fb.set(fb.ref(fb.db, `users/${targetUid}/friendRequests/${u.uid}`), { username: myProf.username || '', ts: fb.serverTimestamp() });
    log('account', 'Freundschaftsanfrage gesendet', { to: targetUid });
    return { ok: true, targetUid };
  } catch (e) { log('account', 'Freundschaftsanfrage fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Eingehende Anfrage annehmen: beide Seiten in die jeweilige friends-Liste eintragen.
export async function acceptFriendRequest(fromUid, fromUsername) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, err: 'notSignedIn' };
    const myProf = (await fb.get(userRef(fb, u.uid, 'profile'))).val() || {};
    const since = fb.serverTimestamp();
    await fb.set(userRef(fb, u.uid, `friends/${fromUid}`), { username: fromUsername || '', since });
    await fb.set(fb.ref(fb.db, `users/${fromUid}/friends/${u.uid}`), { username: myProf.username || '', since });
    await fb.remove(userRef(fb, u.uid, `friendRequests/${fromUid}`));
    log('account', 'Freundschaftsanfrage angenommen', { from: fromUid });
    return { ok: true };
  } catch (e) { log('account', 'Anfrage annehmen fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Anfrage ablehnen (nur aus dem eigenen Posteingang entfernen).
export async function declineFriendRequest(fromUid) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, err: 'notSignedIn' };
    await fb.remove(userRef(fb, u.uid, `friendRequests/${fromUid}`));
    return { ok: true };
  } catch (e) { log('account', 'Anfrage ablehnen fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Freund entfernen (beidseitig).
export async function removeFriend(friendUid) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, err: 'notSignedIn' };
    await fb.remove(userRef(fb, u.uid, `friends/${friendUid}`));
    await fb.remove(fb.ref(fb.db, `users/${friendUid}/friends/${u.uid}`));
    return { ok: true };
  } catch (e) { log('account', 'Freund entfernen fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Live-Listener auf eigene Freundesliste + eingehende Anfragen. cb bekommt {friends,requests}.
// Rückgabe: Abmeldefunktion. Fehler → cb wird nie gerufen (App bleibt nutzbar).
export async function watchFriends(cb) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return () => {};
    const toArr = (val) => Object.entries(val || {}).map(([uid, v]) => ({ uid, username: (v && v.username) || '', ...v }));
    const off1 = fb.onValue(userRef(fb, u.uid, 'friends'), (snap) => cb({ friends: toArr(snap.val()) }));
    const off2 = fb.onValue(userRef(fb, u.uid, 'friendRequests'), (snap) => cb({ requests: toArr(snap.val()) }));
    return () => { try { off1(); off2(); } catch (_) {} };
  } catch (e) { log('account', 'watchFriends fehlgeschlagen', e); return () => {}; }
}

// Präsenz-Listener auf die /status-Knoten mehrerer Freunde. cb(uid, status|null).
export async function watchPresence(uids, cb) {
  try {
    const fb = await ensureFirebase();
    const offs = (uids || []).map((uid) => fb.onValue(fb.ref(fb.db, `status/${uid}`), (snap) => cb(uid, snap.val())));
    return () => { offs.forEach((o) => { try { o(); } catch (_) {} }); };
  } catch (e) { log('account', 'watchPresence fehlgeschlagen', e); return () => {}; }
}

// Eigene Präsenz veröffentlichen. game=null ⇒ online im Menü; game={...} ⇒ in einer Partie.
// onDisconnect setzt den Knoten beim Verbindungsabbruch auf offline.
export async function publishPresence(game = null) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return;
    presenceRef = fb.ref(fb.db, `status/${u.uid}`);
    fb.onDisconnect(presenceRef).set({ online: false, lastActive: fb.serverTimestamp(), game: null });
    await fb.set(presenceRef, { online: true, lastActive: fb.serverTimestamp(), game: game || null });
  } catch (e) { log('account', 'publishPresence fehlgeschlagen', e); }
}

// Beim Verlassen (Logout/Home) offline melden.
export async function clearPresence() {
  try {
    if (!presenceRef) return;
    const fb = await ensureFirebase();
    await fb.set(presenceRef, { online: false, lastActive: fb.serverTimestamp(), game: null });
  } catch (_) {}
}

// ─── Bestenliste (clientseitig, erste Ausbaustufe — ohne Cloud Functions nicht
// voll cheat-sicher; Rules erlauben nur den eigenen Eintrag zu schreiben) ───────
// Eigene (perfekte) Bestzeit für eine Schwierigkeit veröffentlichen. Überschreibt
// den eigenen Eintrag nur, wenn die neue Zeit besser ist (oder noch keiner da war).
export async function publishBestTime(difficulty, timeMs, username) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous || !difficulty || !(timeMs > 0)) return;
    const ref = fb.ref(fb.db, `leaderboard/${difficulty}/${u.uid}`);
    const prev = (await fb.get(ref)).val();
    if (prev && typeof prev.timeMs === 'number' && prev.timeMs <= timeMs) return;
    await fb.set(ref, { username: username || '', timeMs, ts: fb.serverTimestamp() });
    log('account', 'Bestzeit veröffentlicht', { difficulty, timeMs });
  } catch (e) { log('account', 'publishBestTime fehlgeschlagen', e); }
}

// Bestenliste einer Schwierigkeit live beobachten. cb(sortedEntries). Rückgabe:
// Abmelde-Funktion.
export async function watchLeaderboard(difficulty, cb) {
  try {
    const fb = await ensureFirebase();
    const off = fb.onValue(fb.ref(fb.db, `leaderboard/${difficulty}`), (snap) => {
      const arr = Object.entries(snap.val() || {}).map(([uid, v]) => ({ uid, ...(v || {}) }));
      cb(sortLeaderboard(arr));
    });
    return () => { try { off(); } catch (_) {} };
  } catch (e) { log('account', 'watchLeaderboard fehlgeschlagen', e); return () => {}; }
}

// ─── Lobby-Einladungen an Freunde (Coop/Wettkampf) ─────────────────────────────
// Modell: /users/{targetUid}/lobbyInvites/{myUid} = { code, mode, username, ts }.
// Ablehnung meldet der Eingeladene an /users/{inviterUid}/lobbyInviteResponses/{myUid}.
// Einen Freund in die eigene Lobby einladen (Raumcode + Modus).
export async function sendLobbyInvite(targetUid, { code, mode, username } = {}) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous || !targetUid || !code) return { ok: false, err: 'notSignedIn' };
    await fb.set(fb.ref(fb.db, `users/${targetUid}/lobbyInvites/${u.uid}`), {
      code, mode: mode || 'coop', username: username || '', ts: fb.serverTimestamp(),
    });
    log('account', 'Lobby-Einladung gesendet', { targetUid, mode });
    return { ok: true };
  } catch (e) { log('account', 'sendLobbyInvite fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Eingehende Lobby-Einladungen live beobachten. cb(arr).
export async function watchLobbyInvites(cb) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return () => {};
    const off = fb.onValue(userRef(fb, u.uid, 'lobbyInvites'), (snap) => {
      cb(Object.entries(snap.val() || {}).map(([fromUid, v]) => ({ fromUid, ...(v || {}) })));
    });
    return () => { try { off(); } catch (_) {} };
  } catch (e) { log('account', 'watchLobbyInvites fehlgeschlagen', e); return () => {}; }
}

// Eigene (angenommene/abgelehnte) Einladung entfernen.
export async function removeLobbyInvite(fromUid) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous || !fromUid) return;
    await fb.set(userRef(fb, u.uid, `lobbyInvites/${fromUid}`), null);
  } catch (e) { log('account', 'removeLobbyInvite fehlgeschlagen', e); }
}

// Einladung ablehnen: dem Einladenden melden + eigene Einladung entfernen.
export async function declineLobbyInvite(fromUid, username) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous || !fromUid) return;
    await fb.set(fb.ref(fb.db, `users/${fromUid}/lobbyInviteResponses/${u.uid}`), {
      status: 'declined', username: username || '', ts: fb.serverTimestamp(),
    });
    await removeLobbyInvite(fromUid);
    log('account', 'Lobby-Einladung abgelehnt', { fromUid });
  } catch (e) { log('account', 'declineLobbyInvite fehlgeschlagen', e); }
}

// Antworten (Ablehnungen) auf eigene Einladungen beobachten. cb(arr).
export async function watchLobbyInviteResponses(cb) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return () => {};
    const off = fb.onValue(userRef(fb, u.uid, 'lobbyInviteResponses'), (snap) => {
      cb(Object.entries(snap.val() || {}).map(([targetUid, v]) => ({ targetUid, ...(v || {}) })));
    });
    return () => { try { off(); } catch (_) {} };
  } catch (e) { log('account', 'watchLobbyInviteResponses fehlgeschlagen', e); return () => {}; }
}

// Eine verarbeitete Antwort entfernen (nach Anzeige des Toasts).
export async function clearLobbyInviteResponse(targetUid) {
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous || !targetUid) return;
    await fb.set(userRef(fb, u.uid, `lobbyInviteResponses/${targetUid}`), null);
  } catch (e) { log('account', 'clearLobbyInviteResponse fehlgeschlagen', e); }
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
// Lokal → Cloud. Danach ist die Basislinie (syncedRev) = aktuelle lokale Revision,
// d.h. lokal == Cloud == syncedRev (kein Konflikt beim nächsten Start).
async function uploadLocal(fb, uid) {
  await mergeCloudInventory(fb, uid);                 // erst fremde/Geschenk-Items aufnehmen …
  await fb.set(userRef(fb, uid, 'data'), collectExportData('sync'));
  await fb.set(userRef(fb, uid, 'inventory'), loadInventory());  // … dann die Union schreiben
  setSyncedRev(dataRev());
}
// Cloud → lokal (nur bei 'takeCloud' oder Nutzerwahl „Cloud behalten"). Überschreibt
// die lokalen Nutzdaten bewusst mit dem Cloud-Snapshot; Inventar bleibt vereinigt.
async function applyCloud(fb, uid, snap) {
  if (snap) {
    const localInv = loadInventory();
    importFromFile(JSON.stringify(snap));
    mergeInventory(localInv);                 // eigene Unlocks nicht verlieren
  }
  await mergeCloudInventory(fb, uid);
  // WICHTIG: syncedRev muss GENAU dem entsprechen, was decideSync beim nächsten
  // Start als cloudRev berechnet (= snap.rev || 0). Früher wurde bei fehlendem
  // snap.rev auf dataRev() (durch den Import frisch hochgezählt, also != 0)
  // zurückgefallen → nächster reconcile sah cloudChanged (0 !== dataRev) → erneut
  // 'takeCloud' → safeReload → Endlos-Reload-Schleife (Splash→Menü). Jetzt bündig
  // mit dem, was der Vergleich sieht: fehlt der Cloud-rev, ist die Basislinie 0.
  const rev = (snap && snap.rev) || 0;
  setDataRev(rev); setSyncedRev(rev);         // lokal == Cloud (konsistent mit decideSync)
}

// Sync-Status (schnell, ohne Firebase zu laden) fürs UI/Trigger-Gating.
export function isSignedIn() { return !!loadProfile().accountId; }
export function lastSyncAt() { return loadLastSync(); }
function stampSynced() { const ts = Date.now(); saveLastSync(ts); return ts; }

// ── Abgleich beim Start: entscheidet git-artig lokal vs. Cloud. Bei echter
// Divergenz gewinnt IMMER die Cloud (decideSync liefert nie mehr 'conflict'),
// es gibt also keinen Auswahldialog mehr.
export async function reconcile() {
  if (!isSignedIn()) return { decision: 'skip' };
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { decision: 'skip' };
    const snap = (await fb.get(userRef(fb, u.uid, 'data'))).val();
    const decision = decideSync({
      cloudExists: !!snap,
      localRev: dataRev(),
      cloudRev: snap ? (snap.rev || 0) : 0,
      syncedRev: syncedRev(),
      hasLocalData: hasLocalData(),
    });
    if (decision === 'uploadLocal') { await uploadLocal(fb, u.uid); stampSynced(); }
    else if (decision === 'takeCloud') { await applyCloud(fb, u.uid, snap); stampSynced(); }
    else if (decision === 'inSync') { await mergeCloudInventory(fb, u.uid); }
    log('account', 'reconcile', { decision });
    return { decision };
  } catch (e) { log('account', 'reconcile fehlgeschlagen', e); return { decision: 'error', err: errKey(e) }; }
}

// SOFORTIGER Upload ALLER Daten in die Cloud. Liefert { ok, ts } bzw.
// { ok:false, skipped:true } wenn nicht eingeloggt (dann rein lokal, kein Fehler).
export async function syncNow() {
  if (!isSignedIn()) return { ok: false, skipped: true };
  try {
    const fb = await ensureFirebase();
    const u = currentUser(fb);
    if (!u || u.isAnonymous) return { ok: false, skipped: true };
    await uploadLocal(fb, u.uid);
    const ts = stampSynced();
    log('account', 'Cloud-Sync hochgeladen', { uid: u.uid });
    return { ok: true, ts };
  } catch (e) { log('account', 'Cloud-Sync fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
}

// Best-effort, entprellter Upload (mehrere schnelle Aufrufe → ein Upload). No-op ohne Login.
let _syncTimer = null;
export function scheduleSyncUp() {
  if (_syncTimer || !isSignedIn()) return;
  _syncTimer = setTimeout(() => { _syncTimer = null; syncNow(); }, 4000);
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
// ALLE User für den Admin-Browser laden. Primär via /users (ein Read — braucht
// eine Admin-.read-Regel auf /users). Fällt das mit PERMISSION_DENIED aus (Regel
// noch nicht veröffentlicht), Fallback über den /usernames-Index (für jeden
// auth-Nutzer lesbar) + Profil je uid — funktioniert mit den bestehenden Rules.
export async function adminListUsers() {
  try {
    const fb = await ensureFirebase();
    const shape = (uid, u) => ({
      uid,
      username: (u.profile && u.profile.username) || '',
      role: (u.profile && u.profile.role) || 'user',
      email: (u.profile && u.profile.email) || '',
      balance: (u.data && u.data.wallet && u.data.wallet.balance) || 0,
      hasSkin: !!(u.inventory && u.inventory.dynamicColor),
      profile: u.profile || {},
      inventory: u.inventory || {},
    });
    let list;
    try {
      const all = (await fb.get(fb.ref(fb.db, 'users'))).val() || {};
      list = Object.entries(all).map(([uid, u]) => shape(uid, u));
    } catch (e) {
      // Fallback: Index + Einzelabrufe.
      const idx = (await fb.get(fb.ref(fb.db, 'usernames'))).val() || {};
      const uids = [...new Set(Object.values(idx))];
      list = await Promise.all(uids.map(async (uid) => {
        const profile = (await fb.get(userRef(fb, uid, 'profile'))).val() || {};
        const data = (await fb.get(userRef(fb, uid, 'data'))).val() || {};
        const inventory = (await fb.get(userRef(fb, uid, 'inventory'))).val() || {};
        return shape(uid, { profile, data, inventory });
      }));
    }
    list.sort((a, b) => (a.username || a.uid).localeCompare(b.username || b.uid));
    log('account', 'Admin: User-Liste geladen', { count: list.length });
    return { ok: true, users: list };
  } catch (e) { log('account', 'adminListUsers fehlgeschlagen', e); return { ok: false, err: errKey(e) }; }
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
// Genauen Kontostand setzen (nicht addieren).
export async function adminSetCurrency(uid, amount) {
  const n = Math.max(0, Math.floor(amount || 0));
  try {
    const fb = await ensureFirebase();
    await fb.set(userRef(fb, uid, 'data/wallet'), { balance: n, updatedAt: Date.now() });
    log('account', 'Admin: Guthaben gesetzt', { uid, n });
    return { ok: true, balance: n };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
// Username eines fremden Nutzers ändern (inkl. /usernames-Index umhängen).
export async function adminSetUsername(uid, newName) {
  const norm = normalizeUsername(newName);
  if (!isValidUsername(norm)) return { ok: false, err: 'invalidUsername' };
  try {
    const fb = await ensureFirebase();
    const prof = (await fb.get(userRef(fb, uid, 'profile'))).val() || {};
    const oldName = prof.username || '';
    if (normalizeUsername(oldName) !== norm) {
      const taken = (await fb.get(usernameIndexRef(fb, norm))).val();
      if (taken && taken !== uid) return { ok: false, err: 'usernameTaken' };
      await fb.set(usernameIndexRef(fb, norm), uid);
      if (oldName && usernameKey(oldName) !== usernameKey(norm)) { try { await fb.remove(usernameIndexRef(fb, oldName)); } catch (_) {} }
    }
    await fb.set(userRef(fb, uid, 'profile/username'), norm);
    await fb.set(userRef(fb, uid, 'profile/usernameKey'), usernameKey(norm));
    log('account', 'Admin: Username gesetzt', { uid });
    return { ok: true, username: norm };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
// Beliebiges Profilfeld setzen ("jedes Informationsbit"). role/username/usernameKey
// laufen bewusst über die dedizierten Funktionen (Index/Validierung) und sind hier
// gesperrt. Zahlen werden als Zahl gespeichert, 'true'/'false' als Boolean.
export async function adminSetProfileField(uid, key, rawValue) {
  const k = String(key || '').trim();
  if (!k || /[.$#[\]/]/.test(k)) return { ok: false, err: 'generic' };
  if (['role', 'username', 'usernameKey'].includes(k)) return { ok: false, err: 'fieldProtected' };
  let value = rawValue;
  if (value === 'true') value = true; else if (value === 'false') value = false;
  else if (value !== '' && !isNaN(Number(value))) value = Number(value);
  try {
    const fb = await ensureFirebase();
    if (value === '' || value == null) await fb.remove(userRef(fb, uid, 'profile/' + k));
    else await fb.set(userRef(fb, uid, 'profile/' + k), value);
    log('account', 'Admin: Profilfeld gesetzt', { uid, key: k });
    return { ok: true };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
// Passwort-Reset-Mail an einen Nutzer schicken (Firebase-Mail; setzt kein Passwort
// direkt — das geht nur über die Mail bzw. eine Cloud Function).
export async function adminSendPasswordReset(email) {
  if (!isValidEmail(email)) return { ok: false, err: 'invalidEmail' };
  try {
    const fb = await ensureFirebase();
    await fb.authMod.sendPasswordResetEmail(fb.auth, email);
    log('account', 'Admin: Passwort-Reset-Mail gesendet');
    return { ok: true };
  } catch (e) { return { ok: false, err: errKey(e) }; }
}
