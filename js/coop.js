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
// Da ein Raum max. 2 Spieler hat, genügt ein einziger "Partner kam/ging"-
// Listener auf players/ — symmetrisch für Host wie Gast.
//
// Firebase wird bewusst nie statisch importiert (siehe ensureDb()), damit
// Solo-Spieler die SDK-Dateien nie laden.
//
// Jeder relevante Schritt (Verbindungsaufbau, Schreibzugriffe, Fehler) wird
// über debuglog.js protokolliert — rein lokal, damit Verbindungsprobleme bei
// Bedarf anhand eines vom Nutzer exportierten Protokolls nachvollzogen werden
// können, ohne dass dafür eigene Server-Logs nötig wären.
import { log } from './debuglog.js';

let fb = null;       // { db, uid, ref, push, set, get, remove, onChildAdded, onChildRemoved, onDisconnect, serverTimestamp }
let roomCode = null;
let myPlayerRef = null;
let unsubJoin = null;
let unsubLeave = null;
let unsubEvents = null;

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
export async function joinGame({ code, name, color, onOpen, onError, onMessage, onClose }) {
  try {
    const f = await ensureDb();
    log('coop', `Trete Raum ${code} bei – prüfe Existenz…`);
    const playersSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/players`)));
    if (!playersSnap.exists() || playersSnap.size === 0) {
      log('coop', `Code ${code} nicht gefunden`);
      onError && onError({ type: 'code-not-found' });
      return;
    }
    if (playersSnap.size >= 2) {
      log('coop', `Raum ${code} bereits voll`);
      onError && onError({ type: 'room-full' });
      return;
    }
    roomCode = code;
    myPlayerRef = f.ref(f.db, `rooms/${code}/players/${f.uid}`);
    await f.set(myPlayerRef, { name, color, role: 'guest', joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    attachListeners(f, code, { onJoin: null, onLeave: () => onClose && onClose(), onMessage });
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

export async function leave() {
  const f = fb, code = roomCode, playerRef = myPlayerRef;
  unsubJoin && unsubJoin(); unsubLeave && unsubLeave(); unsubEvents && unsubEvents();
  unsubJoin = unsubLeave = unsubEvents = null;
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
  RETRY: 'retry', CLOSE: 'close', IDENTITY: 'identity', ROSTER: 'roster', MISTAKE: 'mistake',
};
