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
let unsubConn = null;
let selfInfo = null;        // {name, color, role} — für Presence-Wiederherstellung nach Reconnect
let everOnline = false;     // true sobald die Verbindung mind. einmal stand (unterdrückt Offline-Flash beim Erst-Connect)
let sawDisconnect = false;  // true sobald sie danach abriss (steuert Reconnect-Toast + Presence-Neuaufbau)
let lastEventKey = null;    // Push-Key des zuletzt gesehenen events-Kinds (auch eigene) — Wiederaufsetzpunkt für rejoin()

// Abweichung der lokalen Uhr zur Firebase-Server-Uhr (ms). Firebase pflegt diesen
// Wert unter `.info/serverTimeOffset` lokal (initial per NTP-artigem Abgleich beim
// Connect). Damit lässt sich eine geräteübergreifend konsistente Zeit berechnen
// (serverNow()) — nötig, weil sonst der Host seinen Date.now()-Startzeitpunkt an
// Gäste sendet und deren abweichende Uhr eine falsche/negative Spielzeit ergibt.
let serverTimeOffset = 0;
let offsetWatched = false;
function watchServerTimeOffset(f) {
  if (offsetWatched) return;
  offsetWatched = true;
  try {
    f.onValue(f.ref(f.db, '.info/serverTimeOffset'), (snap) => {
      const v = snap.val();
      if (typeof v === 'number' && isFinite(v)) serverTimeOffset = v;
    });
  } catch (e) { log('coop', 'serverTimeOffset-Watch fehlgeschlagen', e); }
}
// Serverkorrigierte „Jetzt"-Zeit (ms seit Epoch). Ohne geladenes Firebase
// (Solo) bleibt der Offset 0 → identisch zu Date.now().
export function serverNow() { return Date.now() + serverTimeOffset; }

// Wiederaufsetzpunkt für den kalten Rejoin (siehe attachListeners/rejoin):
// app.js persistiert diesen Key zusammen mit dem Coop-Spielstand.
export function getLastEventKey() { return lastEventKey; }

export function isAvailable() { return typeof window !== 'undefined' && typeof fetch !== 'undefined'; }

async function ensureDb() {
  if (!fb) {
    log('coop', 'Verbinde mit Firebase…');
    const { ensureFirebase } = await import('./firebase.js');
    fb = await ensureFirebase();
    log('coop', 'Firebase verbunden', { uid: fb.uid });
  }
  watchServerTimeOffset(fb);
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

function attachListeners(f, code, { onJoin, onLeave, onMessage }, afterEventKey) {
  // Defensive: falls eine vorherige Session (derselbe Tab, neue Lobby ohne
  // zwischenzeitlichen leave()-Aufruf) noch Listener auf dem alten Raum hängen
  // hat, müssen die ZUERST abgehängt werden -- sonst überschreiben wir nur die
  // Referenzvariablen, während die alten Listener weiterlaufen und Events aus
  // der alten Session (z.B. doppelte MISTAKE-Events) parallel zu den neuen
  // verarbeiten. Genau das war die Ursache für falsch gezählte Fehler nach
  // Lobby-Verlassen-und-wieder-Beitreten.
  unsubJoin && unsubJoin(); unsubLeave && unsubLeave(); unsubEvents && unsubEvents();

  const playersRef = f.ref(f.db, `rooms/${code}/players`);
  // Nach einem kalten Rejoin darf die Event-Historie NICHT von Anfang an
  // wiederholt werden: das replayte INIT würde den wiederhergestellten
  // Spielstand überschreiben und awaitingStart reaktivieren („hängende
  // Bereit-Lobby"), ein replaytes STATUS eine längst beendete Runde sofort
  // wieder beenden. Push-Keys sind chronologisch sortiert, daher genügt
  // orderByKey().startAfter(letzter verarbeiteter Key) — es kommen exakt die
  // während der Abwesenheit verpassten Events an.
  const eventsRef = f.ref(f.db, `rooms/${code}/events`);
  const eventsSrc = afterEventKey ? f.query(eventsRef, f.orderByKey(), f.startAfter(afterEventKey)) : eventsRef;

  unsubJoin = f.onChildAdded(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onJoin && onJoin(snap.key, snap.val());
  });
  unsubLeave = f.onChildRemoved(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onLeave && onLeave(snap.key);
  });
  unsubEvents = f.onChildAdded(eventsSrc, (snap) => {
    lastEventKey = snap.key; // JEDES Event zählt (auch eigene) — Anker für den nächsten rejoin()
    const msg = snap.val();
    if (!msg || msg.author === f.uid) return;
    onMessage && onMessage(msg);
  });
}

