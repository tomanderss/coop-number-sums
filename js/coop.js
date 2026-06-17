// coop.js — Echtzeit-Coop-Transport via WebRTC/PeerJS (Host-Stern-Topologie).
// Der Host legt einen 6-stelligen Zahlencode fest; Gäste verbinden sich damit.
// Der Host ist die maßgebliche Instanz (autoritativ) und verteilt alle Änderungen.
// PeerJS wird als globales window.Peer geladen (siehe index.html).
//
// Herzschlag: da kein eigener Signaling-Server existiert (PeerJS-Cloud-Broker
// ohne Heartbeat-API), schicken sich Host und Gast alle HEARTBEAT_MS ein
// internes __hb/__hbAck-Päckchen. Bleibt eine Antwort länger als
// HEARTBEAT_TIMEOUT_MS aus, gilt die Verbindung als tot (Inaktivität,
// eingeschlafener Tab, Netzwerkausfall ohne saubere 'close'-Meldung) — das
// löst dieselben onLeave/onClose-Pfade wie ein reguläres Trennen aus.

const PREFIX = 'coopnumsums-v1-'; // Namespace für Peer-IDs
const HEARTBEAT_MS = 4000;
const HEARTBEAT_TIMEOUT_MS = 13000;

// STUN reicht nur, wenn beide Seiten direkt erreichbar sind (z.B. selbes WLAN).
// Über getrennte Netzwerke (z.B. Mobilfunk, restriktives NAT) braucht es einen
// TURN-Relay, sonst scheitert die Verbindung. Das Open Relay Project bietet
// einen kostenlosen öffentlichen TURN-Server mit statischen Zugangsdaten — diese
// werden aber von vielen Apps weltweit geteilt und können daher überlastet oder
// (selten) zeitweise nicht erreichbar sein. Google-STUN-Server als zusätzliche,
// unabhängige Kandidaten erhöhen die Chance, dass wenigstens die Verbindungs-
// Aushandlung (Discovery) gelingt, bevor auf TURN zurückgegriffen wird.
const ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:global.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];
const PEER_CONFIG = { config: { iceServers: ICE_SERVERS, iceCandidatePoolSize: 4 } };
// Erzwingt reine TURN-Relay-Kandidaten (kein STUN/Host) — Fallback-Konfig für den
// zweiten Verbindungsversuch des Gasts, siehe joinGame()/iCloud Private Relay unten.
const PEER_CONFIG_RELAY_ONLY = { config: { iceServers: ICE_SERVERS, iceCandidatePoolSize: 4, iceTransportPolicy: 'relay' } };

let peer = null;
let guestConns = [];          // Host: alle Gast-Verbindungen
let hostConn = null;          // Gast: Verbindung zum Host
let heartbeatHandle = null;
let lastSeenByConn = new Map(); // Host: conn -> ts letzter Aktivität
let lastSeenHost = 0;           // Gast: ts letzter Aktivität vom Host

export function isAvailable() { return typeof window !== 'undefined' && !!window.Peer; }

