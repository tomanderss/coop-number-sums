// coop.js — Echtzeit-Coop-Transport via Firebase Realtime Database (RTDB).
// Ein Raum lebt unter /rooms/{code} (meta, players, events). Jede gesendete
// Nachricht landet als Eintrag unter events/ und wird per onChildAdded an alle
// Lauscher (inkl. Absender) verteilt — eigene Events werden anhand von
// `author` (eigene uid) übersprungen, da lokal schon angewandt. Damit entfällt
// das frühere Host-Re-Broadcast: RTDB fächert selbst an alle aus.
//
// Anwesenheit läuft über onDisconnect() statt eines eigenen Heartbeats: RTDB
// entfernt den eigenen players/{uid}-Eintrag serverseitig, sobald die
// Verbindung abreißt (Tab-Schließen, Netzwerkausfall, eingeschlafenes Gerät).
// Ein Raum hat bis zu COOP_MAX_PLAYERS Spieler (config.js) — der onChildAdded/
// onChildRemoved-Listener auf players/ generalisiert dafür ohne Codeänderung,
// da er ohnehin pro Spieler einzeln feuert statt eine feste Paarstruktur
// anzunehmen.
//
// Firebase wird bewusst nie statisch importiert (siehe ensureDb()), damit
// Solo-Spieler die SDK-Dateien nie laden.
//
// Jeder relevante Schritt (Verbindungsaufbau, Schreibzugriffe, Fehler) wird
// über debuglog.js protokolliert — rein lokal, damit Verbindungsprobleme bei
// Bedarf anhand eines vom Nutzer exportierten Protokolls nachvollzogen werden
// können, ohne dass dafür eigene Server-Logs nötig wären.
import { log } from './debuglog.js';
import { COOP_MAX_PLAYERS } from './config.js';

let fb = null;       // { db, uid, ref, push, set, get, remove, onChildAdded, onChildRemoved, onDisconnect, serverTimestamp }
let roomCode = null;
let myPlayerRef = null;
let unsubJoin = null;
let unsubLeave = null;
let unsubEvents = null;
let unsubTeamEvents = null;
let unsubTeamProgress = null;
let unsubRaceProgress = null;

export function isAvailable() { return typeof window !== 'undefined' && typeof fetch !== 'undefined'; }

async function ensureDb() {
  if (!fb) {
    log('coop', 'Verbinde mit Firebase…');
    const { ensureFirebase } = await import('./firebase.js');
    fb = await ensureFirebase();
    log('coop', 'Firebase verbunden', { uid: fb.uid });
  }
  return fb;
}

// Erste DB-Abfragen (Code-Verfügbarkeit/-Existenz) sollen nicht unbegrenzt hängen
// bleiben, falls Firebase mal nicht erreichbar ist — nach TIMEOUT_MS lieber einen
// Fehler melden als die Wartespinner-UI endlos zu zeigen.
const TIMEOUT_MS = 15000;
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject({ type: 'timeout' }), TIMEOUT_MS)),
  ]);
}

