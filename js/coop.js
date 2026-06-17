// coop.js — Echtzeit-Coop-Transport via WebRTC/PeerJS (Host-Stern-Topologie).
// Der Host legt einen 6-stelligen Zahlencode fest; Gäste verbinden sich damit.
// Der Host ist die maßgebliche Instanz (autoritativ) und verteilt alle Änderungen.
// PeerJS wird als globales window.Peer geladen (siehe index.html).

const PREFIX = 'coopnumsums-v1-'; // Namespace für Peer-IDs

let peer = null;
let guestConns = [];   // Host: alle Gast-Verbindungen
let hostConn = null;   // Gast: Verbindung zum Host

export function isAvailable() { return typeof window !== 'undefined' && !!window.Peer; }

// ─── HOST ─────────────────────────────────────────────────────────────────────
export function hostGame({ code, onOpen, onError, onJoin, onLeave, onMessage }) {
  guestConns = [];
  peer = new window.Peer(PREFIX + code, { debug: 1 });
  peer.on('open', () => onOpen && onOpen());
  peer.on('error', (e) => onError && onError(e)); // z.B. 'unavailable-id' = Code belegt
  peer.on('connection', (conn) => {
    conn.on('open', () => { guestConns.push(conn); onJoin && onJoin(conn); });
    conn.on('data', (d) => onMessage && onMessage(d, conn));
    const drop = () => { guestConns = guestConns.filter(c => c !== conn); onLeave && onLeave(conn); };
    conn.on('close', drop); conn.on('error', drop);
  });
}

// ─── GAST ─────────────────────────────────────────────────────────────────────
export function joinGame({ code, onOpen, onError, onMessage, onClose }) {
  peer = new window.Peer({ debug: 1 });
  let settled = false;
  peer.on('open', () => {
    hostConn = peer.connect(PREFIX + String(code), { reliable: true });
    hostConn.on('open', () => { settled = true; onOpen && onOpen(); });
    hostConn.on('data', (d) => onMessage && onMessage(d));
    hostConn.on('close', () => onClose && onClose());
    hostConn.on('error', (e) => onError && onError(e));
  });
  peer.on('error', (e) => onError && onError(e)); // z.B. 'peer-unavailable' = Code falsch
  setTimeout(() => { if (!settled) onError && onError({ type: 'timeout' }); }, 12000);
}

// ─── Nachrichten ────────────────────────────────────────────────────────────
export function broadcast(msg, exceptConn = null) {
  for (const c of guestConns) if (c.open && c !== exceptConn) { try { c.send(msg); } catch {} }
}
export function sendToConn(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch {} }
export function sendToHost(msg) { try { if (hostConn && hostConn.open) hostConn.send(msg); } catch {} }

export function leave() {
  try { if (peer) peer.destroy(); } catch {}
  peer = null; hostConn = null; guestConns = [];
}

export const MSG = {
  INIT: 'init', MOVE: 'move', UNDO: 'undo', CHECK: 'check', STATUS: 'status', PAUSE: 'pause',
};
