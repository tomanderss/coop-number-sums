// app.js — Coop Number Sums (Vue 3, esm-browser). Solo-Spiel; Coop folgt später.
import { createApp, reactive, computed, watch, nextTick, onMounted } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { DIFFICULTIES, DIFF_BY_ID, REGION_COLORS, COOP_COLORS, DEFAULT_GAME_OPTIONS, LIVES, HINTS } from './config.js';
import { generatePuzzle, findHintCell } from './generator.js';
import * as Coop from './coop.js';
import {
  loadSettings, saveSettings, loadActiveGame, saveActiveGame, loadStats, recordResult,
  loadSeenVersion, saveSeenVersion, createBackup, loadBackups, restoreBackup,
  exportToFile, importFromFile,
} from './storage.js';

const APP_START = Date.now();
const splashVersion = document.getElementById('splash-version');
if (splashVersion) splashVersion.textContent = `v${BUILD}`;

// ─── GLOBALER ZUSTAND ─────────────────────────────────────────────────────────
const state = reactive({
  screen: 'home',            // home | setup | game | settings | stats
  settings: loadSettings(),
  stats: loadStats(),

  // Spiel
  puzzle: null,
  marks: [],                 // 'none' | 'kept' | 'removed'
  cellMeta: [],              // pro Zelle: { region, color, edges, chip, hint, hintMark }
  lives: 0, maxLives: 0,
  hintsLeft: 0,
  hintsUsed: 0,
  mistakes: 0,
  status: 'idle',            // idle | playing | won | lost | gaveup
  solutionShown: false,      // Lösung wird angezeigt (rein lokal, nie an den Partner gesendet)
  newHighscore: false,        // true, wenn beim letzten Sieg eine neue Bestzeit erzielt wurde
  tool: 'pen',               // pen | eraser
  startTime: 0,
  elapsed: 0,
  history: [],               // Undo-Stack
  flash: {},                 // "r-c" -> true (rote Fehler-Animation)
  justResolved: {},          // "row-3" | "col-1" | "region-2" -> true (Fertig-Puls)
  cellPx: 48,
  zoom: 1,
  markedBy: [],               // 2D-Array parallel zu marks: 'me' | 'partner' | null (nur Coop)

  // Auswahl im Setup
  sel: { ...DEFAULT_GAME_OPTIONS },

  // Coop-Modus
  coop: {
    active: false,             // aktive Session
    role: null,                // 'host' | 'guest'
    code: '',                  // Host: gewählter Code; Gast: eingegebener Zielcode
    connected: false,          // Partner verbunden
    waitingForGuest: false,    // Host: Peer offen, wartet auf Join / Gast: verbindet
    lobbyDiffId: 'mittel',
    error: null,               // Inline-Fehlermeldung im Lobby-Screen
    myId: null,                // eigene Spieler-ID dieser Session ('host' oder PeerJS-ID als Gast)
    players: [],                // [{id, name, color}] — alle bekannten Mitspieler inkl. mir selbst
    nameDraft: '',              // Entwurf im Namens-Gate, bevor er bestätigt wird
    identityConfirmed: false,   // true sobald das Namens-Gate in dieser Coop-Session bestätigt wurde
    lifeLossBy: [],              // chronologisch: wer hat welches (gemeinsame) Leben verbraucht
    mistakesByPlayer: {},        // id -> Anzahl Fehler dieses Spielers im laufenden Rätsel
  },

  // UI
  toast: null,
  modal: null,               // null | 'howto' | 'changelog' | 'backups' | 'confirm'
  confirm: null,             // { title, msg, onYes }
  showWhatsNew: false,
  generating: false,
  paused: false,             // Pausenmodus (Feld verdeckt, Zeit gestoppt)
  resumeAvailable: null,     // gespeichertes Spiel (zum Fortsetzen)
  confetti: [],
});

let timerHandle = null;
let saveThrottle = 0;
let pinchState = null;       // { dist, zoom } während einer 2-Finger-Geste
let coopIntentionalLeave = false; // unterscheidet bewusstes Verlassen von echtem Verbindungsabbruch

// ─── HELFER ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', ms = 2000) {
  state.toast = { msg, type };
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { state.toast = null; }, ms);
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function avgTimeFor(diffId) {
  const d = state.stats.byDifficulty[diffId];
  if (!d || !d.won) return null;
  return d.sumTimeMs / d.won;
}
function coopAvgTimeFor(diffId) {
  const d = state.stats.byDifficulty[diffId];
  if (!d || !d.coopWon) return null;
  return d.coopSumTimeMs / d.coopWon;
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.darkMode ? 'dark' : 'light');
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', state.settings.darkMode ? '#0b1020' : '#eef2f9');
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function navigate(screen) {
  state.screen = screen;
  if (screen === 'game') startTimer(); else stopTimer();
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  if (state.status !== 'playing' || state.paused) return;
  timerHandle = setInterval(() => {
    state.elapsed = Date.now() - state.startTime;
  }, 250);
}
function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

// ─── PAUSE ────────────────────────────────────────────────────────────────────
// remoteElapsed: bei einer vom Partner empfangenen Pause-Nachricht übernehmen wir
// dessen exakt eingefrorenen Wert, statt ihn lokal neu zu berechnen — sonst würde
// die (kleine, aber sichtbare) Netzwerklatenz zwischen "Pause gedrückt" und
// "Nachricht angekommen" dazu führen, dass beide Seiten eine leicht andere Zeit
// einfrieren (der gemeldete ca. 1-Sekunden-Unterschied).
function pauseGame(broadcast = true, remoteElapsed) {
  if (state.status !== 'playing' || state.paused) return;
  state.paused = true;
  state.elapsed = remoteElapsed != null ? remoteElapsed : Date.now() - state.startTime; // einfrieren
  stopTimer();
  if (broadcast && state.coop.active) coopSend({ type: Coop.MSG.PAUSE, paused: true, elapsed: state.elapsed });
}
function resumeFromPause(broadcast = true) {
  if (!state.paused) return;
  state.paused = false;
  state.startTime = Date.now() - state.elapsed; // Zeit fortsetzen
  startTimer();
  if (broadcast && state.coop.active) coopSend({ type: Coop.MSG.PAUSE, paused: false });
}

// ─── ZELLEN-METADATEN (Regionen, Ränder, Chips) ───────────────────────────────
function buildCellMeta(puzzle) {
  const { rows, cols, regions } = puzzle;
  const meta = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ region: -1, color: null, edges: {}, chip: null, hint: false, hintMark: false })));
  // Regions-ID-Gitter aufbauen
  const rid = Array.from({ length: rows }, () => Array(cols).fill(-1));
  regions.forEach((reg, ri) => { for (const [r, c] of reg.cells) rid[r][c] = ri; });
  const same = (r, c, ri) => r >= 0 && r < rows && c >= 0 && c < cols && rid[r][c] === ri;

  regions.forEach((reg, ri) => {
    const color = REGION_COLORS[reg.colorIndex % REGION_COLORS.length];
    let chipCell = null;
    for (const [r, c] of reg.cells) {
      const m = meta[r][c];
      m.region = ri; m.color = color;
      // Rand auf einer Seite, wenn der Nachbar zu einer anderen Region gehört (oder außerhalb)
      m.edges = {
        t: !same(r - 1, c, ri), b: !same(r + 1, c, ri),
        l: !same(r, c - 1, ri), r: !same(r, c + 1, ri),
      };
      if (chipCell === null || r < chipCell[0] || (r === chipCell[0] && c < chipCell[1])) chipCell = [r, c];
    }
    if (chipCell) meta[chipCell[0]][chipCell[1]].chip = reg.target;
  });
  return meta;
}

// ─── NEUES SPIEL ──────────────────────────────────────────────────────────────
// In einer aktiven Coop-Session (als Host) wird das neue Rätsel an den Partner
// gesendet, statt dass dieser selbst eines wählen müsste — die Lobby bleibt erhalten.
function newGame(diffId) {
  state.generating = true;
  state.screen = 'game';
  // kurze Verzögerung, damit die Lade-Animation sichtbar wird (große Felder)
  setTimeout(() => {
    const puzzle = generatePuzzle({ difficulty: diffId });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    startTimer();
    if (state.coop.active && state.coop.role === 'host') {
      coopSend({ type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
    }
  }, 30);
}

function loadPuzzleIntoState(puzzle, saved) {
  state.puzzle = puzzle;
  state.cellMeta = buildCellMeta(puzzle);
  if (saved && saved.hintMarks) for (const [r, c] of saved.hintMarks) state.cellMeta[r][c].hintMark = true;
  state.marks = saved?.marks || Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill('none'));
  state.markedBy = saved?.markedBy || Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(null));
  state.maxLives = saved?.maxLives ?? LIVES;
  state.lives = saved?.lives ?? LIVES;
  state.hintsLeft = saved?.hintsLeft ?? HINTS;
  state.hintsUsed = saved?.hintsUsed ?? 0;
  state.mistakes = saved?.mistakes ?? 0;
  state.coop.lifeLossBy = [];
  state.coop.mistakesByPlayer = {};
  state.history = [];
  state.flash = {};
  state.justResolved = {};
  state.tool = state.settings.confirmTool || 'pen';
  state.status = 'playing';
  state.solutionShown = false;
  state.newHighscore = false;
  state.elapsed = saved?.elapsed ?? 0;
  // Bei Coop-INIT übernimmt der Gast den exakten Host-Startzeitpunkt, damit beide
  // Seiten dieselbe Zeit anzeigen (sonst Drift durch Verbindungsaufbau-Latenz).
  state.startTime = saved?.startTime ?? (Date.now() - state.elapsed);
  state.zoom = 1;
  computeCellSize();
  persistGame();
}

