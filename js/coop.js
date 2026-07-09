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
    // Der EIGENE Eintrag wurde EXTERN entfernt (z.B. weil der leave() eines
    // anderen Geräts den Raum fälschlich für leer hielt und komplett löschte,
    // während wir still abgerissen waren) — wir sind aber nie gegangen:
    // Anwesenheit (+ ggf. meta) sofort wiederherstellen, sonst spielt man in
    // einem „Geisterraum" weiter, dem niemand mehr beitreten/fortsetzen kann.
    // Ein selbst ausgelöstes leave() hängt diesen Listener VOR dem Entfernen
    // ab, landet also nie hier.
    if (snap.key === f.uid) { healSelfPresence(f); return; }
    onLeave && onLeave(snap.key);
  });
  unsubEvents = f.onChildAdded(eventsSrc, (snap) => {
    lastEventKey = snap.key; // JEDES Event zählt (auch eigene) — Anker für den nächsten rejoin()
    const msg = snap.val();
    if (!msg || msg.author === f.uid) return;
    onMessage && onMessage(msg);
  });
}

// healSelfPresence(): stellt den eigenen players-Eintrag wieder her, nachdem er
// EXTERN entfernt wurde (Raum-Löschung durch ein anderes Gerät im „Raum ist
// leer"-Irrtum, siehe attachListeners/onChildRemoved). War man selbst Host,
// wird auch das mitgelöschte meta wiederhergestellt — sonst schlägt jeder
// spätere rejoin() („Coop fortsetzen" des Partners) mit room-gone fehl.
async function healSelfPresence(f) {
  if (!myPlayerRef || !selfInfo || !roomCode) return;
  try {
    await f.set(myPlayerRef, { ...selfInfo, joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    if (selfInfo.role === 'host') {
      const metaRef = f.ref(f.db, `rooms/${roomCode}/meta`);
      const metaSnap = await f.get(metaRef);
      if (!metaSnap.exists()) await f.set(metaRef, { hostId: f.uid, createdAt: f.serverTimestamp(), status: 'active' });
    }
    log('coop', 'Eigene Anwesenheit nach externer Entfernung wiederhergestellt', { role: selfInfo.role });
  } catch (e) { log('coop', 'Presence-Selbstheilung fehlgeschlagen', e); }
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
          else if (selfInfo.role === 'host') {
            // meta ging während der Abwesenheit verloren (fälschliche Raum-
            // Löschung) — als Host wiederherstellen, sonst schlägt jeder spätere
            // rejoin() („Coop fortsetzen") mit room-gone fehl.
            currentHostId = f.uid;
            await f.set(f.ref(f.db, `rooms/${roomCode}/meta`), { hostId: f.uid, createdAt: f.serverTimestamp(), status: 'active' });
            log('coop', 'Fehlendes meta nach Reconnect wiederhergestellt (Host)');
          }
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
    // Stale Daten einer früheren Session unter demselben Code dürfen nicht in
    // die neue Session hineinspielen — den GANZEN Alt-Raum entfernen (nicht nur
    // events): seit Räume einen letzten Spieler überleben können (keepRoom/
    // Fortsetzen, s. leave()), lägen sonst auch team-/raceProgress-Reste herum.
    await f.remove(f.ref(f.db, `rooms/${code}`));
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
// computeJoinAnchor(): bestimmt für einen FRISCHEN Beitritt, ab welchem Event-Key
// die Raum-Historie abgespielt wird (reine Logik, unit-getestet). Früher wurde
// IMMER die komplette Historie replayed — dadurch spielte ein Beitretender das
// STATUS („won") einer längst beendeten früheren Runde ab (Sieganimation aus dem
// Nichts), landete über ein altes INIT in einer hängenden Bereit-Lobby und
// erschien beim Partner als aktiv, obwohl er nie im Spiel ankam. Jetzt gilt:
// • Läuft gerade eine Runde (letztes INIT ohne nachfolgendes finales STATUS),
//   wird exakt AB diesem INIT abgespielt — der Beitretende rekonstruiert den
//   kompletten Rundenstand (Puzzle, Züge, Leben, Pausen) deterministisch in
//   Originalreihenfolge und spielt sofort mit.
// • Ist keine Runde offen (Lobby/Zwischenrunde/Race/Team), wird die Historie
//   komplett übersprungen; das nächste INIT/START kommt live.
// events: Array von {key, val} in chronologischer Key-Reihenfolge.
// Rückgabe: {afterKey} — Key, HINTER dem der Listener aufsetzt (null = von Anfang an).
export function computeJoinAnchor(events) {
  let prevKey = null, initAnchor = null, roundOpen = false;
  for (const { key, val } of events) {
    if (val && val.type === 'init') { initAnchor = prevKey; roundOpen = true; }
    else if (val && val.type === 'status' && (val.status === 'won' || val.status === 'lost')) roundOpen = false;
    prevKey = key;
  }
  return { afterKey: roundOpen ? initAnchor : prevKey };
}

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
    // Beitritts-Anker bestimmen (siehe computeJoinAnchor): nie wieder die ganze
    // Historie abspielen. Schlägt die Leseabfrage fehl, wird defensiv ohne Anker
    // angehängt (altes Verhalten) — besser ein Voll-Replay als gar kein Spielstand.
    let afterKey = null;
    try {
      const evSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/events`)));
      const events = [];
      evSnap.forEach((child) => { events.push({ key: child.key, val: child.val() }); });
      afterKey = computeJoinAnchor(events).afterKey;
      log('coop', `Beitritts-Anker bestimmt`, { events: events.length, afterKey });
    } catch (e) { log('coop', 'Event-Anker beim Beitritt nicht lesbar – Voll-Replay als Fallback', e); }
    lastEventKey = afterKey;
    attachListeners(f, code, { onJoin: null, onLeave: (id) => onClose && onClose(id), onMessage }, afterKey);
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
    let meta = metaSnap.exists() ? (metaSnap.val() || {}) : null;
    if (!meta) {
      // meta fehlt — das heißt NICHT zwingend, dass der Raum weg ist: eine
      // fälschliche Raum-Löschung (leave() eines Partners, der den Raum für leer
      // hielt) konnte einen „Torso" hinterlassen, in dem der Partner weiterspielt
      // (players/events existieren wieder). Solange noch irgendjemand im Raum
      // ist, wird meta wiederhergestellt statt den Wiedereinstieg zu verweigern.
      const playersSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/players`)));
      if (!playersSnap.exists() || playersSnap.size === 0) {
        log('coop', `Raum ${code} existiert nicht mehr`);
        onError && onError({ type: 'room-gone' });
        return;
      }
      let firstUid = null;
      playersSnap.forEach((child) => { if (!firstUid) firstUid = child.key; });
      meta = { hostId: role === 'host' ? f.uid : (firstUid || f.uid) };
      await f.set(f.ref(f.db, `rooms/${code}/meta`), { ...meta, createdAt: f.serverTimestamp(), status: 'active' });
      log('coop', `Raum ${code}: fehlendes meta wiederhergestellt`, { hostId: meta.hostId });
    }
    // Prüfen, ob wir noch der aktuelle Host sind — falls inzwischen ein anderer
    // Spieler die Host-Rolle übernommen hat (meta.hostId wurde von promoteToHost()
    // aktualisiert), treten wir als Gast wieder bei.
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
// Firebase RTDB lehnt Infinity/-Infinity/NaN ab — und verwirft dann den GESAMTEN
// Schreibvorgang. Ein Solo-Spiel hält hintsLeft = Infinity (unbegrenzte Hinweise,
// HINTS in config.js); landete das ungefiltert im INIT der Solo→Coop-Umwandlung,
// wurde das komplette INIT abgelehnt und der Beitretende bekam NIE ein Spielfeld
// (nur das nachfolgende, Infinity-freie START kam an → „hängt in der Lobby").
// Deshalb wird JEDER gesendete Payload hier tief bereinigt: nicht-endliche Zahlen
// werden zu null (RTDB verwirft den Schlüssel; der Empfänger setzt fehlende Felder
// auf ihre Defaults, z.B. hintsLeft ?? HINTS = Infinity). serverTimestamp-Sentinel
// bleibt unberührt, da nur `msg` bereinigt wird.
export function sanitizeForFirebase(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (Array.isArray(v)) return v.map(sanitizeForFirebase);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k in v) out[k] = sanitizeForFirebase(v[k]);
    return out;
  }
  return v;
}
export async function send(msg) {
  if (!fb || !roomCode) return;
  try {
    await fb.push(fb.ref(fb.db, `rooms/${roomCode}/events`), { ...sanitizeForFirebase(msg), author: fb.uid, ts: fb.serverTimestamp() });
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
    await fb.push(fb.ref(fb.db, `rooms/${roomCode}/teamEvents/${team}`), { ...sanitizeForFirebase(msg), author: fb.uid, ts: fb.serverTimestamp() });
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

// keepRoom: true = Raum bewusst NICHT aufräumen, auch wenn er (scheinbar) leer
// ist — gesetzt, wenn der Verlassende eine wiederaufnehmbare Coop-Session
// gespeichert hat („Zum Menü" mitten in der Runde, s. quitToHome in app.js).
// Vorher löschte genau dieser Pfad den Raum, sobald der Partner zufällig gerade
// still abgerissen war (onDisconnect hatte dessen players-Eintrag entfernt,
// er spielte aber lokal weiter) — danach schlug „Coop fortsetzen" auf BEIDEN
// Seiten mit „Raum existiert nicht mehr" fehl.
export async function leave({ keepRoom = false } = {}) {
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
    if (keepRoom) { log('coop', `Raum ${code} verlassen – bleibt für Fortsetzen bestehen`); return; }
    // Aufräumen nur, wenn der Raum WIRKLICH leer ist — serverseitig bestätigt:
    // runTransaction prüft atomar (Compare-and-Set) gegen den Serverstand und
    // bricht ab, sobald irgendein Spieler (wieder) eingetragen ist. Der frühere
    // get()+remove()-Zweizeiler konnte dagegen auf einem veralteten Stand
    // entscheiden und den Raum unter einem noch aktiven Partner wegziehen.
    await f.runTransaction(f.ref(f.db, `rooms/${code}`), (room) => {
      if (room === null) return null;                                        // schon weg
      if (room.players && Object.keys(room.players).length > 0) return;      // Partner da → abbrechen, Raum behalten
      return null;                                                           // bestätigt leer → löschen
    });
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