function attachListeners(f, code, { onJoin, onLeave, onMessage }) {
  // Defensive: falls eine vorherige Session (derselbe Tab, neue Lobby ohne
  // zwischenzeitlichen leave()-Aufruf) noch Listener auf dem alten Raum hängen
  // hat, müssen die ZUERST abgehängt werden -- sonst überschreiben wir nur die
  // Referenzvariablen, während die alten Listener weiterlaufen und Events aus
  // der alten Session (z.B. doppelte MISTAKE-Events) parallel zu den neuen
  // verarbeiten. Genau das war die Ursache für falsch gezählte Fehler nach
  // Lobby-Verlassen-und-wieder-Beitreten.
  unsubJoin && unsubJoin(); unsubLeave && unsubLeave(); unsubEvents && unsubEvents();

  const playersRef = f.ref(f.db, `rooms/${code}/players`);
  const eventsRef = f.ref(f.db, `rooms/${code}/events`);

  unsubJoin = f.onChildAdded(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onJoin && onJoin(snap.key);
  });
  unsubLeave = f.onChildRemoved(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onLeave && onLeave(snap.key);
  });
  unsubEvents = f.onChildAdded(eventsRef, (snap) => {
    const msg = snap.val();
    if (!msg || msg.author === f.uid) return;
    onMessage && onMessage(msg);
  });
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
// Der players/$uid-Eintrag muss name+color+role+joinedAt enthalten — die
// RTDB-Security-Rules validieren genau diese vier Felder; ein Schreibzugriff
// mit weniger Feldern wird von Firebase mit PERMISSION_DENIED abgelehnt.
export async function hostGame({ code, name, color, onOpen, onError, onJoin, onLeave, onMessage }) {
  try {
    const f = await ensureDb();
    log('coop', `Hoste Raum ${code} – prüfe Verfügbarkeit…`);
    const playersSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/players`)));
    if (playersSnap.exists() && playersSnap.size > 0) {
      log('coop', `Code ${code} bereits belegt`);
      onError && onError({ type: 'code-taken' });
      return;
    }
    roomCode = code;
    // Stale Events einer früheren Session unter demselben Code dürfen nicht in
    // die neue Session hineinspielen.
    await f.remove(f.ref(f.db, `rooms/${code}/events`));
    await f.set(f.ref(f.db, `rooms/${code}/meta`), { hostId: f.uid, createdAt: f.serverTimestamp(), status: 'active' });
    myPlayerRef = f.ref(f.db, `rooms/${code}/players/${f.uid}`);
    await f.set(myPlayerRef, { name, color, role: 'host', joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    attachListeners(f, code, { onJoin, onLeave, onMessage });
    log('coop', `Raum ${code} gehostet`, { uid: f.uid });
    onOpen && onOpen(f.uid);
  } catch (e) {
    log('coop', `Hosten von Raum ${code} fehlgeschlagen`, e);
    onError && onError(e);
  }
}

// ─── GAST ─────────────────────────────────────────────────────────────────────
export async function joinGame({ code, name, color, onOpen, onError, onMessage, onClose, maxPlayers = COOP_MAX_PLAYERS }) {
  try {
    const f = await ensureDb();
    log('coop', `Trete Raum ${code} bei – prüfe Existenz…`);
    const playersSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/players`)));
    if (!playersSnap.exists() || playersSnap.size === 0) {
      log('coop', `Code ${code} nicht gefunden`);
      onError && onError({ type: 'code-not-found' });
      return;
    }
    if (playersSnap.size >= maxPlayers) {
      log('coop', `Raum ${code} bereits voll`);
      onError && onError({ type: 'room-full' });
      return;
    }
    roomCode = code;
    myPlayerRef = f.ref(f.db, `rooms/${code}/players/${f.uid}`);
    await f.set(myPlayerRef, { name, color, role: 'guest', joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    attachListeners(f, code, { onJoin: null, onLeave: (id) => onClose && onClose(id), onMessage });
    log('coop', `Raum ${code} beigetreten`, { uid: f.uid });
    onOpen && onOpen(f.uid);
  } catch (e) {
    log('coop', `Beitreten zu Raum ${code} fehlgeschlagen`, e);
    onError && onError(e);
  }
}

// ─── Nachrichten ────────────────────────────────────────────────────────────
export async function send(msg) {
  if (!fb || !roomCode) return;
  try {
    await fb.push(fb.ref(fb.db, `rooms/${roomCode}/events`), { ...msg, author: fb.uid, ts: fb.serverTimestamp() });
  } catch (e) {
    log('coop', `Senden von "${msg.type}" fehlgeschlagen`, e);
  }
}

// ─── Team-vs-Team: team-skopierte Kanäle innerhalb desselben Raums ────────────
// Statt zwei separater, gekoppelter Räume (eigenes RTDB-Schema, manueller Regel-
// Deploy) leben Zug-Events pro Team unter rooms/{code}/teamEvents/{team} — ein
// neuer Kind-Pfad unterhalb des bestehenden Raums, der bereits über die
// $code-Ebene der Security Rules schreibbar ist (kein .validate dort definiert,
// kein Rules-Update nötig). Jeder Client lauscht ausschließlich auf den Kanal
// des EIGENEN Teams, nie auf den des Gegner-Teams — so verlassen Zellpositionen
// nie den Client der jeweils anderen Seite. Aggregierter Fortschritt (Prozent/
// Fehlerzahl, kein Zell-Inhalt) läuft separat über teamProgress/{team}, das
// gegenseitig sichtbar sein darf.
export async function sendTeamEvent(team, msg) {
  if (!fb || !roomCode) return;
  try {
    await fb.push(fb.ref(fb.db, `rooms/${roomCode}/teamEvents/${team}`), { ...msg, author: fb.uid, ts: fb.serverTimestamp() });
  } catch (e) {
    log('coop', `Senden von Team-Event "${msg.type}" fehlgeschlagen`, e);
  }
}