// ─── ZELLGRÖSSE (responsiv + Zoom) ────────────────────────────────────────────
function computeCellSize() {
  if (!state.puzzle) return;
  const cols = state.puzzle.cols;
  const avail = Math.min(window.innerWidth - 44, 496); // 2*(14px App-Padding + 6px Board-Wrap-Padding) + Sicherheitspuffer
  const ideal = Math.floor(avail / (cols + 1)); // +1 für Kopfspalte
  const base = Math.max(26, Math.min(56, ideal));
  state.cellPx = Math.round(base * state.zoom);
}
function setZoom(delta) {
  state.zoom = Math.max(0.7, Math.min(2.2, +(state.zoom + delta).toFixed(2)));
  computeCellSize();
}

// ─── PINCH-TO-ZOOM (Board) ─────────────────────────────────────────────────────
function touchDist(touches) {
  const [a, b] = touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function onPinchStart(e) {
  if (e.touches.length === 2) pinchState = { dist: touchDist(e.touches), zoom: state.zoom };
}
function onPinchMove(e) {
  if (!pinchState || e.touches.length !== 2) return;
  e.preventDefault();
  const ratio = touchDist(e.touches) / pinchState.dist;
  state.zoom = Math.max(0.7, Math.min(2.2, +(pinchState.zoom * ratio).toFixed(2)));
  computeCellSize();
}
function onPinchEnd(e) { if (e.touches.length < 2) pinchState = null; }

// ─── SUMMEN & FERTIG-STATUS ───────────────────────────────────────────────────
function rowSum(r) {
  let s = 0; const p = state.puzzle; for (let c = 0; c < p.cols; c++) if (state.marks[r][c] === 'kept') s += p.values[r][c]; return s;
}
function colSum(c) {
  let s = 0; const p = state.puzzle; for (let r = 0; r < p.rows; r++) if (state.marks[r][c] === 'kept') s += p.values[r][c]; return s;
}
function regionSum(i) {
  let s = 0; const p = state.puzzle; for (const [r, c] of p.regions[i].cells) if (state.marks[r][c] === 'kept') s += p.values[r][c]; return s;
}
// Eine Gruppe gilt erst als "aufgelöst", wenn JEDE Zelle korrekt markiert ist
// (Lösungszellen eingekreist, alle anderen gelöscht) — nicht schon, wenn die
// Summe stimmt. Kein automatisches Auflösen.
const cellCorrect = (r, c) => state.puzzle.solution[r][c]
  ? state.marks[r][c] === 'kept'
  : state.marks[r][c] === 'removed';
function rowResolved(r) { const p = state.puzzle; for (let c = 0; c < p.cols; c++) if (!cellCorrect(r, c)) return false; return true; }
function colResolved(c) { const p = state.puzzle; for (let r = 0; r < p.rows; r++) if (!cellCorrect(r, c)) return false; return true; }
function regionResolved(i) { const p = state.puzzle; for (const [r, c] of p.regions[i].cells) if (!cellCorrect(r, c)) return false; return true; }
// aktuelle Summen stimmen (Hilfsanzeige): Summe der eingekreisten == Ziel
const rowSumMatch = r => rowSum(r) === state.puzzle.rowTargets[r];
const colSumMatch = c => colSum(c) === state.puzzle.colTargets[c];

// Kurzer, smoother Leucht-Puls für eine gerade fertig gewordene Reihe/Spalte/Cage.
function pulseResolved(kind, idx) {
  const key = `${kind}-${idx}`;
  state.justResolved[key] = true;
  setTimeout(() => { delete state.justResolved[key]; }, 900);
}

// ─── SPIELZÜGE ────────────────────────────────────────────────────────────────
function onCellTap(r, c) {
  if (state.status !== 'playing' || state.generating || state.paused) return;
  const cur = state.marks[r][c];
  if (cur !== 'none') return; // already marked — only undo can reverse
  const next = state.tool === 'pen' ? 'kept' : 'removed';
  setMark(r, c, next, true);
}

function setMark(r, c, next, user, fromId) {
  const cur = state.marks[r][c];
  if (cur === next) return;

  if (user && state.settings.errorReveal === 'instant') {
    const sol = state.puzzle.solution[r][c];
    const wrong = (next === 'kept' && !sol) || (next === 'removed' && sol);
    if (wrong) { flashError(r, c); registerMistake(); return; }
  }

  const region = state.cellMeta[r][c].region;
  const wasRow = rowResolved(r), wasCol = colResolved(c);
  const wasRegion = region >= 0 ? regionResolved(region) : false;

  state.history = [{ r, c, prev: cur }]; // nur der letzte Zug ist rückgängig machbar
  state.marks[r][c] = next;
  state.markedBy[r][c] = next === 'none' ? null : (user ? state.coop.myId : fromId);
  if (user && state.coop.active) coopSend({ type: Coop.MSG.MOVE, r, c, mark: next, from: state.coop.myId });

  if (!wasRow && rowResolved(r)) pulseResolved('row', r);
  if (!wasCol && colResolved(c)) pulseResolved('col', c);
  if (region >= 0 && !wasRegion && regionResolved(region)) pulseResolved('region', region);

  afterMove();
}

function afterMove() {
  persistGame();
  if (isSolved()) win();
}

function flashError(r, c) {
  const key = `${r}-${c}`;
  state.flash[key] = true;
  setTimeout(() => { delete state.flash[key]; }, 650);
}

// by: wer den Fehler begangen hat ('me'/Peer-ID im Coop, sonst null). Wird im Coop
// an den/die Partner gesendet, damit Fehler & gemeinsame Leben bei allen synchron
// bleiben (eine rein lokale Sofort-Aufdeckung würde der Partner sonst nie erfahren).
function registerMistake() {
  const by = state.coop.active ? state.coop.myId : null;
  state.mistakes++;
  if (by) state.coop.mistakesByPlayer[by] = (state.coop.mistakesByPlayer[by] || 0) + 1;
  if (state.coop.active) coopSend({ type: Coop.MSG.MISTAKE, by, n: 1 });
  if (state.settings.livesEnabled) {
    state.lives--;
    if (state.coop.active) state.coop.lifeLossBy.push(by);
    if (state.lives <= 0) { state.lives = 0; lose(); }
  }
  persistGame();
}

// Wendet einen vom Partner gemeldeten Fehler an (ohne erneut zu senden — sonst
// würde die Nachricht zwischen Host und Gast endlos hin- und herlaufen).
function applyRemoteMistake(by, n) {
  state.mistakes += n;
  if (by) state.coop.mistakesByPlayer[by] = (state.coop.mistakesByPlayer[by] || 0) + n;
  if (state.settings.livesEnabled) {
    for (let i = 0; i < n; i++) {
      state.lives--;
      state.coop.lifeLossBy.push(by);
      if (state.lives <= 0) { state.lives = 0; lose(); return; }
    }
  }
}

// Gelöst, wenn JEDE Zelle korrekt markiert ist (Lösung eingekreist, Rest gelöscht).
function isSolved() {
  const p = state.puzzle; if (!p) return false;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      if (!cellCorrect(r, c)) return false;
  return true;
}

// "Prüfen"-Modus (Fehler erst auf Knopfdruck). by: wer den Check ausgelöst hat
// (für die Fehler-/Lebenszuordnung im Coop) — bleibt beim Weiterleiten an weitere
// Mitspieler unverändert, damit die Zuordnung auch beim Host-Relay erhalten bleibt.
function doCheck(by = state.coop.active ? state.coop.myId : null, broadcast = true) {
  if (state.status !== 'playing') return;
  if (broadcast && state.coop.active) coopSend({ type: Coop.MSG.CHECK, from: by });
  const p = state.puzzle; const wrong = [];
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      const mk = state.marks[r][c], sol = p.solution[r][c];
      if ((mk === 'kept' && !sol) || (mk === 'removed' && sol)) wrong.push([r, c]);
    }
  if (wrong.length === 0) {
    if (isSolved()) { win(); return; }
    showToast('Bisher alles korrekt – aber noch nicht fertig 👍', 'info');
    return;
  }
  wrong.forEach(([r, c]) => flashError(r, c));
  state.mistakes += wrong.length;
  if (by) state.coop.mistakesByPlayer[by] = (state.coop.mistakesByPlayer[by] || 0) + wrong.length;
  if (state.settings.livesEnabled) {
    state.lives--;
    if (state.coop.active) state.coop.lifeLossBy.push(by);
    if (state.lives <= 0) { state.lives = 0; lose(); return; }
  }
  showToast(`${wrong.length} Fehler gefunden`, 'error');
  persistGame();
}

