// app.js — Coop Number Sums (Vue 3, esm-browser). Solo-Spiel; Coop folgt später.
import { createApp, reactive, computed, watch, nextTick, onMounted } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { DIFFICULTIES, DIFF_BY_ID, REGION_COLORS, DEFAULT_GAME_OPTIONS, LIVES, HINTS } from './config.js';
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
  status: 'idle',            // idle | playing | won | lost
  tool: 'pen',               // pen | eraser
  startTime: 0,
  elapsed: 0,
  history: [],               // Undo-Stack
  flash: {},                 // "r-c" -> true (rote Fehler-Animation)
  justResolved: {},          // "row-3" | "col-1" | "region-2" -> true (Fertig-Puls)
  cellPx: 48,
  zoom: 1,

  // Auswahl im Setup
  sel: { ...DEFAULT_GAME_OPTIONS },

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
  if (state.status !== 'playing') return;
  timerHandle = setInterval(() => {
    state.elapsed = Date.now() - state.startTime;
  }, 250);
}
function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

// ─── PAUSE ────────────────────────────────────────────────────────────────────
function pauseGame() {
  if (state.status !== 'playing' || state.paused) return;
  state.paused = true;
  state.elapsed = Date.now() - state.startTime; // einfrieren
  stopTimer();
}
function resumeFromPause() {
  if (!state.paused) return;
  state.paused = false;
  state.startTime = Date.now() - state.elapsed; // Zeit fortsetzen
  startTimer();
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
function newGame(diffId) {
  state.generating = true;
  state.screen = 'game';
  // kurze Verzögerung, damit die Lade-Animation sichtbar wird (große Felder)
  setTimeout(() => {
    const puzzle = generatePuzzle({ difficulty: diffId });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    startTimer();
  }, 30);
}

function loadPuzzleIntoState(puzzle, saved) {
  state.puzzle = puzzle;
  state.cellMeta = buildCellMeta(puzzle);
  if (saved && saved.hintMarks) for (const [r, c] of saved.hintMarks) state.cellMeta[r][c].hintMark = true;
  state.marks = saved ? saved.marks : Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill('none'));
  state.maxLives = saved ? saved.maxLives : LIVES;
  state.lives = saved ? saved.lives : LIVES;
  state.hintsLeft = saved ? saved.hintsLeft : HINTS;
  state.hintsUsed = saved ? saved.hintsUsed : 0;
  state.mistakes = saved ? saved.mistakes : 0;
  state.history = [];
  state.flash = {};
  state.justResolved = {};
  state.tool = state.settings.confirmTool || 'pen';
  state.status = 'playing';
  state.elapsed = saved ? (saved.elapsed || 0) : 0;
  state.startTime = Date.now() - state.elapsed;
  state.zoom = 1;
  computeCellSize();
  persistGame();
}

// ─── ZELLGRÖSSE (responsiv + Zoom) ────────────────────────────────────────────
function computeCellSize() {
  if (!state.puzzle) return;
  const cols = state.puzzle.cols;
  const avail = Math.min(window.innerWidth - 24, 560);
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
  let next;
  if (state.tool === 'pen') next = (cur === 'kept') ? 'none' : 'kept';
  else next = (cur === 'removed') ? 'none' : 'removed';
  setMark(r, c, next, true);
}

