// app.js — Coop Number Sums (Vue 3, esm-browser). Solo-Spiel; Coop folgt später.
import { createApp, reactive, computed, watch, nextTick, onMounted } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { DIFFICULTIES, DIFF_BY_ID, REGION_COLORS, COOP_COLORS, COOP_COLORS_CB, DEFAULT_GAME_OPTIONS, CUSTOM_SIZES, LIVES, HINTS } from './config.js';
import { generatePuzzle, findHintCell } from './generator.js';
import { getDailyChallenge, todayDateStr } from './daily.js';
import { getBossChallenge } from './boss.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import { hasProfanity } from './profanity.js';
import { ACHIEVEMENTS, evaluate as evaluateAchievements } from './achievements.js';
import { findTrainingStep, isFullyTier1Solvable } from './training.js';
import {
  loadSettings, saveSettings, loadActiveGame, saveActiveGame, loadStats, recordResult,
  loadSeenVersion, saveSeenVersion, createBackup, loadBackups, restoreBackup,
  exportToFile, importFromFile, deleteAllData, loadDaily, recordDailyResult,
  loadBoss, recordBossWin, recordBossLoss, loadHistory, recordHistory,
  loadAchievements, unlockAchievements,
} from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();
const splashVersion = document.getElementById('splash-version');
if (splashVersion) splashVersion.textContent = `v${BUILD}`;

// ─── GLOBALER ZUSTAND ─────────────────────────────────────────────────────────
const state = reactive({
  screen: 'home',            // home | setup | game | settings | stats
  settings: loadSettings(),
  stats: loadStats(),
  daily: loadDaily(),        // { lastCompletedDate, currentStreak, bestStreak, totalCompleted }
  boss: loadBoss(),          // { lastAttemptedWeek, lastCompletedWeek, currentStreak, bestStreak, totalCompleted }
  puzzleHistory: loadHistory(), // Ringpuffer gelöster Rätsel (neueste zuerst), siehe storage.js
  achievements: loadAchievements(), // { id: Freischalt-Zeitstempel }, siehe storage.js
  historyDetail: null,       // { entry, puzzle, cellMeta } während der Endboard-Ansicht eines Verlauf-Eintrags, sonst null

  // Spiel
  puzzle: null,
  isDailyGame: false,         // true, während das laufende Rätsel das Tagesrätsel ist
  dailyDateStr: null,         // Kalendertag, für den das laufende Tagesrätsel generiert wurde
  isBossGame: false,          // true, während das laufende Rätsel das wöchentliche Boss-Rätsel ist
  bossWeekStr: null,          // ISO-Kalenderwoche, für die das laufende Boss-Rätsel generiert wurde
  isCustomGame: false,        // true, während das laufende Rätsel eine eigene (nicht in Stats gezählte) Größe hat
  isTrainingGame: false,      // true, während der Trainingsmodus (Schritt-für-Schritt-Erklärung) läuft
  trainingStep: null,         // aktuell erklärter Schritt { r, c, action, reason, group } oder null
  trainingDone: false,        // true, sobald keine weiteren Tier-1-Schritte mehr gefunden wurden
  marks: [],                 // 'none' | 'kept' | 'removed'
  cellMeta: [],              // pro Zelle: { region, color, edges, chip, hint, hintMark }
  lives: 0, maxLives: 0,
  hintsLeft: 0,
  hintsUsed: 0,
  mistakes: 0,
  status: 'idle',            // idle | playing | won | lost | gaveup
  solutionShown: false,      // Lösung wird angezeigt (rein lokal, nie an den Partner gesendet)
  newHighscore: false,        // true, wenn beim letzten Sieg eine neue Bestzeit erzielt wurde
  wouldHaveBeenBest: false,   // true, wenn die Zeit ohne Fehler/Hinweise eine neue Bestzeit gewesen wäre
  hintWarnShown: false,       // true, sobald die einmalige Hinweis-Warnung dieser Partie bestätigt wurde
  bestTimeNotice: null,       // Text der kurzen Top-Banner-Meldung "Bestzeit nicht mehr möglich"
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
    waitingForGuest: false,    // Host: Raum offen, wartet auf Join / Gast: verbindet
    lobbyDiffId: 'mittel',
    error: null,               // Inline-Fehlermeldung im Lobby-Screen
    myId: null,                // eigene Firebase-uid dieser Session (Host wie Gast)
    players: [],                // [{id, name, color}] — alle bekannten Mitspieler inkl. mir selbst
    nameDraft: '',              // Entwurf im Namens-Gate, bevor er bestätigt wird
    identityConfirmed: false,   // true sobald das Namens-Gate in dieser Coop-Session bestätigt wurde
    lifeLossBy: [],              // chronologisch: wer hat welches (gemeinsame) Leben verbraucht
    mistakesByPlayer: {},        // id -> Anzahl Fehler dieses Spielers im laufenden Rätsel
    awaitingStart: false,        // Rätsel ist generiert, aber die Zeit läuft noch nicht — wartet auf Start-Klick
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
  updateReady: false,        // neue App-Version liegt im Service-Worker bereit
});

let timerHandle = null;
let saveThrottle = 0;
let coopIntentionalLeave = false; // unterscheidet bewusstes Verlassen von echtem Verbindungsabbruch