// Wendet einen Hinweis auf eine Zelle an (lokal ausgelöst oder vom Coop-Partner empfangen).
// user kennzeichnet, wer den Hinweis ausgelöst hat (für die Coop-Farbmarkierung).
function applyHintEffect(r, c, mark, user = true, fromId) {
  const region = state.cellMeta[r][c].region;
  const wasRow = rowResolved(r), wasCol = colResolved(c);
  const wasRegion = region >= 0 ? regionResolved(region) : false;

  state.history = [{ r, c, prev: state.marks[r][c] }];
  state.marks[r][c] = mark;
  state.markedBy[r][c] = state.coop.active ? (user ? state.coop.myId : fromId) : null;
  // .hint = kurzer Leucht-Puls (Quadrat), .hintMark = bleibt für den Rest des Rätsels
  state.cellMeta[r][c].hint = true;
  state.cellMeta[r][c].hintMark = true;
  setTimeout(() => { if (state.cellMeta[r]) state.cellMeta[r][c].hint = false; }, 1400);

  if (!wasRow && rowResolved(r)) pulseResolved('row', r);
  if (!wasCol && colResolved(c)) pulseResolved('col', c);
  if (region >= 0 && !wasRegion && regionResolved(region)) pulseResolved('region', region);

  afterMove();
}

function useHint() {
  if (state.status !== 'playing' || state.hintsLeft <= 0) return;
  const hint = findHintCell(state.puzzle, state.marks);
  if (!hint) return;
  state.hintsLeft--; state.hintsUsed++;
  applyHintEffect(hint.r, hint.c, hint.want);
  if (state.coop.active) coopSend({ type: Coop.MSG.HINT, r: hint.r, c: hint.c, mark: hint.want, from: state.coop.myId });
}

function undo(broadcast = true) {
  if (!state.history.length || state.status !== 'playing') return;
  const last = state.history.pop();
  state.marks[last.r][last.c] = last.prev;
  state.markedBy[last.r][last.c] = null; // prev ist immer 'none' (siehe Markier-Sperre)
  persistGame();
  if (broadcast && state.coop.active) coopSend({ type: Coop.MSG.UNDO });
}

// ─── COOP ────────────────────────────────────────────────────────────────────
const CODE_RE = /^\d{6}$/;

function coopSend(msg) {
  if (!state.coop.active || !state.coop.connected) return;
  if (state.coop.role === 'host') Coop.broadcast(msg);
  else Coop.sendToHost(msg);
}

function handleCoopMsg(msg, fromConn) {
  if (msg.type === Coop.MSG.MOVE) {
    setMark(msg.r, msg.c, msg.mark, false, msg.from);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.UNDO) {
    undo(false);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.CHECK) {
    doCheck(msg.from, false);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.MISTAKE) {
    applyRemoteMistake(msg.by, msg.n);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.PAUSE) {
    if (msg.paused) pauseGame(false, msg.elapsed); else resumeFromPause(false);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.HINT) {
    applyHintEffect(msg.r, msg.c, msg.mark, false, msg.from);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.INIT) {
    loadPuzzleIntoState(msg.puzzle, { marks: msg.marks, markedBy: msg.markedBy, startTime: msg.startTime });
    state.coop.active = true;
    state.coop.connected = true;
    state.coop.waitingForGuest = false;
    navigate('game');
  } else if (msg.type === Coop.MSG.STATUS) {
    const remote = { timeMs: msg.timeMs, mistakes: msg.mistakes, hintsUsed: msg.hintsUsed };
    if (msg.status === 'won') win(remote);
    else if (msg.status === 'lost') lose(remote);
    else if (msg.status === 'gaveup') giveUp(remote);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.IDENTITY) {
    // Nur der Host wertet Identitäts-Meldungen aus und verteilt die Liste neu —
    // er entscheidet (Konfliktauflösung), welche Farbe ein Mitspieler tatsächlich bekommt.
    if (state.coop.role === 'host' && fromConn) {
      upsertPlayer(fromConn.peer, msg.name, msg.color);
      broadcastRoster();
    }
  } else if (msg.type === Coop.MSG.ROSTER) {
    state.coop.players = msg.players;
  } else if (msg.type === Coop.MSG.RETRY) {
    restartPuzzle(msg.startTime);
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
  } else if (msg.type === Coop.MSG.CLOSE) {
    if (state.coop.role === 'host') Coop.broadcast(msg, fromConn);
    coopReset();
    showToast('Mitspieler hat das Spiel beendet', 'info', 3000);
    saveActiveGame(null);
    refreshResume();
    navigate('home');
  }
}

function coopReset() {
  coopIntentionalLeave = true;
  Coop.leave();
  const keepDiff = state.coop.lobbyDiffId;
  state.coop.active = false; state.coop.role = null; state.coop.code = '';
  state.coop.connected = false; state.coop.waitingForGuest = false;
  state.coop.lobbyDiffId = keepDiff; state.coop.error = null;
  state.coop.myId = null; state.coop.players = [];
}

// ─── SPIELER-IDENTITÄT (Namen & Farben) ────────────────────────────────────────
// Nur der Host führt die maßgebliche Spielerliste — er löst Farbkonflikte auf und
// verteilt das Ergebnis per ROSTER an alle. Eigene Wunschfarbe bleibt dabei in den
// Einstellungen unangetastet; reassignte Farben gelten nur für die laufende Session.
function normHex(h) { return (h || '').toLowerCase(); }
function pickAvailableColor(requested, others) {
  const used = new Set(others.map(p => normHex(p.color)));
  if (requested && !used.has(normHex(requested))) return requested;
  const free = COOP_COLORS.find(c => !used.has(normHex(c.hex)));
  if (free) return free.hex;
  // Palette erschöpft (mehr Spieler als vordefinierte Farben): per Goldwinkel-
  // Rotation eine weitere, praktisch garantiert eindeutige Farbe erzeugen.
  const hue = Math.round((others.length * 137.508) % 360);
  return `hsl(${hue} 75% 55%)`;
}
function upsertPlayer(id, name, requestedColor) {
  const others = state.coop.players.filter(p => p.id !== id);
  const color = pickAvailableColor(requestedColor, others);
  state.coop.players = [...others, { id, name: (name || '').trim() || 'Spieler', color }];
}
function removePlayer(id) {
  state.coop.players = state.coop.players.filter(p => p.id !== id);
}
function broadcastRoster() {
  coopSend({ type: Coop.MSG.ROSTER, players: state.coop.players });
}
function playerColor(id) { return state.coop.players.find(p => p.id === id)?.color || null; }
function chipTextColor(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#fff';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1a1304' : '#ffffff';
}
function confirmCoopIdentity() {
  const name = (state.coop.nameDraft || '').trim();
  if (!name) return;
  state.settings.coopName = name;
  state.coop.identityConfirmed = true;
}
// Beim Einstieg ins Coop-Menü erscheint das Namens-Gate jedes Mal erneut (man
// kann den Namen also immer ändern), wird aber mit dem zuletzt gespeicherten
// Namen vorbefüllt, damit man ihn im Normalfall nur bestätigen muss.
function goCoop() {
  state.coop.nameDraft = state.settings.coopName;
  state.coop.identityConfirmed = false;
  navigate('coop');
}

