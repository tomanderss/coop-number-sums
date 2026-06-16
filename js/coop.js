// coop.js — Echtzeit-Coop-Transport via WebRTC/PeerJS (Host-Stern-Topologie).
// Der Host hat einen kurzen Lobby-Code; Gäste verbinden sich damit. Der Host ist
// die maßgebliche Instanz (autoritativ) und verteilt alle Änderungen.
// PeerJS wird als globales window.Peer geladen (siehe index.html).

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen
const PREFIX = 'coopnumsums-v1-';                       // Namespace für Peer-IDs

let peer = null;
let guestConns = [];   // Host: alle Gast-Verbindungen
let hostConn = null;   // Gast: Verbindung zum Host

export function isAvailable() { return typeof window !== 'undefined' && !!window.Peer; }

function randomCode(n = 4) {
  let s = ''; for (let i = 0; i < n; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
export function hostGame({ onCode, onError, onJoin, onLeave, onMessage }) {
  guestConns = [];
  let code = randomCode();
  let tries = 0;
  const open = () => {
    peer = new window.Peer(PREFIX + code, { debug: 1 });
    peer.on('open', () => onCode && onCode(code));
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries++ < 6) { code = randomCode(); try { peer.destroy(); } catch {} open(); }
      else onError && onError(e);
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => { guestConns.push(conn); onJoin && onJoin(conn); });
      conn.on('data', (d) => onMessage && onMessage(d, conn));
      const drop = () => { guestConns = guestConns.filter(c => c !== conn); onLeave && onLeave(conn); };
      conn.on('close', drop); conn.on('error', drop);
    });
  };
  open();
}

// ─── GAST ─────────────────────────────────────────────────────────────────────
export function joinGame({ code, onOpen, onError, onMessage, onClose }) {
  peer = new window.Peer({ debug: 1 });
  let settled = false;
  peer.on('open', () => {
    hostConn = peer.connect(PREFIX + String(code).toUpperCase(), { reliable: true });
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