// ─── HELFER ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', ms = 2000) {
  state.toast = { msg, type };
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { state.toast = null; }, ms);
}
// Eigenständige, oben sitzende Banner-Meldung (statt des unten sitzenden Toasts) —
// verdeckt nie das Spielfeld, da sie nur den schmalen Bereich am oberen Rand nutzt.
function showBestTimeNotice(msg) {
  state.bestTimeNotice = msg;
  clearTimeout(showBestTimeNotice._t);
  showBestTimeNotice._t = setTimeout(() => { state.bestTimeNotice = null; }, 2600);
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
function applyLocale() {
  if (!state.settings.language) state.settings.language = detectLocale();
  setLocale(state.settings.language);
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function navigate(screen) {
  state.screen = screen;
  if (screen === 'game') startTimer(); else stopTimer();
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  if (state.status !== 'playing' || state.paused || state.coop.awaitingStart) return;
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
  if (state.status !== 'playing' || state.paused || state.coop.awaitingStart) return;
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

// ─── COOP-LOBBY: "Bereit?" vor dem eigentlichen Start ─────────────────────────
// Ein frisch generiertes Coop-Rätsel zeigt zunächst nur die Lobby ("Mitspieler
// sind da, Zeit läuft noch nicht") statt sofort loszulaufen — wer auch immer
// zuerst auf "Starten" tippt, legt den gemeinsamen Startzeitpunkt fest.
function startCoopGame(startTime) {
  state.coop.awaitingStart = false;
  state.elapsed = 0;
  state.startTime = startTime;
  startTimer();
}
function startCoopRound() {
  if (!state.coop.awaitingStart) return;
  const startTime = Date.now();
  startCoopGame(startTime);
  coopSend({ type: Coop.MSG.START, startTime });
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
function newGame(diffId, customDim) {
  state.isDailyGame = false;
  state.dailyDateStr = null;
  state.isBossGame = false;
  state.bossWeekStr = null;
  state.isTrainingGame = false;
  // Custom-Größe ist bewusst auf Solo beschränkt (siehe Setup-Template, das den
  // Tab dafür in aktiver Coop-Session ausblendet) — hier zusätzlich abgesichert,
  // damit ein evtl. noch gesetztes state.sel.custom aus einer früheren Solo-
  // Session den Coop-Host-Flow nicht verändert.
  state.isCustomGame = !state.coop.active && !!customDim;
  state.generating = true;
  state.screen = 'game';
  // kurze Verzögerung, damit die Lade-Animation sichtbar wird (große Felder)
  setTimeout(() => {
    log('game', `Puzzle-Generierung gestartet`, { difficulty: diffId, customDim });
    let puzzle;
    try {
      puzzle = generatePuzzle(state.isCustomGame ? { difficulty: diffId, dim: customDim } : { difficulty: diffId });
    } catch (e) {
      log('game', `Puzzle-Generierung fehlgeschlagen`, e);
      throw e;
    }
    log('game', `Puzzle generiert`, { difficulty: diffId, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    if (state.coop.active && state.coop.role === 'host') {
      state.coop.awaitingStart = true;
      startTimer();
      coopSend({ type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
    } else {
      startTimer();
    }
  }, 30);
}

// Gewonnenes Coop-Rätsel → statt direkt erneut derselben Schwierigkeit (wie im
// Solo-Modus) zur Schwierigkeitsauswahl, vorbefüllt mit der zuletzt gespielten —
// der Host kann so für die nächste Runde bewusst eine andere Schwierigkeit wählen.
function goNextPuzzle() {
  if (state.coop.active && state.coop.role === 'host') {
    state.sel.difficulty = state.puzzle.difficulty;
    navigate('setup');
  } else {
    newGame(state.puzzle.difficulty, state.isCustomGame ? { r: state.puzzle.rows, c: state.puzzle.cols } : undefined);
  }
}

// Tagesrätsel: deterministisch aus dem Kalendertag abgeleitet (gleicher Seed +
// gleiche, auf sehrleicht/leicht/mittel begrenzte Schwierigkeit für alle
// Spieler weltweit am selben Tag, siehe daily.js). Bewusst solo-only — kein
// Coop-Pendant, das würde die Determinismus-Garantie unnötig verkomplizieren.
function startDailyGame() {
  const { dateStr, seed, difficulty } = getDailyChallenge();
  state.isDailyGame = true;
  state.dailyDateStr = dateStr;
  state.isBossGame = false;
  state.bossWeekStr = null;
  state.isTrainingGame = false;
  state.isCustomGame = false;
  state.generating = true;
  state.screen = 'game';
  setTimeout(() => {
    log('game', `Tagesrätsel-Generierung gestartet`, { dateStr, difficulty });
    let puzzle;
    try {
      puzzle = generatePuzzle({ difficulty, seed });
    } catch (e) {
      log('game', `Tagesrätsel-Generierung fehlgeschlagen`, e);
      throw e;
    }
    log('game', `Tagesrätsel generiert`, { dateStr, difficulty, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    startTimer();
  }, 30);
}

// Boss-Rätsel: wöchentlich rotierendes Sudden-Death-Format (siehe boss.js) — genau
// ein Versuch pro ISO-Kalenderwoche, erzwungenes einzelnes Leben (siehe
// loadPuzzleIntoState), kein Retry bei Niederlage (siehe Verlust-Screen-Template).
// Solo-only aus demselben Grund wie das Tagesrätsel.
function startBossGame() {
  const { weekStr, seed, difficulty } = getBossChallenge();
  state.isBossGame = true;
  state.bossWeekStr = weekStr;
  state.isDailyGame = false;
  state.dailyDateStr = null;
  state.isCustomGame = false;
  state.isTrainingGame = false;
  state.generating = true;
  state.screen = 'game';
  setTimeout(() => {
    log('game', `Boss-Rätsel-Generierung gestartet`, { weekStr, difficulty });
    let puzzle;
    try {
      puzzle = generatePuzzle({ difficulty, seed });
    } catch (e) {
      log('game', `Boss-Rätsel-Generierung fehlgeschlagen`, e);
      throw e;
    }
    log('game', `Boss-Rätsel generiert`, { weekStr, difficulty, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    startTimer();
  }, 30);
}

// Trainingsmodus: Schritt-für-Schritt-Erklärung erzwungener Züge (siehe
// training.js). Das Rätsel wird GEZIELT so ausgewählt, dass es sich komplett
// mit den einfachen, in Worten erklärbaren Tier-1-Schritten lösen lässt --
// sonst würde der Durchlauf plötzlich auf ein Rätsel treffen, das v1 nicht
// erklären kann. Solo, kein Netz, keine eigenen Storage-Keys (siehe Plan).
const TRAINING_GEN_BUDGET = 40; // Versuche, bis ein voll Tier-1-lösbares Rätsel gefunden ist
function startTrainingGame() {
  state.isTrainingGame = true;
  state.isDailyGame = false; state.dailyDateStr = null;
  state.isBossGame = false; state.bossWeekStr = null;
  state.isCustomGame = false;
  state.trainingStep = null;
  state.trainingDone = false;
  state.generating = true;
  state.screen = 'game';
  setTimeout(() => {
    log('game', `Trainingsrätsel-Generierung gestartet`);
    let puzzle = generatePuzzle({ difficulty: 'sehrleicht' });
    for (let i = 0; i < TRAINING_GEN_BUDGET && !isFullyTier1Solvable(puzzle); i++) {
      puzzle = generatePuzzle({ difficulty: 'sehrleicht' });
    }
    log('game', `Trainingsrätsel generiert`, { rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    startTimer();
    trainingNextStep();
  }, 30);
}

// Sucht den nächsten erzwungenen Schritt und zeigt ihn als Erklär-Overlay an
// -- die Markierung selbst passiert erst im "anwenden"-Klick (applyTrainingStep),
// damit die Begründung zuerst gelesen werden kann, bevor sich das Feld ändert.
function trainingNextStep() {
  state.trainingStep = findTrainingStep(state.puzzle, state.marks);
  state.trainingDone = !state.trainingStep;
}

function applyTrainingStep() {
  const step = state.trainingStep;
  if (!step) return;
  setMark(step.r, step.c, step.action, false);
  state.trainingStep = null;
  if (state.status === 'playing') trainingNextStep();
}

function loadPuzzleIntoState(puzzle, saved) {
  state.puzzle = puzzle;
  state.cellMeta = buildCellMeta(puzzle);
  if (saved && saved.hintMarks) for (const [r, c] of saved.hintMarks) state.cellMeta[r][c].hintMark = true;
  state.marks = saved?.marks || Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill('none'));
  state.markedBy = saved?.markedBy || Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(null));
  state.maxLives = saved?.maxLives ?? (state.isBossGame ? 1 : LIVES);
  state.lives = saved?.lives ?? (state.isBossGame ? 1 : LIVES);
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
  state.wouldHaveBeenBest = false;
  state.hintWarnShown = false;
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

// ─── LANGES DRÜCKEN (Markierung zurücksetzen, nur Solo + "Beim Prüfen") ───────
// Nur hier kann eine Zelle ohne festen Fehler-Status falsch markiert worden
// sein (im 'instant'-Modus lehnt setMark falsche Züge sofort ab) — daher ist
// das Zurückholen per langem Drücken auf diesen Modus beschränkt, und auf
// Solo, da Coop-Markierungen mit dem Partner synchron bleiben müssen.
const LONGPRESS_MS = 500;          // Haltedauer bis zum Zurücksetzen auf 'none'
const LONGPRESS_TOLERANCE_PX = 10; // Bewegungstoleranz während des Haltens
                                    // (verhindert Fehlauslösung beim Schwenken eines gezoomten Felds)
let pressState = null;       // { r, c, x, y, timer } während eines Pointer-Holds, sonst null
let suppressClickUntil = 0;  // Date.now()-Zeitstempel; bis dahin wird der nächste Klick auf der Zelle ignoriert

function canLongPressRestore(r, c) {
  if (state.status !== 'playing' || state.generating || state.paused) return false;
  if (state.coop.active || state.isTrainingGame) return false;
  if (state.settings.errorReveal !== 'onCheck') return false;
  const mk = state.marks[r][c];
  if (state.tool === 'eraser' && mk === 'removed') return true;
  if (state.tool === 'pen' && mk === 'kept') return true;
  return false;
}

function onCellPointerDown(e, r, c) {
  if (!canLongPressRestore(r, c)) return;
  if (pressState) clearTimeout(pressState.timer);
  pressState = { r, c, x: e.clientX, y: e.clientY, timer: null };
  pressState.timer = setTimeout(() => {
    if (!pressState || pressState.r !== r || pressState.c !== c) return;
    suppressClickUntil = Date.now() + 400;
    pressState = null;
    setMark(r, c, 'none', true);
  }, LONGPRESS_MS);
}

function onCellPointerMove(e) {
  if (!pressState) return;
  const dx = e.clientX - pressState.x, dy = e.clientY - pressState.y;
  if (Math.hypot(dx, dy) > LONGPRESS_TOLERANCE_PX) {
    clearTimeout(pressState.timer);
    pressState = null;
  }
}

function onCellPointerCancel() {
  if (pressState) { clearTimeout(pressState.timer); pressState = null; }
}

function onCellTap(r, c) {
  if (Date.now() < suppressClickUntil) { suppressClickUntil = 0; return; }
  if (state.status !== 'playing' || state.generating || state.paused) return;
  // Solange noch erzwungene Schritte existieren, steuert ausschließlich der
  // "nächster Schritt"-Button -- erst wenn Tier-1-Logik nicht mehr weiterkommt
  // (trainingDone, sollte dank TRAINING_GEN_BUDGET praktisch nie vorkommen),
  // darf frei zu Ende getippt werden.
  if (state.isTrainingGame && !state.trainingDone) return;
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
  if (state.isBossGame || state.settings.livesEnabled) {
    state.lives--;
    if (state.coop.active) state.coop.lifeLossBy.push(by);
    showBestTimeNotice(t('game.lifeLostNotice'));
    if (state.lives <= 0) { state.lives = 0; lose(); }
  }
  persistGame();
}

// Wendet einen vom Partner gemeldeten Fehler an (ohne erneut zu senden — sonst
// würde die Nachricht zwischen Host und Gast endlos hin- und herlaufen).
function applyRemoteMistake(by, n) {
  state.mistakes += n;
  if (by) state.coop.mistakesByPlayer[by] = (state.coop.mistakesByPlayer[by] || 0) + n;
  if (state.isBossGame || state.settings.livesEnabled) {
    for (let i = 0; i < n; i++) {
      state.lives--;
      state.coop.lifeLossBy.push(by);
      showBestTimeNotice(t('game.lifeLostNotice'));
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
    showToast(t('game.stillCorrect'), 'info');
    return;
  }
  log('game', `Check ausgeführt`, { errors: wrong.length });
  wrong.forEach(([r, c]) => flashError(r, c));
  state.mistakes += wrong.length;
  if (by) state.coop.mistakesByPlayer[by] = (state.coop.mistakesByPlayer[by] || 0) + wrong.length;
  if (state.isBossGame || state.settings.livesEnabled) {
    state.lives--;
    if (state.coop.active) state.coop.lifeLossBy.push(by);
    showBestTimeNotice(t('game.lifeLostNotice'));
    if (state.lives <= 0) { state.lives = 0; lose(); return; }
  }
  showToast(t('game.errorsFound', { count: wrong.length }), 'error');
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

// Vor dem ersten Hinweis je Partie (und je Spieler, da state lokal ist) eine
// einmalige Warnung, dass damit keine Bestzeit mehr möglich ist — bei Abbruch
// bleibt hintWarnShown false, sodass die Warnung beim nächsten Versuch erneut kommt.
function useHint() {
  if (state.status !== 'playing' || state.hintsLeft <= 0) return;
  if (!state.hintWarnShown) {
    ask(t('game.hintConfirmTitle'), t('game.hintConfirmMsg'), () => {
      state.hintWarnShown = true;
      doUseHint();
    });
    return;
  }
  doUseHint();
}
function doUseHint() {
  const hint = findHintCell(state.puzzle, state.marks);
  if (!hint) return;
  log('game', `Hinweis verwendet`, { hintsLeft: state.hintsLeft - 1 });
  state.hintsLeft--; state.hintsUsed++;
  applyHintEffect(hint.r, hint.c, hint.want);
  showBestTimeNotice(t('game.hintUsedNotice'));
  if (state.coop.active) coopSend({ type: Coop.MSG.HINT, r: hint.r, c: hint.c, mark: hint.want, from: state.coop.myId });
}

function undo(broadcast = true) {
  if (!state.history.length || state.status !== 'playing') return;
  const last = state.history.pop();
  state.marks[last.r][last.c] = last.prev;
  state.markedBy[last.r][last.c] = null; // prev ist immer 'none' (siehe Markier-Sperre)
  log('game', `Rückgängig`);
  persistGame();
  if (broadcast && state.coop.active) coopSend({ type: Coop.MSG.UNDO });
}

// ─── COOP ────────────────────────────────────────────────────────────────────
const CODE_RE = /^\d{6}$/;

function coopSend(msg) {
  if (!state.coop.active || !state.coop.connected) return;
  Coop.send(msg);
}

function handleCoopMsg(msg) {
  if (msg.type === Coop.MSG.MOVE) {
    setMark(msg.r, msg.c, msg.mark, false, msg.from);
  } else if (msg.type === Coop.MSG.UNDO) {
    undo(false);
  } else if (msg.type === Coop.MSG.CHECK) {
    doCheck(msg.from, false);
  } else if (msg.type === Coop.MSG.MISTAKE) {
    applyRemoteMistake(msg.by, msg.n);
  } else if (msg.type === Coop.MSG.PAUSE) {
    if (msg.paused) pauseGame(false, msg.elapsed); else resumeFromPause(false);
  } else if (msg.type === Coop.MSG.HINT) {
    applyHintEffect(msg.r, msg.c, msg.mark, false, msg.from);
  } else if (msg.type === Coop.MSG.INIT) {
    loadPuzzleIntoState(msg.puzzle, { marks: msg.marks, markedBy: msg.markedBy, startTime: msg.startTime });
    state.coop.active = true;
    state.coop.connected = true;
    state.coop.waitingForGuest = false;
    state.coop.awaitingStart = true;
    navigate('game');
  } else if (msg.type === Coop.MSG.START) {
    if (state.coop.awaitingStart) startCoopGame(msg.startTime);
  } else if (msg.type === Coop.MSG.STATUS) {
    const remote = { timeMs: msg.timeMs, mistakes: msg.mistakes, hintsUsed: msg.hintsUsed };
    if (msg.status === 'won') win(remote);
    else if (msg.status === 'lost') lose(remote);
    else if (msg.status === 'gaveup') giveUp(remote);
  } else if (msg.type === Coop.MSG.IDENTITY) {
    // Nur der Host wertet Identitäts-Meldungen aus und verteilt die Liste neu —
    // er entscheidet (Konfliktauflösung), welche Farbe ein Mitspieler tatsächlich bekommt.
    if (state.coop.role === 'host') {
      upsertPlayer(msg.author, msg.name, msg.color);
      broadcastRoster();
    }
  } else if (msg.type === Coop.MSG.ROSTER) {
    state.coop.players = msg.players;
  } else if (msg.type === Coop.MSG.RETRY) {
    restartPuzzle(msg.startTime);
  }
}

function coopReset() {
  coopIntentionalLeave = true;
  Coop.leave();
  const keepDiff = state.coop.lobbyDiffId;
  state.coop.active = false; state.coop.role = null; state.coop.code = '';
  state.coop.connected = false; state.coop.waitingForGuest = false;
  state.coop.lobbyDiffId = keepDiff; state.coop.error = null;
  state.coop.myId = null; state.coop.players = []; state.coop.awaitingStart = false;
}

// ─── SPIELER-IDENTITÄT (Namen & Farben) ────────────────────────────────────────
// Nur der Host führt die maßgebliche Spielerliste — er löst Farbkonflikte auf und
// verteilt das Ergebnis per ROSTER an alle. Eigene Wunschfarbe bleibt dabei in den
// Einstellungen unangetastet; reassignte Farben gelten nur für die laufende Session.
function normHex(h) { return (h || '').toLowerCase(); }
function activeCoopPalette() { return state.settings.colorBlindMode ? COOP_COLORS_CB : COOP_COLORS; }
function pickAvailableColor(requested, others) {
  const used = new Set(others.map(p => normHex(p.color)));
  if (requested && !used.has(normHex(requested))) return requested;
  const free = activeCoopPalette().find(c => !used.has(normHex(c.hex)));
  if (free) return free.hex;
  // Palette erschöpft (mehr Spieler als vordefinierte Farben): per Goldwinkel-
  // Rotation eine weitere, praktisch garantiert eindeutige Farbe erzeugen.
  const hue = Math.round((others.length * 137.508) % 360);
  return `hsl(${hue} 75% 55%)`;
}
function upsertPlayer(id, name, requestedColor) {
  const others = state.coop.players.filter(p => p.id !== id);
  const color = pickAvailableColor(requestedColor, others);
  state.coop.players = [...others, { id, name: (name || '').trim() || t('common.defaultPlayerName'), color }];
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
  if (hasProfanity(name)) {
    showToast(t('error.profanity'), 'error');
    return;
  }
  state.settings.coopName = name;
  state.coop.identityConfirmed = true;
}
function onCoopNameBlur() {
  if (hasProfanity(state.settings.coopName)) {
    state.settings.coopName = '';
    showToast(t('error.profanity'), 'error');
  }
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
// (Tab eingeschlafen, Netzwerkausfall) während die Runde noch läuft: der Gast
// übernimmt lokal die Host-Rolle (Identitäts-Arbitrierung für künftige Mitspieler) —
// die Raumdaten in der RTDB leben unabhängig vom "Host", ein Transport-Neuaufbau
// ist anders als bei PeerJS nicht nötig.
function promoteToHost() {
  state.coop.role = 'host';
  showToast(t('coop.becameHost'), 'info', 4000);
}

function startHosting() {
  if (!Coop.isAvailable()) { state.coop.error = t('coop.errorWebrtcUnavailable'); return; }
  if (!CODE_RE.test(state.coop.code)) { state.coop.error = t('coop.errorInvalidCode'); return; }
  coopIntentionalLeave = false;
  state.coop.role = 'host';
  state.coop.waitingForGuest = true;
  state.coop.error = null;
  state.coop.myId = null;
  state.coop.players = [];
  Coop.hostGame({
    code: state.coop.code,
    name: state.settings.coopName,
    color: state.settings.coopMyColor,
    onOpen(id) {
      state.coop.myId = id;
      upsertPlayer(id, state.settings.coopName, state.settings.coopMyColor);
    },
    onError(e) {
      state.coop.waitingForGuest = false;
      state.coop.error = e.type === 'code-taken'
        ? t('coop.errorCodeTaken') : t('coop.errorConnection');
    },
    onJoin() {
      log('game', `Puzzle-Generierung gestartet (Coop)`, { difficulty: state.coop.lobbyDiffId });
      let puzzle;
      try {
        puzzle = generatePuzzle({ difficulty: state.coop.lobbyDiffId });
      } catch (e) {
        log('game', `Puzzle-Generierung fehlgeschlagen (Coop)`, e);
        throw e;
      }
      log('game', `Puzzle generiert (Coop)`, { difficulty: state.coop.lobbyDiffId, rows: puzzle.rows, cols: puzzle.cols });
      loadPuzzleIntoState(puzzle, null);
      state.coop.active = true;
      state.coop.connected = true;
      state.coop.waitingForGuest = false;
      state.coop.awaitingStart = true;
      navigate('game');
      Coop.send({ type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
      showToast(t('coop.partnerConnected'));
    },
    onLeave(id) {
      state.coop.connected = false;
      removePlayer(id);
      broadcastRoster();
      if (!coopIntentionalLeave) showToast(t('coop.partnerDisconnected'), 'info', 3000);
    },
    onMessage: handleCoopMsg,
  });
}

function startJoining() {
  if (!CODE_RE.test(state.coop.code)) { state.coop.error = t('coop.errorInvalidCode'); return; }
  coopIntentionalLeave = false;
  state.coop.role = 'guest';
  state.coop.waitingForGuest = true;
  state.coop.error = null;
  state.coop.players = [];
  Coop.joinGame({
    code: state.coop.code,
    name: state.settings.coopName,
    color: state.settings.coopMyColor,
    onOpen(id) {
      // Eigene ID dieser Session sichern und sofort dem Host die eigene Identität
      // melden — coopSend() blockt hier noch (state.coop.connected wird erst beim
      // INIT true), daher direkt über die Transportschicht senden.
      state.coop.myId = id;
      upsertPlayer(id, state.settings.coopName, state.settings.coopMyColor);
      Coop.send({ type: Coop.MSG.IDENTITY, name: state.settings.coopName, color: state.settings.coopMyColor });
    },
    onError(e) {
      state.coop.waitingForGuest = false;
      state.coop.error =
        e.type === 'code-not-found' ? t('coop.errorCodeNotFound') :
        e.type === 'room-full'      ? t('coop.errorConnection') :
        e.type === 'timeout'        ? t('coop.errorTimeout') : t('coop.errorConnection');
    },
    onMessage: handleCoopMsg,
    onClose() {
      state.coop.connected = false;
      if (coopIntentionalLeave) return;
      if (state.coop.active && state.status === 'playing') {
        showToast(t('coop.hostDisconnectedPromoting'), 'info', 3000);
        promoteToHost();
      } else {
        showToast(t('coop.hostDisconnected'), 'info', 3000);
      }
    },
  });
}

// remote: vom Coop-Partner empfangene, maßgebliche Werte (überschreibt lokal ggf.
// abweichende Zeit/Fehler/Hinweise, damit beide Seiten exakt denselben Endstand zeigen).
// Die Coop-Lobby/Verbindung bleibt nach Rundenende bestehen — sie schließt erst,
// wenn ein Spieler aktiv "Zum Menü" klickt (siehe quitToHome).
// Nach jeder abgeschlossenen Partie aufgerufen (win/lose/giveUp) -- baut einen
// Kontext-Snapshot aus dem aktuellen state und prüft ihn gegen achievements.js.
function checkAchievements() {
  const ctx = {
    outcome: state.status,
    perfect: (state.mistakes || 0) === 0 && (state.hintsUsed || 0) === 0,
    difficulty: state.puzzle?.difficulty,
    coop: state.coop.active,
    custom: state.isCustomGame,
    totalWon: (state.stats.won || 0) + (state.stats.coopWon || 0),
    currentStreak: state.coop.active ? state.stats.coopCurrentStreak : state.stats.currentStreak,
    dailyStreak: state.daily.currentStreak,
    bossWin: state.isBossGame && state.status === 'won',
    bossStreak: state.boss.currentStreak,
    historyLength: state.puzzleHistory.length,
    wonAllDifficulties: DIFFICULTIES.every(d => (state.stats.byDifficulty[d.id]?.won || 0) > 0 || (state.stats.byDifficulty[d.id]?.coopWon || 0) > 0),
  };
  const newly = evaluateAchievements(ctx, Object.keys(state.achievements));
  if (!newly.length) return;
  state.achievements = unlockAchievements(newly);
  const name = t('achievements.' + newly[0] + '.title');
  showToast(t('achievements.unlockedToast', { name }) + (newly.length > 1 ? ` (+${newly.length - 1})` : ''), 'success', 3500);
}

function win(remote) {
  if (state.status === 'won') return;
  state.status = 'won';
  log('game', `Gewonnen`, { remote: !!remote, coop: state.coop.active });
  stopTimer();
  launchConfetti();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  // Custom-Rätsel (eigene Rastergröße) und Trainingsrätsel (geführter
  // Lernmodus, keine echte eigene Leistung) fließen bewusst nicht in die nach
  // Schwierigkeit gebucketeten Streaks/Bestzeiten ein.
  if (state.isCustomGame || state.isTrainingGame) {
    state.wouldHaveBeenBest = false;
    state.newHighscore = false;
  } else {
    // Vergleich VOR recordResult() einfangen, da der Aufruf bestTimeMs/coopBestTimeMs
    // bei einem tatsächlichen Highscore sofort überschreibt.
    const prevBest = state.coop.active
      ? state.stats.byDifficulty[state.puzzle.difficulty]?.coopBestTimeMs
      : state.stats.byDifficulty[state.puzzle.difficulty]?.bestTimeMs;
    const disqualified = state.mistakes > 0 || state.hintsUsed > 0;
    state.wouldHaveBeenBest = disqualified && (prevBest == null || state.elapsed < prevBest);
    const { stats, newHighscore } = recordResult({
      difficulty: state.puzzle.difficulty, outcome: 'won',
      timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
      coop: state.coop.active,
    });
    state.stats = stats;
    state.newHighscore = newHighscore;
  }
  if (state.isDailyGame) state.daily = recordDailyResult(state.dailyDateStr);
  if (state.isBossGame) state.boss = recordBossWin(state.bossWeekStr);
  // Trainingsrätsel landen bewusst nicht im Verlauf/in den Achievements (siehe
  // oben) -- sie werden beliebig oft wiederholt und sollen den Ringpuffer bzw.
  // "perfektes Spiel"-artige Erfolge nicht verwässern.
  if (!state.isTrainingGame) {
    state.puzzleHistory = recordHistory({
      difficulty: state.puzzle.difficulty, dim: { r: state.puzzle.rows, c: state.puzzle.cols },
      seed: state.puzzle.seed, marks: state.marks.map(row => row.slice()),
      timeMs: state.elapsed, outcome: 'won', coop: state.coop.active,
    });
    checkAchievements();
  }
  saveActiveGame(null);
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'won', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
}

function lose(remote) {
  if (state.status === 'lost') return;
  state.status = 'lost';
  log('game', `Verloren`, { remote: !!remote, coop: state.coop.active });
  stopTimer();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  if (!state.isCustomGame && !state.isTrainingGame) {
    const { stats } = recordResult({
      difficulty: state.puzzle.difficulty, outcome: 'lost',
      timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
      coop: state.coop.active,
    });
    state.stats = stats;
  }
  if (state.isBossGame) state.boss = recordBossLoss(state.bossWeekStr);
  if (!state.isTrainingGame) {
    state.puzzleHistory = recordHistory({
      difficulty: state.puzzle.difficulty, dim: { r: state.puzzle.rows, c: state.puzzle.cols },
      seed: state.puzzle.seed, marks: state.marks.map(row => row.slice()),
      timeMs: state.elapsed, outcome: 'lost', coop: state.coop.active,
    });
    checkAchievements();
  }
  saveActiveGame(null);
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'lost', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
}

function giveUp(remote) {
  if (!remote && state.status !== 'playing') return;
  if (remote && state.status === 'gaveup') return;
  state.status = 'gaveup';
  log('game', `Aufgegeben`, { remote: !!remote, coop: state.coop.active });
  stopTimer();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  if (!state.isCustomGame && !state.isTrainingGame) {
    const { stats } = recordResult({
      difficulty: state.puzzle.difficulty, outcome: 'gaveup',
      timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
      coop: state.coop.active,
    });
    state.stats = stats;
  }
  if (state.isBossGame) state.boss = recordBossLoss(state.bossWeekStr);
  if (!state.isTrainingGame) state.puzzleHistory = recordHistory({
    difficulty: state.puzzle.difficulty, dim: { r: state.puzzle.rows, c: state.puzzle.cols },
    seed: state.puzzle.seed, marks: state.marks.map(row => row.slice()),
    timeMs: state.elapsed, outcome: 'gaveup', coop: state.coop.active,
  });
  if (!state.isTrainingGame) checkAchievements();
  saveActiveGame(null);
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'gaveup', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
}

// Rein lokal: zeigt das fertige Feld nur auf diesem Gerät an, ohne den Partner
// zu beeinflussen oder den Spielstatus zu verändern (status bleibt
// 'won'/'lost'/'gaveup', damit "Zurück" einfach wieder zum Ergebnis-Dialog
// zurückkehrt). Bei 'won' sind die Markierungen bereits korrekt — der Aufruf
// setzt hier nur solutionShown, damit das Ergebnis-Overlay kurz ausgeblendet
// werden kann.
function revealSolution() {
  const p = state.puzzle;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      state.marks[r][c] = p.solution[r][c] ? 'kept' : 'removed';
  state.solutionShown = true;
}

function restartPuzzle(startTime) {
  log('game', `Puzzle neu gestartet`);
  state.marks = Array.from({ length: state.puzzle.rows }, () => Array(state.puzzle.cols).fill('none'));
  state.markedBy = Array.from({ length: state.puzzle.rows }, () => Array(state.puzzle.cols).fill(null));
  state.cellMeta = buildCellMeta(state.puzzle); // setzt auch hint/hintMark zurück
  state.lives = LIVES; state.maxLives = LIVES; state.hintsLeft = HINTS;
  state.hintsUsed = 0; state.mistakes = 0; state.history = []; state.flash = {}; state.justResolved = {};
  state.coop.lifeLossBy = []; state.coop.mistakesByPlayer = {};
  state.status = 'playing'; state.solutionShown = false; state.newHighscore = false; state.elapsed = 0;
  state.wouldHaveBeenBest = false; state.hintWarnShown = false;
  state.startTime = startTime ?? Date.now();
  startTimer(); persistGame();
}

// Verlässt man die Coop-Lobby selbst (auch mitten in der laufenden Runde), bekommt
// das NICHT automatisch das Spiel für den Partner – der eigene players/$uid-Eintrag
// verschwindet aus der RTDB (siehe Coop.leave()/coopReset()) und der Partner reagiert
// darauf genauso wie auf einen unerwarteten Verbindungsabbruch: er übernimmt bei
// laufender Runde selbst die Host-Rolle und spielt weiter (siehe promoteToHost()/
// onClose() bzw. onLeave() in startHosting/startJoining).
function quitToHome() {
  const wasCoop = state.coop.active;
  if (state.coop.role) coopReset();
  saveActiveGame(!wasCoop && state.status === 'playing' && !state.isTrainingGame ? activeSnapshot() : null);
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
    isDailyGame: state.isDailyGame, dailyDateStr: state.dailyDateStr,
    isBossGame: state.isBossGame, bossWeekStr: state.bossWeekStr,
    isCustomGame: state.isCustomGame,
    ts: Date.now(),
  };
}
function persistGame() {
  // Trainingsrätsel werden nie persistiert/fortgesetzt -- sie sind als
  // wiederholbarer Lerndurchlauf gedacht, kein "Spielstand".
  if (state.status !== 'playing' || state.isTrainingGame) { saveActiveGame(null); return; }
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
  state.isDailyGame = !!g.isDailyGame;
  state.dailyDateStr = g.dailyDateStr || null;
  state.isBossGame = !!g.isBossGame;
  state.bossWeekStr = g.bossWeekStr || null;
  state.isCustomGame = !!g.isCustomGame;
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
function setSetting(key, val) {
  state.settings[key] = val;
  if (key === 'language') applyLocale();
}
watch(() => state.settings, (s) => saveSettings(s), { deep: true });

// ─── DATEN: EXPORT / IMPORT / BACKUPS ─────────────────────────────────────────
function doExport() { exportToFile('manual').then(() => showToast(t('toast.backupExported'), 'success')).catch(() => {}); }
function doExportLog() { exportLogToFile().catch(() => {}); }
function doImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importFromFile(reader.result);
      state.settings = loadSettings(); state.stats = loadStats(); applyTheme(); applyLocale(); refreshResume();
      showToast(t('toast.importSuccess'), 'success');
    } catch { showToast(t('toast.importFailed'), 'error'); }
  };
  reader.readAsText(file);
  ev.target.value = '';
}
function openBackups() { state.modal = 'backups'; }
function doRestore(slot) {
  if (restoreBackup(slot)) {
    state.settings = loadSettings(); state.stats = loadStats(); applyTheme(); applyLocale(); refreshResume();
    state.modal = null; showToast(t('toast.backupRestored'), 'success');
  }
}
function resetStats() {
  ask(t('stats.resetConfirmTitle'), t('stats.resetConfirmMsg'), () => {
    localStorage.removeItem('cns_stats'); state.stats = loadStats(); showToast(t('stats.resetDone'), 'success');
  });
}
function doDeleteAllData() {
  ask(t('settings.deleteAllConfirmTitle'), t('settings.deleteAllConfirmMsg'), () => {
    deleteAllData();
    state.settings = loadSettings(); state.stats = loadStats(); state.daily = loadDaily(); state.boss = loadBoss(); state.puzzleHistory = loadHistory(); applyTheme(); applyLocale(); refreshResume();
    showToast(t('settings.deleteAllDone'), 'success');
  });
}

// ─── VERLAUF GELÖSTER RÄTSEL ───────────────────────────────────────────────────
// v1 = Snapshot abgeschlossener Rätsel (Endboard + Seed), kein zugweises
// Playback — es gibt aktuell keinen vollständigen Zug-Log (nur Single-Level-
// Undo, siehe state.history), siehe ROADMAP/Plan.
function openHistoryDetail(entry) {
  const puzzle = generatePuzzle({ difficulty: entry.difficulty, seed: entry.seed, dim: entry.dim });
  state.historyDetail = { entry, puzzle, cellMeta: buildCellMeta(puzzle) };
}
function closeHistoryDetail() { state.historyDetail = null; }
function historyGridStyle(puzzle) {
  const avail = Math.min(window.innerWidth - 80, 420);
  const cellPx = Math.max(20, Math.min(40, Math.floor(avail / (puzzle.cols + 1))));
  return {
    gridTemplateColumns: `var(--hdr) repeat(${puzzle.cols}, var(--cell))`,
    gridTemplateRows: `var(--hdr) repeat(${puzzle.rows}, var(--cell))`,
    '--cell': cellPx + 'px', '--hdr': cellPx + 'px',
    '--fs': Math.max(9, Math.round(cellPx * 0.4)) + 'px',
  };
}
function historyCellClasses(r, c) {
  const m = state.historyDetail.cellMeta[r][c];
  const mk = state.historyDetail.entry.marks?.[r]?.[c] || 'none';
  return {
    kept: mk === 'kept', removed: mk === 'removed', region: m.region >= 0,
    strike: mk === 'removed' && state.settings.eraseStyle === 'strike',
  };
}
function historyCellStyle(r, c) {
  const m = state.historyDetail.cellMeta[r][c];
  const st = { fontSize: 'var(--fs)' };
  if (m.color) { st['--rc-h'] = m.color.h; st['--rc-s'] = m.color.s + '%'; st['--rc-l'] = m.color.l + '%'; }
  return st;
}
// Erzeugt per Seed exakt dasselbe Rätsel neu und startet eine frische,
// spielbare Partie damit (kein zugweises Fortsetzen — ein neuer Versuch).
// Weicht die gespeicherte Dimension von der Standardgröße der Schwierigkeit
// ab, war es ein Custom-Spiel — dieselbe Ausschlussregel wie bei newGame().
function replayHistoryEntry(entry) {
  state.historyDetail = null;
  const stdDim = DIFF_BY_ID[entry.difficulty]?.dim;
  const isCustom = !stdDim || stdDim.r !== entry.dim.r || stdDim.c !== entry.dim.c;
  state.isDailyGame = false; state.dailyDateStr = null;
  state.isBossGame = false; state.bossWeekStr = null;
  state.isCustomGame = !state.coop.active && isCustom;
  state.generating = true;
  state.screen = 'game';
  setTimeout(() => {
    log('game', `Verlauf-Replay gestartet`, { difficulty: entry.difficulty, seed: entry.seed, dim: entry.dim });
    const puzzle = generatePuzzle({ difficulty: entry.difficulty, seed: entry.seed, dim: entry.dim });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    startTimer();
  }, 30);
}

// ─── TEILEN (viraler Loop) ─────────────────────────────────────────────────────
// Web Share API mit Clipboard-Fallback — analog zum bereits etablierten Muster
// in exportToFile() (storage.js), nur für Text statt einer Datei.
async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; }
    catch (e) { if (e.name === 'AbortError') return; log('app', 'Teilen fehlgeschlagen', e); }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); showToast(t('toast.linkCopied'), 'success'); return; }
    catch (e) { log('app', 'Kopieren fehlgeschlagen', e); }
  }
}
function shareDailyResult() {
  shareText(t('share.dailyResult', {
    time: fmtTime(state.elapsed), streak: state.daily.currentStreak, url: location.origin + location.pathname,
  }));
}
function shareCoopInvite() {
  shareText(t('share.coopInvite', { code: state.coop.code, url: location.origin + location.pathname }));
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

// ─── APP-UPDATE (Service Worker) ──────────────────────────────────────────────
// Hält den im "waiting" wartenden Worker, bis der Nutzer aktiv aktualisiert.
let waitingWorker = null;
let reloadingForUpdate = false;
function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  log('sw', `Update wird angewendet`);
  // Sobald der neue Worker die Kontrolle übernimmt, einmalig neu laden.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    log('sw', `Neuer Worker aktiv – lade neu`);
    location.reload();
  });
  waitingWorker.postMessage({ type: 'skipWaiting' });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  applyTheme();
  applyLocale();
  refreshResume();
  maybeShowWhatsNew();
  window.addEventListener('resize', computeCellSize);
}

// ════════════════════════════════════════════════════════════════════════════
//  KOMPONENTE / TEMPLATE
// ════════════════════════════════════════════════════════════════════════════
const App = {
  setup() {
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
    const dailyInfo = computed(() => getDailyChallenge());
    const dailyDoneToday = computed(() => state.daily.lastCompletedDate === dailyInfo.value.dateStr);
    const bossInfo = computed(() => getBossChallenge());
    const bossAttemptedThisWeek = computed(() => state.boss.lastAttemptedWeek === bossInfo.value.weekStr);

    return {
      state, BUILD, CHANGELOG, DIFFICULTIES, DIFF_BY_ID, CUSTOM_SIZES, ACHIEVEMENTS,
      livesArr, lifeLossColor, coopPerformance, mvpId, progress, gridStyle, coopAvailable,
      navigate, newGame, goNextPuzzle, resumeGame, onCellTap, onCellPointerDown, onCellPointerMove, onCellPointerCancel, undo, useHint, doCheck,
      rowSum, colSum, regionSum, rowResolved, colResolved, regionResolved, rowSumMatch, colSumMatch,
      fmtTime, toggleSetting, setSetting, doExport, doExportLog, doImport, openBackups, doRestore,
      resetStats, doDeleteAllData, ask, confirmYes, confirmNo, dismissWhatsNew, loadBackups,
      revealSolution, restartPuzzle, quitToHome, setZoom, pauseGame, resumeFromPause, startCoopRound,
      cellClasses, cellStyle, cellAriaLabel, toggleTool, restartFromGame,
      startHosting, startJoining, coopReset, avgTimeFor, coopAvgTimeFor, giveUp,
      chipTextColor, confirmCoopIdentity, onCoopNameBlur, playerColor, goCoop, applyUpdate,
      startDailyGame, dailyInfo, dailyDoneToday, shareDailyResult, shareCoopInvite,
      startBossGame, bossInfo, bossAttemptedThisWeek,
      startTrainingGame, applyTrainingStep,
      openHistoryDetail, closeHistoryDetail, historyGridStyle, historyCellClasses, historyCellStyle, replayHistoryEntry,
      t, i18nState, SUPPORTED_LOCALES,
    };
  },
  template: `
  <div class="app" :class="{ generating: state.generating, 'modal-open': !!state.modal }">

    <!-- ══ HOME ══ -->
    <section v-if="state.screen==='home'" class="screen home">
      <div class="brand">
        <img class="brand-logo" src="./icons/icon-192.png" alt="" />
        <h1 class="brand-title">Coop<br>Number Sums</h1>
      </div>

      <div class="home-actions">
        <button v-if="state.resumeAvailable" class="btn btn-resume" @click="resumeGame">
          <span class="btn-ic">▶</span>
          <span class="btn-tx"><b>{{ t('home.resume') }}</b>
            <small>{{ t('difficulty.'+state.resumeAvailable.difficulty) }} · {{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.dim.r }}×{{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.dim.c }} · {{ fmtTime(state.resumeAvailable.elapsed||0) }}</small>
          </span>
        </button>
        <button class="btn btn-primary" @click="navigate('setup')">
          <span class="btn-ic">➕</span><span class="btn-tx"><b>{{ t('home.newGame') }}</b><small>{{ t('home.newGameHint') }}</small></span>
        </button>
        <button class="btn btn-coop" :disabled="!coopAvailable" @click="goCoop">
          <span class="btn-ic">👥</span><span class="btn-tx"><b>{{ t('home.coopMode') }}</b><small>{{ t('home.coopHint') }}</small></span>
          <span v-if="!coopAvailable" class="badge-soon">{{ t('home.comingSoon') }}</span>
        </button>
        <button class="btn daily-btn" :class="dailyDoneToday ? 'btn-ghost' : 'btn-daily'" @click="startDailyGame">
          <span class="btn-ic">📅</span>
          <span class="btn-tx"><b>{{ t('home.dailyChallenge') }}</b><small>{{ dailyDoneToday ? t('home.dailyDone') : t('difficulty.'+dailyInfo.difficulty) }}</small></span>
          <span v-if="state.daily.currentStreak>0" class="badge-soon">🔥{{ state.daily.currentStreak }}</span>
        </button>
        <button class="btn boss-btn" :class="bossAttemptedThisWeek ? 'btn-ghost' : 'btn-daily'" :disabled="bossAttemptedThisWeek" @click="startBossGame">
          <span class="btn-ic">👹</span>
          <span class="btn-tx"><b>{{ t('home.bossChallenge') }}</b><small>{{ bossAttemptedThisWeek ? t('home.bossDone') : t('difficulty.'+bossInfo.difficulty) }}</small></span>
          <span v-if="state.boss.currentStreak>0" class="badge-soon">🔥{{ state.boss.currentStreak }}</span>
        </button>
        <button class="btn training-btn btn-ghost" @click="startTrainingGame">
          <span class="btn-ic">🎓</span>
          <span class="btn-tx"><b>{{ t('home.trainingMode') }}</b><small>{{ t('home.trainingHint') }}</small></span>
        </button>
        <div class="home-grid">
          <button class="btn btn-ghost" @click="navigate('stats')"><span class="btn-ic">📊</span> {{ t('home.stats') }}</button>
          <button class="btn btn-ghost" @click="navigate('settings')"><span class="btn-ic">⚙️</span> {{ t('home.settings') }}</button>
          <button class="btn btn-ghost" @click="state.modal='howto'"><span class="btn-ic">❓</span> {{ t('home.howto') }}</button>
          <button class="btn btn-ghost" @click="state.modal='changelog'"><span class="btn-ic">📝</span> {{ t('home.changelog') }}</button>
          <button class="btn btn-ghost" @click="navigate('history')"><span class="btn-ic">🕘</span> {{ t('home.history') }}</button>
        </div>
      </div>
      <div class="home-version">v{{ BUILD }}</div>
    </section>

    <!-- ══ SETUP ══ -->
    <section v-else-if="state.screen==='setup'" class="screen setup">
      <header class="topbar">
        <button class="icon-btn" @click="navigate('home')">‹</button>
        <h2>{{ t('setup.title') }}</h2><span></span>
      </header>
      <div class="setup-body">
        <div class="seg" v-if="!state.coop.active">
          <button :class="{active: !state.sel.custom}" @click="state.sel.custom=false">{{ t('setup.standardTab') }}</button>
          <button :class="{active: state.sel.custom}" @click="state.sel.custom=true">{{ t('setup.customTab') }}</button>
        </div>
        <div class="setup-label">{{ t('common.difficulty') }}</div>
        <div class="option-grid">
          <button v-for="d in DIFFICULTIES" :key="d.id" class="opt-card" :class="{active: state.sel.difficulty===d.id}" @click="state.sel.difficulty=d.id">
            <span class="opt-emoji">{{ d.emoji }}</span>
            <span class="opt-name">{{ t('difficulty.'+d.id) }}</span>
            <span class="opt-desc">{{ (!state.coop.active && state.sel.custom) ? (state.sel.customSize+'×'+state.sel.customSize) : (d.dim.r+'×'+d.dim.c) }}</span>
            <span v-if="!(!state.coop.active && state.sel.custom) && state.stats.byDifficulty[d.id]?.bestTimeMs!=null" class="opt-best">🏆 {{ fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) }}</span>
            <span v-if="!(!state.coop.active && state.sel.custom) && state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="opt-best">👥🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
          </button>
        </div>
        <template v-if="!state.coop.active && state.sel.custom">
          <div class="setup-label">{{ t('setup.customSizeLabel') }}</div>
          <div class="option-grid">
            <button v-for="n in CUSTOM_SIZES" :key="n" class="opt-card" :class="{active: state.sel.customSize===n}" @click="state.sel.customSize=n">
              <span class="opt-name">{{ n }}×{{ n }}</span>
            </button>
          </div>
          <small class="set-hint">{{ t('setup.customHint') }}</small>
        </template>
        <button class="btn btn-primary btn-start" @click="newGame(state.sel.difficulty, (!state.coop.active && state.sel.custom) ? { r: state.sel.customSize, c: state.sel.customSize } : undefined)">
          {{ t('setup.start') }}
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
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing' && !state.coop.awaitingStart" @click="pauseGame" :title="t('game.pauseTitle')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg>
          </button>
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing'" @click="ask(t('game.giveUpConfirmTitle'), t('game.giveUpConfirmMsg'), giveUp)" :title="t('game.giveUpTitle')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="5" y="3" width="2.4" height="18" rx="1.2"/><path d="M7.4 4h12.1l-3 3.6 3 3.6H7.4z"/></svg>
          </button>
          <button class="icon-btn" @click="state.modal='howto'">?</button>
        </div>
      </header>

      <div v-if="state.generating" class="loading">
        <div class="spinner"></div>
        <div class="loading-tx">{{ t('game.loading') }}</div>
      </div>

      <template v-else-if="state.puzzle">
        <div class="game-meta">
          <span class="chip">{{ DIFF_BY_ID[state.puzzle.difficulty].emoji }} {{ t('difficulty.'+state.puzzle.difficulty) }}</span>
          <span class="chip">{{ state.puzzle.rows }}×{{ state.puzzle.cols }}</span>
          <span v-if="state.coop.active" class="chip coop-chip" :class="state.coop.connected ? 'coop-on' : 'coop-off'">
            👥 {{ t('game.coopTag') }}{{ state.coop.connected ? '' : t('game.coopOfflineSuffix') }}
          </span>
          <span class="zoomctl">
            <button class="zoom-btn" @click="setZoom(-0.15)">−</button>
            <button class="zoom-btn" @click="setZoom(0.15)">+</button>
          </span>
        </div>

        <div v-if="state.coop.active && state.coop.players.length" class="coop-roster">
          <span v-for="p in state.coop.players" :key="p.id" class="player-chip"
                :style="{ background: p.color, color: chipTextColor(p.color) }">
            {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
          </span>
        </div>

        <div class="board-wrap" :class="{ blurred: state.paused || state.coop.awaitingStart }">
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
                   role="button" tabindex="0" :aria-label="cellAriaLabel(r-1,c-1)"
                   @click="onCellTap(r-1,c-1)"
                   @keydown.enter.prevent="onCellTap(r-1,c-1)"
                   @keydown.space.prevent="onCellTap(r-1,c-1)"
                   @pointerdown="onCellPointerDown($event,r-1,c-1)"
                   @pointermove="onCellPointerMove($event)"
                   @pointerup="onCellPointerCancel"
                   @pointerleave="onCellPointerCancel"
                   @pointercancel="onCellPointerCancel"
                   @contextmenu.prevent>
                <span v-if="state.cellMeta[r-1][c-1].chip!=null && !regionResolved(state.cellMeta[r-1][c-1].region)" class="rchip">{{ state.cellMeta[r-1][c-1].chip }}</span>
                <span class="cnum">{{ state.puzzle.values[r-1][c-1] }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Werkzeug-Umschalter (Radierer / Stift) — während der Lösungsanzeige
             ausgeblendet, da Bearbeiten dort ohnehin nicht möglich/sinnvoll ist
             und die Buttons sonst von der .review-bar verdeckt würden. -->
        <div v-if="!state.solutionShown && (!state.isTrainingGame || state.trainingDone)" class="toolbar">
          <button class="round-btn" :disabled="!state.history.length" @click="undo" :title="t('game.undoTitle')" :aria-label="t('game.undoTitle')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-4"/></svg>
          </button>
          <div class="tool-toggle" @click="toggleTool">
            <div class="tool-pill" :class="{ pen: state.tool==='pen' }"></div>
            <span class="tool-ic eraser" :class="{active: state.tool==='eraser'}" :title="t('game.eraserTitle')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 20H20"/><path d="m3.6 14.5 5.9 5.9 9.4-9.4a2 2 0 0 0 0-2.8l-3.1-3.1a2 2 0 0 0-2.8 0L3.6 11.7a2 2 0 0 0 0 2.8z"/><path d="m9 8.5 6.5 6.5"/></svg>
            </span>
            <span class="tool-ic pen" :class="{active: state.tool==='pen'}" :title="t('game.penTitle')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="11" cy="13" rx="8" ry="7"/><path d="m16.5 7.5 3.2-3.2a1.6 1.6 0 0 1 2.3 2.3l-3.2 3.2-2.3-2.3z"/></svg>
            </span>
          </div>
          <button class="round-btn" :disabled="state.hintsLeft<=0" @click="useHint" :title="t('game.hintTitle')" :aria-label="t('game.hintTitle')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.8.7 1.2 1.3 1.3 2.4h5.4c.1-1.1.5-1.7 1.3-2.4A6.5 6.5 0 0 0 12 2.5z"/></svg>
          </button>
        </div>
        <div v-if="!state.solutionShown && state.settings.errorReveal==='onCheck' && (!state.isTrainingGame || state.trainingDone)" class="check-row">
          <button class="btn btn-primary btn-check" @click="doCheck()">{{ t('game.check') }}</button>
        </div>
      </template>

      <!-- Trainingsmodus: Erklär-Banner für den nächsten erzwungenen Schritt.
           Bewusst kein Vollbild-Overlay (wie Pause/Coop-Lobby) -- das Feld
           bleibt sichtbar, die betroffene Zelle ist per .training-highlight
           markiert (siehe cellClasses), damit Erklärung und Zelle zusammen
           erkennbar sind. -->
      <div v-if="state.isTrainingGame && state.status==='playing' && !state.paused && !state.solutionShown" class="training-banner">
        <template v-if="state.trainingStep">
          <div class="training-text">
            <b>{{ t('training.group.'+state.trainingStep.group.kind, { n: state.trainingStep.group.ref+1 }) }} ({{ t('training.target', { n: state.trainingStep.group.target }) }})</b>
            <span>{{ t('training.reason.'+state.trainingStep.reason) }}</span>
          </div>
          <button class="btn btn-primary btn-sm" @click="applyTrainingStep">{{ t('training.apply') }}</button>
        </template>
        <template v-else-if="state.trainingDone">
          <div class="training-text">{{ t('training.doneMsg') }}</div>
        </template>
      </div>

      <!-- Coop-Lobby: Rätsel ist da, Zeit läuft erst nach "Starten" -->
      <div v-if="state.coop.awaitingStart" class="overlay coop-lobby-overlay">
        <div class="result-card">
          <div class="result-emoji">👥</div>
          <h2>{{ t('coop.lobbyTitle') }}</h2>
          <p class="result-msg">{{ t('coop.lobbyMsg') }}</p>
          <button class="btn btn-primary" @click="startCoopRound">{{ t('coop.lobbyStart') }}</button>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>

      <!-- Pause -->
      <div v-if="state.paused" class="overlay pause-overlay">
        <div class="result-card">
          <div class="result-emoji">⏸️</div>
          <h2>{{ t('pause.title') }}</h2>
          <div class="pause-time">⏱ {{ fmtTime(state.elapsed) }}</div>
          <p class="result-msg">{{ t('pause.msg') }}</p>
          <button class="btn btn-primary" @click="resumeFromPause">{{ t('pause.resume') }}</button>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>

      <!-- Gewonnen / Verloren -->
      <div v-if="state.status==='won' && !state.solutionShown" class="overlay">
        <div class="result-card win">
          <div class="result-emoji">🎉</div>
          <h2>{{ t('win.title') }}</h2>
          <div v-if="state.newHighscore" class="highscore-badge">{{ t('win.newHighscore') }}</div>
          <div v-else-if="state.wouldHaveBeenBest" class="highscore-badge missed">
            {{ t('win.missedPrefix') }}
            <template v-if="state.mistakes>0 && state.hintsUsed>0"> {{ t('win.missedBoth') }}</template>
            <template v-else-if="state.mistakes>0"> {{ t('win.missedMistakes') }}</template>
            <template v-else> {{ t('win.missedHints') }}</template>.
          </div>
          <div class="result-stats">
            <div><b>{{ fmtTime(state.elapsed) }}</b><small>{{ t('win.timeLabel') }}</small></div>
            <div><b>{{ state.mistakes }}</b><small>{{ t('win.mistakesLabel') }}</small></div>
            <div><b>{{ state.hintsUsed }}</b><small>{{ t('win.hintsLabel') }}</small></div>
          </div>
          <div v-if="coopPerformance.length" class="coop-performance">
            <div class="perf-title">{{ t('win.teamPerformance') }}</div>
            <div v-for="pl in coopPerformance" :key="pl.id" class="perf-row" :class="{mvp: pl.id===mvpId}">
              <div class="perf-head">
                <span class="perf-name" :style="{color: pl.color}">{{ pl.name }}<template v-if="pl.id===mvpId"> {{ t('win.mvp') }}</template></span>
                <span class="perf-pct">{{ pl.contributionPct }}%</span>
              </div>
              <div class="perf-bar"><div class="perf-bar-fill" :style="{width: pl.contributionPct + '%', background: pl.color}"></div></div>
              <div class="perf-nums">
                <span>{{ t('win.correctKept', { count: pl.correctKept }) }}</span>
                <span>{{ t('win.correctRemoved', { count: pl.correctRemoved }) }}</span>
                <span>{{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
              </div>
            </div>
          </div>
          <div v-if="state.isDailyGame" class="highscore-badge">{{ t('daily.streakBadge', { count: state.daily.currentStreak }) }}</div>
          <div v-if="state.isBossGame" class="highscore-badge">{{ t('boss.streakBadge', { count: state.boss.currentStreak }) }}</div>
          <button v-if="state.isDailyGame" class="btn btn-ghost" @click="shareDailyResult">📤 {{ t('share.button') }}</button>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.isDailyGame && !state.isBossGame && (!state.coop.active || state.coop.role==='host')" @click="goNextPuzzle">{{ t('win.nextPuzzle') }}</button>
          <p v-else-if="state.coop.active && state.coop.role!=='host'" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-ghost" @click="revealSolution">{{ t('win.viewBoard') }}</button>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>
      <div v-if="state.status==='lost' && !state.solutionShown" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">💔</div>
          <h2>{{ t('loss.title') }}</h2>
          <p class="result-msg">{{ t('loss.msg') }}</p>
          <div v-if="coopPerformance.length" class="coop-performance">
            <div class="perf-title">{{ t('win.teamPerformance') }}</div>
            <div v-for="pl in coopPerformance" :key="pl.id" class="perf-row" :class="{mvp: pl.id===mvpId}">
              <div class="perf-head">
                <span class="perf-name" :style="{color: pl.color}">{{ pl.name }}<template v-if="pl.id===mvpId"> {{ t('win.mvp') }}</template></span>
                <span class="perf-pct">{{ pl.contributionPct }}%</span>
              </div>
              <div class="perf-bar"><div class="perf-bar-fill" :style="{width: pl.contributionPct + '%', background: pl.color}"></div></div>
              <div class="perf-nums">
                <span>{{ t('win.correctKept', { count: pl.correctKept }) }}</span>
                <span>{{ t('win.correctRemoved', { count: pl.correctRemoved }) }}</span>
                <span>{{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
              </div>
            </div>
          </div>
          <div v-if="state.isBossGame" class="result-msg">{{ t('boss.tryAgainNextWeek') }}</div>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.isBossGame" @click="restartFromGame">{{ t('loss.retry') }}</button>
          <button class="btn btn-ghost" v-if="!state.isTrainingGame && (!state.coop.active || state.coop.role==='host')" @click="navigate('setup')">{{ t('common.newGame') }}</button>
          <button class="btn btn-ghost" @click="revealSolution">{{ t('loss.showSolution') }}</button>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>
      <div v-if="state.status==='gaveup' && !state.solutionShown" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">🏳</div>
          <h2>{{ t('gaveup.title') }}</h2>
          <p class="result-msg">{{ t('loss.msg') }}</p>
          <div v-if="state.isBossGame" class="result-msg">{{ t('boss.tryAgainNextWeek') }}</div>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.isBossGame" @click="restartFromGame">{{ t('loss.retry') }}</button>
          <button class="btn btn-ghost" v-if="!state.isTrainingGame && (!state.coop.active || state.coop.role==='host')" @click="navigate('setup')">{{ t('common.newGame') }}</button>
          <button class="btn btn-ghost" @click="revealSolution">{{ t('loss.showSolution') }}</button>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>
      <!-- Lösungsanzeige ist rein lokal (Punkt 4): "Zurück" bringt nur diesen
           Spieler zum Ergebnis-Dialog zurück, ohne den Partner zu beeinflussen. -->
      <transition name="toast">
        <div v-if="state.solutionShown" class="review-bar">
          <span>{{ state.status==='won' ? t('review.puzzle') : t('review.solution') }}</span>
          <button class="btn btn-primary btn-sm" @click="state.solutionShown=false">{{ t('common.back') }}</button>
        </div>
      </transition>

      <!-- Confetti -->
      <div v-if="state.confetti.length" class="confetti">
        <i v-for="p in state.confetti" :key="p.id" :style="{left:p.left+'%', background:p.color, animationDelay:p.delay+'s', animationDuration:p.dur+'s', width:p.size+'px', height:p.size+'px', transform:'rotate('+p.rot+'deg)'}"></i>
      </div>
    </section>

    <!-- ══ STATS ══ -->
    <section v-else-if="state.screen==='stats'" class="screen stats">
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>{{ t('stats.title') }}</h2><span></span></header>
      <div class="stats-body">
        <div class="stats-section-title">{{ t('stats.levelOverview') }}</div>
        <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
          <div class="diff-row-top">
            <span class="diff-name">{{ d.emoji }} {{ t('difficulty.'+d.id) }}</span>
          </div>
          <div class="diff-sub">
            <div class="diff-sub-label">{{ t('stats.solo') }}</div>
            <div class="diff-row-sub">
              <span class="chip">{{ (state.stats.byDifficulty[d.id]?.won)||0 }} / {{ (state.stats.byDifficulty[d.id]?.played)||0 }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.bestTimeMs!=null" class="chip best-time-chip">🏆 {{ fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) }}</span>
              <span v-if="avgTimeFor(d.id)!=null" class="chip">⌀ {{ fmtTime(avgTimeFor(d.id)) }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.gaveup" class="chip">🏳 {{ state.stats.byDifficulty[d.id].gaveup }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.lost" class="chip">💔 {{ state.stats.byDifficulty[d.id].lost }}</span>
            </div>
          </div>
          <div class="diff-sub">
            <div class="diff-sub-label coop">{{ t('stats.coop') }}</div>
            <div class="diff-row-sub">
              <span class="chip coop-chip">{{ (state.stats.byDifficulty[d.id]?.coopWon)||0 }} / {{ (state.stats.byDifficulty[d.id]?.coopPlayed)||0 }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="chip coop-chip best-time-chip">🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
              <span v-if="coopAvgTimeFor(d.id)!=null" class="chip coop-chip">⌀ {{ fmtTime(coopAvgTimeFor(d.id)) }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.coopGaveup" class="chip coop-chip">🏳 {{ state.stats.byDifficulty[d.id].coopGaveup }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.coopLost" class="chip coop-chip">💔 {{ state.stats.byDifficulty[d.id].coopLost }}</span>
            </div>
          </div>
        </div>
        <button class="btn btn-ghost" @click="navigate('achievements')">{{ t('stats.achievementsButton') }}</button>
        <button class="btn btn-danger-ghost" @click="resetStats">{{ t('stats.reset') }}</button>
      </div>
    </section>

    <!-- ══ ACHIEVEMENTS ══ -->
    <section v-else-if="state.screen==='achievements'" class="screen achievements">
      <header class="topbar"><button class="icon-btn" @click="navigate('stats')">‹</button><h2>{{ t('achievements.title') }}</h2><span></span></header>
      <div class="achievements-body">
        <div v-for="a in ACHIEVEMENTS" :key="a.id" class="achievement-row" :class="{ unlocked: !!state.achievements[a.id] }">
          <span class="achievement-icon">{{ state.achievements[a.id] ? a.icon : '🔒' }}</span>
          <div class="achievement-text">
            <div class="achievement-name">{{ t('achievements.'+a.id+'.title') }}</div>
            <div class="achievement-desc">{{ t('achievements.'+a.id+'.desc') }}</div>
            <div v-if="state.achievements[a.id]" class="achievement-date">{{ t('achievements.unlockedOn', { date: new Date(state.achievements[a.id]).toLocaleDateString('de-DE') }) }}</div>
            <div v-else class="achievement-date locked">{{ t('achievements.locked') }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ VERLAUF ══ -->
    <section v-else-if="state.screen==='history'" class="screen history">
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>{{ t('history.title') }}</h2><span></span></header>
      <div class="history-body">
        <div v-if="!state.puzzleHistory.length" class="empty">{{ t('history.empty') }}</div>
        <div v-for="h in state.puzzleHistory" :key="h.ts" class="history-row">
          <div class="history-row-main">
            <span class="history-outcome" :class="'outcome-'+h.outcome">{{ h.outcome==='won' ? '🏆' : (h.outcome==='lost' ? '💔' : '🏳') }}</span>
            <span class="diff-name">{{ DIFF_BY_ID[h.difficulty]?.emoji }} {{ t('difficulty.'+h.difficulty) }}</span>
            <span class="chip">{{ h.dim.r }}×{{ h.dim.c }}</span>
            <span v-if="h.coop" class="chip coop-chip">👥</span>
          </div>
          <div class="history-row-sub">
            <span>{{ t('history.outcome.'+h.outcome) }} · {{ fmtTime(h.timeMs) }}</span>
            <span class="history-date">{{ new Date(h.ts).toLocaleString('de-DE') }}</span>
          </div>
          <div class="history-row-actions">
            <button class="btn btn-ghost btn-sm" @click="openHistoryDetail(h)">{{ t('history.view') }}</button>
            <button class="btn btn-primary btn-sm" @click="replayHistoryEntry(h)">{{ t('history.replay') }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ COOP ══ -->
    <section v-else-if="state.screen==='coop'" class="screen coop-screen">
      <header class="topbar">
        <button class="icon-btn" @click="coopReset(); navigate('home')">‹</button>
        <h2>{{ t('coop.title') }}</h2><span></span>
      </header>

      <!-- Namens-Gate: bevor irgendetwas anderes möglich ist, Name + eigene Farbe festlegen
           (jedes Mal erneut, aber mit dem zuletzt gespeicherten Namen vorbefüllt) -->
      <div v-if="!state.coop.identityConfirmed" class="coop-body">
        <p class="coop-tagline">{{ t('coop.identityPrompt') }}</p>
        <input class="text-input" v-model="state.coop.nameDraft" maxlength="32" :placeholder="t('common.namePlaceholder')"
               @keydown.enter="confirmCoopIdentity" />
        <div class="setup-label">{{ t('coop.yourColor') }}</div>
        <div class="coop-swatches">
          <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" :title="t('common.pickColorTitle')" />
        </div>
        <button class="btn btn-primary" :disabled="!state.coop.nameDraft.trim()" @click="confirmCoopIdentity">{{ t('coop.continue') }}</button>
      </div>

      <!-- Auswahl: Hosten oder Beitreten? -->
      <div v-else-if="state.coop.role === null" class="coop-body">
        <p class="coop-tagline">{{ t('coop.tagline') }}</p>
        <button class="btn btn-primary" @click="state.coop.role='host'">
          <span class="btn-ic">📡</span>
          <span class="btn-tx"><b>{{ t('coop.host') }}</b><small>{{ t('coop.hostHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" @click="state.coop.role='guest'">
          <span class="btn-ic">🔗</span>
          <span class="btn-tx"><b>{{ t('coop.join') }}</b><small>{{ t('coop.joinHint') }}</small></span>
        </button>
      </div>

      <!-- Host: Code festlegen + Schwierigkeit → warte auf Gast -->
      <div v-else-if="state.coop.role === 'host'" class="coop-body">
        <template v-if="!state.coop.waitingForGuest">
          <div class="coop-code-label">{{ t('coop.setCode') }}</div>
          <input class="coop-input" v-model="state.coop.code" maxlength="6" inputmode="numeric" pattern="[0-9]*"
                 :placeholder="t('common.codePlaceholder')" @input="state.coop.code=state.coop.code.replace(/\D/g,'')" />
          <div class="setup-label">{{ t('common.difficulty') }}</div>
          <div class="option-grid">
            <button v-for="d in DIFFICULTIES" :key="d.id" class="opt-card"
                    :class="{active: state.coop.lobbyDiffId===d.id}"
                    @click="state.coop.lobbyDiffId=d.id">
              <span class="opt-emoji">{{ d.emoji }}</span>
              <span class="opt-name">{{ t('difficulty.'+d.id) }}</span>
              <span class="opt-desc">{{ d.dim.r }}×{{ d.dim.c }}</span>
              <span v-if="state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="opt-best">👥🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
            </button>
          </div>
          <button class="btn btn-primary" @click="startHosting">{{ t('coop.startHosting') }}</button>
        </template>
        <template v-else>
          <div class="coop-code-label">{{ t('coop.yourCode') }}</div>
          <div class="coop-code">{{ state.coop.code }}</div>
          <p class="coop-subtext">{{ t('coop.shareCode') }}</p>
          <button class="btn btn-ghost btn-sm" @click="shareCoopInvite">📤 {{ t('coop.shareInvite') }}</button>
          <div class="coop-waiting">
            <div class="spinner"></div>
            <div class="loading-tx">{{ t('coop.waitingForGuest') }}</div>
          </div>
        </template>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:8px" @click="coopReset(); state.coop.role=null">{{ t('common.cancel') }}</button>
      </div>

      <!-- Gast: Code eingeben → verbinden -->
      <div v-else-if="state.coop.role === 'guest'" class="coop-body">
        <div class="coop-code-label">{{ t('coop.enterHostCode') }}</div>
        <input class="coop-input" v-model="state.coop.code" maxlength="6" inputmode="numeric" pattern="[0-9]*"
               :placeholder="t('common.codePlaceholder')" :disabled="state.coop.waitingForGuest"
               @input="state.coop.code=state.coop.code.replace(/\D/g,'')"
               @keydown.enter="startJoining" />
        <button class="btn btn-primary" :disabled="state.coop.waitingForGuest || state.coop.code.length!==6" @click="startJoining">
          <span v-if="state.coop.waitingForGuest"><span class="spinner-inline"></span> {{ t('coop.connecting') }}</span>
          <span v-else>{{ t('coop.connect') }}</span>
        </button>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:4px" @click="coopReset(); state.coop.role=null">{{ t('common.back') }}</button>
      </div>
    </section>

    <!-- ══ SETTINGS ══ -->
    <section v-else-if="state.screen==='settings'" class="screen settings">
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>{{ t('settings.title') }}</h2><span></span></header>
      <div class="settings-body">
        <div class="set-group-title">{{ t('settings.appearance') }}</div>
        <div class="set-row" @click="toggleSetting('darkMode')">
          <span>{{ t('settings.darkMode') }}</span><span class="switch" :class="{on:state.settings.darkMode}"><i></i></span>
        </div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.language') }}</span>
          <select class="text-input" :value="state.settings.language" @change="setSetting('language', $event.target.value)">
            <option v-for="l in SUPPORTED_LOCALES" :key="l.id" :value="l.id">{{ l.label }}</option>
          </select>
        </div>

        <div class="set-group-title">{{ t('settings.gameHelp') }}</div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.errorReveal') }}</span>
          <div class="seg">
            <button :class="{active:state.settings.errorReveal==='instant'}" @click="setSetting('errorReveal','instant')">{{ t('settings.instant') }}</button>
            <button :class="{active:state.settings.errorReveal==='onCheck'}" @click="setSetting('errorReveal','onCheck')">{{ t('settings.onCheck') }}</button>
          </div>
          <small class="set-hint">{{ state.settings.errorReveal==='instant' ? t('settings.errorRevealHintInstant') : t('settings.errorRevealHintOnCheck') }}</small>
        </div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.eraseStyle') }}</span>
          <div class="seg">
            <button :class="{active:state.settings.eraseStyle==='hide'}" @click="setSetting('eraseStyle','hide')">{{ t('settings.hide') }}</button>
            <button :class="{active:state.settings.eraseStyle==='strike'}" @click="setSetting('eraseStyle','strike')">{{ t('settings.strike') }}</button>
          </div>
        </div>
        <div class="set-row" @click="toggleSetting('livesEnabled')">
          <span>{{ t('settings.livesEnabled') }}</span><span class="switch" :class="{on:state.settings.livesEnabled}"><i></i></span>
        </div>

        <div class="set-group-title">{{ t('settings.misc') }}</div>
        <div class="set-row" @click="toggleSetting('showTimer')">
          <span>{{ t('settings.showTimer') }}</span><span class="switch" :class="{on:state.settings.showTimer}"><i></i></span>
        </div>

        <div class="set-group-title">{{ t('settings.a11y') }}</div>
        <div class="set-row" @click="toggleSetting('colorBlindMode')">
          <span>{{ t('settings.colorBlindMode') }}</span><span class="switch" :class="{on:state.settings.colorBlindMode}"><i></i></span>
        </div>
        <small class="set-hint">{{ t('settings.colorBlindModeHint') }}</small>

        <div class="set-group-title">{{ t('settings.coop') }}</div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.displayName') }}</span>
          <input class="text-input" v-model="state.settings.coopName" maxlength="32" :placeholder="t('common.namePlaceholder')" @blur="onCoopNameBlur" />
        </div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.myColor') }}</span>
          <div class="coop-swatches">
            <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" :title="t('common.pickColorTitle')" />
          </div>
          <small class="set-hint">{{ t('settings.colorHint') }}</small>
        </div>
        <div class="set-row" @click="toggleSetting('coopRemovedOutline')">
          <span>{{ t('settings.coopRemovedOutline') }}</span><span class="switch" :class="{on:state.settings.coopRemovedOutline}"><i></i></span>
        </div>
        <small class="set-hint">{{ t('settings.coopRemovedOutlineHint') }}</small>

        <div class="set-group-title">{{ t('settings.data') }}</div>
        <button class="btn btn-ghost" @click="doExport">{{ t('settings.exportBackup') }}</button>
        <label class="btn btn-ghost file-btn">{{ t('settings.importBackup') }}
          <input type="file" accept="application/json" @change="doImport" hidden>
        </label>
        <button class="btn btn-ghost" @click="openBackups">{{ t('settings.autoBackups') }}</button>
        <button class="btn btn-ghost" @click="doExportLog">{{ t('settings.exportLog') }}</button>
        <a class="btn btn-ghost" href="./privacy.html" target="_blank" rel="noopener">{{ t('settings.privacyPolicy') }}</a>
        <a class="btn btn-ghost" href="./imprint.html" target="_blank" rel="noopener">{{ t('settings.imprint') }}</a>
        <button class="btn btn-danger-ghost" @click="doDeleteAllData">{{ t('settings.deleteAllData') }}</button>
      </div>
    </section>

    <!-- ══ TOAST ══ -->
    <transition name="toast">
      <div v-if="state.toast" class="toast" :class="state.toast.type">{{ state.toast.msg }}</div>
    </transition>
    <!-- Top-Banner statt Toast: verdeckt nie das Spielfeld, sitzt am oberen Rand. -->
    <transition name="toast">
      <div v-if="state.bestTimeNotice" class="best-time-banner">⏱️ {{ state.bestTimeNotice }}</div>
    </transition>

    <!-- ══ MODALS ══ -->
    <div v-if="state.modal==='howto'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>{{ t('howto.title') }}</h3>
        <ol class="rules">
          <li v-html="t('howto.rule1')"></li>
          <li v-html="t('howto.rule2')"></li>
          <li v-html="t('howto.rule3')"></li>
          <li v-html="t('howto.rule4')"></li>
          <li v-html="t('howto.rule5')"></li>
          <li v-html="t('howto.rule6')"></li>
          <li v-if="state.coop.active" v-html="t('howto.rule7Coop')"></li>
          <li v-if="!state.coop.active && state.settings.errorReveal==='onCheck'" v-html="t('howto.rule8OnCheck')"></li>
          <li v-html="t('howto.rule9')"></li>
        </ol>
        <button class="btn btn-primary" @click="state.modal=null">{{ t('howto.understood') }}</button>
      </div>
    </div>

    <div v-if="state.modal==='changelog'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>{{ t('changelog.title') }}</h3>
        <p v-if="i18nState.locale!=='de'" class="set-hint">{{ t('changelog.germanOnlyNote') }}</p>
        <div class="changelog">
          <div v-for="e in CHANGELOG" :key="e.version" class="cl-entry">
            <div class="cl-head"><b>v{{ e.version }}</b><span>{{ e.date }}</span></div>
            <ul><li v-for="(it,i) in e.changes" :key="i">✦ {{ it }}</li></ul>
          </div>
        </div>
        <button class="btn btn-primary" @click="state.modal=null">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="state.modal==='backups'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>{{ t('backups.title') }}</h3>
        <div v-if="!loadBackups().length" class="empty">{{ t('backups.empty') }}</div>
        <div v-for="b in loadBackups()" :key="b.slot" class="backup-row">
          <span>{{ new Date(b.ts).toLocaleString('de-DE') }}<small> · {{ b.label }}</small></span>
          <button class="btn btn-sm btn-primary" @click="doRestore(b.slot)">{{ t('backups.load') }}</button>
        </div>
        <button class="btn btn-ghost" @click="state.modal=null">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="state.historyDetail" class="modal-bg" @click.self="closeHistoryDetail">
      <div class="modal modal-history">
        <h3>{{ DIFF_BY_ID[state.historyDetail.entry.difficulty]?.emoji }} {{ t('difficulty.'+state.historyDetail.entry.difficulty) }} · {{ state.historyDetail.entry.dim.r }}×{{ state.historyDetail.entry.dim.c }}</h3>
        <div class="board-wrap">
          <div class="board" :style="historyGridStyle(state.historyDetail.puzzle)">
            <div class="corner"></div>
            <div v-for="c in state.historyDetail.puzzle.cols" :key="'hch'+c" class="hdr col-hdr">
              <span class="tgt">{{ state.historyDetail.puzzle.colTargets[c-1] }}</span>
            </div>
            <template v-for="r in state.historyDetail.puzzle.rows" :key="'hr'+r">
              <div class="hdr row-hdr">
                <span class="tgt">{{ state.historyDetail.puzzle.rowTargets[r-1] }}</span>
              </div>
              <div v-for="c in state.historyDetail.puzzle.cols" :key="'h'+r+'-'+c"
                   class="cell" :class="historyCellClasses(r-1,c-1)" :style="historyCellStyle(r-1,c-1)">
                <span v-if="state.historyDetail.cellMeta[r-1][c-1].chip!=null" class="rchip">{{ state.historyDetail.cellMeta[r-1][c-1].chip }}</span>
                <span class="cnum">{{ state.historyDetail.puzzle.values[r-1][c-1] }}</span>
              </div>
            </template>
          </div>
        </div>
        <button class="btn btn-primary" @click="closeHistoryDetail">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="state.modal==='confirm'" class="modal-bg" @click.self="confirmNo">
      <div class="modal modal-sm">
        <h3>{{ state.confirm?.title }}</h3>
        <p class="confirm-msg">{{ state.confirm?.msg }}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" @click="confirmNo">{{ t('common.cancel') }}</button>
          <button class="btn btn-danger" @click="confirmYes">{{ t('common.yes') }}</button>
        </div>
      </div>
    </div>

    <div v-if="state.showWhatsNew" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge">{{ t('whatsnew.badge') }}</div>
        <h3>{{ t('whatsnew.title', { version: CHANGELOG[0]?.version }) }}</h3>
        <ul class="whatsnew"><li v-for="(it,i) in CHANGELOG[0]?.changes" :key="i">✦ {{ it }}</li></ul>
        <button class="btn btn-primary" @click="dismissWhatsNew">{{ t('whatsnew.start') }}</button>
      </div>
    </div>

    <div v-if="state.updateReady" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge">{{ t('update.badge') }}</div>
        <h3>{{ t('update.title') }}</h3>
        <p class="confirm-msg">{{ t('update.body') }}</p>
        <button class="btn btn-ghost" @click="doExport">{{ t('update.backup') }}</button>
        <button class="btn btn-primary" @click="applyUpdate">{{ t('update.apply') }}</button>
        <button class="btn btn-ghost btn-sm" @click="state.updateReady=false">{{ t('update.later') }}</button>
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

function cellAriaLabel(r, c) {
  const mk = state.marks[r][c];
  const status = mk === 'kept' ? t('a11y.cellKept') : mk === 'removed' ? t('a11y.cellRemoved') : t('a11y.cellUnmarked');
  return t('a11y.cellLabel', { row: r + 1, col: c + 1, value: state.puzzle.values[r][c], status });
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
    'coop-mark-removed': state.coop.active && !!state.markedBy[r][c] && mk === 'removed' && state.settings.coopRemovedOutline,
    'training-highlight': state.isTrainingGame && state.trainingStep?.r === r && state.trainingStep?.c === c,
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

// Der Service Worker dient ausschließlich dem GitHub-Pages-Update-Banner-Flow
// (neues Deployment erkennen) — innerhalb einer nativen Capacitor-App gibt es
// dieses Konzept nicht (Updates laufen über Store-Binaries), daher dort gar
// nicht erst registrieren.
if ('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      log('sw', `Service Worker registriert`);
      // Ein bereits wartender Worker (Update kam, während die App geschlossen war).
      const promote = (w) => {
        if (!w) return;
        // Nur als Update werten, wenn diese Seite schon von einem Worker kontrolliert
        // wird — sonst ist es die Erst-Installation (kein "alte Version läuft weiter").
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = w;
          state.updateReady = true;
          log('sw', `Update verfügbar (wartend)`);
        }
      };
      promote(reg.waiting);
      // Ein Update, das erst zur Laufzeit eintrifft.
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => promote(nw));
      });
    }).catch(e => log('sw', `Service-Worker-Registrierung fehlgeschlagen`, e));
  });
}