// Wird aufgerufen, wenn der Gast die Verbindung zum Host unerwartet verliert
// (Inaktivität, Tab eingeschlafen, Netzwerkausfall) während die Runde noch läuft:
// der Gast übernimmt selbst die Host-Rolle unter demselben Code, damit der
// ursprüngliche Host später wieder beitreten kann.
function promoteToHost() {
  state.coop.role = 'host';
  state.coop.connected = false;
  Coop.leave(); // alte (Gast-)Peer-Verbindung sauber abräumen, bevor der neue Host-Slot belegt wird
  coopIntentionalLeave = false;
  state.coop.myId = 'host';
  state.coop.players = [];
  upsertPlayer('host', state.settings.coopName, state.settings.coopMyColor);
  Coop.hostGame({
    code: state.coop.code,
    onOpen() { showToast('Host getrennt — du bist jetzt Host 📡', 'info', 4000); },
    onError() {
      // Code ist beim Broker evtl. noch kurz reserviert — erneut versuchen.
      setTimeout(() => { if (state.coop.active && state.coop.role === 'host' && !state.coop.connected) promoteToHost(); }, 1500);
    },
    onJoin(conn) {
      state.coop.connected = true;
      Coop.sendToConn(conn, { type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
      showToast('Mitspieler verbunden 👥');
    },
    onLeave(conn) {
      state.coop.connected = false;
      removePlayer(conn.peer);
      broadcastRoster();
      if (!coopIntentionalLeave) showToast('Mitspieler hat getrennt', 'info', 3000);
    },
    onMessage: (d, conn) => handleCoopMsg(d, conn),
  });
}

function startHosting() {
  if (!Coop.isAvailable()) { state.coop.error = 'WebRTC nicht verfügbar.'; return; }
  if (!CODE_RE.test(state.coop.code)) { state.coop.error = 'Bitte 6-stelligen Zahlencode eingeben.'; return; }
  coopIntentionalLeave = false;
  state.coop.role = 'host';
  state.coop.waitingForGuest = true;
  state.coop.error = null;
  state.coop.myId = 'host';
  state.coop.players = [];
  upsertPlayer('host', state.settings.coopName, state.settings.coopMyColor);
  Coop.hostGame({
    code: state.coop.code,
    onOpen() { /* Peer offen, wartet auf Gast */ },
    onError(e) {
      state.coop.waitingForGuest = false;
      state.coop.error = e.type === 'unavailable-id'
        ? 'Code bereits vergeben — wähle eine andere Zahl.' : 'Verbindungsfehler.';
    },
    onJoin(conn) {
      const puzzle = generatePuzzle({ difficulty: state.coop.lobbyDiffId });
      loadPuzzleIntoState(puzzle, null);
      state.coop.active = true;
      state.coop.connected = true;
      state.coop.waitingForGuest = false;
      navigate('game');
      Coop.sendToConn(conn, { type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
      showToast('Mitspieler verbunden 👥');
    },
    onLeave(conn) {
      state.coop.connected = false;
      removePlayer(conn.peer);
      broadcastRoster();
      if (!coopIntentionalLeave) showToast('Mitspieler hat getrennt', 'info', 3000);
    },
    onMessage: (d, conn) => handleCoopMsg(d, conn),
  });
}

function startJoining() {
  if (!CODE_RE.test(state.coop.code)) { state.coop.error = 'Bitte 6-stelligen Zahlencode eingeben.'; return; }
  coopIntentionalLeave = false;
  state.coop.role = 'guest';
  state.coop.waitingForGuest = true;
  state.coop.error = null;
  state.coop.players = [];
  Coop.joinGame({
    code: state.coop.code,
    onOpen(id) {
      // Eigene ID dieser Session sichern und sofort dem Host die eigene Identität
      // melden — coopSend() blockt hier noch (state.coop.connected wird erst beim
      // INIT true), daher direkt über die Transportschicht senden.
      state.coop.myId = id;
      upsertPlayer(id, state.settings.coopName, state.settings.coopMyColor);
      Coop.sendToHost({ type: Coop.MSG.IDENTITY, name: state.settings.coopName, color: state.settings.coopMyColor });
    },
    onError(e) {
      state.coop.waitingForGuest = false;
      state.coop.error =
        e.type === 'peer-unavailable' ? 'Code nicht gefunden.' :
        e.type === 'timeout'          ? 'Zeitüberschreitung.' : 'Verbindungsfehler.';
    },
    onMessage: (d) => handleCoopMsg(d, null),
    onClose() {
      state.coop.connected = false;
      if (coopIntentionalLeave) return;
      if (state.coop.active && state.status === 'playing') {
        showToast('Host getrennt — werde neuer Host …', 'info', 3000);
        promoteToHost();
      } else {
        showToast('Verbindung zum Host getrennt', 'info', 3000);
      }
    },
  });
}

// remote: vom Coop-Partner empfangene, maßgebliche Werte (überschreibt lokal ggf.
// abweichende Zeit/Fehler/Hinweise, damit beide Seiten exakt denselben Endstand zeigen).
// Die Coop-Lobby/Verbindung bleibt nach Rundenende bestehen — sie schließt erst,
// wenn ein Spieler aktiv "Zum Menü" klickt (siehe quitToHome).
function win(remote) {
  if (state.status === 'won') return;
  state.status = 'won';
  stopTimer();
  launchConfetti();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  const { stats, newHighscore } = recordResult({
    difficulty: state.puzzle.difficulty, outcome: 'won',
    timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
    coop: state.coop.active,
  });
  state.stats = stats;
  state.newHighscore = newHighscore;
  saveActiveGame(null);
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'won', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
}

function lose(remote) {
  if (state.status === 'lost') return;
  state.status = 'lost';
  stopTimer();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  const { stats } = recordResult({
    difficulty: state.puzzle.difficulty, outcome: 'lost',
    timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
    coop: state.coop.active,
  });
  state.stats = stats;
  saveActiveGame(null);
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'lost', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
}

function giveUp(remote) {
  if (!remote && state.status !== 'playing') return;
  if (remote && state.status === 'gaveup') return;
  state.status = 'gaveup';
  stopTimer();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  const { stats } = recordResult({
    difficulty: state.puzzle.difficulty, outcome: 'gaveup',
    timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
    coop: state.coop.active,
  });
  state.stats = stats;
  saveActiveGame(null);
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'gaveup', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
}

// Rein lokal: zeigt die Lösung nur auf diesem Gerät an, ohne den Partner zu
// beeinflussen oder den Spielstatus zu verändern (status bleibt 'lost'/'gaveup',
// damit "Zurück" einfach wieder zum Aufgeben-Dialog zurückkehrt).
function revealSolution() {
  const p = state.puzzle;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      state.marks[r][c] = p.solution[r][c] ? 'kept' : 'removed';
  state.solutionShown = true;
}

function restartPuzzle(startTime) {
  state.marks = Array.from({ length: state.puzzle.rows }, () => Array(state.puzzle.cols).fill('none'));
  state.markedBy = Array.from({ length: state.puzzle.rows }, () => Array(state.puzzle.cols).fill(null));
  state.cellMeta = buildCellMeta(state.puzzle); // setzt auch hint/hintMark zurück
  state.lives = LIVES; state.maxLives = LIVES; state.hintsLeft = HINTS;
  state.hintsUsed = 0; state.mistakes = 0; state.history = []; state.flash = {}; state.justResolved = {};
  state.coop.lifeLossBy = []; state.coop.mistakesByPlayer = {};
  state.status = 'playing'; state.solutionShown = false; state.newHighscore = false; state.elapsed = 0;
  state.startTime = startTime ?? Date.now();
  startTimer(); persistGame();
}

// Schließt die Coop-Lobby für BEIDE Spieler — egal wer "Zum Menü" klickt.
function quitToHome() {
  const wasCoop = state.coop.active;
  if (wasCoop) coopSend({ type: Coop.MSG.CLOSE });
  if (state.coop.role) coopReset();
  saveActiveGame(!wasCoop && state.status === 'playing' ? activeSnapshot() : null);
  refreshResume();
  navigate('home');
}

// ─── PERSISTENZ DES LAUFENDEN SPIELS ──────────────────────────────────────────
function collectHintMarks() {
  const out = [];
  for (let r = 0; r < state.cellMeta.length; r++)
    for (let c = 0; c < state.cellMeta[r].length; c++)
      if (state.cellMeta[r][c].hintMark) out.push([r, c]);
  return out;
}
function activeSnapshot() {
  return {
    puzzle: state.puzzle, marks: state.marks, lives: state.lives, maxLives: state.maxLives,
    hintsLeft: state.hintsLeft, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
    elapsed: state.elapsed, difficulty: state.puzzle.difficulty,
    hintMarks: collectHintMarks(),
    ts: Date.now(),
  };
}
function persistGame() {
  if (state.status !== 'playing') { saveActiveGame(null); return; }
  const now = Date.now();
  if (now - saveThrottle < 400) return;
  saveThrottle = now;
  saveActiveGame(activeSnapshot());
}
function refreshResume() {
  const g = loadActiveGame();
  state.resumeAvailable = (g && g.puzzle) ? g : null;
}
function resumeGame() {
  const g = state.resumeAvailable;
  if (!g) return;
  navigate('game');
  loadPuzzleIntoState(g.puzzle, g);
  startTimer();
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = REGION_COLORS.map(c => `hsl(${c.h} ${c.s}% ${c.l}%)`);
  const pieces = [];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      id: i, left: Math.random() * 100,
      delay: Math.random() * 0.5, dur: 1.6 + Math.random() * 1.4,
      color: colors[i % colors.length], rot: Math.random() * 360,
      size: 6 + Math.random() * 8,
    });
  }
  state.confetti = pieces;
  setTimeout(() => { state.confetti = []; }, 3500);
}

// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────
function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  if (key === 'darkMode') applyTheme();
}
function setSetting(key, val) { state.settings[key] = val; }
watch(() => state.settings, (s) => saveSettings(s), { deep: true });

// ─── DATEN: EXPORT / IMPORT / BACKUPS ─────────────────────────────────────────
function doExport() { exportToFile('manual').then(() => showToast('Backup exportiert', 'success')).catch(() => {}); }
function doImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importFromFile(reader.result);
      state.settings = loadSettings(); state.stats = loadStats(); applyTheme(); refreshResume();
      showToast('Import erfolgreich', 'success');
    } catch { showToast('Import fehlgeschlagen', 'error'); }
  };
  reader.readAsText(file);
  ev.target.value = '';
}
function openBackups() { state.modal = 'backups'; }
function doRestore(slot) {
  if (restoreBackup(slot)) {
    state.settings = loadSettings(); state.stats = loadStats(); applyTheme(); refreshResume();
    state.modal = null; showToast('Backup wiederhergestellt', 'success');
  }
}
function resetStats() {
  ask('Statistik zurücksetzen?', 'Alle Erfolge und Bestzeiten werden gelöscht.', () => {
    localStorage.removeItem('cns_stats'); state.stats = loadStats(); showToast('Statistik gelöscht', 'success');
  });
}

function ask(title, msg, onYes) { state.confirm = { title, msg, onYes }; state.modal = 'confirm'; }
function confirmYes() { const f = state.confirm?.onYes; state.modal = null; state.confirm = null; if (f) f(); }
function confirmNo() { state.modal = null; state.confirm = null; }