export function listenTeamEvents(team, onMessage) {
  if (!fb || !roomCode) return;
  unsubTeamEvents && unsubTeamEvents();
  const ref = fb.ref(fb.db, `rooms/${roomCode}/teamEvents/${team}`);
  unsubTeamEvents = fb.onChildAdded(ref, (snap) => {
    const msg = snap.val();
    if (!msg || msg.author === fb.uid) return;
    onMessage && onMessage(msg);
  });
}

export async function setTeamProgress(team, payload) {
  if (!fb || !roomCode) return;
  try {
    await fb.set(fb.ref(fb.db, `rooms/${roomCode}/teamProgress/${team}`), payload);
  } catch (e) {
    log('coop', 'Team-Fortschritt schreiben fehlgeschlagen', e);
  }
}

export function listenTeamProgress(onUpdate) {
  if (!fb || !roomCode) return;
  unsubTeamProgress && unsubTeamProgress();
  const ref = fb.ref(fb.db, `rooms/${roomCode}/teamProgress`);
  unsubTeamProgress = fb.onValue(ref, (snap) => onUpdate && onUpdate(snap.val() || {}));
}

// ─── Race-/Duell-Modus: aggregierter Fortschritt pro Spieler ─────────────────
// Wie teamProgress, nur pro uid statt pro Team — race ist strikt 1v1 und
// sendet NIE Zug-Events über Coop.send()/coopSend() (state.coop.active bleibt
// während des Rennens absichtlich false), nur diesen aggregierten Fortschritt.
export async function setRaceProgress(uid, payload) {
  if (!fb || !roomCode) return;
  try {
    await fb.set(fb.ref(fb.db, `rooms/${roomCode}/raceProgress/${uid}`), payload);
  } catch (e) {
    log('coop', 'Renn-Fortschritt schreiben fehlgeschlagen', e);
  }
}

export function listenRaceProgress(onUpdate) {
  if (!fb || !roomCode) return;
  unsubRaceProgress && unsubRaceProgress();
  const ref = fb.ref(fb.db, `rooms/${roomCode}/raceProgress`);
  unsubRaceProgress = fb.onValue(ref, (snap) => onUpdate && onUpdate(snap.val() || {}));
}

export async function leave() {
  const f = fb, code = roomCode, playerRef = myPlayerRef;
  unsubJoin && unsubJoin(); unsubLeave && unsubLeave(); unsubEvents && unsubEvents();
  unsubTeamEvents && unsubTeamEvents(); unsubTeamProgress && unsubTeamProgress();
  unsubRaceProgress && unsubRaceProgress();
  unsubJoin = unsubLeave = unsubEvents = unsubTeamEvents = unsubTeamProgress = unsubRaceProgress = null;
  roomCode = null; myPlayerRef = null;
  if (!f || !playerRef) return;
  try {
    await f.onDisconnect(playerRef).cancel();
    await f.remove(playerRef);
    const playersSnap = await f.get(f.ref(f.db, `rooms/${code}/players`));
    if (!playersSnap.exists() || playersSnap.size === 0) {
      await f.remove(f.ref(f.db, `rooms/${code}`));
    }
  } catch (e) {
    log('coop', `Verlassen von Raum ${code} fehlgeschlagen`, e);
  }
}

export const MSG = {
  INIT: 'init', MOVE: 'move', UNDO: 'undo', CHECK: 'check', STATUS: 'status', PAUSE: 'pause', HINT: 'hint',
  IDENTITY: 'identity', ROSTER: 'roster', MISTAKE: 'mistake', START: 'start',
  TEAM_START: 'teamStart', TEAM_DONE: 'teamDone',
  RACE_START: 'raceStart', RACE_DONE: 'raceDone',
};