// watchConnection(): überwacht die EIGENE RTDB-Socket-Verbindung über das
// spezielle `.info/connected`-Feld. Dieses Feld pflegt das SDK rein lokal und
// feuert auch ohne Server-Roundtrip, sobald die Verbindung ab- oder wieder
// aufgebaut wird — genau der Fall eines stillen Idle-Disconnects, bei dem bisher
// NUR der Host das Verschwinden des Gasts sah (per onChildRemoved), der
// abgehängte Client selbst aber weiter "online" anzeigte (seine players-Liste
// blieb eingefroren). Jetzt merkt der Client den Abriss selbst. Bei Reconnect
// wird die eigene Anwesenheit + der onDisconnect-Trigger neu gesetzt, sodass der
// Platz automatisch zurückkommt. cb(online, isReconnect) meldet den Zustand an app.js.
function watchConnection(f, cb) {
  unsubConn && unsubConn();
  everOnline = false; sawDisconnect = false;
  const connRef = f.ref(f.db, '.info/connected');
  unsubConn = f.onValue(connRef, async (snap) => {
    const online = snap.val() === true;
    if (online) {
      const isReconnect = sawDisconnect;
      everOnline = true;
      let currentHostId = null;
      if (isReconnect && myPlayerRef && selfInfo) {
        try {
          // Während der Abwesenheit kann ein Mitspieler die Host-Rolle übernommen
          // haben (promoteToHost → meta.hostId) — meta ist die Quelle der Wahrheit.
          // Sonst kämen wir mit stale role:'host' zurück und es gäbe zwei Hosts.
          const hostSnap = await f.get(f.ref(f.db, `rooms/${roomCode}/meta/hostId`));
          currentHostId = hostSnap.exists() ? hostSnap.val() : null;
          if (currentHostId) selfInfo.role = currentHostId === f.uid ? 'host' : 'guest';
          await f.set(myPlayerRef, { ...selfInfo, joinedAt: f.serverTimestamp() });
          f.onDisconnect(myPlayerRef).remove();
          log('coop', 'Verbindung wieder online – Anwesenheit neu gesetzt', { role: selfInfo.role });
        } catch (e) { log('coop', 'Presence nach Reconnect fehlgeschlagen', e); }
      }
      cb && cb(true, isReconnect, currentHostId);
    } else {
      if (!everOnline) return; // initiales "noch nicht verbunden" ignorieren (kein Offline-Flash beim Join)
      sawDisconnect = true;
      log('coop', 'RTDB-Verbindung verloren (Idle/Netz)');
      cb && cb(false, false);
    }
  });
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
// Der players/$uid-Eintrag muss name+color+role+joinedAt enthalten — die
// RTDB-Security-Rules validieren genau diese vier Felder; ein Schreibzugriff
// mit weniger Feldern wird von Firebase mit PERMISSION_DENIED abgelehnt.
export async function hostGame({ code, name, color, onOpen, onError, onJoin, onLeave, onMessage, onConnection }) {
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
    selfInfo = { name, color, role: 'host' };
    attachListeners(f, code, { onJoin, onLeave, onMessage });
    watchConnection(f, onConnection);
    log('coop', `Raum ${code} gehostet`, { uid: f.uid });
    onOpen && onOpen(f.uid);
  } catch (e) {
    log('coop', `Hosten von Raum ${code} fehlgeschlagen`, e);
    onError && onError(e);
  }
}

// ─── GAST ─────────────────────────────────────────────────────────────────────
export async function joinGame({ code, name, color, onOpen, onError, onMessage, onClose, onConnection, maxPlayers = COOP_MAX_PLAYERS }) {
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
    selfInfo = { name, color, role: 'guest' };
    attachListeners(f, code, { onJoin: null, onLeave: (id) => onClose && onClose(id), onMessage });
    watchConnection(f, onConnection);
    log('coop', `Raum ${code} beigetreten`, { uid: f.uid });
    onOpen && onOpen(f.uid);
  } catch (e) {
    log('coop', `Beitreten zu Raum ${code} fehlgeschlagen`, e);
    onError && onError(e);
  }
}