// ─── WAS IST NEU ──────────────────────────────────────────────────────────────
function maybeShowWhatsNew() {
  const seen = loadSeenVersion();
  if (seen !== BUILD && CHANGELOG.length) { state.showWhatsNew = true; }
}
function dismissWhatsNew() { state.showWhatsNew = false; saveSeenVersion(BUILD); }

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  applyTheme();
  refreshResume();
  maybeShowWhatsNew();
  window.addEventListener('resize', computeCellSize);
}

// ════════════════════════════════════════════════════════════════════════════
//  KOMPONENTE / TEMPLATE
// ════════════════════════════════════════════════════════════════════════════
const App = {
  setup() {
    const winStat = computed(() => {
      const p = state.stats.played || 0, w = state.stats.won || 0;
      return p ? Math.round((w / p) * 100) : 0;
    });
    const livesArr = computed(() => Array.from({ length: state.maxLives }, (_, i) => i < state.lives));
    // Welcher Spieler hat das Herz an Index i verbraucht? Herzen werden von links
    // gefüllt angezeigt, verbraucht wird aber immer von rechts (höchster Index
    // zuerst) — daher die Umrechnung über die Verlust-Reihenfolge.
    function lifeLossColor(i) {
      const lossNr = state.maxLives - i; // 1-basiert: 1. verlorenes Herz, 2., ...
      const by = state.coop.lifeLossBy[lossNr - 1];
      return by ? playerColor(by) : null;
    }
    const coopPerformance = computed(() => {
      if (!state.coop.active || !state.puzzle || !state.coop.players.length) return [];
      const p = state.puzzle;
      const raw = state.coop.players.map(pl => {
        let correctKept = 0, correctRemoved = 0;
        for (let r = 0; r < p.rows; r++)
          for (let c = 0; c < p.cols; c++) {
            if (state.markedBy[r][c] !== pl.id) continue;
            if (state.marks[r][c] === 'kept' && p.solution[r][c]) correctKept++;
            else if (state.marks[r][c] === 'removed' && !p.solution[r][c]) correctRemoved++;
          }
        const mistakes = state.coop.mistakesByPlayer[pl.id] || 0;
        return { id: pl.id, name: pl.name, color: pl.color, correctKept, correctRemoved, mistakes, correct: correctKept + correctRemoved };
      });
      const totalCorrect = raw.reduce((s, pl) => s + pl.correct, 0);
      return raw.map(pl => ({
        ...pl,
        contributionPct: totalCorrect > 0 ? Math.round((pl.correct / totalCorrect) * 100) : Math.round(100 / raw.length),
        accuracyPct: (pl.correct + pl.mistakes) > 0 ? Math.round((pl.correct / (pl.correct + pl.mistakes)) * 100) : 100,
      })).sort((a, b) => b.contributionPct - a.contributionPct || b.accuracyPct - a.accuracyPct);
    });
    // Kein MVP, wenn nur einer mitspielt oder alle exakt gleich gut beigetragen haben.
    const mvpId = computed(() => {
      const list = coopPerformance.value;
      if (list.length < 2) return null;
      const best = list[0];
      if (list.every(pl => pl.contributionPct === best.contributionPct && pl.accuracyPct === best.accuracyPct)) return null;
      return best.id;
    });
    const progress = computed(() => {
      if (!state.puzzle) return { kept: 0, total: 0 };
      let kept = 0, total = 0;
      const p = state.puzzle;
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        if (p.solution[r][c]) { total++; if (state.marks[r][c] === 'kept') kept++; }
      }
      return { kept, total };
    });
    const gridStyle = computed(() => ({
      gridTemplateColumns: `var(--hdr) repeat(${state.puzzle?.cols || 1}, var(--cell))`,
      gridTemplateRows: `var(--hdr) repeat(${state.puzzle?.rows || 1}, var(--cell))`,
      '--cell': state.cellPx + 'px',
      '--hdr': state.cellPx + 'px',
      '--fs': Math.max(11, Math.round(state.cellPx * 0.4)) + 'px',
    }));
    onMounted(init);
    const coopAvailable = computed(() => Coop.isAvailable());

    return {
      state, BUILD, CHANGELOG, DIFFICULTIES, DIFF_BY_ID, COOP_COLORS,
      winStat, livesArr, lifeLossColor, coopPerformance, mvpId, progress, gridStyle, coopAvailable,
      navigate, newGame, resumeGame, onCellTap, undo, useHint, doCheck,
      rowSum, colSum, regionSum, rowResolved, colResolved, regionResolved, rowSumMatch, colSumMatch,
      fmtTime, toggleSetting, setSetting, doExport, doImport, openBackups, doRestore,
      resetStats, ask, confirmYes, confirmNo, dismissWhatsNew, loadBackups,
      revealSolution, restartPuzzle, quitToHome, setZoom, pauseGame, resumeFromPause,
      onPinchStart, onPinchMove, onPinchEnd,
      cellClasses, cellStyle, toggleTool, restartFromGame,
      startHosting, startJoining, coopReset, avgTimeFor, coopAvgTimeFor, giveUp,
      chipTextColor, confirmCoopIdentity, playerColor, goCoop,
    };
  },
  template: `
  <div class="app" :class="{ generating: state.generating }">

    <!-- ══ HOME ══ -->
    <section v-if="state.screen==='home'" class="screen home">
      <div class="brand">
        <img class="brand-logo" src="./icons/icon-192.png" alt="" />
        <h1 class="brand-title">Coop<br>Number Sums</h1>
      </div>

      <div class="home-actions">
        <button v-if="state.resumeAvailable" class="btn btn-resume" @click="resumeGame">
          <span class="btn-ic">▶</span>
          <span class="btn-tx"><b>Fortsetzen</b>
            <small>{{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.name }} · {{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.dim.r }}×{{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.dim.c }} · {{ fmtTime(state.resumeAvailable.elapsed||0) }}</small>
          </span>
        </button>
        <button class="btn btn-primary" @click="navigate('setup')">
          <span class="btn-ic">➕</span><span class="btn-tx"><b>Neues Spiel</b><small>Schwierigkeit wählen</small></span>
        </button>
        <button class="btn btn-coop" :disabled="!coopAvailable" @click="goCoop">
          <span class="btn-ic">👥</span><span class="btn-tx"><b>Coop-Modus</b><small>Gemeinsam lösen</small></span>
          <span v-if="!coopAvailable" class="badge-soon">bald</span>
        </button>
        <div class="home-grid">
          <button class="btn btn-ghost" @click="navigate('stats')"><span class="btn-ic">📊</span> Statistik</button>
          <button class="btn btn-ghost" @click="navigate('settings')"><span class="btn-ic">⚙️</span> Einstellungen</button>
          <button class="btn btn-ghost" @click="state.modal='howto'"><span class="btn-ic">❓</span> Anleitung</button>
          <button class="btn btn-ghost" @click="state.modal='changelog'"><span class="btn-ic">📝</span> Änderungen</button>
        </div>
      </div>
      <div class="home-version">v{{ BUILD }}</div>
    </section>

    <!-- ══ SETUP ══ -->
    <section v-else-if="state.screen==='setup'" class="screen setup">
      <header class="topbar">
        <button class="icon-btn" @click="navigate('home')">‹</button>
        <h2>Neues Spiel</h2><span></span>
      </header>
      <div class="setup-body">
        <div class="setup-label">Schwierigkeit</div>
        <div class="option-grid">
          <button v-for="d in DIFFICULTIES" :key="d.id" class="opt-card" :class="{active: state.sel.difficulty===d.id}" @click="state.sel.difficulty=d.id">
            <span class="opt-emoji">{{ d.emoji }}</span>
            <span class="opt-name">{{ d.name }}</span>
            <span class="opt-desc">{{ d.dim.r }}×{{ d.dim.c }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.bestTimeMs!=null" class="opt-best">🏆 {{ fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="opt-best">👥🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
          </button>
        </div>
        <button class="btn btn-primary btn-start" @click="newGame(state.sel.difficulty)">
          Los geht's! 🚀
        </button>
      </div>
    </section>

    <!-- ══ GAME ══ -->
    <section v-else-if="state.screen==='game'" class="screen game">
      <header class="topbar game-top">
        <button class="icon-btn" @click="quitToHome">‹</button>
        <div class="hud">
          <div class="hud-item lives" v-if="state.settings.livesEnabled">
            <span v-for="(full,i) in livesArr" :key="i" class="heart" :class="{empty:!full}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <i v-if="!full && state.coop.active && lifeLossColor(i)" class="heart-strike" :style="{background: lifeLossColor(i)}"></i>
            </span>
          </div>
          <div class="hud-item timer" v-if="state.settings.showTimer">⏱ {{ fmtTime(state.elapsed) }}</div>
        </div>
        <div class="top-actions">
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing'" @click="pauseGame" title="Pause">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg>
          </button>
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing'" @click="ask('Aufgeben?', 'Das Rätsel wird als aufgegeben gewertet.', giveUp)" title="Aufgeben">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="5" y="3" width="2.4" height="18" rx="1.2"/><path d="M7.4 4h12.1l-3 3.6 3 3.6H7.4z"/></svg>
          </button>
          <button class="icon-btn" @click="state.modal='howto'">?</button>
        </div>
      </header>

      <div v-if="state.generating" class="loading">
        <div class="spinner"></div>
        <div class="loading-tx">Rätsel wird erstellt…</div>
      </div>

      <template v-else-if="state.puzzle">
        <div class="game-meta">
          <span class="chip">{{ DIFF_BY_ID[state.puzzle.difficulty].emoji }} {{ DIFF_BY_ID[state.puzzle.difficulty].name }}</span>
          <span class="chip">{{ state.puzzle.rows }}×{{ state.puzzle.cols }}</span>
          <span v-if="state.coop.active" class="chip coop-chip" :class="state.coop.connected ? 'coop-on' : 'coop-off'">
            👥 COOP{{ state.coop.connected ? '' : ' · offline' }}
          </span>
          <span class="zoomctl">
            <button class="zoom-btn" @click="setZoom(-0.15)">−</button>
            <button class="zoom-btn" @click="setZoom(0.15)">+</button>
          </span>
        </div>

        <div v-if="state.coop.active && state.coop.players.length" class="coop-roster">
          <span v-for="p in state.coop.players" :key="p.id" class="player-chip"
                :style="{ background: p.color, color: chipTextColor(p.color) }">
            {{ p.name }}<template v-if="p.id===state.coop.myId"> (Du)</template>
          </span>
        </div>

        <div class="board-wrap" :class="{ blurred: state.paused }"
             @touchstart="onPinchStart" @touchmove="onPinchMove" @touchend="onPinchEnd" @touchcancel="onPinchEnd">
          <div class="board" :style="gridStyle">
            <div class="corner"></div>
            <div v-for="c in state.puzzle.cols" :key="'ch'+c" class="hdr col-hdr" :class="{resolved: colResolved(c-1), pulse: state.justResolved['col-'+(c-1)]}">
              <template v-if="!colResolved(c-1)">
                <span class="cur" :class="{match: colSumMatch(c-1)}">{{ colSum(c-1) }}</span>
                <span class="tgt">{{ state.puzzle.colTargets[c-1] }}</span>
              </template>
            </div>
            <template v-for="r in state.puzzle.rows" :key="'r'+r">
              <div class="hdr row-hdr" :class="{resolved: rowResolved(r-1), pulse: state.justResolved['row-'+(r-1)]}">
                <template v-if="!rowResolved(r-1)">
                  <span class="cur" :class="{match: rowSumMatch(r-1)}">{{ rowSum(r-1) }}</span>
                  <span class="tgt">{{ state.puzzle.rowTargets[r-1] }}</span>
                </template>
              </div>
              <div v-for="c in state.puzzle.cols" :key="r+'-'+c"
                   class="cell" :class="cellClasses(r-1,c-1)" :style="cellStyle(r-1,c-1)"
                   @click="onCellTap(r-1,c-1)">
                <span v-if="state.cellMeta[r-1][c-1].chip!=null && !regionResolved(state.cellMeta[r-1][c-1].region)" class="rchip">{{ state.cellMeta[r-1][c-1].chip }}</span>
                <span class="cnum">{{ state.puzzle.values[r-1][c-1] }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Werkzeug-Umschalter (Radierer / Stift) -->
        <div class="toolbar">
          <button class="round-btn" :disabled="!state.history.length" @click="undo" title="Rückgängig" aria-label="Rückgängig">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-4"/></svg>
          </button>
          <div class="tool-toggle" @click="toggleTool">
            <div class="tool-pill" :class="{ pen: state.tool==='pen' }"></div>
            <span class="tool-ic eraser" :class="{active: state.tool==='eraser'}" title="Löschen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 20H20"/><path d="m3.6 14.5 5.9 5.9 9.4-9.4a2 2 0 0 0 0-2.8l-3.1-3.1a2 2 0 0 0-2.8 0L3.6 11.7a2 2 0 0 0 0 2.8z"/><path d="m9 8.5 6.5 6.5"/></svg>
            </span>
            <span class="tool-ic pen" :class="{active: state.tool==='pen'}" title="Einkreisen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="11" cy="13" rx="8" ry="7"/><path d="m16.5 7.5 3.2-3.2a1.6 1.6 0 0 1 2.3 2.3l-3.2 3.2-2.3-2.3z"/></svg>
            </span>
          </div>
          <button class="round-btn" :disabled="state.hintsLeft<=0" @click="useHint" title="Hinweis" aria-label="Hinweis">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.8.7 1.2 1.3 1.3 2.4h5.4c.1-1.1.5-1.7 1.3-2.4A6.5 6.5 0 0 0 12 2.5z"/></svg>
          </button>
        </div>
        <div v-if="state.settings.errorReveal==='onCheck'" class="check-row">
          <button class="btn btn-primary btn-check" @click="doCheck()">✓ Prüfen</button>
        </div>
      </template>

      <!-- Pause -->
      <div v-if="state.paused" class="overlay pause-overlay">
        <div class="result-card">
          <div class="result-emoji">⏸️</div>
          <h2>Pausiert</h2>
          <div class="pause-time">⏱ {{ fmtTime(state.elapsed) }}</div>
          <p class="result-msg">Das Feld ist verdeckt – die Zeit läuft nicht weiter.</p>
          <button class="btn btn-primary" @click="resumeFromPause">Fortsetzen</button>
          <button class="btn btn-ghost" @click="quitToHome">Zum Menü</button>
        </div>
      </div>

      <!-- Gewonnen / Verloren -->
      <div v-if="state.status==='won'" class="overlay">
        <div class="result-card win">
          <div class="result-emoji">🎉</div>
          <h2>Gelöst!</h2>
          <div v-if="state.newHighscore" class="highscore-badge">🏆 Neue Bestzeit!</div>
          <div class="result-stats">
            <div><b>{{ fmtTime(state.elapsed) }}</b><small>Zeit</small></div>
            <div><b>{{ state.mistakes }}</b><small>Fehler</small></div>
            <div><b>{{ state.hintsUsed }}</b><small>Hinweise</small></div>
          </div>
          <div v-if="coopPerformance.length" class="coop-performance">
            <div class="perf-title">👥 Team-Performance</div>
            <div v-for="pl in coopPerformance" :key="pl.id" class="perf-row" :class="{mvp: pl.id===mvpId}">
              <div class="perf-head">
                <span class="perf-name" :style="{color: pl.color}">{{ pl.name }}<template v-if="pl.id===mvpId"> 🏆 MVP</template></span>
                <span class="perf-pct">{{ pl.contributionPct }}%</span>
              </div>
              <div class="perf-bar"><div class="perf-bar-fill" :style="{width: pl.contributionPct + '%', background: pl.color}"></div></div>
              <div class="perf-nums">
                <span>⭕ {{ pl.correctKept }} richtig eingekreist</span>
                <span>🗑️ {{ pl.correctRemoved }} richtig gelöscht</span>
                <span>❌ {{ pl.mistakes }} Fehler</span>
              </div>
            </div>
          </div>
          <button class="btn btn-primary" v-if="!state.coop.active || state.coop.role==='host'" @click="newGame(state.puzzle.difficulty)">Nächstes Rätsel</button>
          <p v-else class="result-msg">Warte auf den Host für die nächste Runde …</p>
          <button class="btn btn-ghost" @click="quitToHome">Zum Menü</button>
        </div>
      </div>
      <div v-if="state.status==='lost' && !state.solutionShown" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">💔</div>
          <h2>Keine Leben mehr</h2>
          <p class="result-msg">Kein Problem – versuch es erneut!</p>
          <div v-if="coopPerformance.length" class="coop-performance">
            <div class="perf-title">👥 Team-Performance</div>
            <div v-for="pl in coopPerformance" :key="pl.id" class="perf-row" :class="{mvp: pl.id===mvpId}">
              <div class="perf-head">
                <span class="perf-name" :style="{color: pl.color}">{{ pl.name }}<template v-if="pl.id===mvpId"> 🏆 MVP</template></span>
                <span class="perf-pct">{{ pl.contributionPct }}%</span>
              </div>
              <div class="perf-bar"><div class="perf-bar-fill" :style="{width: pl.contributionPct + '%', background: pl.color}"></div></div>
              <div class="perf-nums">
                <span>⭕ {{ pl.correctKept }} richtig eingekreist</span>
                <span>🗑️ {{ pl.correctRemoved }} richtig gelöscht</span>
                <span>❌ {{ pl.mistakes }} Fehler</span>
              </div>
            </div>
          </div>
          <button class="btn btn-primary" @click="restartFromGame">Nochmal versuchen</button>
          <button class="btn btn-ghost" v-if="!state.coop.active || state.coop.role==='host'" @click="navigate('setup')">Neues Spiel</button>
          <button class="btn btn-ghost" @click="revealSolution">Lösung zeigen</button>
          <button class="btn btn-ghost" @click="quitToHome">Zum Menü</button>
        </div>
      </div>
      <div v-if="state.status==='gaveup' && !state.solutionShown" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">🏳</div>
          <h2>Aufgegeben</h2>
          <p class="result-msg">Kein Problem – versuch es erneut!</p>
          <button class="btn btn-primary" @click="restartFromGame">Nochmal versuchen</button>
          <button class="btn btn-ghost" v-if="!state.coop.active || state.coop.role==='host'" @click="navigate('setup')">Neues Spiel</button>
          <button class="btn btn-ghost" @click="revealSolution">Lösung zeigen</button>
          <button class="btn btn-ghost" @click="quitToHome">Zum Menü</button>
        </div>
      </div>
      <!-- Lösungsanzeige ist rein lokal (Punkt 4): "Zurück" bringt nur diesen
           Spieler zum Aufgeben-Dialog zurück, ohne den Partner zu beeinflussen. -->
      <div v-if="state.solutionShown" class="review-bar">
        <span>Lösung</span>
        <button class="btn btn-primary btn-sm" @click="state.solutionShown=false">Zurück</button>
      </div>

      <!-- Confetti -->
      <div v-if="state.confetti.length" class="confetti">
        <i v-for="p in state.confetti" :key="p.id" :style="{left:p.left+'%', background:p.color, animationDelay:p.delay+'s', animationDuration:p.dur+'s', width:p.size+'px', height:p.size+'px', transform:'rotate('+p.rot+'deg)'}"></i>
      </div>
    </section>

    <!-- ══ STATS ══ -->
    <section v-else-if="state.screen==='stats'" class="screen stats">
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>Statistik</h2><span></span></header>
      <div class="stats-body">
        <div class="stat-grid">
          <div class="stat-box"><b>{{ state.stats.played }}</b><small>Gespielt</small></div>
          <div class="stat-box"><b>{{ state.stats.won }}</b><small>Gewonnen</small></div>
          <div class="stat-box"><b>{{ winStat }}%</b><small>Quote</small></div>
          <div class="stat-box"><b>{{ state.stats.currentStreak }}</b><small>Serie</small></div>
          <div class="stat-box"><b>{{ state.stats.bestStreak }}</b><small>Beste Serie</small></div>
          <div class="stat-box"><b>{{ state.stats.hintsUsed }}</b><small>Hinweise</small></div>
        </div>
        <div class="stats-section-title">Nach Schwierigkeit</div>
        <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
          <div class="diff-row-top">
            <span class="diff-name">{{ d.emoji }} {{ d.name }}</span>
            <span class="diff-num">{{ (state.stats.byDifficulty[d.id]?.won)||0 }} / {{ (state.stats.byDifficulty[d.id]?.played)||0 }}</span>
          </div>
          <div class="diff-row-sub">
            <span v-if="state.stats.byDifficulty[d.id]?.bestTimeMs!=null" class="chip best-time-chip">🏆 {{ fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) }}</span>
            <span v-if="avgTimeFor(d.id)!=null" class="chip">⌀ {{ fmtTime(avgTimeFor(d.id)) }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="chip best-time-chip">👥🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
            <span v-if="coopAvgTimeFor(d.id)!=null" class="chip">👥⌀ {{ fmtTime(coopAvgTimeFor(d.id)) }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.gaveup" class="chip">🏳 {{ state.stats.byDifficulty[d.id].gaveup }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.lost" class="chip">💔 {{ state.stats.byDifficulty[d.id].lost }}</span>
          </div>
        </div>
        <button class="btn btn-danger-ghost" @click="resetStats">Statistik zurücksetzen</button>
      </div>
    </section>

    <!-- ══ COOP ══ -->
    <section v-else-if="state.screen==='coop'" class="screen coop-screen">
      <header class="topbar">
        <button class="icon-btn" @click="coopReset(); navigate('home')">‹</button>
        <h2>Coop-Modus</h2><span></span>
      </header>

      <!-- Namens-Gate: bevor irgendetwas anderes möglich ist, Name + eigene Farbe festlegen
           (jedes Mal erneut, aber mit dem zuletzt gespeicherten Namen vorbefüllt) -->
      <div v-if="!state.coop.identityConfirmed" class="coop-body">
        <p class="coop-tagline">Wie sollen dich die anderen Spieler sehen?</p>
        <input class="text-input" v-model="state.coop.nameDraft" maxlength="16" placeholder="Dein Name"
               @keydown.enter="confirmCoopIdentity" />
        <div class="setup-label">Deine Farbe</div>
        <div class="coop-swatches">
          <button v-for="c in COOP_COLORS" :key="c.hex" class="swatch"
                  :class="{active: state.settings.coopMyColor===c.hex}"
                  :style="{background:c.hex}"
                  @click="setSetting('coopMyColor', c.hex)" :title="c.name"></button>
          <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" title="Eigene Farbe wählen" />
        </div>
        <button class="btn btn-primary" :disabled="!state.coop.nameDraft.trim()" @click="confirmCoopIdentity">Weiter</button>
      </div>

      <!-- Auswahl: Hosten oder Beitreten? -->
      <div v-else-if="state.coop.role === null" class="coop-body">
        <p class="coop-tagline">Löst ein Rätsel gemeinsam in Echtzeit!</p>
        <button class="btn btn-primary" @click="state.coop.role='host'">
          <span class="btn-ic">📡</span>
          <span class="btn-tx"><b>Hosten</b><small>Code festlegen &amp; Rätsel erstellen</small></span>
        </button>
        <button class="btn btn-ghost" @click="state.coop.role='guest'">
          <span class="btn-ic">🔗</span>
          <span class="btn-tx"><b>Beitreten</b><small>Code des Hosts eingeben</small></span>
        </button>
      </div>

      <!-- Host: Code festlegen + Schwierigkeit → warte auf Gast -->
      <div v-else-if="state.coop.role === 'host'" class="coop-body">
        <template v-if="!state.coop.waitingForGuest">
          <div class="coop-code-label">Code festlegen (6 Ziffern)</div>
          <input class="coop-input" v-model="state.coop.code" maxlength="6" inputmode="numeric" pattern="[0-9]*"
                 placeholder="z.B. 482917" @input="state.coop.code=state.coop.code.replace(/\D/g,'')" />
          <div class="setup-label">Schwierigkeit</div>
          <div class="option-grid">
            <button v-for="d in DIFFICULTIES" :key="d.id" class="opt-card"
                    :class="{active: state.coop.lobbyDiffId===d.id}"
                    @click="state.coop.lobbyDiffId=d.id">
              <span class="opt-emoji">{{ d.emoji }}</span>
              <span class="opt-name">{{ d.name }}</span>
              <span class="opt-desc">{{ d.dim.r }}×{{ d.dim.c }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="opt-best">👥🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
            </button>
          </div>
          <button class="btn btn-primary" @click="startHosting">Hosten 🚀</button>
        </template>
        <template v-else>
          <div class="coop-code-label">Dein Code</div>
          <div class="coop-code">{{ state.coop.code }}</div>
          <p class="coop-subtext">Gib diesen Code deinem Mitspieler</p>
          <div class="coop-waiting">
            <div class="spinner"></div>
            <div class="loading-tx">Auf Mitspieler warten…</div>
          </div>
        </template>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:8px" @click="coopReset(); state.coop.role=null">Abbrechen</button>
      </div>

      <!-- Gast: Code eingeben → verbinden -->
      <div v-else-if="state.coop.role === 'guest'" class="coop-body">
        <div class="coop-code-label">Code des Hosts eingeben</div>
        <input class="coop-input" v-model="state.coop.code" maxlength="6" inputmode="numeric" pattern="[0-9]*"
               placeholder="z.B. 482917" :disabled="state.coop.waitingForGuest"
               @input="state.coop.code=state.coop.code.replace(/\D/g,'')"
               @keydown.enter="startJoining" />
        <button class="btn btn-primary" :disabled="state.coop.waitingForGuest || state.coop.code.length!==6" @click="startJoining">
          <span v-if="state.coop.waitingForGuest"><span class="spinner-inline"></span> Verbinden…</span>
          <span v-else>Verbinden ↗</span>
        </button>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:4px" @click="coopReset(); state.coop.role=null">Zurück</button>
      </div>
    </section>

    <!-- ══ SETTINGS ══ -->
    <section v-else-if="state.screen==='settings'" class="screen settings">
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>Einstellungen</h2><span></span></header>
      <div class="settings-body">
        <div class="set-group-title">Darstellung</div>
        <div class="set-row" @click="toggleSetting('darkMode')">
          <span>🌙 Dunkelmodus</span><span class="switch" :class="{on:state.settings.darkMode}"><i></i></span>
        </div>

        <div class="set-group-title">Spielhilfe</div>
        <div class="set-row col">
          <span class="set-row-label">⚠️ Fehleraufdeckung</span>
          <div class="seg">
            <button :class="{active:state.settings.errorReveal==='instant'}" @click="setSetting('errorReveal','instant')">Sofort</button>
            <button :class="{active:state.settings.errorReveal==='onCheck'}" @click="setSetting('errorReveal','onCheck')">Beim Prüfen</button>
          </div>
          <small class="set-hint">{{ state.settings.errorReveal==='instant' ? 'Falsche Einkreisung wird sofort rot markiert.' : 'Fehler erst beim Tippen auf „Prüfen“.' }}</small>
        </div>
        <div class="set-row col">
          <span class="set-row-label">🧹 Gelöschte Zahlen</span>
          <div class="seg">
            <button :class="{active:state.settings.eraseStyle==='hide'}" @click="setSetting('eraseStyle','hide')">Verschwinden</button>
            <button :class="{active:state.settings.eraseStyle==='strike'}" @click="setSetting('eraseStyle','strike')">Durchstreichen</button>
          </div>
        </div>
        <div class="set-row" @click="toggleSetting('livesEnabled')">
          <span>❤️ Leben / Fehler-Limit</span><span class="switch" :class="{on:state.settings.livesEnabled}"><i></i></span>
        </div>

        <div class="set-group-title">Sonstiges</div>
        <div class="set-row" @click="toggleSetting('showTimer')">
          <span>⏱ Timer anzeigen</span><span class="switch" :class="{on:state.settings.showTimer}"><i></i></span>
        </div>

        <div class="set-group-title">Coop-Identität</div>
        <div class="set-row col">
          <span class="set-row-label">Anzeigename</span>
          <input class="text-input" v-model="state.settings.coopName" maxlength="16" placeholder="Dein Name" />
        </div>
        <div class="set-row col">
          <span class="set-row-label">Meine Farbe</span>
          <div class="coop-swatches">
            <button v-for="c in COOP_COLORS" :key="c.hex" class="swatch"
                    :class="{active: state.settings.coopMyColor===c.hex}"
                    :style="{background:c.hex}"
                    @click="setSetting('coopMyColor', c.hex)" :title="c.name"></button>
            <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" title="Eigene Farbe wählen" />
          </div>
          <small class="set-hint">Andere Mitspieler bekommen automatisch eine eigene, eindeutige Farbe zugewiesen.</small>
        </div>

        <div class="set-group-title">Daten</div>
        <button class="btn btn-ghost" @click="doExport">⬆️ Backup exportieren</button>
        <label class="btn btn-ghost file-btn">⬇️ Backup importieren
          <input type="file" accept="application/json" @change="doImport" hidden>
        </label>
        <button class="btn btn-ghost" @click="openBackups">🗂 Auto-Backups</button>
      </div>
    </section>

    <!-- ══ TOAST ══ -->
    <transition name="toast">
      <div v-if="state.toast" class="toast" :class="state.toast.type">{{ state.toast.msg }}</div>
    </transition>

    <!-- ══ MODALS ══ -->
    <div v-if="state.modal==='howto'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>So wird gespielt</h3>
        <ol class="rules">
          <li>Jede <b>Zahl neben einer Reihe</b> (links) und <b>über einer Spalte</b> (oben) ist die <b>Zielsumme</b>.</li>
          <li>Kreise mit dem <b>Stift</b> <span class="rule-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="11" cy="13" rx="8" ry="7"/><path d="m16.5 7.5 3.2-3.2a1.6 1.6 0 0 1 2.3 2.3l-3.2 3.2-2.3-2.3z"/></svg></span> genau die Zahlen ein, die zusammen die Zielsumme ergeben.</li>
          <li>Überflüssige Zahlen mit dem <b>Radierer</b> <span class="rule-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 20H20"/><path d="m3.6 14.5 5.9 5.9 9.4-9.4a2 2 0 0 0 0-2.8l-3.1-3.1a2 2 0 0 0-2.8 0L3.6 11.7a2 2 0 0 0 0 2.8z"/><path d="m9 8.5 6.5 6.5"/></svg></span> durchstreichen.</li>
          <li>Auch jede <b>farbige Region</b> hat eine eigene Zielsumme (Zahl in der Ecke).</li>
          <li>Kreise nur ein, wo du dir <b>sicher</b> bist – jedes Rätsel ist <b>ohne Raten</b> lösbar.</li>
          <li>Gelöst, wenn alle Summen stimmen. Im Leben-Modus kostet jeder Fehler ein ❤.</li>
          <li v-if="state.coop.active">Im Coop teilt ihr euch die ❤ — ein verbrauchtes Herz wird in der Farbe des Spielers durchgestrichen, der den Fehler gemacht hat.</li>
        </ol>
        <button class="btn btn-primary" @click="state.modal=null">Verstanden</button>
      </div>
    </div>

    <div v-if="state.modal==='changelog'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>Änderungen</h3>
        <div class="changelog">
          <div v-for="e in CHANGELOG" :key="e.version" class="cl-entry">
            <div class="cl-head"><b>v{{ e.version }}</b><span>{{ e.date }}</span></div>
            <ul><li v-for="(it,i) in e.changes" :key="i">✦ {{ it }}</li></ul>
          </div>
        </div>
        <button class="btn btn-primary" @click="state.modal=null">Schließen</button>
      </div>
    </div>

    <div v-if="state.modal==='backups'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>Auto-Backups</h3>
        <div v-if="!loadBackups().length" class="empty">Noch keine Backups vorhanden.</div>
        <div v-for="b in loadBackups()" :key="b.slot" class="backup-row">
          <span>{{ new Date(b.ts).toLocaleString('de-DE') }}<small> · {{ b.label }}</small></span>
          <button class="btn btn-sm btn-primary" @click="doRestore(b.slot)">Laden</button>
        </div>
        <button class="btn btn-ghost" @click="state.modal=null">Schließen</button>
      </div>
    </div>

    <div v-if="state.modal==='confirm'" class="modal-bg" @click.self="confirmNo">
      <div class="modal modal-sm">
        <h3>{{ state.confirm?.title }}</h3>
        <p class="confirm-msg">{{ state.confirm?.msg }}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" @click="confirmNo">Abbrechen</button>
          <button class="btn btn-danger" @click="confirmYes">Ja</button>
        </div>
      </div>
    </div>

    <div v-if="state.showWhatsNew" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge">✨ Neu</div>
        <h3>Version {{ CHANGELOG[0]?.version }}</h3>
        <ul class="whatsnew"><li v-for="(it,i) in CHANGELOG[0]?.changes" :key="i">✦ {{ it }}</li></ul>
        <button class="btn btn-primary" @click="dismissWhatsNew">Los geht's</button>
      </div>
    </div>
  </div>
  `,
};