function stopHeartbeat() {
  if (heartbeatHandle) { clearInterval(heartbeatHandle); heartbeatHandle = null; }
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
export function hostGame({ code, onOpen, onError, onJoin, onLeave, onMessage }) {
  guestConns = [];
  lastSeenByConn = new Map();
  stopHeartbeat();
  peer = new window.Peer(PREFIX + code, { debug: 1, ...PEER_CONFIG });
  // Es gibt je Session immer genau einen Host — eine feste logische ID reicht,
  // statt die interne (code-abhängige) Peer-ID nach außen zu reichen.
  peer.on('open', () => onOpen && onOpen('host'));
  peer.on('error', (e) => onError && onError(e)); // z.B. 'unavailable-id' = Code belegt
  peer.on('connection', (conn) => {
    conn.on('open', () => { guestConns.push(conn); lastSeenByConn.set(conn, Date.now()); onJoin && onJoin(conn); });
    conn.on('data', (d) => {
      lastSeenByConn.set(conn, Date.now());
      if (d && d.__hb) { try { conn.send({ __hbAck: true }); } catch {} return; }
      if (d && d.__hbAck) return;
      onMessage && onMessage(d, conn);
    });
    const drop = () => {
      guestConns = guestConns.filter(c => c !== conn);
      lastSeenByConn.delete(conn);
      onLeave && onLeave(conn);
    };
    conn.on('close', drop); conn.on('error', drop);
  });
  heartbeatHandle = setInterval(() => {
    const now = Date.now();
    for (const conn of [...guestConns]) {
      const last = lastSeenByConn.get(conn) || now;
      if (now - last > HEARTBEAT_TIMEOUT_MS) {
        try { conn.close(); } catch {}
        guestConns = guestConns.filter(c => c !== conn);
        lastSeenByConn.delete(conn);
        onLeave && onLeave(conn);
      } else {
        try { conn.send({ __hb: true }); } catch {}
      }
    }
  }, HEARTBEAT_MS);
}

// ─── GAST ─────────────────────────────────────────────────────────────────────
// Manche Mobilfunknetze (v.a. iOS mit aktiviertem iCloud Private Relay) verschleiern
// die NAT-Adresse so, dass STUN-Kandidaten unbrauchbar werden und die normale
// ICE-Aushandlung ("all") nie zustande kommt. Das lässt sich von der Webseite aus
// nicht erkennen oder umgehen — aber ein zweiter Versuch, der ausschließlich
// TURN-Relay-Kandidaten zulässt (iceTransportPolicy: 'relay'), kommt damit meist
// klar, weil der Relay-Traffic wie normaler Server-Verkehr aussieht. Daher: erster
// Versuch normal (kurzes Timeout, da er unter Private Relay schnell scheitert),
// bei Fehlschlag automatisch ein zweiter Versuch nur mit Relay (längeres Timeout,
// da TURN-Aushandlung über Mobilfunk/CGNAT mehr Zeit braucht).
export function joinGame({ code, onOpen, onError, onMessage, onClose }) {
  stopHeartbeat();
  attemptJoin({ code, onOpen, onError, onMessage, onClose, forceRelay: false });
}

function attemptJoin({ code, onOpen, onError, onMessage, onClose, forceRelay }) {
  let settled = false;
  let timeoutHandle = null;
  peer = new window.Peer({ debug: 1, ...(forceRelay ? PEER_CONFIG_RELAY_ONLY : PEER_CONFIG) });

  const fail = (e) => {
    if (settled) return;
    settled = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    try { peer.destroy(); } catch {}
    peer = null; hostConn = null;
    // 'peer-unavailable' = Code falsch/Host nicht erreichbar — ein Relay-Retry
    // ändert daran nichts, also direkt den Fehler melden statt erneut zu versuchen.
    if (!forceRelay && (!e || e.type !== 'peer-unavailable')) {
      attemptJoin({ code, onOpen, onError, onMessage, onClose, forceRelay: true });
    } else {
      onError && onError(e);
    }
  };

  peer.on('open', (myId) => {
    hostConn = peer.connect(PREFIX + String(code), { reliable: true });
    hostConn.on('open', () => {
      settled = true; if (timeoutHandle) clearTimeout(timeoutHandle);
      lastSeenHost = Date.now(); onOpen && onOpen(myId);
      heartbeatHandle = setInterval(() => {
        if (!hostConn) return;
        if (Date.now() - lastSeenHost > HEARTBEAT_TIMEOUT_MS) {
          stopHeartbeat();
          try { hostConn.close(); } catch {}
          onClose && onClose();
          return;
        }
        try { hostConn.send({ __hb: true }); } catch {}
      }, HEARTBEAT_MS);
    });
    hostConn.on('data', (d) => {
      lastSeenHost = Date.now();
      if (d && d.__hb) { try { hostConn.send({ __hbAck: true }); } catch {} return; }
      if (d && d.__hbAck) return;
      onMessage && onMessage(d);
    });
    hostConn.on('close', () => { stopHeartbeat(); onClose && onClose(); });
    hostConn.on('error', (e) => fail(e));
  });
  peer.on('error', (e) => fail(e)); // z.B. 'unavailable-id', 'peer-unavailable' = Code falsch
  // Erster Versuch: 12s (unter Private Relay scheitert er ohnehin schnell).
  // Relay-Versuch: 20s (TURN-Aushandlung über Mobilfunk/CGNAT braucht länger).
  timeoutHandle = setTimeout(() => fail({ type: 'timeout' }), forceRelay ? 20000 : 12000);
}

// ─── Nachrichten ────────────────────────────────────────────────────────────
export function broadcast(msg, exceptConn = null) {
  for (const c of guestConns) if (c.open && c !== exceptConn) { try { c.send(msg); } catch {} }
}
export function sendToConn(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch {} }
export function sendToHost(msg) { try { if (hostConn && hostConn.open) hostConn.send(msg); } catch {} }

export function leave() {
  stopHeartbeat();
  try { if (peer) peer.destroy(); } catch {}
  peer = null; hostConn = null; guestConns = []; lastSeenByConn = new Map(); lastSeenHost = 0;
}

export const MSG = {
  INIT: 'init', MOVE: 'move', UNDO: 'undo', CHECK: 'check', STATUS: 'status', PAUSE: 'pause', HINT: 'hint',
  RETRY: 'retry', CLOSE: 'close', IDENTITY: 'identity', ROSTER: 'roster', MISTAKE: 'mistake',
};