// ─── Wiederverbindung nach Hintergrund/Reload ────────────────────────────────
// rejoin(): kalter Fall — der JS-Kontext (und damit alle Listener) ging
// verloren (z.B. App aus dem Speicher entfernt, voller Reload). Validiert
// anders als hostGame()/joinGame() NICHT Kapazität/Belegung erneut, sondern
// nur, ob der Raum überhaupt noch existiert — wer schon drin war, darf wieder
// hinein, auch wenn der Raum inzwischen "voll" wäre.
export async function rejoin({ code, name, color, role, afterEventKey, onOpen, onError, onJoin, onLeave, onMessage, onConnection }) {
  try {
    const f = await ensureDb();
    log('coop', `Verbinde erneut mit Raum ${code}…`);
    const metaSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/meta`)));
    if (!metaSnap.exists()) {
      log('coop', `Raum ${code} existiert nicht mehr`);
      onError && onError({ type: 'room-gone' });
      return;
    }
    // Prüfen, ob wir noch der aktuelle Host sind — falls inzwischen ein anderer
    // Spieler die Host-Rolle übernommen hat (meta.hostId wurde von promoteToHost()
    // aktualisiert), treten wir als Gast wieder bei.
    const meta = metaSnap.val() || {};
    const actualRole = meta.hostId === f.uid ? 'host' : 'guest';
    roomCode = code;
    myPlayerRef = f.ref(f.db, `rooms/${code}/players/${f.uid}`);
    await f.set(myPlayerRef, { name, color, role: actualRole, joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    selfInfo = { name, color, role: actualRole };
    // Anker vorbelegen: der nächste persistGame()-Save darf nicht mit null
    // starten und so einen späteren zweiten Rejoin wieder zum Voll-Replay machen.
    lastEventKey = afterEventKey || null;
    attachListeners(f, code, { onJoin, onLeave, onMessage }, afterEventKey);
    watchConnection(f, onConnection);
    log('coop', `Raum ${code} wieder verbunden als ${actualRole}`, { uid: f.uid, afterEventKey: afterEventKey || null });
    onOpen && onOpen(f.uid, actualRole);
  } catch (e) {
    log('coop', `Wiederverbindung zu Raum ${code} fehlgeschlagen`, e);
    onError && onError(e);
  }
}

export async function updateHostId(uid) {
  if (!fb || !roomCode) return;
  try {
    await fb.set(fb.ref(fb.db, `rooms/${roomCode}/meta/hostId`), uid);
  } catch (e) {
    log('coop', 'Host-ID in Meta aktualisieren fehlgeschlagen', e);
  }
}

// ensurePresence(): warmer Fall — der JS-Kontext (und damit alle Listener)
// lief weiter, nur die eigene players/$uid-Anwesenheit könnte serverseitig per
// onDisconnect() entfernt worden sein (kurzer Hintergrund-Zeitraum). Stellt
// nur den eigenen Eintrag wieder her, fasst Listener nicht erneut an.
export async function ensurePresence({ name, color, role }) {
  if (!fb || !roomCode || !myPlayerRef) return;
  try {
    selfInfo = { name, color, role }; // aktuell halten, damit watchConnection nach Reconnect korrekt neu setzt
    const snap = await fb.get(myPlayerRef);
    if (snap.exists()) return;
    await fb.set(myPlayerRef, { name, color, role, joinedAt: fb.serverTimestamp() });
    fb.onDisconnect(myPlayerRef).remove();
    log('coop', 'Anwesenheit nach Hintergrund wiederhergestellt');
  } catch (e) {
    log('coop', 'Anwesenheit wiederherstellen fehlgeschlagen', e);
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
  unsubRaceProgress && unsubRaceProgress(); unsubConn && unsubConn();
  unsubJoin = unsubLeave = unsubEvents = unsubTeamEvents = unsubTeamProgress = unsubRaceProgress = unsubConn = null;
  selfInfo = null; everOnline = false; sawDisconnect = false; lastEventKey = null;
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
  IDENTITY: 'identity', ROSTER: 'roster', MISTAKE: 'mistake', START: 'start', READY: 'ready', UNREADY: 'unready',
  TEAM_START: 'teamStart', TEAM_DONE: 'teamDone',
  RACE_START: 'raceStart', RACE_DONE: 'raceDone',
  CHAT: 'chat',
};