// Methoden, die das Template über setup() referenziert
function toggleTool() { state.tool = state.tool === 'pen' ? 'eraser' : 'pen'; state.settings.confirmTool = state.tool; }
function restartFromGame(broadcast = true) {
  restartPuzzle();
  if (broadcast && state.coop.active) coopSend({ type: Coop.MSG.RETRY, startTime: state.startTime });
}

// Liefert, welche Seiten dieser Zelle zum ÄUSSEREN Rand einer gerade fertig
// gewordenen Reihe/Spalte/Cage gehören (für den Fertig-Puls, Punkt 3: nur die
// äußersten Ränder der ganzen Struktur leuchten, keine Querstriche dazwischen).
function pulseEdges(r, c) {
  const p = state.puzzle;
  let t = false, b = false, l = false, rr = false;
  if (state.justResolved[`row-${r}`]) { t = true; b = true; if (c === 0) l = true; if (c === p.cols - 1) rr = true; }
  if (state.justResolved[`col-${c}`]) { l = true; rr = true; if (r === 0) t = true; if (r === p.rows - 1) b = true; }
  const region = state.cellMeta[r][c].region;
  if (region >= 0 && state.justResolved[`region-${region}`]) {
    const e = state.cellMeta[r][c].edges;
    if (e.t) t = true; if (e.b) b = true; if (e.l) l = true; if (e.r) rr = true;
  }
  return { t, b, l, r: rr };
}