function setMark(r, c, next, user) {
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

  state.history.push({ r, c, prev: cur });
  if (state.history.length > 500) state.history.shift();
  state.marks[r][c] = next;

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

function registerMistake() {
  state.mistakes++;
  if (state.settings.livesEnabled) {
    state.lives--;
    if (state.lives <= 0) { state.lives = 0; lose(); }
  }
  persistGame();
}

// Gelöst, wenn JEDE Zelle korrekt markiert ist (Lösung eingekreist, Rest gelöscht).
function isSolved() {
  const p = state.puzzle; if (!p) return false;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      if (!cellCorrect(r, c)) return false;
  return true;
}

// "Prüfen"-Modus (Fehler erst auf Knopfdruck)
function doCheck() {
  if (state.status !== 'playing') return;
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
  if (state.settings.livesEnabled) {
    state.lives--;
    if (state.lives <= 0) { state.lives = 0; lose(); return; }
  }
  showToast(`${wrong.length} Fehler gefunden`, 'error');
  persistGame();
}

function useHint() {
  if (state.status !== 'playing' || state.hintsLeft <= 0) return;
  const hint = findHintCell(state.puzzle, state.marks);
  if (!hint) return;
  state.hintsLeft--; state.hintsUsed++;
  const next = hint.want; // 'kept' | 'removed'
  const region = state.cellMeta[hint.r][hint.c].region;
  const wasRow = rowResolved(hint.r), wasCol = colResolved(hint.c);
  const wasRegion = region >= 0 ? regionResolved(region) : false;

  state.history.push({ r: hint.r, c: hint.c, prev: state.marks[hint.r][hint.c] });
  state.marks[hint.r][hint.c] = next;
  // .hint = kurzer Leucht-Puls (Quadrat), .hintMark = bleibt für den Rest des Rätsels
  state.cellMeta[hint.r][hint.c].hint = true;
  state.cellMeta[hint.r][hint.c].hintMark = true;
  setTimeout(() => { if (state.cellMeta[hint.r]) state.cellMeta[hint.r][hint.c].hint = false; }, 1400);

  if (!wasRow && rowResolved(hint.r)) pulseResolved('row', hint.r);
  if (!wasCol && colResolved(hint.c)) pulseResolved('col', hint.c);
  if (region >= 0 && !wasRegion && regionResolved(region)) pulseResolved('region', region);

  afterMove();
}

function undo() {
  if (!state.history.length || state.status !== 'playing') return;
  const last = state.history.pop();
  state.marks[last.r][last.c] = last.prev;
  persistGame();
}

function win() {
  if (state.status === 'won') return;
  state.status = 'won';
  stopTimer();
  launchConfetti();
  state.stats = recordResult({
    difficulty: state.puzzle.difficulty,
    won: true, timeMs: state.elapsed, hintsUsed: state.hintsUsed,
  });
  saveActiveGame(null);
}

function lose() {
  state.status = 'lost';
  stopTimer();
  state.stats = recordResult({
    difficulty: state.puzzle.difficulty,
    won: false, timeMs: state.elapsed, hintsUsed: state.hintsUsed,
  });
  saveActiveGame(null);
}

function revealSolution() {
  const p = state.puzzle;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      state.marks[r][c] = p.solution[r][c] ? 'kept' : 'removed';
}

function restartPuzzle() {
  state.marks = Array.from({ length: state.puzzle.rows }, () => Array(state.puzzle.cols).fill('none'));
  state.cellMeta = buildCellMeta(state.puzzle); // setzt auch hint/hintMark zurück
  state.lives = LIVES; state.maxLives = LIVES; state.hintsLeft = HINTS;
  state.hintsUsed = 0; state.mistakes = 0; state.history = []; state.flash = {}; state.justResolved = {};
  state.status = 'playing'; state.elapsed = 0; state.startTime = Date.now();
  startTimer(); persistGame();
}

function quitToHome() {
  saveActiveGame(state.status === 'playing' ? activeSnapshot() : null);
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
      '--hdr': Math.round(state.cellPx * 0.78) + 'px',
      '--fs': Math.max(11, Math.round(state.cellPx * 0.4)) + 'px',
    }));
    onMounted(init);

    return {
      state, BUILD, CHANGELOG, DIFFICULTIES, DIFF_BY_ID,
      winStat, livesArr, progress, gridStyle,
      navigate, newGame, resumeGame, onCellTap, undo, useHint, doCheck,
      rowSum, colSum, regionSum, rowResolved, colResolved, regionResolved, rowSumMatch, colSumMatch,
      fmtTime, toggleSetting, setSetting, doExport, doImport, openBackups, doRestore,
      resetStats, ask, confirmYes, confirmNo, dismissWhatsNew, loadBackups,
      revealSolution, restartPuzzle, quitToHome, setZoom, pauseGame, resumeFromPause,
      onPinchStart, onPinchMove, onPinchEnd,
      cellClasses, cellStyle, toggleTool, restartFromGame,
    };
  },
  template: `
  <div class="app" :class="{ generating: state.generating }">

    <!-- ══ HOME ══ -->
    <section v-if="state.screen==='home'" class="screen home">
      <div class="brand">
        <div class="brand-logo">∑</div>
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
          <span class="btn-ic">✚</span><span class="btn-tx"><b>Neues Spiel</b><small>Schwierigkeit wählen</small></span>
        </button>
        <button class="btn btn-coop" disabled>
          <span class="btn-ic">👥</span><span class="btn-tx"><b>Coop-Modus</b><small>Gemeinsam lösen · bald verfügbar</small></span>
          <span class="badge-soon">bald</span>
        </button>
        <div class="home-row">
          <button class="btn btn-ghost" @click="navigate('stats')"><span class="btn-ic">📊</span> Statistik</button>
          <button class="btn btn-ghost" @click="navigate('settings')"><span class="btn-ic">⚙️</span> Einstellungen</button>
        </div>
        <div class="home-row">
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
            <span v-for="(full,i) in livesArr" :key="i" class="heart" :class="{empty:!full}">♥</span>
          </div>
          <div class="hud-item timer" v-if="state.settings.showTimer">⏱ {{ fmtTime(state.elapsed) }}</div>
        </div>
        <div class="top-actions">
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing'" @click="pauseGame" title="Pause">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg>
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
          <span class="zoomctl">
            <button class="zoom-btn" @click="setZoom(-0.15)">−</button>
            <button class="zoom-btn" @click="setZoom(0.15)">+</button>
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
          <button v-if="state.settings.errorReveal==='onCheck'" class="round-btn" :disabled="!state.history.length" @click="undo" title="Rückgängig" aria-label="Rückgängig">
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
          <button class="btn btn-primary btn-check" @click="doCheck">✓ Prüfen</button>
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
          <div class="result-stats">
            <div><b>{{ fmtTime(state.elapsed) }}</b><small>Zeit</small></div>
            <div><b>{{ state.mistakes }}</b><small>Fehler</small></div>
            <div><b>{{ state.hintsUsed }}</b><small>Hinweise</small></div>
          </div>
          <button class="btn btn-primary" @click="newGame(state.puzzle.difficulty)">Nächstes Rätsel</button>
          <button class="btn btn-ghost" @click="quitToHome">Zum Menü</button>
        </div>
      </div>
      <div v-if="state.status==='lost'" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">💔</div>
          <h2>Keine Leben mehr</h2>
          <p class="result-msg">Kein Problem – versuch es erneut!</p>
          <button class="btn btn-primary" @click="restartFromGame">Nochmal versuchen</button>
          <button class="btn btn-ghost" @click="revealSolution(); state.status='review'">Lösung zeigen</button>
          <button class="btn btn-ghost" @click="quitToHome">Zum Menü</button>
        </div>
      </div>
      <div v-if="state.status==='review'" class="review-bar">
        <span>Lösung</span>
        <button class="btn btn-primary btn-sm" @click="quitToHome">Zum Menü</button>
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
          <span class="diff-name">{{ d.emoji }} {{ d.name }}</span>
          <span class="diff-num">{{ (state.stats.byDifficulty[d.id]?.won)||0 }} / {{ (state.stats.byDifficulty[d.id]?.played)||0 }}</span>
        </div>
        <button class="btn btn-danger-ghost" @click="resetStats">Statistik zurücksetzen</button>
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
          <li>Kreise mit dem <b>Stift ○</b> genau die Zahlen ein, die zusammen die Zielsumme ergeben.</li>
          <li>Überflüssige Zahlen mit dem <b>Radierer ⌫</b> durchstreichen.</li>
          <li>Auch jede <b>farbige Region</b> hat eine eigene Zielsumme (Zahl in der Ecke).</li>
          <li>Kreise nur ein, wo du dir <b>sicher</b> bist – jedes Rätsel ist <b>ohne Raten</b> lösbar.</li>
          <li>Gelöst, wenn alle Summen stimmen. Im Leben-Modus kostet jeder Fehler ein ❤.</li>
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
function restartFromGame() { restartPuzzle(); }

function cellClasses(r, c) {
  const m = state.cellMeta[r][c];
  const mk = state.marks[r][c];
  // Cage-Färbung nur solange die Cage NICHT aufgelöst ist (dann verschwindet sie).
  const colored = m.region >= 0 && !regionResolved(m.region);
  return {
    kept: mk === 'kept', removed: mk === 'removed',
    region: colored,
    flash: !!state.flash[`${r}-${c}`],
    hinted: m.hint,
    hintmark: m.hintMark,
    pulse: m.region >= 0 && !!state.justResolved[`region-${m.region}`],
    strike: mk === 'removed' && state.settings.eraseStyle === 'strike',
    solnc: state.status === 'review' && state.puzzle.solution[r][c],
  };
}
function cellStyle(r, c) {
  const m = state.cellMeta[r][c];
  const st = { fontSize: 'var(--fs)' };
  if (m.color) { st['--rc-h'] = m.color.h; st['--rc-s'] = m.color.s + '%'; st['--rc-l'] = m.color.l + '%'; }
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