function cellClasses(r, c) {
  const m = state.cellMeta[r][c];
  const mk = state.marks[r][c];
  // Cage-Färbung nur solange die Cage NICHT aufgelöst ist (dann verschwindet sie).
  const colored = m.region >= 0 && !regionResolved(m.region);
  const pe = pulseEdges(r, c);
  return {
    kept: mk === 'kept', removed: mk === 'removed',
    region: colored,
    flash: !!state.flash[`${r}-${c}`],
    hinted: m.hint,
    hintmark: m.hintMark,
    'pulse-edge': pe.t || pe.b || pe.l || pe.r,
    strike: mk === 'removed' && state.settings.eraseStyle === 'strike',
    solnc: state.solutionShown && state.puzzle.solution[r][c],
    'coop-mark': state.coop.active && !!state.markedBy[r][c],
  };
}
function cellStyle(r, c) {
  const m = state.cellMeta[r][c];
  const st = { fontSize: 'var(--fs)' };
  if (m.color) { st['--rc-h'] = m.color.h; st['--rc-s'] = m.color.s + '%'; st['--rc-l'] = m.color.l + '%'; }
  const who = state.coop.active ? state.markedBy[r][c] : null;
  if (who) { const col = playerColor(who); if (col) st['--markcol'] = col; }
  const pe = pulseEdges(r, c);
  if (pe.t) st['--pt'] = '3px';
  if (pe.b) st['--pb'] = '3px';
  if (pe.l) st['--pl'] = '3px';
  if (pe.r) st['--pr'] = '3px';
  return st;
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
const app = createApp(App);
app.mount('#app');
// Debug-Hook nur lokal (nie auf der echten Domain aktiv)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.__cns = { state, onCellTap, isSolved };

nextTick(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const remaining = Math.max(0, 1200 - (Date.now() - APP_START));
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 450);
  }, remaining);
});

window.addEventListener('pagehide', () => { if (state.status === 'playing') saveActiveGame(activeSnapshot()); createBackup('close'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (state.status === 'playing') saveActiveGame(activeSnapshot()); createBackup('close'); }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
