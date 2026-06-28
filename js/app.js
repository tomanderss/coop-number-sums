// app.js — Coop Number Sums (Vue 3, esm-browser). Solo-Spiel; Coop folgt später.
import { createApp, reactive, computed, watch, nextTick, onMounted, markRaw } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { DIFFICULTIES, DIFF_BY_ID, REGION_COLORS, COOP_COLORS, COOP_COLORS_CB, DEFAULT_GAME_OPTIONS, LIVES, HINTS, COOP_MAX_PLAYERS, DONATE_URL } from './config.js';
import { generatePuzzle, findHintCell } from './generator.js';
import { todayDateStr } from './streak.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import { ACHIEVEMENTS, evaluate as evaluateAchievements } from './achievements.js';
import { findTrainingStep, isFullyTier1Solvable } from './training.js';
import * as Music from './music.js';
import {
  loadSettings, saveSettings, loadActiveGame, saveActiveGame, loadActiveGameCoop, saveActiveGameCoop,
  loadStats, recordResult,
  loadSeenVersion, saveSeenVersion, createBackup, loadBackups, restoreBackup,
  exportToFile, importFromFile, deleteAllData, loadStreak, recordStreakResult,
  loadHistory, recordHistory,
  loadAchievements, unlockAchievements, loadRace, recordRaceWin, recordRaceLoss,
  saveCoopSession, loadCoopSession, clearCoopSession,
} from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();
const splashVersion = document.getElementById('splash-version');
if (splashVersion) splashVersion.textContent = `v${BUILD}`;

// Sentinel für state.markedBy außerhalb einer aktiven Coop-/Team-/Wettkampf-
// Lobby (state.coop.myId ist dort null, da keine Firebase-Identität nötig ist).
const LOCAL_PLAYER_ID = 'local';

// ─── GLOBALER ZUSTAND ─────────────────────────────────────────────────────────
const state = reactive({
  screen: 'home',            // home | setup | game | settings | stats
  settings: loadSettings(),
  stats: loadStats(),
  streak: loadStreak(),      // { lastCompletedDate, currentStreak, bestStreak, totalCompleted }
  streakLostNotice: false,   // true, wenn beim Start ein Streak-Verlust angezeigt werden soll
  raceStats: loadRace(),     // { racesPlayed, racesWon, racesLost, fastestWinMs } — getrennt von state.race (laufendes Match)
  puzzleHistory: loadHistory(), // Ringpuffer gelöster Rätsel (neueste zuerst), siehe storage.js
  achievements: loadAchievements(), // { id: Freischalt-Zeitstempel }, siehe storage.js
  historyDetail: null,       // { entry, puzzle, cellMeta } während der Endboard-Ansicht eines Verlauf-Eintrags, sonst null

  // Spiel
  puzzle: null,
  isRaceGame: false,          // true, während ein Race-/Duell-Match (1v1) läuft
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
  newHighscore: false,        // true, wenn beim letzten Sieg eine neue Bestzeit erzielt wurde
  wouldHaveBeenBest: false,   // true, wenn die Zeit ohne Fehler/Hinweise eine neue Bestzeit gewesen wäre
  hintWarnShown: false,       // true, sobald die einmalige Hinweis-Warnung dieser Partie bestätigt wurde
  hintNudge: null,            // aktiver sokratischer Hinweis { group:{kind,ref,target}, reason, rem, r, c, want }
                              // — highlightet die Gruppe + zeigt eine Leitfrage, OHNE die Zelle/Aktion zu verraten;
                              // erst ein zweiter Tipp auf den Hinweis-Knopf löst die Zelle wirklich auf.
  bestTimeNotice: null,       // Text der kurzen Top-Banner-Meldung "Bestzeit nicht mehr möglich"
  tool: 'pen',               // pen | eraser
  startTime: 0,
  elapsed: 0,
  history: [],               // Undo-Stack
  flash: {},                 // "r-c" -> true (rote Fehler-Animation)
  justResolved: {},          // "row-3" | "col-1" | "region-2" -> true (Fertig-Puls)
  cellPx: 48,
  zoom: 1,
  markedBy: [],               // 2D-Array parallel zu marks: Coop-Spieler-Id, LOCAL_PLAYER_ID (solo/Wettkampf) oder null

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
    hostId: null,               // uid des aktuell amtierenden Hosts (für deterministische Host-Übernahme bei Disconnect)
    players: [],                // [{id, name, color}] — alle bekannten Mitspieler inkl. mir selbst
    nameDraft: '',              // Entwurf im Namens-Gate, bevor er bestätigt wird
    identityConfirmed: false,   // true sobald das Namens-Gate in dieser Coop-Session bestätigt wurde
    lifeLossBy: [],              // chronologisch: wer hat welches (gemeinsame) Leben verbraucht
    mistakesByPlayer: {},        // id -> Anzahl Fehler dieses Spielers im laufenden Rätsel
    awaitingStart: false,        // Rätsel ist generiert, aber die Zeit läuft noch nicht — wartet auf Start-Klick

    teamMode: false,               // Host-Lobby-Toggle: Team-vs-Team statt normalem Coop
    raceMode: false,               // Host-Lobby-Toggle: Race-/Duell-Modus (1v1, getrennte Fortschritte) statt normalem Coop
  },

  // Team-vs-Team (Feature 12b) — getrennt von state.coop, da es einen zweiten,
  // nur aggregiert sichtbaren "Gegner" gibt. Die Formations-Lobby (Team-
  // Zuweisung pro Spieler) läuft über state.coop.players[].team im selben Raum
  // wie normaler Coop; siehe startTeamMatch()/applyTeamStart() für Details.
  team: {
    active: false,         // true während eines laufenden Team-vs-Team-Matches
    myTeam: null,           // 'A' | 'B'
    matchOver: false,       // true sobald ein Team fertig ist (hartes Match-Ende für beide)
    winningTeam: null,      // 'A' | 'B', sobald matchOver
    endReason: null,        // 'won' | 'lost' | 'gaveup' -- WARUM das Match endete (das Team, das
                            // den Ausschlag gegeben hat, hat selbst fertiggelöst/alle Leben
                            // verloren/aufgegeben), nötig damit der Ergebnis-Screen nicht
                            // pauschal "Gelöst!" zeigt, wenn man nur durchs Leben-/Aufgabe-Ende
                            // der Gegenseite gewonnen hat.
    opponentPct: 0,         // zuletzt bekannter Fortschritt des Gegner-Teams (nur Prozent, keine Zellinhalte)
    opponentMistakes: 0,
    opponentMistakesByPlayer: {}, // uid -> Fehleranzahl, fürs Einzel-Leben-Verlust-Panel im Ergebnis-Screen
    myPct: 0,               // eigener Fortschritt zum Zeitpunkt des Match-Endes (für den Vergleichs-Screen)
  },

  // Race-/Duell-Modus (Feature 11) — strikt 1v1, KEIN geteiltes Gitter: jeder
  // Spieler sieht nur den eigenen aggregierten Fortschritt des Gegners (Prozent/
  // Fehlerzahl), nie dessen Zellinhalte. state.coop.active bleibt während des
  // Rennens absichtlich false, damit coopSend() niemals Zug-Events versendet —
  // Antwort-Leak ist dadurch baulich ausgeschlossen, nicht nur durch Konvention.
  race: {
    active: false,          // true während eines laufenden Race-Matches
    opponentId: null,        // uid des Gegners (für raceProgress-Lookup)
    opponentName: '',
    opponentColor: '#888',
    matchOver: false,        // true sobald einer fertig ist (hartes Match-Ende für beide)
    winner: null,            // 'me' | 'opponent', sobald matchOver
    endReason: null,         // 'won' | 'lost' | 'gaveup' -- WARUM das Match endete (Outcome der
                             // Seite, die das Match ausgelöst hat: echtes Fertiglösen, alle
                             // Leben verloren oder aufgegeben). Zusammen mit winner ergibt das
                             // 6 eindeutige, unterscheidbare Szenarien für den Ergebnis-Screen --
                             // ohne dieses Feld zeigte "Gelöst!" auch dann, wenn man nur gewonnen
                             // hat, weil der Gegner alle Leben verlor oder aufgab.
    myPct: 0,
    opponentPct: 0,
    opponentMistakes: 0,
    rematchPending: false,  // true nur nach einem beendeten Match bis zum nächsten Hosten --
                             // steuert, ob die Race-Lobby ihre eigene Schwierigkeitsauswahl
                             // nochmal zeigt (siehe rematchRace()/startHosting()).
  },

  // UI
  toast: null,
  modal: null,               // null | 'howto' | 'changelog' | 'backups' | 'confirm'
  confirm: null,             // { title, msg, onYes }
  showWhatsNew: false,
  generating: false,
  paused: false,             // Pausenmodus (Feld verdeckt, Zeit gestoppt)
  resumeAvailable: null,     // gespeichertes Solo-Spiel (zum Fortsetzen)
  resumeAvailableCoop: null, // gespeichertes Coop-Spiel (zum Fortsetzen, separater Slot)
  confetti: [],
  perfectWin: false,         // gradueller Konfetti-/Glanz-Effekt für makellose Siege
  updateReady: false,        // neue App-Version liegt im Service-Worker bereit
  pendingUpdate: false,      // Update erkannt, aber Spiel läuft noch — Dialog nach Spielende zeigen
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
function racePct(modeStats) {
  if (!modeStats.racesPlayed) return 0;
  return Math.round((modeStats.racesWon / modeStats.racesPlayed) * 100);
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.darkMode ? 'dark' : 'light');
  document.documentElement.classList.toggle('colorblind', state.settings.colorBlindMode);
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
  updateMusic();
  // overflow-anchor:none allein verhinderte nicht jeden Fall eines mittig
  // startenden Screens (z.B. wenn ein Banner erst nach dem ersten Layout
  // einklappt) -- expliziter Scroll-Reset nach dem Render macht "oben
  // starten" unabhängig vom genauen Lade-Timing einzelner Inhalte.
  nextTick(() => { document.querySelector('.screen')?.scrollTo(0, 0); scheduleScrollLockUpdate(); });
}

// ─── HINTERGRUNDMUSIK ─────────────────────────────────────────────────────────
// Welcher Spielmodus läuft gerade? Bestimmt, welche Musik-Einstellung greift.
// "competition" deckt Race (1v1) UND Team (2v2) ab; Team setzt zwar coop.active,
// wird aber zuerst geprüft, damit es nicht als "coop" zählt.
function currentMusicMode() {
  if (state.isTrainingGame) return 'training';
  if (state.race.active || state.team.active) return 'competition';
  if (state.coop.active) return 'coop';
  return 'solo';
}
function musicEnabledForMode(mode) {
  const s = state.settings;
  return mode === 'training' ? s.musicTraining
    : mode === 'competition' ? s.musicCompetition
    : mode === 'coop' ? s.musicCoop
    : s.musicSolo;
}
// Einzige Stelle, die Musik startet/stoppt. Zwei Kontexte:
//  • Aktiv laufendes Rätsel (Spielscreen, nicht pausiert, nicht Coop-Lobby) ->
//    es greift der Schalter des aktuellen Spielmodus.
//  • Alles andere (Menüs, Statistik, Verlauf, Pause, Ergebnis-Screen ...) ->
//    es greift der "Menü/App"-Schalter (musicMenu).
// Sind alle Schalter an, läuft die Musik nahtlos durch (play() ist idempotent,
// solange sie schon läuft -> kein Neustart beim Wechsel Menü<->Spiel).
// Aufgerufen an allen Übergängen (navigate, Start, Pause, Sieg/Niederlage,
// Settings) sowie bei der ersten Nutzergeste (AudioContext-Freischaltung).
function updateMusic() {
  const inActiveGame = state.screen === 'game' && state.status === 'playing'
    && !state.paused && !state.coop.awaitingStart;
  const shouldPlay = inActiveGame ? musicEnabledForMode(currentMusicMode()) : state.settings.musicMenu;
  if (shouldPlay) Music.play(state.settings.musicVolume);
  else Music.stop();
}

// overflow-y:auto auf .screen ist nötig, damit lange Inhalte (z.B. Stats,
// Verlauf) scrollen können -- aber iOS/Safari erlaubt das elastische
// Zieh-und-Zurückschnapp-Gefühl auf JEDEM overflow:auto-Container, auch wenn
// dessen Inhalt gar nicht über den sichtbaren Bereich hinausgeht. Deshalb hier
// pro Screen messen, ob tatsächlich etwas zu scrollen ist, und sonst per Klasse
// auf overflow:hidden umschalten (siehe .screen.no-overflow in styles.css) --
// echtes Scrollen bleibt unberührt, nur das sinnlose Wabbeln verschwindet.
let scrollLockRaf = null;
function updateScreenScrollLock() {
  const el = document.querySelector('.screen');
  if (!el) return;
  el.classList.toggle('no-overflow', el.scrollHeight <= el.clientHeight + 1);
}
function scheduleScrollLockUpdate() {
  if (scrollLockRaf) return;
  scrollLockRaf = requestAnimationFrame(() => { scrollLockRaf = null; updateScreenScrollLock(); });
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  if (state.status !== 'playing' || state.paused || state.coop.awaitingStart) return;
  timerHandle = setInterval(() => {
    state.elapsed = Date.now() - state.startTime;
  }, 250);
  updateMusic(); // ein aktiv laufendes Rätsel ist genau der Moment für Musik
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
  updateMusic();
  if (broadcast) {
    // Race: state.coop.active bleibt absichtlich false (siehe state.race-Kommentar),
    // coopSend() wäre hier also ein No-op -- analog zum MSG.START-Versand direkt
    // über Coop.send(), damit der Gegner trotzdem mitpausiert/-startet wird.
    if (state.race.active) Coop.send({ type: Coop.MSG.PAUSE, paused: true, elapsed: state.elapsed });
    else if (state.coop.active) coopSend({ type: Coop.MSG.PAUSE, paused: true, elapsed: state.elapsed });
  }
}
function resumeFromPause(broadcast = true) {
  if (!state.paused) return;
  state.paused = false;
  state.startTime = Date.now() - state.elapsed; // Zeit fortsetzen
  startTimer();
  updateMusic();
  if (broadcast) {
    if (state.race.active) Coop.send({ type: Coop.MSG.PAUSE, paused: false });
    else if (state.coop.active) coopSend({ type: Coop.MSG.PAUSE, paused: false });
  }
}

// Einstellungen sind von JEDEM Screen aus über das Zahnrad erreichbar. Wir merken
// uns den Ausgangs-Screen, um beim Schließen wieder dorthin zurückzukehren (statt
// immer nach Home). Wird aus dem laufenden Spiel geöffnet, pausiert das Spiel —
// pauseGame() broadcastet im Coop/Race, sodass ALLE Spieler mitpausieren; es
// schützt sich selbst gegen Doppelpause/Lobby/Nicht-Spielen.
let settingsReturn = null;
function openSettings() {
  if (state.screen === 'settings') return;
  settingsReturn = state.screen;
  if (state.screen === 'game') pauseGame();
  navigate('settings');
}
// Zurück aus den Einstellungen zum Ausgangs-Screen. Ein währenddessen pausiertes
// Spiel bleibt pausiert (Pause-Overlay mit „Fortsetzen") — bewusst kein Auto-Resume.
function closeSettings() {
  const back = settingsReturn || 'home';
  settingsReturn = null;
  navigate(back);
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
  updateMusic();
}
function startCoopRound() {
  if (!state.coop.awaitingStart) return;
  // Nur der Host darf final starten, und erst sobald alle Mitspieler bereit
  // sind (siehe Bereit-System oben) -- verhindert, dass jemand noch nicht
  // hingeschaut hat, wenn die gemeinsame Zeit zu laufen beginnt.
  if (state.coop.role !== 'host' || !allGuestsReady()) return;
  const startTime = Date.now();
  startCoopGame(startTime);
  // Race-Matches halten state.coop.active absichtlich auf false (siehe
  // state.race-Kommentar), wodurch coopSend()s Guard das START-Signal
  // verschlucken würde -- hier muss roh über Coop.send() verschickt werden.
  // Team-Matches haben state.coop.active zwar auf true, aber coopSend()
  // leitet bei aktivem Team-Modus auf den team-skopierten Kanal um (siehe
  // coopSend()) -- das START-Signal muss aber BEIDE Teams erreichen, daher
  // auch hier roh über Coop.send() verschicken statt über coopSend().
  if (state.race.active || state.team.active) Coop.send({ type: Coop.MSG.START, startTime });
  else coopSend({ type: Coop.MSG.START, startTime });
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
  state.isTrainingGame = false;
  state.generating = true;
  state.screen = 'game';
  // kurze Verzögerung, damit die Lade-Animation sichtbar wird (große Felder)
  setTimeout(() => {
    log('game', `Puzzle-Generierung gestartet`, { difficulty: diffId });
    let puzzle;
    try {
      puzzle = generatePuzzle({ difficulty: diffId });
    } catch (e) {
      log('game', `Puzzle-Generierung fehlgeschlagen`, e);
      throw e;
    }
    log('game', `Puzzle generiert`, { difficulty: diffId, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.generating = false;
    if (state.coop.active && state.coop.role === 'host') {
      state.coop.awaitingStart = true;
      resetReadyFlags();
      startTimer();
      coopSend({ type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
    } else {
      startTimer();
    }
  }, 30);
}

// Nach jedem Solo-/Coop-Spiel geht's NIE direkt erneut in dieselbe Schwierigkeit,
// sondern immer zur Schwierigkeitsauswahl, vorbefüllt mit der zuletzt gespielten —
// so wird eine bewusste Bestätigung erzwungen, bevor das nächste Rätsel startet.
function goNextPuzzle() {
  state.sel.difficulty = state.puzzle.difficulty;
  navigate('setup');
}

// Trainingsmodus: Schritt-für-Schritt-Erklärung erzwungener Züge (siehe
// training.js). Das Rätsel wird GEZIELT so ausgewählt, dass es sich komplett
// mit den einfachen, in Worten erklärbaren Tier-1-Schritten lösen lässt --
// sonst würde der Durchlauf plötzlich auf ein Rätsel treffen, das v1 nicht
// erklären kann. Solo, kein Netz, keine eigenen Storage-Keys (siehe Plan).
const TRAINING_GEN_BUDGET = 40; // Versuche, bis ein voll Tier-1-lösbares Rätsel gefunden ist
function startTrainingGame() {
  coopReset();
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
    // Erst NACH loadPuzzleIntoState setzen, da dieses isTrainingGame/trainingStep/
    // trainingDone als generischer Reset-Punkt für alle Spielstart-Pfade auf false
    // zurücksetzt (siehe dort) -- sonst würde der Reset diese Zeilen sofort überschreiben.
    state.isTrainingGame = true;
    state.trainingStep = null;
    state.trainingDone = false;
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
  // Genereller Reset-Punkt für alle Spielstart-Pfade (Solo, Coop, Race, Team,
  // Fortsetzen, Daily/Boss) -- ohne den blieb der Trainingsmodus-Banner nach
  // einem Abbruch per Zurück-Button (quitToHome() setzt isTrainingGame nicht
  // zurück) in jedem danach gestarteten "normalen" Spiel sichtbar. startTrainingGame()
  // setzt isTrainingGame direkt NACH diesem Aufruf wieder auf true.
  state.isTrainingGame = false;
  state.trainingStep = null;
  state.trainingDone = false;
  state.paused = false;
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
  state.newHighscore = false;
  state.wouldHaveBeenBest = false;
  state.perfectWin = false;
  state.hintWarnShown = false;
  state.hintNudge = null;
  state.elapsed = saved?.elapsed ?? 0;
  // Bei Coop-INIT übernimmt der Gast den exakten Host-Startzeitpunkt, damit beide
  // Seiten dieselbe Zeit anzeigen (sonst Drift durch Verbindungsaufbau-Latenz).
  state.startTime = saved?.startTime ?? (Date.now() - state.elapsed);
  state.zoom = 1;
  computeCellSize();
  // .board-wrap existiert beim ersten Aufruf (vor dem nächsten Vue-Render) noch
  // nicht im DOM -- der nextTick-Nachschlag korrigiert die Fallback-Schätzung,
  // sobald die echte Größe (Hoch- oder Querformat) feststeht.
  nextTick(computeCellSize);
  persistGame();
}

// ─── ZELLGRÖSSE (responsiv + Zoom) ────────────────────────────────────────────
// Misst die tatsächlich verfügbare Fläche von .board-wrap (Breite UND Höhe),
// damit Zellen im Querformat (wo die Höhe statt der Breite limitiert) nicht zu
// groß werden. Vor dem ersten Render (DOM noch nicht da) greift ein grober
// Fallback über window.innerWidth/-Height, den der nextTick-Aufruf in
// loadPuzzleIntoState() danach durch die echte Messung ersetzt.
function computeCellSize() {
  if (!state.puzzle) return;
  const cols = state.puzzle.cols;
  const rows = state.puzzle.rows;
  const wrap = document.querySelector('.board-wrap');
  let availW, availH;
  if (wrap && wrap.clientWidth && wrap.clientHeight) {
    availW = wrap.clientWidth - 12; // 2*6px Board-Wrap-Padding
    availH = wrap.clientHeight - 12;
  } else {
    availW = Math.min(window.innerWidth - 44, 496); // 2*(14px App-Padding + 6px Board-Wrap-Padding) + Sicherheitspuffer
    availH = window.innerHeight - 200; // grobe Schätzung für Kopf-/Werkzeugleiste vor dem ersten Render
  }
  const idealW = Math.floor(availW / (cols + 1)); // +1 für Kopfspalte
  const idealH = Math.floor(availH / (rows + 1)); // +1 für Kopfzeile
  const ideal = Math.min(idealW, idealH);
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
  if (state.coop.active || state.isTrainingGame || state.isRaceGame) return false;
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
  if (user) state.hintNudge = null; // eigene Aktion verwirft die offene Leitfrage (Highlight + Banner)
  const cur = state.marks[r][c];
  if (cur === next) return;

  if (user && (state.settings.errorReveal === 'instant' || state.isRaceGame)) {
    const sol = state.puzzle.solution[r][c];
    const wrong = (next === 'kept' && !sol) || (next === 'removed' && sol);
    if (wrong) { flashError(r, c); registerMistake(); return; }
  }

  const region = state.cellMeta[r][c].region;
  const wasRow = rowResolved(r), wasCol = colResolved(c);
  const wasRegion = region >= 0 ? regionResolved(region) : false;

  state.history = [{ r, c, prev: cur }]; // nur der letzte Zug ist rückgängig machbar
  state.marks[r][c] = next;
  // Außerhalb einer aktiven Coop-/Team-/Wettkampf-Lobby ist state.coop.myId
  // null (keine Firebase-Identität nötig) -- LOCAL_PLAYER_ID markiert eigene
  // Züge trotzdem als "meine", damit die eigene Farbe (state.settings.coopMyColor)
  // auch solo greift (siehe cellStyle()).
  state.markedBy[r][c] = next === 'none' ? null : (user ? (state.coop.myId || LOCAL_PLAYER_ID) : fromId);
  if (user && state.coop.active) coopSend({ type: Coop.MSG.MOVE, r, c, mark: next, from: state.coop.myId });

  // Aktions-Sound nur für eigene Züge (sonst klingelt jeder Partner-Tap im Coop).
  if (user) {
    if (next === 'kept' && state.settings.sfxKeep) Music.sfxKeep();
    else if (next === 'removed' && state.settings.sfxRemove) Music.sfxRemove();
  }

  // Wie viele Strukturen löst dieser eine Zug gleichzeitig auf? -> Stufung.
  let resolved = 0;
  if (!wasRow && rowResolved(r)) { pulseResolved('row', r); resolved++; }
  if (!wasCol && colResolved(c)) { pulseResolved('col', c); resolved++; }
  if (region >= 0 && !wasRegion && regionResolved(region)) { pulseResolved('region', region); resolved++; }
  if (resolved > 0 && state.settings.sfxComplete) Music.sfxComplete(resolved);

  afterMove();
}

function afterMove() {
  clearStaleHintNudge();
  persistGame();
  if (state.team.active) pushTeamProgress();
  if (state.race.active) pushRaceProgress();
  if (isSolved()) win();
}
// Verwirft den aktiven Hinweis, sobald SEINE Zielzelle gelöst ist — egal wodurch
// (eigener Zug, Auflösen, Coop-Partner). So bleibt nie ein veralteter Hinweis mit
// stage≥2 im Kopf hängen, der den nächsten Tipp fälschlich sofort auflösen würde:
// nach jeder gelösten Zelle beginnt der nächste Hinweis wieder bei Stufe 1.
function clearStaleHintNudge() {
  const n = state.hintNudge;
  if (n && state.marks[n.r][n.c] === n.want) state.hintNudge = null;
}

let lastErrorSfx = 0;
function flashError(r, c) {
  const key = `${r}-${c}`;
  state.flash[key] = true;
  setTimeout(() => { delete state.flash[key]; }, 650);
  // Fehler-Ton — beim Mehrfach-Check (doCheck markiert viele Zellen auf einmal)
  // nur einmal spielen, nicht pro Zelle.
  if (state.settings.sfxError && Date.now() - lastErrorSfx > 120) { lastErrorSfx = Date.now(); Music.sfxError(); }
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
    showBestTimeNotice(t('game.lifeLostNotice'));
    if (state.lives <= 0) { state.lives = 0; lose(); }
  }
  persistGame();
  // Ohne diese beiden Pushs sah die Gegenseite einen Fehler erst beim nächsten
  // KORREKTEN Zug (der über afterMove() läuft) -- ein Fehler-Zug selbst kehrt
  // oben in setMark() vorzeitig zurück und erreicht afterMove() nie. Bewusst
  // UNGEDROSSELT (wie bei broadcastTeamDone()) statt über den normalen
  // 2s-Throttle, da Fehler -- anders als jeder einzelne Zug -- selten genug
  // sind, dass ein Sofort-Push hier kein Kosten-/Schreibvolumen-Problem ist,
  // für die Gegenseite aber sofort sichtbar sein soll.
  if (state.team.active) {
    teamProgressThrottle = Date.now();
    Coop.setTeamProgress(state.team.myTeam, { pct: progressPct(), mistakes: state.mistakes, mistakesByPlayer: { ...state.coop.mistakesByPlayer } });
  }
  if (state.race.active) {
    raceProgressThrottle = Date.now();
    Coop.setRaceProgress(state.coop.myId, { pct: progressPct(), mistakes: state.mistakes });
  }
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

// ─── TEAM-VS-TEAM / RACE: aggregierter Fortschritt für die Gegenseite ─────────
// Nur ein Prozentwert + Fehlerzahl wandern über teamProgress/{team} bzw.
// raceProgress/{uid} -- nie Zellinhalte (sonst Antwort-Leak an die Gegenseite,
// siehe Plan). progressPct() ist bewusst generisch (kein Team-/Race-Bezug im
// Namen), da beide Modi denselben reinen Puzzle-Fortschritt brauchen.
function progressPct() {
  const p = state.puzzle; if (!p) return 0;
  let total = 0, correct = 0;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) { total++; if (cellCorrect(r, c)) correct++; }
  return total ? Math.round((correct / total) * 100) : 0;
}
let teamProgressThrottle = 0;
let teamProgressTimer = null;
// Reines "leading edge"-Throttle (nur sofort senden, sonst verwerfen) ließ
// die Gegenseite bei mehreren schnellen Zügen auf einem veralteten Prozentwert
// sitzen, bis der nächste Zug zufällig außerhalb des Zeitfensters fiel --
// blieb der Spieler danach kurz stehen (z.B. zum Nachdenken), zeigte die
// Gegenseite dauerhaft einen falschen Stand. Ein nachgelagerter Timer holt
// den letzten Stand garantiert nach, auch ohne weiteren Zug.
function pushTeamProgress() {
  const now = Date.now();
  const elapsed = now - teamProgressThrottle;
  if (elapsed >= 2000) {
    teamProgressThrottle = now;
    Coop.setTeamProgress(state.team.myTeam, { pct: progressPct(), mistakes: state.mistakes, mistakesByPlayer: { ...state.coop.mistakesByPlayer } });
  } else if (!teamProgressTimer) {
    teamProgressTimer = setTimeout(() => {
      teamProgressTimer = null;
      teamProgressThrottle = Date.now();
      Coop.setTeamProgress(state.team.myTeam, { pct: progressPct(), mistakes: state.mistakes, mistakesByPlayer: { ...state.coop.mistakesByPlayer } });
    }, 2000 - elapsed);
  }
}
// Empfängt den Fortschritt BEIDER Teams (eigener + gegnerischer) -- die eigene
// Hälfte wird einfach ignoriert, da der lokale Stand ohnehin genauer ist.
function onTeamProgressUpdate(progressByTeam) {
  const opponentTeam = state.team.myTeam === 'A' ? 'B' : 'A';
  const opp = progressByTeam[opponentTeam];
  if (opp) {
    state.team.opponentPct = opp.pct || 0;
    state.team.opponentMistakes = opp.mistakes || 0;
    state.team.opponentMistakesByPlayer = opp.mistakesByPlayer || {};
  }
}
let raceProgressThrottle = 0;
let raceProgressTimer = null;
// Gleicher Fix wie bei pushTeamProgress() oben -- ein reines leading-edge-
// Throttle ließ den Gegner-Fortschritt im Race auf einem veralteten Stand
// einfrieren, sobald keine weiteren Züge mehr außerhalb des Zeitfensters
// kamen. Der Timer garantiert, dass der letzte Stand spätestens nach Ablauf
// des Throttle-Fensters nachgereicht wird.
function pushRaceProgress() {
  const now = Date.now();
  const elapsed = now - raceProgressThrottle;
  if (elapsed >= 2000) {
    raceProgressThrottle = now;
    Coop.setRaceProgress(state.coop.myId, { pct: progressPct(), mistakes: state.mistakes });
  } else if (!raceProgressTimer) {
    raceProgressTimer = setTimeout(() => {
      raceProgressTimer = null;
      raceProgressThrottle = Date.now();
      Coop.setRaceProgress(state.coop.myId, { pct: progressPct(), mistakes: state.mistakes });
    }, 2000 - elapsed);
  }
}
// Empfängt den Fortschritt beider Spieler (eigener + Gegner) -- nur der
// Gegner-Eintrag (per uid) ist relevant, der eigene Stand ist lokal genauer.
function onRaceProgressUpdate(progressByUid) {
  const opp = progressByUid[state.race.opponentId];
  if (opp) { state.race.opponentPct = opp.pct || 0; state.race.opponentMistakes = opp.mistakes || 0; }
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
  if (state.settings.livesEnabled) {
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

  let resolved = 0;
  if (!wasRow && rowResolved(r)) { pulseResolved('row', r); resolved++; }
  if (!wasCol && colResolved(c)) { pulseResolved('col', c); resolved++; }
  if (region >= 0 && !wasRegion && regionResolved(region)) { pulseResolved('region', region); resolved++; }
  if (resolved > 0 && state.settings.sfxComplete) Music.sfxComplete(resolved);

  afterMove();
}

// Dreistufiger Hinweis — jeder Tipp auf den Knopf geht eine Stufe weiter:
//  Stufe 1: markiert NUR den relevanten Bereich (Zeile/Spalte/Käfig, der den
//    nächsten Zug erzwingt) — kein Text, keine Lösung. Verdeckt nichts, der
//    Spieler sucht selbst.
//  Stufe 2: blendet zusätzlich die sokratische Leitfrage ein (Banner) — erklärt
//    den Gedanken, ohne die konkrete Zelle/Aktion zu nennen.
//  Stufe 3: löst die konkrete Zelle wirklich auf.
// Schon Stufe 1 kostet die Bestzeit (jede Hilfe zählt) — daher kommt die
// einmalige Warnung VOR Stufe 1. Stufe 2/3 lösen dann keine weitere Warnung/
// Strafe mehr aus (ist ja schon "verbraucht"). Gibt es keinen einfach
// erklärbaren Schritt (nur Tier-2/2.5-Logik nötig), wird sofort aufgelöst.
function useHint() {
  if (state.status !== 'playing' || state.hintsLeft <= 0 || state.isRaceGame || state.team.active) return;
  clearStaleHintNudge(); // veralteten Hinweis (Zielzelle schon gelöst) zuerst verwerfen
  const n = state.hintNudge;
  // Stufe 3: Frage steht schon -> Zelle wirklich auflösen (Strafe lief in Stufe 1).
  if (n && n.stage >= 2) { state.hintNudge = null; doRevealCell(n.r, n.c, n.want); return; }
  // Stufe 2: Bereich ist schon markiert -> jetzt die Leitfrage einblenden.
  if (n) { if (state.settings.sfxHint) Music.sfxHint(); n.stage = 2; return; }
  // Stufe 1: erst warnen (kostet die Bestzeit!), dann Bereich markieren.
  confirmThenStartHint();
}
// Hinweis-Banner wegklicken (X) — verwirft die offene Frage komplett, sodass die
// Werkzeugleiste wieder frei ist; der nächste Tipp auf den Knopf beginnt neu bei
// Stufe 1.
function dismissHintNudge() { state.hintNudge = null; }
// "Auflösen"-Knopf im Banner (= Stufe 3): deckt die Zelle auf. Keine erneute
// Strafe — die lief schon in Stufe 1.
function revealHintNudge() {
  const n = state.hintNudge;
  if (!n) return;
  state.hintNudge = null;
  doRevealCell(n.r, n.c, n.want);
}
// Einmalige Bestzeit-Warnung je Partie, dann den Hinweis starten — bei Abbruch
// bleibt hintWarnShown false, sodass die Warnung erneut käme.
function confirmThenStartHint() {
  if (!state.hintWarnShown) {
    ask(t('game.hintConfirmTitle'), t('game.hintConfirmMsg'), () => { state.hintWarnShown = true; startHint(); });
    return;
  }
  startHint();
}
// Stufe 1: zieht die Strafe (Bestzeit futsch) und markiert den relevanten
// Bereich. Ohne einfach erklärbaren Schritt wird direkt eine Zelle aufgelöst.
function startHint() {
  const step = findTrainingStep(state.puzzle, state.marks);
  registerHintPenalty();
  if (state.settings.sfxHint) Music.sfxHint(); // Stufe 1 — Ton bei jeder Hinweis-Instanz
  if (step) {
    state.hintNudge = { group: step.group, reason: step.reason, rem: step.rem, r: step.r, c: step.c, want: step.action, stage: 1 };
    log('game', `Hinweis Stufe 1 (Bereich markiert)`, { group: step.group.kind });
    return;
  }
  const hint = findHintCell(state.puzzle, state.marks);
  if (hint) doRevealCell(hint.r, hint.c, hint.want);
}
// Strafe für die Hinweis-Nutzung: zählt den Hinweis (entwertet die Bestzeit) und
// meldet das einmal sichtbar. Läuft genau einmal je Hinweis-Sequenz (in Stufe 1).
function registerHintPenalty() {
  state.hintsLeft--; state.hintsUsed++;
  showBestTimeNotice(t('game.hintUsedNotice'));
}
// Auflöse-Kern: deckt Zelle (r,c) mit der korrekten Markierung auf und synct sie
// im Coop. Zählt NICHT erneut — die Strafe lief bereits in Stufe 1.
function doRevealCell(r, c, want) {
  log('game', `Hinweis aufgelöst`, { r, c });
  if (state.settings.sfxHint) Music.sfxHint(); // Stufe 3 — Ton bei jeder Hinweis-Instanz
  applyHintEffect(r, c, want);
  if (state.coop.active) coopSend({ type: Coop.MSG.HINT, r, c, mark: want, from: state.coop.myId });
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

// Im Team-vs-Team-Modus laufen Zug-Nachrichten (MOVE/MISTAKE/UNDO/HINT/CHECK/
// PAUSE/START/STATUS) über den team-skopierten Kanal statt des raumweiten
// Event-Logs -- so erreichen sie nie das gegnerische Team. Das "Team X ist
// fertig"-Signal (TEAM_DONE) wird bewusst NICHT über coopSend() verschickt,
// sondern direkt über Coop.send() (siehe win()), da es absichtlich beide Teams
// erreichen muss.
function coopSend(msg) {
  if (!state.coop.active || !state.coop.connected) return;
  if (state.team.active) Coop.sendTeamEvent(state.team.myTeam, msg);
  else Coop.send(msg);
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
      showToast(t('coop.playerJoinedLobby', { name: (msg.name || '').trim() || t('common.defaultPlayerName') }));
    }
  } else if (msg.type === Coop.MSG.ROSTER) {
    const prevHostId = state.coop.hostId;
    state.coop.players = msg.players;
    if (msg.hostId) {
      state.coop.hostId = msg.hostId;
      // Eigene Rolle korrigieren falls ein anderer Spieler inzwischen Host wurde
      // (tritt auf wenn der ursprüngliche Host via resumeCoopGame() wieder beitritt).
      if (state.coop.role === 'host' && msg.hostId !== state.coop.myId) {
        state.coop.role = 'guest';
      }
      if (prevHostId && msg.hostId !== prevHostId && msg.hostId !== state.coop.myId) {
        const newHostName = msg.players.find(p => p.id === msg.hostId)?.name || t('common.defaultPlayerName');
        showToast(t('coop.newHostIs', { name: newHostName }), 'info', 3000);
      }
    }
    state.coop.teamMode = !!msg.teamMode;
    updateConnectedFlag();
  } else if (msg.type === Coop.MSG.READY) {
    // Nur der Host wertet Bereit-Meldungen aus und verteilt die Liste neu --
    // exakt das gleiche Muster wie IDENTITY (Konfliktauflösung/Quelle der Wahrheit).
    if (state.coop.role === 'host') {
      const p = state.coop.players.find(pl => pl.id === msg.author);
      if (p) { p.ready = true; broadcastRoster(); }
    }
  } else if (msg.type === Coop.MSG.UNREADY) {
    if (state.coop.role === 'host') {
      const p = state.coop.players.find(pl => pl.id === msg.author);
      if (p) { p.ready = false; broadcastRoster(); }
    }
  } else if (msg.type === Coop.MSG.TEAM_START) {
    applyTeamStart(msg.seed, msg.difficulty);
  } else if (msg.type === Coop.MSG.TEAM_DONE) {
    if (!state.team.active || state.team.matchOver) return;
    state.team.matchOver = true;
    // "won" entscheidet das eigene Team; "lost"/"gaveup" gibt den Sieg automatisch
    // an die Gegenseite (kein Zu-Ende-Spielen für eigene Stats, siehe Plan).
    state.team.winningTeam = msg.outcome === 'won' ? msg.team : (msg.team === 'A' ? 'B' : 'A');
    state.team.endReason = msg.outcome;
    if (msg.team === state.team.myTeam) return; // eigenes Team meldet sich direkt aus win()/lose()/giveUp()
    if (state.status === 'playing') {
      const remote = { timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed };
      if (state.team.winningTeam === state.team.myTeam) win(remote);
      else lose(remote);
    }
  } else if (msg.type === Coop.MSG.RACE_START) {
    applyRaceStart(msg.seed, msg.difficulty);
  } else if (msg.type === Coop.MSG.RACE_DONE) {
    // Race ist strikt 1v1 -- jede empfangene RACE_DONE-Nachricht stammt damit
    // notwendig vom Gegner (kein Selbst-Skip-Check nötig wie bei TEAM_DONE,
    // dessen Raum mehr als zwei Parteien haben kann).
    if (!state.race.active || state.race.matchOver) return;
    state.race.matchOver = true;
    state.race.winner = msg.outcome === 'won' ? 'opponent' : 'me';
    state.race.endReason = msg.outcome;
    state.race.opponentPct = msg.finalPct ?? state.race.opponentPct;
    state.race.opponentMistakes = msg.finalMistakes ?? state.race.opponentMistakes;
    state.race.myPct = progressPct();
    if (state.status === 'playing') {
      const remote = { timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed };
      if (state.race.winner === 'me') win(remote);
      else lose(remote);
    }
  }
}

function coopReset() {
  coopIntentionalLeave = true;
  Coop.leave();
  clearCoopSession();
  // Ausstehende nachgelagerte Fortschritts-Pushs (siehe pushTeamProgress()/
  // pushRaceProgress() oben) dürfen nicht nach dem Verlassen des Raums noch
  // feuern -- der Raum existiert dann ggf. nicht mehr.
  clearTimeout(teamProgressTimer); teamProgressTimer = null;
  clearTimeout(raceProgressTimer); raceProgressTimer = null;
  const keepDiff = state.coop.lobbyDiffId;
  state.coop.active = false; state.coop.role = null; state.coop.code = '';
  state.coop.connected = false; state.coop.waitingForGuest = false;
  state.coop.lobbyDiffId = keepDiff; state.coop.error = null;
  state.coop.myId = null; state.coop.hostId = null; state.coop.players = []; state.coop.awaitingStart = false;
  state.coop.teamMode = false;
  state.coop.raceMode = false;
  state.team.active = false; state.team.myTeam = null; state.team.matchOver = false;
  state.team.winningTeam = null; state.team.endReason = null; state.team.opponentPct = 0; state.team.opponentMistakes = 0; state.team.myPct = 0;
  state.team.opponentMistakesByPlayer = {};
  state.race.active = false; state.race.opponentId = null; state.race.opponentName = '';
  state.race.opponentColor = '#888'; state.race.matchOver = false; state.race.winner = null; state.race.endReason = null;
  state.race.myPct = 0; state.race.opponentPct = 0; state.race.opponentMistakes = 0;
  state.race.rematchPending = false;
  state.isRaceGame = false;
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
  const existing = state.coop.players.find(p => p.id === id);
  state.coop.players = [...others, { id, name: (name || '').trim() || t('common.defaultPlayerName'), color, team: existing?.team ?? null, ready: existing?.ready ?? false }];
  updateConnectedFlag();
}
// Nur der Host weist Teams zu (Formations-Lobby), per direkter Zielangabe
// statt zyklischem Tippen auf den Spieler -- die Lobby zeigt dafür eine
// Tabelle mit Team A links / Team B rechts, dazwischen pro Person ein
// Tausch-/Zuweisungs-Pfeil, der genau hierher zielt. team fließt einfach als
// zusätzliches Feld über den bestehenden ROSTER-Broadcast mit, kein eigener
// MSG-Typ nötig.
function assignTeam(id, team) {
  if (state.coop.role !== 'host') return;
  const p = state.coop.players.find(pl => pl.id === id);
  if (!p) return;
  p.team = team;
  broadcastRoster();
}
// Host-only "Zufall"-Button: mischt alle Spieler (Fisher-Yates) und verteilt
// sie danach abwechselnd auf A/B -- bei einer geraden Spielerzahl (insb. dem
// namensgebenden 2v2-Fall mit 4 Spielern) ergibt das automatisch ein exaktes
// 2-gegen-2; bei ungerader Anzahl wird ein Team um genau einen Spieler größer.
function randomizeTeams() {
  if (state.coop.role !== 'host') return;
  const shuffled = [...state.coop.players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.forEach((p, i) => { p.team = i % 2 === 0 ? 'A' : 'B'; });
  broadcastRoster();
}
function removePlayer(id) {
  state.coop.players = state.coop.players.filter(p => p.id !== id);
  updateConnectedFlag();
}
// "Verbunden" heißt hier "mindestens ein anderer Spieler ist aktuell im Raum" —
// generalisiert das frühere binäre Host/Gast-Partner-Flag auf bis zu
// COOP_MAX_PLAYERS Mitspieler.
function updateConnectedFlag() {
  state.coop.connected = state.coop.players.some(p => p.id !== state.coop.myId);
}
// Roster-Broadcast läuft unabhängig vom "Spiel aktiv"-Status (auch schon in der
// Lobby vor dem Start nötig) — bewusst über Coop.send direkt statt coopSend(),
// dessen Guard `state.coop.active` voraussetzt.
function broadcastRoster() {
  Coop.send({ type: Coop.MSG.ROSTER, players: state.coop.players, hostId: state.coop.hostId, teamMode: state.coop.teamMode });
}
// ─── BEREIT-SYSTEM (vor Mehrspieler-Start) ─────────────────────────────────────
// Alle Mitspieler außer dem Host müssen "Bereit" bestätigen, bevor der Host das
// Match final starten kann (siehe startCoopRound()/.coop-lobby-overlay) — der
// Host selbst zählt dabei nie als "Mitspieler", der bereit sein muss.
function nonHostPlayers() {
  return state.coop.players.filter(p => p.id !== state.coop.hostId);
}
function readyCount() {
  return nonHostPlayers().filter(p => p.ready).length;
}
function allGuestsReady() {
  const others = nonHostPlayers();
  return others.length > 0 && others.every(p => p.ready);
}
function myReady() {
  return !!state.coop.players.find(p => p.id === state.coop.myId)?.ready;
}
// Vom Host bei jedem neuen Rätsel/Match aufgerufen, damit sich alle erneut
// bereit melden müssen (siehe startCoopMatch()/startTeamMatch()/startRaceMatch()/
// newGame()) -- Bereit-Status gilt immer nur für die laufende Runde.
function resetReadyFlags() {
  state.coop.players.forEach(p => { p.ready = false; });
  broadcastRoster();
}
// Von einem Mitspieler (nie vom Host) ausgelöst -- bewusst über Coop.send()
// direkt statt coopSend(), damit der Host die Meldung auch dann sieht, wenn der
// Mitspieler im Team-vs-Team-Modus im gegnerischen Team sitzt (siehe IDENTITY).
function markReady() {
  if (state.coop.role === 'host') return;
  const me = state.coop.players.find(p => p.id === state.coop.myId);
  if (me) me.ready = true;
  Coop.send({ type: Coop.MSG.READY });
}
// Gegenstück zu markReady() -- erlaubt das Zurücknehmen einer versehentlichen
// Bereit-Meldung, solange der Host die Runde noch nicht gestartet hat.
function unmarkReady() {
  if (state.coop.role === 'host') return;
  const me = state.coop.players.find(p => p.id === state.coop.myId);
  if (me) me.ready = false;
  Coop.send({ type: Coop.MSG.UNREADY });
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
  coopReset();
  state.coop.nameDraft = state.settings.coopName;
  state.coop.identityConfirmed = false;
  navigate('coop');
}
// Einstieg über den Race-/Duell-Home-Button -- identisches Namens-Gate, aber
// mit gesetztem raceMode- oder teamMode-Flag je gewähltem Modus (1v1 oder
// 2v2), das die Spielerzahl der Lobby entsprechend begrenzt (siehe startJoining()).
function goRace(mode) {
  coopReset();
  state.coop.nameDraft = state.settings.coopName;
  state.coop.identityConfirmed = false;
  state.coop.raceMode = mode !== '2v2';
  state.coop.teamMode = mode === '2v2';
  state.modal = null;
  navigate('coop');
}

// Bei bis zu COOP_MAX_PLAYERS Spielern könnten mehrere Gäste gleichzeitig den
// Host-Verlust bemerken — damit nicht mehrere sich parallel selbst befördern,
// wird deterministisch (ohne weitere Netzwerk-Roundtrips) der nach uid kleinste
// verbleibende Spieler zum neuen Host: jeder Client berechnet dasselbe Ergebnis
// lokal aus seiner aktuellen Roster-Kopie.
function pickNewHostId() {
  const ids = state.coop.players.map(p => p.id).filter(Boolean).sort();
  return ids[0] || null;
}
// Wird aufgerufen, wenn ein Spieler bemerkt, dass der bisherige Host die
// Verbindung unerwartet verloren hat (Tab eingeschlafen, Netzwerkausfall)
// während die Runde noch läuft: der per pickNewHostId() bestimmte Spieler
// übernimmt lokal die Host-Rolle (Identitäts-Arbitrierung für künftige
// Mitspieler) — die Raumdaten in der RTDB leben unabhängig vom "Host", ein
// Transport-Neuaufbau ist anders als bei PeerJS nicht nötig.
function promoteToHost() {
  state.coop.role = 'host';
  state.coop.hostId = state.coop.myId;
  Coop.updateHostId(state.coop.myId);
  broadcastRoster();
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
  state.race.rematchPending = false;
  Coop.hostGame({
    code: state.coop.code,
    name: state.settings.coopName,
    color: state.settings.coopMyColor,
    onOpen(id) {
      state.coop.myId = id;
      state.coop.hostId = id;
      upsertPlayer(id, state.settings.coopName, state.settings.coopMyColor);
    },
    onError(e) {
      state.coop.waitingForGuest = false;
      state.coop.error = e.type === 'code-taken'
        ? t('coop.errorCodeTaken') : t('coop.errorConnection');
    },
    // Das eigentliche Hinzufügen zur Roster-Liste passiert über die vom
    // beitretenden Spieler gesendete IDENTITY-Nachricht (handleCoopMsg) — hier
    // genügt ein Diagnose-Log, der Spieler erscheint sobald IDENTITY eintrifft.
    onJoin(id) {
      log('game', `Mitspieler in Lobby beigetreten (Coop)`, { id });
    },
    onLeave(id) {
      const leavingName = state.coop.players.find(p => p.id === id)?.name || t('common.defaultPlayerName');
      removePlayer(id);
      broadcastRoster();
      if (!coopIntentionalLeave) showToast(t('coop.partnerDisconnected', { name: leavingName }), 'info', 3000);
    },
    onMessage: handleCoopMsg,
  });
}

// Vom Host per Button ausgelöst, sobald mindestens ein weiterer Spieler in der
// Lobby ist — ersetzt das frühere automatische Spielstart-Verhalten beim
// ersten Beitritt, da bei bis zu COOP_MAX_PLAYERS Spielern Zeit zum Beitreten
// für Spieler 3/4 bleiben muss.
function canStartCoopMatch() {
  return state.coop.role === 'host' && state.coop.players.length >= 2;
}
function startCoopMatch() {
  if (!canStartCoopMatch()) return;
  const difficulty = state.coop.lobbyDiffId;
  log('game', `Puzzle-Generierung gestartet (Coop)`, { difficulty, players: state.coop.players.length });
  let puzzle;
  try {
    puzzle = generatePuzzle({ difficulty });
  } catch (e) {
    log('game', `Puzzle-Generierung fehlgeschlagen (Coop)`, e);
    throw e;
  }
  log('game', `Puzzle generiert (Coop)`, { difficulty, rows: puzzle.rows, cols: puzzle.cols });
  loadPuzzleIntoState(puzzle, null);
  state.coop.active = true;
  state.coop.waitingForGuest = false;
  state.coop.awaitingStart = true;
  resetReadyFlags();
  navigate('game');
  Coop.send({ type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
}

// ─── TEAM-VS-TEAM (Feature 12b) ───────────────────────────────────────────────
// Mindestens ein Spieler pro Team -- die Formations-Lobby ist dieselbe
// COOP_MAX_PLAYERS-Lobby aus F12a, nur mit einer zusätzlichen Team-Zuweisung
// pro Spieler (state.coop.players[].team, per cycleTeam() gesetzt).
function canStartTeamMatch() {
  if (state.coop.role !== 'host') return false;
  const a = state.coop.players.filter(p => p.team === 'A').length;
  const b = state.coop.players.filter(p => p.team === 'B').length;
  return a >= 1 && b >= 1;
}
// Statt das fertige Puzzle zu verschicken (wie INIT es für normalen Coop tut),
// wandert hier nur Seed+Schwierigkeit raumweit (beide Teams empfangen es) --
// jeder Client generiert sein (für beide Teams identisches) Rätsel lokal über
// generatePuzzle({difficulty, seed}), kein Antwort-Leak. Innerhalb eines Teams
// laufen Züge danach wie gewohnt über coopSend()/MOVE usw., das jetzt automatisch
// auf den team-skopierten Kanal umleitet (siehe coopSend()).
function startTeamMatch() {
  if (!canStartTeamMatch()) return;
  resetReadyFlags();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const difficulty = state.coop.lobbyDiffId;
  applyTeamStart(seed, difficulty);
  Coop.send({ type: Coop.MSG.TEAM_START, seed, difficulty });
}
function applyTeamStart(seed, difficulty) {
  const me = state.coop.players.find(p => p.id === state.coop.myId);
  state.team.myTeam = me?.team || 'A';
  state.team.active = true;
  state.team.matchOver = false;
  state.team.winningTeam = null;
  state.team.endReason = null;
  state.team.opponentPct = 0;
  state.team.opponentMistakes = 0;
  state.team.opponentMistakesByPlayer = {};
  state.team.myPct = 0;
  log('game', `Puzzle-Generierung gestartet (Team-Match)`, { difficulty, seed, team: state.team.myTeam });
  let puzzle;
  try {
    puzzle = generatePuzzle({ difficulty, seed });
  } catch (e) {
    log('game', `Puzzle-Generierung fehlgeschlagen (Team-Match)`, e);
    throw e;
  }
  log('game', `Puzzle generiert (Team-Match)`, { difficulty, rows: puzzle.rows, cols: puzzle.cols });
  loadPuzzleIntoState(puzzle, null);
  state.coop.active = true;
  state.coop.waitingForGuest = false;
  state.coop.awaitingStart = true;
  Coop.listenTeamEvents(state.team.myTeam, handleCoopMsg);
  Coop.listenTeamProgress(onTeamProgressUpdate);
  navigate('game');
}

// ─── RACE-/DUELL-MODUS (Feature 11) ───────────────────────────────────────────
// Strikt 1v1 -- die Lobby ist dieselbe coop-Lobby, aber state.coop.raceMode
// begrenzt sie auf genau 2 Spieler (siehe startJoining()/joinGame()).
function canStartRaceMatch() {
  return state.coop.role === 'host' && state.coop.players.length === 2;
}
// Wie startTeamMatch(): nur Seed+Schwierigkeit wandern raumweit, jeder Client
// generiert sein (identisches) Rätsel lokal über generatePuzzle({difficulty,
// seed}) -- kein Antwort-Leak, da nie das fertige Puzzle verschickt wird.
function startRaceMatch() {
  if (!canStartRaceMatch()) return;
  resetReadyFlags();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const difficulty = state.coop.lobbyDiffId;
  applyRaceStart(seed, difficulty);
  Coop.send({ type: Coop.MSG.RACE_START, seed, difficulty });
}
// state.coop.active bleibt hier BEWUSST false (im Gegensatz zu
// applyTeamStart()) -- siehe state.race-Kommentar: dadurch sendet coopSend()
// während des Rennens niemals Zug-/Markierungs-Events, Antwort-Leak ist damit
// baulich ausgeschlossen statt nur durch Konvention vermieden. Leben/Fehler-
// anzeige werden über state.isRaceGame separat erzwungen (siehe setMark()/
// registerMistake()/doCheck()).
function applyRaceStart(seed, difficulty) {
  const opponent = state.coop.players.find(p => p.id !== state.coop.myId);
  state.race.opponentId = opponent?.id || null;
  state.race.opponentName = opponent?.name || '';
  state.race.opponentColor = opponent?.color || '#888';
  state.race.active = true;
  state.race.matchOver = false;
  state.race.winner = null;
  state.race.endReason = null;
  state.race.myPct = 0;
  state.race.opponentPct = 0;
  state.race.opponentMistakes = 0;
  state.isRaceGame = true;
  log('game', `Puzzle-Generierung gestartet (Race-Match)`, { difficulty, seed });
  let puzzle;
  try {
    puzzle = generatePuzzle({ difficulty, seed });
  } catch (e) {
    log('game', `Puzzle-Generierung fehlgeschlagen (Race-Match)`, e);
    throw e;
  }
  log('game', `Puzzle generiert (Race-Match)`, { difficulty, rows: puzzle.rows, cols: puzzle.cols });
  loadPuzzleIntoState(puzzle, null);
  state.coop.waitingForGuest = false;
  state.coop.awaitingStart = true;
  Coop.listenRaceProgress(onRaceProgressUpdate);
  navigate('game');
}
// "Nochmal spielen" nach einem beendeten Race-Match: nur der Host darf das
// auslösen (er wählt die Schwierigkeit und startet per RACE_START). Raum/
// Spieler-Verbindung bleiben dabei erhalten -- es wird nur in die bestehende
// Lobby zurückgekehrt (waitingForGuest), nicht erneut gehostet/beigetreten.
function rematchRace() {
  if (state.coop.role !== 'host') return;
  state.race.active = false;
  state.race.matchOver = false;
  state.race.winner = null;
  state.race.endReason = null;
  state.race.myPct = 0;
  state.race.opponentPct = 0;
  state.race.opponentMistakes = 0;
  state.race.rematchPending = true;
  state.isRaceGame = false;
  state.coop.awaitingStart = false;
  state.coop.waitingForGuest = true;
  navigate('coop');
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
    maxPlayers: state.coop.raceMode ? 2 : COOP_MAX_PLAYERS,
    onOpen(id) {
      // Eigene ID dieser Session sichern und sofort dem Host die eigene Identität
      // melden — coopSend() blockt hier noch (state.coop.connected wird erst nach
      // der ersten ROSTER-Antwort true), daher direkt über die Transportschicht senden.
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
    onClose(id) {
      if (coopIntentionalLeave) return;
      // Nur reagieren, wenn der Host (oder, bei noch unbekannter hostId, der
      // einzig bekannte Stand) gegangen ist — ein abreisender Mitspieler, der
      // nicht der Host war, betrifft die eigene Verbindung nicht. Greift sowohl
      // in der Lobby (vor Spielstart) als auch in der laufenden Runde, damit bei
      // bis zu COOP_MAX_PLAYERS Spielern auch ein Host-Wechsel mitten in der
      // Warte-Lobby den Raum nicht verwaisen lässt.
      const wasHost = !state.coop.hostId || id === state.coop.hostId;
      const leavingName = state.coop.players.find(p => p.id === id)?.name || t('common.defaultPlayerName');
      removePlayer(id);
      if (!wasHost) {
        showToast(t('coop.partnerDisconnected', { name: leavingName }), 'info', 3000);
        return;
      }
      // Auch wenn nur ich selbst übrig bin, Host-Rolle übernehmen — so kann
      // der ursprüngliche Host (oder ein neuer Mitspieler) wieder beitreten.
      const newHostId = pickNewHostId();
      if (newHostId === state.coop.myId) {
        showToast(t('coop.hostDisconnectedPromoting', { name: leavingName }), 'info', 3000);
        promoteToHost();
      } else if (newHostId) {
        state.coop.hostId = newHostId;
      } else {
        showToast(t('coop.hostDisconnected', { name: leavingName }), 'info', 3000);
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
    mistakes: state.mistakes || 0,
    hintsUsedGame: state.hintsUsed || 0,
    difficulty: state.puzzle?.difficulty,
    coop: state.coop.active,
    isRace: state.isRaceGame,
    isTeam: state.team.active,
    timeMs: state.elapsed,
    hour: new Date().getHours(),
    totalWon: (state.stats.won || 0) + (state.stats.coopWon || 0),
    totalPlayed: (state.stats.played || 0) + (state.stats.coopPlayed || 0),
    perfectWins: state.coop.active ? state.stats.coopPerfectWins : state.stats.perfectWins,
    currentStreak: state.coop.active ? state.stats.coopCurrentStreak : state.stats.currentStreak,
    coopWon: state.stats.coopWon || 0,
    raceWon1v1: state.raceStats['1v1']?.racesWon || 0,
    raceWon2v2: state.raceStats['2v2']?.racesWon || 0,
    streak: state.streak.currentStreak,
    historyLength: state.puzzleHistory.length,
    wonAllDifficulties: DIFFICULTIES.every(d => (state.stats.byDifficulty[d.id]?.won || 0) > 0 || (state.stats.byDifficulty[d.id]?.coopWon || 0) > 0),
  };
  const newly = evaluateAchievements(ctx, Object.keys(state.achievements));
  if (!newly.length) return;
  state.achievements = unlockAchievements(newly);
  const name = t('achievements.' + newly[0] + '.title');
  showToast(t('achievements.unlockedToast', { name }) + (newly.length > 1 ? ` (+${newly.length - 1})` : ''), 'success', 3500);
}

// Meldet das eigene Team als fertig (Sieg ODER Niederlage/Aufgabe) raumweit --
// bewusst über Coop.send direkt statt coopSend(), da die Nachricht BEIDE Teams
// erreichen muss, nicht nur das eigene. "won" entscheidet den Sieg selbst; bei
// "lost"/"gaveup" gewinnt automatisch das andere Team (kein Zu-Ende-Spielen
// für eigene Stats, siehe Plan).
function broadcastTeamDone(outcome) {
  state.team.matchOver = true;
  state.team.winningTeam = outcome === 'won' ? state.team.myTeam : (state.team.myTeam === 'A' ? 'B' : 'A');
  state.team.endReason = outcome;
  state.team.myPct = progressPct();
  // Sofortiger, ungedrosselter Progress-Push, damit die Gegenseite die finale
  // Einzel-Fehlerverteilung (mistakesByPlayer) sicher noch vor Match-Ende erhält
  // -- der reguläre pushTeamProgress()-Throttle könnte den letzten Stand sonst
  // verpassen, wenn das Match genau zwischen zwei Throttle-Fenstern endet.
  Coop.setTeamProgress(state.team.myTeam, { pct: state.team.myPct, mistakes: state.mistakes, mistakesByPlayer: { ...state.coop.mistakesByPlayer } });
  Coop.send({ type: Coop.MSG.TEAM_DONE, team: state.team.myTeam, outcome });
}

// Meldet das eigene Ergebnis im Race-Match raumweit -- bewusst über Coop.send
// direkt statt coopSend(), da state.coop.active während des Rennens absichtlich
// false bleibt (siehe state.race-Kommentar) und die Nachricht trotzdem den
// Gegner erreichen muss. "won" entscheidet den Sieg selbst; bei "lost"/"gaveup"
// gewinnt automatisch der Gegner (kein Zu-Ende-Spielen für eigene Stats, analog
// Team-vs-Team).
function broadcastRaceDone(outcome) {
  state.race.matchOver = true;
  state.race.winner = outcome === 'won' ? 'me' : 'opponent';
  state.race.endReason = outcome;
  state.race.myPct = progressPct();
  Coop.send({ type: Coop.MSG.RACE_DONE, from: state.coop.myId, outcome, finalPct: state.race.myPct, finalMistakes: state.mistakes });
}

function win(remote) {
  if (state.status === 'won') return;
  state.status = 'won';
  log('game', `Gewonnen`, { remote: !!remote, coop: state.coop.active });
  stopTimer();
  updateMusic();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  launchConfetti((state.mistakes || 0) === 0 && (state.hintsUsed || 0) === 0);
  // Trainingsrätsel (geführter Lernmodus, keine echte eigene Leistung)
  // fließen bewusst nicht in die nach Schwierigkeit gebucketeten Streaks/
  // Bestzeiten ein.
  if (state.isTrainingGame || state.isRaceGame) {
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
  if (!state.isTrainingGame) state.streak = recordStreakResult();
  if (state.isRaceGame) state.raceStats = recordRaceWin('1v1', state.elapsed);
  if (state.team.active) state.raceStats = recordRaceWin('2v2', state.elapsed);
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
  persistGame();
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'won', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
  if (state.team.active && !remote) broadcastTeamDone('won');
  if (state.race.active && !remote) broadcastRaceDone('won');
  if (state.pendingUpdate) { state.pendingUpdate = false; state.updateReady = true; }
}

function lose(remote) {
  if (state.status === 'lost') return;
  state.status = 'lost';
  log('game', `Verloren`, { remote: !!remote, coop: state.coop.active });
  stopTimer();
  updateMusic();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  if (!state.isTrainingGame && !state.isRaceGame) {
    const { stats } = recordResult({
      difficulty: state.puzzle.difficulty, outcome: 'lost',
      timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
      coop: state.coop.active,
    });
    state.stats = stats;
  }
  if (!state.isTrainingGame) state.streak = recordStreakResult();
  if (state.isRaceGame) state.raceStats = recordRaceLoss('1v1');
  if (state.team.active) state.raceStats = recordRaceLoss('2v2');
  if (!state.isTrainingGame) {
    state.puzzleHistory = recordHistory({
      difficulty: state.puzzle.difficulty, dim: { r: state.puzzle.rows, c: state.puzzle.cols },
      seed: state.puzzle.seed, marks: state.marks.map(row => row.slice()),
      timeMs: state.elapsed, outcome: 'lost', coop: state.coop.active,
    });
    checkAchievements();
  }
  persistGame();
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'lost', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
  if (state.team.active && !remote) broadcastTeamDone('lost');
  if (state.race.active && !remote) broadcastRaceDone('lost');
  if (state.pendingUpdate) { state.pendingUpdate = false; state.updateReady = true; }
}

function giveUp(remote) {
  if (!remote && state.status !== 'playing') return;
  if (remote && state.status === 'gaveup') return;
  state.status = 'gaveup';
  log('game', `Aufgegeben`, { remote: !!remote, coop: state.coop.active });
  updateMusic();
  stopTimer();
  if (remote) {
    state.elapsed = remote.timeMs;
    state.mistakes = remote.mistakes;
    state.hintsUsed = remote.hintsUsed;
  }
  if (!state.isTrainingGame && !state.isRaceGame) {
    const { stats } = recordResult({
      difficulty: state.puzzle.difficulty, outcome: 'gaveup',
      timeMs: state.elapsed, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
      coop: state.coop.active,
    });
    state.stats = stats;
  }
  if (!state.isTrainingGame) state.streak = recordStreakResult();
  if (state.isRaceGame) state.raceStats = recordRaceLoss('1v1');
  if (state.team.active) state.raceStats = recordRaceLoss('2v2');
  if (!state.isTrainingGame) state.puzzleHistory = recordHistory({
    difficulty: state.puzzle.difficulty, dim: { r: state.puzzle.rows, c: state.puzzle.cols },
    seed: state.puzzle.seed, marks: state.marks.map(row => row.slice()),
    timeMs: state.elapsed, outcome: 'gaveup', coop: state.coop.active,
  });
  if (!state.isTrainingGame) checkAchievements();
  persistGame();
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'gaveup', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
  if (state.team.active && !remote) broadcastTeamDone('gaveup');
  if (state.race.active && !remote) broadcastRaceDone('gaveup');
  if (state.pendingUpdate) { state.pendingUpdate = false; state.updateReady = true; }
}

// Verlässt man die Coop-Lobby selbst (auch mitten in der laufenden Runde), bekommt
// das NICHT automatisch das Spiel für den Partner – der eigene players/$uid-Eintrag
// verschwindet aus der RTDB (siehe Coop.leave()/coopReset()) und der Partner reagiert
// darauf genauso wie auf einen unerwarteten Verbindungsabbruch: er übernimmt bei
// laufender Runde selbst die Host-Rolle und spielt weiter (siehe promoteToHost()/
// onClose() bzw. onLeave() in startHosting/startJoining).
function quitToHome() {
  // state.coop.active bleibt während eines Race-Matches absichtlich false
  // (siehe state.race-Kommentar) -- ohne state.race.active hier würde
  // quitToHome() ein verlassenes Rennen fälschlich als Solo-Spielstand
  // speichern und später zum Fortsetzen anbieten.
  const wasCoop = state.coop.active || state.race.active;
  const wasPlaying = state.status === 'playing' && !state.isTrainingGame;
  // Coop-Spielstand und Session sichern BEVOR coopReset()/clearCoopSession()
  // sie wegräumt — nur wenn das Spiel noch lief (kein Race, kein Training).
  // So bleibt der "Coop fortsetzen"-Button im Hauptmenü sichtbar und der
  // Spieler kann per resumeCoopGame() wieder beitreten, solange der Raum offen ist.
  const coopSnap = wasCoop && wasPlaying && !state.race.active ? activeSnapshot() : null;
  const coopSess = coopSnap ? { code: state.coop.code, role: state.coop.role, name: state.settings.coopName, color: state.settings.coopMyColor, hostId: state.coop.hostId } : null;
  if (state.coop.role) coopReset();
  // Solo- und Coop-Spielstände leben in getrennten Storage-Slots (siehe
  // persistGame()) -- ein Verlassen des einen Modus darf den gespeicherten
  // Stand des anderen nicht überschreiben/löschen.
  if (wasCoop) {
    if (!state.race.active) {
      if (coopSnap) { saveActiveGameCoop(coopSnap); saveCoopSession(coopSess); }
      else saveActiveGameCoop(null);
    }
  } else {
    saveActiveGame(wasPlaying ? activeSnapshot() : null);
  }
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
    puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, lives: state.lives, maxLives: state.maxLives,
    hintsLeft: state.hintsLeft, hintsUsed: state.hintsUsed, mistakes: state.mistakes,
    elapsed: state.elapsed, difficulty: state.puzzle.difficulty,
    hintMarks: collectHintMarks(),
    ts: Date.now(),
  };
}
function persistGame() {
  // Race-Matches sind strikt live/Wettkampf -- ein Fortsetzen nach Verbindungs-
  // abbruch wäre unfair/sinnlos (siehe state.race-Kommentar), daher nie persistiert.
  if (state.race.active) return;
  // Solo- und Coop-Spielstände leben in getrennten Storage-Slots, sonst
  // überschreibt ein 400ms-Autosave aus dem jeweils anderen Modus den
  // gespeicherten Stand des anderen.
  // Trainingsrätsel werden nie persistiert/fortgesetzt -- sie sind als
  // wiederholbarer Lerndurchlauf gedacht, kein "Spielstand".
  if (state.status !== 'playing' || state.isTrainingGame) {
    if (state.coop.active) { saveActiveGameCoop(null); clearCoopSession(); }
    else saveActiveGame(null);
    return;
  }
  const now = Date.now();
  if (now - saveThrottle < 400) return;
  saveThrottle = now;
  if (state.coop.active) {
    saveActiveGameCoop(activeSnapshot());
    saveCoopSession({ code: state.coop.code, role: state.coop.role, name: state.settings.coopName, color: state.settings.coopMyColor, hostId: state.coop.hostId });
  } else {
    saveActiveGame(activeSnapshot());
  }
}
function refreshResume() {
  const g = loadActiveGame();
  state.resumeAvailable = (g && g.puzzle) ? g : null;
  const gc = loadActiveGameCoop();
  state.resumeAvailableCoop = (gc && gc.puzzle) ? gc : null;
}
function resumeGame() {
  const g = state.resumeAvailable;
  if (!g) return;
  navigate('game');
  loadPuzzleIntoState(g.puzzle, g);
  startTimer();
}
// Fortsetzen eines unterbrochenen Coop-Spiels (kalter Wiederverbindungsfall,
// siehe Coop.rejoin()) -- state.coop.active/code/role/hostId müssen schon VOR
// loadPuzzleIntoState() gesetzt sein, da dessen abschließender persistGame()-
// Aufruf sonst fälschlich den Solo-Slot statt des Coop-Slots beschreibt.
function resumeCoopGame() {
  const g = state.resumeAvailableCoop;
  const sess = loadCoopSession();
  if (!g || !sess) { state.resumeAvailableCoop = null; saveActiveGameCoop(null); clearCoopSession(); return; }
  state.coop.active = true;
  state.coop.code = sess.code;
  state.coop.role = sess.role;
  state.coop.hostId = sess.hostId;
  state.coop.players = [];
  navigate('game');
  loadPuzzleIntoState(g.puzzle, g);
  startTimer();
  attemptCoopRejoin(sess);
}
function attemptCoopRejoin(sess) {
  coopIntentionalLeave = false;
  state.coop.waitingForGuest = true;
  Coop.rejoin({
    code: sess.code, name: sess.name, color: sess.color, role: sess.role,
    onOpen(id, actualRole) {
      state.coop.myId = id;
      state.coop.waitingForGuest = false;
      // actualRole kommt von Coop.rejoin(): falls inzwischen ein anderer Host
      // gewählt wurde, wird die eigene Rolle auf 'guest' korrigiert.
      if (actualRole && actualRole !== state.coop.role) {
        state.coop.role = actualRole;
      }
      upsertPlayer(id, sess.name, sess.color);
      // Informiert einen ggf. noch aktiven Host über die eigene Rückkehr --
      // identisch zum normalen Beitritts-Pfad (confirmCoopIdentity()), löst
      // beim Host upsertPlayer()+broadcastRoster() aus (handleCoopMsg/IDENTITY).
      Coop.send({ type: Coop.MSG.IDENTITY, name: sess.name, color: sess.color });
      showToast(t('coop.reconnected'), 'success', 2000);
    },
    onError() {
      state.coop.waitingForGuest = false;
      clearCoopSession();
      showToast(t('coop.errorRoomGone'), 'error', 3000);
    },
    // Bereits vorhandene Mitspieler feuern beim erneuten Anhängen der Listener
    // sofort ein onChildAdded -- so lernt z.B. ein wiederverbundener Host die
    // während seiner Abwesenheit unveränderte Mitspielerliste erneut.
    onJoin(id, data) {
      upsertPlayer(id, data?.name, data?.color);
      if (state.coop.role === 'host') broadcastRoster();
    },
    onLeave(id) {
      const leavingName = state.coop.players.find(p => p.id === id)?.name || t('common.defaultPlayerName');
      removePlayer(id);
      if (state.coop.role === 'host') broadcastRoster();
      if (!coopIntentionalLeave) showToast(t('coop.partnerDisconnected', { name: leavingName }), 'info', 3000);
    },
    onMessage: handleCoopMsg,
  });
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
// Bei einem makellosen Sieg (keine Fehler, keine Hinweise) fällt die Animation
// dichter und länger aus -- abgestufte Belohnung statt eines einzigen festen
// Effekts für jeden Sieg.
function launchConfetti(perfect) {
  state.perfectWin = !!perfect;
  const colors = REGION_COLORS.map(c => `hsl(${c.h} ${c.s}% ${c.l}%)`);
  const count = perfect ? 160 : 80;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i, left: Math.random() * 100,
      delay: Math.random() * 0.5, dur: 1.6 + Math.random() * 1.4,
      color: colors[i % colors.length], rot: Math.random() * 360,
      size: perfect ? 8 + Math.random() * 10 : 6 + Math.random() * 8,
    });
  }
  // markRaw: die Teilchen ändern sich nach dem Erzeugen nie wieder (reine
  // CSS-Animation übernimmt den Rest) -- ohne markRaw würde Vue für jedes der
  // bis zu 160 Objekte einen reaktiven Proxy anlegen, was beim Auslösen genau
  // den Initial-Ruckler verursacht, den dieser Effekt eigentlich feiern soll.
  state.confetti = pieces.map(p => markRaw(p));
  setTimeout(() => { state.confetti = []; }, perfect ? 4800 : 3500);
}

// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────
function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  if (key === 'darkMode' || key === 'colorBlindMode') applyTheme();
  if (key.startsWith('music')) updateMusic();
  // Aktions-Sound beim Einschalten kurz vorspielen (zum Anhören/Prüfen).
  if (state.settings[key]) {
    if (key === 'sfxComplete') Music.sfxComplete(1);
    else if (key === 'sfxKeep') Music.sfxKeep();
    else if (key === 'sfxRemove') Music.sfxRemove();
    else if (key === 'sfxError') Music.sfxError();
    else if (key === 'sfxHint') Music.sfxHint();
  }
}
function setSetting(key, val) {
  state.settings[key] = val;
  if (key === 'language') applyLocale();
  if (key === 'musicVolume') { Music.setVolume(val); updateMusic(); }
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
    state.settings = loadSettings(); state.stats = loadStats(); state.streak = loadStreak(); state.puzzleHistory = loadHistory(); applyTheme(); applyLocale(); refreshResume();
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
function replayHistoryEntry(entry) {
  state.historyDetail = null;
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
function dismissStreakLostNotice() { state.streakLostNotice = false; }

// ─── APP-UPDATE (Service Worker) ──────────────────────────────────────────────
// Hält den im "waiting" wartenden Worker, bis der Nutzer aktiv aktualisiert.
let waitingWorker = null;

// Zeigt den Update-Dialog — aber nicht mitten im Spiel. Wenn gerade gespielt
// wird, merkt pendingUpdate das und der Dialog erscheint nach Spielende.
function offerUpdate() {
  if (state.screen === 'game' && state.status === 'playing') {
    state.pendingUpdate = true;
  } else {
    state.updateReady = true;
  }
}
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
  if (state.streak.justLost) state.streakLostNotice = true;
  window.addEventListener('resize', computeCellSize);
  window.addEventListener('resize', scheduleScrollLockUpdate);
  // Deckt jede Inhaltsänderung ab (Badges, Sprache, dynamische Banner), ohne
  // jedes betroffene state-Feld einzeln verdrahten zu müssen.
  const appEl = document.querySelector('.app');
  if (appEl) new MutationObserver(scheduleScrollLockUpdate).observe(appEl, { childList: true, subtree: true, attributes: true, characterData: true });
  nextTick(() => { document.querySelector('.screen')?.scrollTo(0, 0); scheduleScrollLockUpdate(); });
  // Menü-/App-Musik: Browser erlauben Audio erst nach einer Nutzergeste. Der
  // Listener bleibt BESTEHEN (nicht { once }), damit auch nach dem Zurückkehren
  // aus dem Hintergrund (frischer, zunächst gesperrter AudioContext) der erste
  // Tap die Musik wieder startet. updateMusic() ist idempotent.
  // Menü-/App-Musik möglichst SOFORT starten (Wunsch: Musik schon beim Öffnen
  // der App / sobald das Menü sichtbar ist, ohne dass man erst etwas antippen
  // muss). Daher EAGER beim Laden versuchen — auf Android/Desktop startet das
  // direkt. iOS/Safari verlangt für den allerersten Audiostart prinzipiell eine
  // Nutzergeste; dort greift der Listener unten und startet die Musik beim ersten
  // Tippen/Tasten/Touch. updateMusic() ist idempotent.
  updateMusic();
  const unlockAudio = () => updateMusic();
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  // App im Hintergrund: AudioContext KOMPLETT schließen (suspendForBackground),
  // damit das OS nichts mehr glitchen kann. Zurück im Vordergrund sofort wieder
  // starten (und falls iOS das blockt, beim ersten Tap, s.o.).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Music.suspendForBackground();
    else updateMusic();
  });
  // pagehide/pageshow zusätzlich: feuert auf iOS-PWA beim Backgrounding oft
  // zuverlässiger/früher als visibilitychange.
  window.addEventListener('pagehide', () => Music.suspendForBackground());
  window.addEventListener('pageshow', () => updateMusic());
  window.addEventListener('blur', () => { if (document.hidden) Music.suspendForBackground(); });
}

// ════════════════════════════════════════════════════════════════════════════
//  KOMPONENTE / TEMPLATE
// ════════════════════════════════════════════════════════════════════════════
const App = {
  setup() {
    const livesArr = computed(() => Array.from({ length: state.maxLives }, (_, i) => i < state.lives));
    // Gegner-Lebensanzeige im Wettkampf: dieselbe Herzen-Optik wie die eigene
    // (state.maxLives ist symmetrisch, da beide Seiten dieselbe Schwierigkeit/
    // Einstellung spielen) -- Fehler des Gegners zählen 1:1 wie eigene Fehler.
    const opponentLivesArr = computed(() => {
      const left = Math.max(0, state.maxLives - state.race.opponentMistakes);
      return Array.from({ length: state.maxLives }, (_, i) => i < left);
    });
    const opponentTeamLivesArr = computed(() => {
      const left = Math.max(0, state.maxLives - state.team.opponentMistakes);
      return Array.from({ length: state.maxLives }, (_, i) => i < left);
    });
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
      // Im Team-vs-Team-Modus nur das eigene Team auswerten -- die Gegenseite
      // hat ohnehin nie Zugriff auf dieses Puzzle/diese markedBy-Daten bekommen.
      const roster = state.team.active ? state.coop.players.filter(pl => pl.team === state.team.myTeam) : state.coop.players;
      if (!roster.length) return [];
      const p = state.puzzle;
      const raw = roster.map(pl => {
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
    // Einzel-Leben-Verlust pro Gegner-Spieler im 2v2-Modus (Punkt #18) -- nutzt
    // state.team.opponentMistakesByPlayer, das übers teamProgress-Feld der
    // Gegenseite mitwandert (siehe pushTeamProgress()/onTeamProgressUpdate()).
    // Korrekt-Zahlen (correctKept/correctRemoved) gibt es hier bewusst nicht --
    // die Gegenseite bekommt nie Zugriff auf das Gitter der anderen Seite.
    const opponentTeamPerformance = computed(() => {
      if (!state.team.active || !state.coop.players.length) return [];
      const opponentTeam = state.team.myTeam === 'A' ? 'B' : 'A';
      return state.coop.players
        .filter(pl => pl.team === opponentTeam)
        .map(pl => ({ id: pl.id, name: pl.name, color: pl.color, mistakes: state.team.opponentMistakesByPlayer[pl.id] || 0 }));
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
    // Eigener Fortschritt (0-100) für die Fortschrittsanzeige im HUD -- reaktiver
    // Wrapper um progressPct(), das dieselbe Berechnung schon fürs Team-/Race-
    // Throttle-Pushing nutzt (siehe dort), hier aber ungedrosselt für die lokale UI.
    const myProgressPct = computed(() => progressPct());
    const gridStyle = computed(() => ({
      gridTemplateColumns: `var(--hdr) repeat(${state.puzzle?.cols || 1}, var(--cell))`,
      gridTemplateRows: `var(--hdr) repeat(${state.puzzle?.rows || 1}, var(--cell))`,
      '--cell': state.cellPx + 'px',
      '--hdr': state.cellPx + 'px',
      '--fs': Math.max(11, Math.round(state.cellPx * 0.4)) + 'px',
    }));
    onMounted(init);
    const coopAvailable = computed(() => Coop.isAvailable());
    // Die "fehlerfrei"-Formulierung gilt nur, wenn die jeweilige Seite tatsächlich
    // 0 Fehler hatte -- vorher war der Text unabhängig von state.mistakes/
    // state.race.opponentMistakes immer als "fehlerfrei" formuliert.
    // state.race.endReason verrät, WARUM das Match endete (Outcome der Seite, die
    // es ausgelöst hat) -- ohne das wurde hier immer "fehlerfrei zuerst fertig"
    // behauptet, selbst wenn der Sieg nur daraus kam, dass der Gegner alle Leben
    // verloren oder aufgegeben hat (und umgekehrt bei der eigenen Niederlage).
    const raceResultMsg = computed(() => {
      const r = state.race;
      const name = r.opponentName || t('common.defaultPlayerName');
      if (r.winner === 'me') {
        if (r.endReason === 'lost') return t('race.youWonByOpponentLives', { name, myPct: r.myPct, oppPct: r.opponentPct });
        if (r.endReason === 'gaveup') return t('race.youWonByOpponentGaveup', { name, myPct: r.myPct, oppPct: r.opponentPct });
        const key = state.mistakes === 0 ? 'race.youWonClean' : 'race.youWonMistakes';
        return t(key, { name, myPct: r.myPct, oppPct: r.opponentPct });
      }
      if (r.endReason === 'lost') return t('race.youLostByLives', { name, myPct: r.myPct, oppPct: r.opponentPct });
      if (r.endReason === 'gaveup') return t('race.youLostByGaveup', { name, myPct: r.myPct, oppPct: r.opponentPct });
      const key = r.opponentMistakes === 0 ? 'race.youLostClean' : 'race.youLostMistakes';
      return t(key, { name, myPct: r.myPct, oppPct: r.opponentPct });
    });
    // Analog zu raceResultMsg: state.team.endReason unterscheidet ein echtes
    // Fertiglösen vom automatischen Sieg/der automatischen Niederlage durch
    // Leben-Verlust/Aufgabe der jeweiligen Seite.
    const teamResultMsg = computed(() => {
      const tm = state.team;
      const won = tm.winningTeam === tm.myTeam;
      const oppTeam = tm.myTeam === 'A' ? 'B' : 'A';
      const params = { myTeam: tm.myTeam, oppTeam, myPct: tm.myPct, oppPct: tm.opponentPct };
      if (won) {
        if (tm.endReason === 'lost') return t('team.weWonByOpponentLives', params);
        if (tm.endReason === 'gaveup') return t('team.weWonByOpponentGaveup', params);
        return t('team.weWon', params);
      }
      if (tm.endReason === 'lost') return t('team.weLostByLives', params);
      if (tm.endReason === 'gaveup') return t('team.weLostByGaveup', params);
      return t('team.weLost', params);
    });
    // Das WIN-Overlay zeigte bisher immer t('win.title') ("Gelöst!"), auch wenn
    // der Sieg im Team-/Race-Modus nur daraus kam, dass die Gegenseite alle Leben
    // verloren oder aufgegeben hat -- man hat dann selbst nichts "gelöst".
    const winTitle = computed(() => {
      if (state.race.active && state.race.endReason && state.race.endReason !== 'won') return t('race.winTitleAuto');
      if (state.team.active && state.team.endReason && state.team.endReason !== 'won') return t('team.winTitleAuto');
      return t('win.title');
    });
    const achievementsUnlockedCount = computed(() => Object.keys(state.achievements).length);

    return {
      state, BUILD, CHANGELOG, DIFFICULTIES, DIFF_BY_ID, ACHIEVEMENTS, achievementsUnlockedCount,
      livesArr, lifeLossColor, opponentLivesArr, opponentTeamLivesArr, coopPerformance, mvpId, opponentTeamPerformance, progress, myProgressPct, gridStyle, coopAvailable,
      navigate, newGame, goNextPuzzle, resumeGame, resumeCoopGame, onCellTap, onCellPointerDown, onCellPointerMove, onCellPointerCancel, undo, useHint, revealHintNudge, dismissHintNudge, doCheck,
      rowSum, colSum, regionSum, rowResolved, colResolved, regionResolved, rowSumMatch, colSumMatch,
      fmtTime, toggleSetting, setSetting, doExport, doExportLog, doImport, openBackups, doRestore,
      resetStats, doDeleteAllData, ask, confirmYes, confirmNo, dismissWhatsNew, dismissStreakLostNotice, loadBackups,
      quitToHome, setZoom, pauseGame, resumeFromPause, openSettings, closeSettings, startCoopRound,
      cellClasses, cellStyle, cellAriaLabel, toggleTool,
      startHosting, startJoining, coopReset, avgTimeFor, coopAvgTimeFor, racePct, giveUp,
      startCoopMatch, canStartCoopMatch, COOP_MAX_PLAYERS, DONATE_URL,
      assignTeam, randomizeTeams, canStartTeamMatch, startTeamMatch, goRace, canStartRaceMatch, startRaceMatch, rematchRace,
      chipTextColor, confirmCoopIdentity, playerColor, goCoop, applyUpdate,
      nonHostPlayers, readyCount, allGuestsReady, myReady, markReady, unmarkReady,
      shareCoopInvite, raceResultMsg, teamResultMsg, winTitle,
      startTrainingGame, applyTrainingStep,
      openHistoryDetail, closeHistoryDetail, historyGridStyle, historyCellClasses, historyCellStyle, replayHistoryEntry,
      t, i18nState, SUPPORTED_LOCALES,
    };
  },
  template: `
  <div class="app" :class="{ generating: state.generating, 'modal-open': !!state.modal, 'app-game': state.screen === 'game', 'app-home': state.screen === 'home' }">

    <!-- ══ HOME ══ -->
    <section v-if="state.screen==='home'" class="screen home">
      <a class="icon-btn home-donate-btn" :href="DONATE_URL" target="_blank" rel="noopener" :aria-label="t('home.donate')" :title="t('home.donate')">☕<span class="home-donate-heart" aria-hidden="true">❤</span></a>
      <span v-if="state.streak.currentStreak>0" class="home-streak-badge">🔥{{ state.streak.currentStreak }}</span>
      <div class="home-topbar-right">
        <button class="icon-btn home-howto-btn" @click="state.modal='howto'" :aria-label="t('home.howto')" :title="t('home.howto')">?</button>
        <button class="icon-btn home-settings-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button>
      </div>
      <div class="brand">
        <img class="brand-logo" src="./icons/icon-192.png" alt="" />
        <h1 class="brand-title">Coop<br>Number Sums</h1>
      </div>

      <div class="home-actions">
        <div v-if="state.resumeAvailable || state.resumeAvailableCoop" class="resume-row">
          <button v-if="state.resumeAvailable" class="btn btn-resume" @click="resumeGame">
            <span class="btn-ic">▶</span>
            <span class="btn-tx"><b>{{ t('home.resume') }}</b>
              <small>{{ t('difficulty.'+state.resumeAvailable.difficulty) }} · {{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.dim.r }}×{{ DIFF_BY_ID[state.resumeAvailable.difficulty]?.dim.c }} · {{ fmtTime(state.resumeAvailable.elapsed||0) }}</small>
            </span>
          </button>
          <button v-if="state.resumeAvailableCoop" class="btn btn-resume" @click="resumeCoopGame">
            <span class="btn-ic">👥</span>
            <span class="btn-tx"><b>{{ t('home.resumeCoop') }}</b>
              <small>{{ t('difficulty.'+state.resumeAvailableCoop.difficulty) }} · {{ DIFF_BY_ID[state.resumeAvailableCoop.difficulty]?.dim.r }}×{{ DIFF_BY_ID[state.resumeAvailableCoop.difficulty]?.dim.c }} · {{ fmtTime(state.resumeAvailableCoop.elapsed||0) }}</small>
            </span>
          </button>
        </div>
        <button class="btn btn-primary" @click="coopReset(); navigate('setup')">
          <span class="btn-ic">🧩</span><span class="btn-tx"><b>{{ t('home.newGame') }}</b><small>{{ t('home.newGameHint') }}</small></span>
        </button>
        <button class="btn btn-coop" :disabled="!coopAvailable" @click="goCoop">
          <span class="btn-ic">👥</span><span class="btn-tx"><b>{{ t('home.coopMode') }}</b><small>{{ t('home.coopHint') }}</small></span>
          <span v-if="!coopAvailable" class="badge-soon">{{ t('home.comingSoon') }}</span>
        </button>
        <button class="btn btn-ghost race-btn" :disabled="!coopAvailable" @click="state.modal='raceChoice'">
          <span class="btn-ic">🆚</span><span class="btn-tx"><b>{{ t('home.raceMode') }}</b><small>{{ t('home.raceHint') }}</small></span>
        </button>
        <div class="home-grid">
          <button class="btn btn-ghost" @click="navigate('stats')"><span class="btn-ic">📊</span> {{ t('home.stats') }}</button>
          <button class="btn btn-ghost" @click="navigate('history')"><span class="btn-ic">🕘</span> {{ t('home.history') }}</button>
        </div>
      </div>
      <div class="home-version">v{{ BUILD }}</div>
    </section>

    <!-- ══ SETUP ══ -->
    <section v-else-if="state.screen==='setup'" class="screen setup">
      <header class="topbar">
        <button class="icon-btn" @click="coopReset(); navigate('home')">‹</button>
        <h2>{{ t('setup.title') }}</h2>
        <button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button>
      </header>
      <div class="setup-body">
        <div class="setup-label">{{ t('common.difficulty') }}</div>
        <div class="option-grid">
          <button v-for="d in DIFFICULTIES" :key="d.id" class="opt-card" :class="{active: state.sel.difficulty===d.id}" @click="state.sel.difficulty=d.id">
            <span class="opt-emoji">{{ d.emoji }}</span>
            <span class="opt-name">{{ t('difficulty.'+d.id) }}</span>
            <span class="opt-desc">{{ d.dim.r }}×{{ d.dim.c }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.bestTimeMs!=null" class="opt-best">🏆 {{ fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) }}</span>
            <span v-if="state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null" class="opt-best">👥🏆 {{ fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) }}</span>
          </button>
        </div>
        <button class="btn btn-primary btn-start" @click="newGame(state.sel.difficulty)">
          {{ t('setup.start') }}
        </button>
      </div>
    </section>

    <!-- ══ GAME ══ -->
    <section v-else-if="state.screen==='game'" class="screen game" :class="{ 'race-mode': state.race.active, 'team-mode': state.team.active, 'training-mode': state.isTrainingGame }">
      <header class="topbar game-top">
        <button class="icon-btn" @click="quitToHome">‹</button>
        <div class="hud">
          <div class="hud-item lives" v-if="state.settings.livesEnabled">
            <span v-for="(full,i) in livesArr" :key="i" class="heart" :class="{empty:!full}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <i v-if="!full && state.coop.active && lifeLossColor(i)" class="heart-strike" :style="{background: lifeLossColor(i)}"></i>
            </span>
          </div>
          <div class="hud-item timer" v-if="state.settings.showTimer"><span class="timer-icon">⏱</span><span>{{ fmtTime(state.elapsed) }}</span></div>
        </div>
        <div class="top-actions">
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing' && !state.coop.awaitingStart" @click="pauseGame" :title="t('game.pauseTitle')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg>
          </button>
          <button class="icon-btn" v-if="state.puzzle && !state.generating && state.status==='playing'" @click="ask(t('game.giveUpConfirmTitle'), t('game.giveUpConfirmMsg'), giveUp)" :title="t('game.giveUpTitle')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="5" y="3" width="2.4" height="18" rx="1.2"/><path d="M7.4 4h12.1l-3 3.6 3 3.6H7.4z"/></svg>
          </button>
          <button class="icon-btn" @click="state.modal='howto'">?</button>
          <button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button>
        </div>
      </header>

      <div v-if="state.generating" class="loading">
        <div class="spinner"></div>
        <div class="loading-tx">{{ t('game.loading') }}</div>
      </div>

      <template v-else-if="state.puzzle">
        <!-- game-sidebar-top/-bottom sind im Hochformat unsichtbare Wrapper
             (display:contents, siehe styles.css) -- ihre Kinder verhalten sich
             dort exakt wie bisher als direkte Flex-Kinder von .screen.game.
             Im Querformat werden sie zu echten Grid-Feldern neben dem
             Spielfeld (siehe @media ... orientation:landscape). -->
        <div class="game-sidebar-top">
        <div class="game-meta">
          <span class="chip">{{ DIFF_BY_ID[state.puzzle.difficulty].emoji }} {{ t('difficulty.'+state.puzzle.difficulty) }}</span>
          <span class="chip">{{ state.puzzle.rows }}×{{ state.puzzle.cols }}</span>
          <span v-if="state.coop.active" class="chip coop-chip" :class="state.coop.connected ? 'coop-on' : 'coop-off'">
            👥 {{ t('game.coopTag') }}{{ state.coop.connected ? '' : t('game.coopOfflineSuffix') }}
          </span>
          <span v-if="state.team.active" class="chip coop-chip">🆚 {{ t('team.label'+state.team.myTeam) }}</span>
          <span v-if="state.team.active" class="chip coop-chip">{{ t('team.opponentProgress', { pct: state.team.opponentPct }) }}</span>
          <span v-if="state.team.active && state.settings.livesEnabled" class="chip coop-chip hearts-chip" :aria-label="t('win.mistakesCount', { count: state.team.opponentMistakes })">
            <span v-for="(full,i) in opponentTeamLivesArr" :key="i" class="heart" :class="{empty:!full}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <i v-if="!full" class="heart-strike opp-heart-strike"></i>
            </span>
          </span>
          <span v-if="state.race.active" class="chip coop-chip">🆚 {{ state.race.opponentName }}</span>
          <span class="zoomctl">
            <button class="zoom-btn" @click="setZoom(-0.15)">−</button>
            <button class="zoom-btn" @click="setZoom(0.15)">+</button>
          </span>
        </div>

        <!-- Eigener Fortschritt (immer sichtbar); im Race-Modus zusätzlich der
             Gegner-Balken direkt darunter, damit beide Balken auf einen Blick
             verglichen werden können. -->
        <div class="progress-row">
          <div class="progress-line" :aria-label="t('game.progressLabel', { pct: myProgressPct })">
            <span v-if="state.race.active" class="progress-label">{{ t('common.you') }}</span>
            <span class="progress-pct">{{ myProgressPct }}%</span>
            <span class="progress-bar"><span class="progress-bar-fill mine" :style="{ width: myProgressPct + '%' }"></span></span>
          </div>
          <div class="progress-line" v-if="state.race.active" :aria-label="t('race.opponentProgress', { pct: state.race.opponentPct })">
            <span class="progress-label">{{ state.race.opponentName }}</span>
            <span class="progress-pct">{{ state.race.opponentPct }}%</span>
            <span class="progress-bar"><span class="progress-bar-fill opp" :style="{ width: state.race.opponentPct + '%', background: state.race.opponentColor }"></span></span>
          </div>
          <div class="progress-line opponent-lives-line" v-if="state.race.active && state.settings.livesEnabled" :aria-label="t('win.mistakesCount', { count: state.race.opponentMistakes })">
            <span class="progress-label"></span>
            <span class="opponent-lives">
              <span v-for="(full,i) in opponentLivesArr" :key="i" class="heart" :class="{empty:!full}">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <i v-if="!full" class="heart-strike opp-heart-strike"></i>
              </span>
            </span>
          </div>
        </div>

        <div v-if="state.coop.active && state.coop.players.length" class="coop-roster">
          <span v-for="p in (state.team.active ? state.coop.players.filter(pl=>pl.team===state.team.myTeam) : state.coop.players)" :key="p.id" class="player-chip"
                :style="{ background: p.color, color: chipTextColor(p.color) }">
            {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
          </span>
        </div>
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
                <i v-if="state.marks[r-1][c-1]==='removed' && state.cellMeta[r-1][c-1].hintMark" class="hint-dot"></i>
              </div>
            </template>
          </div>
        </div>

        <div class="game-sidebar-bottom">
        <div v-if="!state.isTrainingGame || state.trainingDone" class="toolbar">
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
          <button v-if="!state.isRaceGame && !state.team.active" class="round-btn" :disabled="state.hintsLeft<=0" @click="useHint" :title="t('game.hintTitle')" :aria-label="t('game.hintTitle')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.8.7 1.2 1.3 1.3 2.4h5.4c.1-1.1.5-1.7 1.3-2.4A6.5 6.5 0 0 0 12 2.5z"/></svg>
          </button>
        </div>
        <div v-if="state.settings.errorReveal==='onCheck' && !state.isRaceGame && (!state.isTrainingGame || state.trainingDone)" class="check-row">
          <button class="btn btn-primary btn-check" @click="doCheck()">{{ t('game.check') }}</button>
        </div>
        </div>
      </template>

      <!-- Trainingsmodus: Erklär-Banner für den nächsten erzwungenen Schritt.
           Bewusst kein Vollbild-Overlay (wie Pause/Coop-Lobby) -- das Feld
           bleibt sichtbar, die betroffene Zelle ist per .training-highlight
           markiert (siehe cellClasses), damit Erklärung und Zelle zusammen
           erkennbar sind. -->
      <div v-if="state.isTrainingGame && state.status==='playing' && !state.paused" class="training-banner">
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

      <!-- Sokratischer Hinweis, Stufe 2: highlightet den Bereich (hint-group) UND
           blendet die Leitfrage ein, ohne die konkrete Zelle/Aktion zu verraten.
           Stufe 1 zeigt nur das Highlight (kein Banner). Per "Auflösen" (oder
           erneut auf den Hinweis-Knopf) wird die Zelle aufgedeckt; per X wird das
           Banner weggeklickt, damit es die Werkzeugleiste nicht dauerhaft
           verdeckt. -->
      <div v-if="state.hintNudge && state.hintNudge.stage>=2 && !state.isTrainingGame && state.status==='playing' && !state.paused" class="hint-banner">
        <div class="hint-text">
          <b>💡 {{ t('training.group.'+state.hintNudge.group.kind, { n: state.hintNudge.group.ref+1 }) }} ({{ t('training.target', { n: state.hintNudge.group.target }) }})</b>
          <span>{{ t('hint.socratic.'+state.hintNudge.reason, { rem: state.hintNudge.rem }) }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="revealHintNudge">{{ t('hint.reveal') }}</button>
        <button class="hint-dismiss" @click="dismissHintNudge" :aria-label="t('hint.dismiss')" :title="t('hint.dismiss')">✕</button>
      </div>

      <!-- Coop-Lobby: Rätsel ist da, Zeit läuft erst nach "Starten" -->
      <div v-if="state.coop.awaitingStart" class="overlay coop-lobby-overlay">
        <div class="result-card">
          <div class="result-emoji">👥</div>
          <h2>{{ t('coop.lobbyTitle') }}</h2>
          <p class="result-msg">{{ t('coop.lobbyMsg') }}</p>
          <div class="coop-roster" v-if="nonHostPlayers().length">
            <span v-for="p in nonHostPlayers()" :key="p.id" class="player-chip" :class="{ 'ready-chip': p.ready }"
                  :style="{ background: p.color, color: chipTextColor(p.color) }">
              {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
              {{ p.ready ? '✅' : '⏳' }}
            </span>
          </div>
          <template v-if="state.coop.role === 'host'">
            <p class="coop-subtext">{{ t('coop.readyCount', { n: readyCount(), total: nonHostPlayers().length }) }}</p>
            <button class="btn btn-primary" :disabled="!allGuestsReady()" @click="startCoopRound">{{ t('coop.lobbyStart') }}</button>
          </template>
          <template v-else>
            <button v-if="!myReady()" class="btn btn-primary" @click="markReady">{{ t('coop.markReady') }}</button>
            <template v-else>
              <p class="coop-subtext">{{ t('coop.waitingForHostFinalStart') }}</p>
              <button class="btn btn-ghost" @click="unmarkReady">{{ t('coop.unmarkReady') }}</button>
            </template>
          </template>
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
      <div v-if="state.status==='won'" class="overlay">
        <div class="result-card win" :class="{ perfect: state.perfectWin }">
          <div class="result-emoji">🎉</div>
          <h2>{{ winTitle }}</h2>
          <div v-if="state.team.active" class="team-result">
            <p class="result-msg">{{ teamResultMsg }}</p>
          </div>
          <div v-if="state.race.active" class="team-result">
            <p class="result-msg">{{ raceResultMsg }}</p>
          </div>
          <div v-if="state.perfectWin" class="perfect-badge">{{ t('win.perfectBadge') }}</div>
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
          <div v-if="opponentTeamPerformance.length" class="opponent-team-performance">
            <div class="perf-title">{{ t('team.opponentLivesLostPerPlayer') }}</div>
            <span v-for="pl in opponentTeamPerformance" :key="pl.id" class="chip" :style="{color: pl.color}">{{ pl.name }}: {{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
          </div>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.team.active && !state.race.active && (!state.coop.active || state.coop.role==='host')" @click="goNextPuzzle">{{ t('win.nextPuzzle') }}</button>
          <p v-else-if="!state.team.active && !state.race.active && state.coop.active && state.coop.role!=='host'" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-primary" v-else-if="state.race.active && state.coop.role==='host'" @click="rematchRace">{{ t('race.rematch') }}</button>
          <p v-else-if="state.race.active" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>
      <div v-if="state.status==='lost'" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">💔</div>
          <template v-if="state.team.active">
            <h2>{{ t('team.lossTitleAuto') }}</h2>
            <p class="result-msg">{{ teamResultMsg }}</p>
          </template>
          <template v-else-if="state.race.active">
            <h2>{{ t('race.lossTitleAuto') }}</h2>
            <p class="result-msg">{{ raceResultMsg }}</p>
          </template>
          <template v-else>
            <h2>{{ t('loss.title') }}</h2>
            <p class="result-msg">{{ t('loss.msg') }}</p>
          </template>
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
          <div v-if="opponentTeamPerformance.length" class="opponent-team-performance">
            <div class="perf-title">{{ t('team.opponentLivesLostPerPlayer') }}</div>
            <span v-for="pl in opponentTeamPerformance" :key="pl.id" class="chip" :style="{color: pl.color}">{{ pl.name }}: {{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
          </div>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.team.active && !state.race.active && (!state.coop.active || state.coop.role==='host')" @click="goNextPuzzle">{{ t('common.newGame') }}</button>
          <p v-else-if="!state.team.active && !state.race.active && state.coop.active && state.coop.role!=='host'" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-primary" v-else-if="state.race.active && state.coop.role==='host'" @click="rematchRace">{{ t('race.rematch') }}</button>
          <p v-else-if="state.race.active" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>
      <div v-if="state.status==='gaveup'" class="overlay">
        <div class="result-card lose">
          <div class="result-emoji">🏳</div>
          <h2>{{ t('gaveup.title') }}</h2>
          <template v-if="state.team.active">
            <p class="result-msg">{{ teamResultMsg }}</p>
          </template>
          <template v-else-if="state.race.active">
            <p class="result-msg">{{ raceResultMsg }}</p>
          </template>
          <template v-else>
            <p class="result-msg">{{ t('loss.msg') }}</p>
          </template>
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
          <div v-if="opponentTeamPerformance.length" class="opponent-team-performance">
            <div class="perf-title">{{ t('team.opponentLivesLostPerPlayer') }}</div>
            <span v-for="pl in opponentTeamPerformance" :key="pl.id" class="chip" :style="{color: pl.color}">{{ pl.name }}: {{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
          </div>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.team.active && !state.race.active && (!state.coop.active || state.coop.role==='host')" @click="goNextPuzzle">{{ t('common.newGame') }}</button>
          <p v-else-if="!state.team.active && !state.race.active && state.coop.active && state.coop.role!=='host'" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-primary" v-else-if="state.race.active && state.coop.role==='host'" @click="rematchRace">{{ t('race.rematch') }}</button>
          <p v-else-if="state.race.active" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>

      <!-- Confetti -->
      <div v-if="state.confetti.length" class="confetti" :class="{ perfect: state.perfectWin }">
        <i v-for="p in state.confetti" :key="p.id" :style="{left:p.left+'%', background:p.color, animationDelay:p.delay+'s', animationDuration:p.dur+'s', width:p.size+'px', height:p.size+'px', transform:'rotate('+p.rot+'deg)'}"></i>
      </div>
    </section>

    <!-- ══ STATS ══ -->
    <section v-else-if="state.screen==='stats'" class="screen stats">
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>{{ t('stats.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button></header>
      <div class="stats-body">
        <button class="btn btn-ghost achievements-top-btn" @click="navigate('achievements')">{{ t('stats.achievementsButton') }} ({{ achievementsUnlockedCount }}/{{ ACHIEVEMENTS.length }})</button>
        <div class="stats-section-title">{{ t('stats.levelOverview') }}</div>
        <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
          <div class="diff-row-top">
            <span class="diff-name">{{ d.emoji }} {{ t('difficulty.'+d.id) }}</span>
          </div>
          <div class="diff-sub">
            <div class="diff-sub-label">{{ t('stats.solo') }}</div>
            <div class="diff-row-sub">
              <span class="chip">🥇 {{ (state.stats.byDifficulty[d.id]?.won)||0 }} / {{ (state.stats.byDifficulty[d.id]?.played)||0 }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip best-time-chip">🏆 {{ state.stats.byDifficulty[d.id]?.bestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              <span class="chip">⌀ {{ avgTimeFor(d.id)!=null ? fmtTime(avgTimeFor(d.id)) : '-:--' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip">🏳 {{ (state.stats.byDifficulty[d.id]?.gaveup)||0 }}<span class="chip-label">{{ t('stats.gaveupLabel') }}</span></span>
              <span class="chip">💔 {{ (state.stats.byDifficulty[d.id]?.lost)||0 }}<span class="chip-label">{{ t('stats.lostLabel') }}</span></span>
            </div>
          </div>
          <div class="diff-sub">
            <div class="diff-sub-label coop">{{ t('stats.coop') }}</div>
            <div class="diff-row-sub">
              <span class="chip coop-chip">🥇 {{ (state.stats.byDifficulty[d.id]?.coopWon)||0 }} / {{ (state.stats.byDifficulty[d.id]?.coopPlayed)||0 }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip coop-chip best-time-chip">🏆 {{ state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              <span class="chip coop-chip">⌀ {{ coopAvgTimeFor(d.id)!=null ? fmtTime(coopAvgTimeFor(d.id)) : '-:--' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip coop-chip">🏳 {{ (state.stats.byDifficulty[d.id]?.coopGaveup)||0 }}<span class="chip-label">{{ t('stats.gaveupLabel') }}</span></span>
              <span class="chip coop-chip">💔 {{ (state.stats.byDifficulty[d.id]?.coopLost)||0 }}<span class="chip-label">{{ t('stats.lostLabel') }}</span></span>
            </div>
          </div>
        </div>
        <div class="stats-section-title">{{ t('stats.raceSection') }}</div>
        <div class="diff-row">
          <div class="diff-sub">
            <div class="diff-sub-label">{{ t('stats.race1v1') }}</div>
            <div class="diff-row-sub">
              <span class="chip">🥇 {{ state.raceStats['1v1'].racesWon }} / {{ state.raceStats['1v1'].racesPlayed }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip">📈 {{ racePct(state.raceStats['1v1']) }}%<span class="chip-label">{{ t('stats.winPctLabel') }}</span></span>
              <span class="chip best-time-chip">🏆 {{ state.raceStats['1v1'].fastestWinMs!=null ? fmtTime(state.raceStats['1v1'].fastestWinMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
            </div>
          </div>
          <div class="diff-sub">
            <div class="diff-sub-label coop">{{ t('stats.race2v2') }}</div>
            <div class="diff-row-sub">
              <span class="chip coop-chip">🥇 {{ state.raceStats['2v2'].racesWon }} / {{ state.raceStats['2v2'].racesPlayed }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip coop-chip">📈 {{ racePct(state.raceStats['2v2']) }}%<span class="chip-label">{{ t('stats.winPctLabel') }}</span></span>
              <span class="chip coop-chip best-time-chip">🏆 {{ state.raceStats['2v2'].fastestWinMs!=null ? fmtTime(state.raceStats['2v2'].fastestWinMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
            </div>
          </div>
        </div>
        <button class="btn btn-danger-ghost" @click="resetStats">{{ t('stats.reset') }}</button>
      </div>
    </section>

    <!-- ══ ACHIEVEMENTS ══ -->
    <section v-else-if="state.screen==='achievements'" class="screen achievements">
      <header class="topbar"><button class="icon-btn" @click="navigate('stats')">‹</button><h2>{{ t('achievements.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button></header>
      <div class="achievements-body">
        <div class="achievements-progress">
          <span class="achievements-progress-label">{{ t('achievements.progress', { unlocked: achievementsUnlockedCount, total: ACHIEVEMENTS.length }) }}</span>
          <div class="progress-bar"><span class="progress-bar-fill" :style="{ width: (achievementsUnlockedCount / ACHIEVEMENTS.length * 100) + '%' }"></span></div>
        </div>
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
      <header class="topbar"><button class="icon-btn" @click="navigate('home')">‹</button><h2>{{ t('history.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button></header>
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
        <h2>{{ t('coop.title') }}</h2>
        <button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button>
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
          <p v-if="state.coop.teamMode" class="coop-subtext">{{ t('team.assignHint') }}</p>
          <button v-if="state.coop.teamMode && state.coop.role==='host'" class="btn btn-ghost btn-sm randomize-teams-btn" :disabled="state.coop.players.length<2" @click="randomizeTeams">🔀 {{ t('team.randomize') }}</button>
          <div class="team-picker" v-if="state.coop.teamMode && state.coop.players.length">
            <div class="team-picker-header team-picker-header-a">{{ t('team.labelA') }}</div>
            <div class="team-picker-header team-picker-header-mid"></div>
            <div class="team-picker-header team-picker-header-b">{{ t('team.labelB') }}</div>
            <template v-for="p in state.coop.players" :key="p.id">
              <div class="team-slot team-slot-a">
                <span v-if="p.team==='A'" class="player-chip" :style="{ background: p.color, color: chipTextColor(p.color) }">
                  {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
                </span>
              </div>
              <div class="team-slot team-slot-mid">
                <template v-if="!p.team">
                  <span class="team-mid-name">{{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template></span>
                  <button type="button" class="team-arrow-btn" :disabled="state.coop.role!=='host'" @click="assignTeam(p.id,'A')" :aria-label="t('team.moveTo',{team:t('team.labelA')})">◀</button>
                  <button type="button" class="team-arrow-btn" :disabled="state.coop.role!=='host'" @click="assignTeam(p.id,'B')" :aria-label="t('team.moveTo',{team:t('team.labelB')})">▶</button>
                </template>
                <template v-else>
                  <button type="button" class="team-arrow-btn team-swap-btn" :disabled="state.coop.role!=='host'"
                          @click="assignTeam(p.id, p.team==='A' ? 'B' : 'A')"
                          :aria-label="t('team.moveTo',{team:t('team.label'+(p.team==='A'?'B':'A'))})">{{ p.team==='A' ? '▶' : '◀' }}</button>
                  <button type="button" class="team-arrow-btn team-unassign-btn" :disabled="state.coop.role!=='host'" @click="assignTeam(p.id,null)" :aria-label="t('team.unassign')">✕</button>
                </template>
              </div>
              <div class="team-slot team-slot-b">
                <span v-if="p.team==='B'" class="player-chip" :style="{ background: p.color, color: chipTextColor(p.color) }">
                  {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
                </span>
              </div>
            </template>
          </div>
          <div class="coop-roster" v-if="!state.coop.teamMode && state.coop.players.length">
            <span v-for="p in state.coop.players" :key="p.id" class="player-chip"
                  :style="{ background: p.color, color: chipTextColor(p.color) }">
              {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
            </span>
          </div>
          <!-- Race-Lobby zeigt die Schwierigkeitsauswahl ein zweites Mal NUR
               nach einem beendeten Match (rematchRace() setzt rematchPending),
               damit "nochmal spielen" ohne erneutes Hosten/Beitreten eine neue
               Schwierigkeit wählen kann. Beim allerersten Hosten wurde die
               Schwierigkeit bereits in der Ansicht davor gewählt -- ein
               zweites Grid hier würde nur unnötig Platz verbrauchen/scrollen. -->
          <template v-if="state.coop.raceMode && state.race.rematchPending">
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
          </template>
          <p class="coop-subtext">{{ t('coop.playersCount', { n: state.coop.players.length, max: state.coop.raceMode ? 2 : COOP_MAX_PLAYERS }) }}</p>
          <button v-if="state.coop.teamMode" class="btn btn-primary" :disabled="!canStartTeamMatch()" @click="startTeamMatch">{{ t('team.startMatch') }}</button>
          <button v-else-if="state.coop.raceMode" class="btn btn-primary" :disabled="!canStartRaceMatch()" @click="startRaceMatch">{{ t('race.startMatch') }}</button>
          <button v-else class="btn btn-primary" :disabled="!canStartCoopMatch()" @click="startCoopMatch">{{ t('coop.startMatch') }}</button>
          <div v-if="state.coop.teamMode ? !canStartTeamMatch() : (state.coop.raceMode ? !canStartRaceMatch() : !canStartCoopMatch())" class="coop-waiting">
            <div class="spinner"></div>
            <div class="loading-tx">{{ t(state.coop.teamMode ? 'team.waitingForTeams' : (state.coop.raceMode ? 'race.waitingForOpponent' : 'coop.waitingForGuest')) }}</div>
          </div>
        </template>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:8px" @click="coopReset(); state.coop.role=null">{{ t('common.cancel') }}</button>
      </div>

      <!-- Gast: Code eingeben → verbinden → Lobby (warten auf Hoststart) -->
      <div v-else-if="state.coop.role === 'guest'" class="coop-body">
        <div class="coop-code-label">{{ t('coop.enterHostCode') }}</div>
        <input class="coop-input" v-model="state.coop.code" maxlength="6" inputmode="numeric" pattern="[0-9]*"
               :placeholder="t('common.codePlaceholder')" :disabled="state.coop.waitingForGuest"
               @input="state.coop.code=state.coop.code.replace(/\D/g,'')"
               @keydown.enter="startJoining" />
        <button class="btn btn-primary" :disabled="state.coop.waitingForGuest || state.coop.code.length!==6" @click="startJoining">
          <span v-if="state.coop.waitingForGuest && !state.coop.myId"><span class="spinner-inline"></span> {{ t('coop.connecting') }}</span>
          <span v-else-if="state.coop.waitingForGuest">{{ t('coop.waitingForHostStart') }}</span>
          <span v-else>{{ t('coop.connect') }}</span>
        </button>
        <div class="coop-roster" v-if="state.coop.waitingForGuest && state.coop.myId && state.coop.players.length">
          <span v-for="p in state.coop.players" :key="p.id" class="player-chip"
                :style="{ background: p.color, color: chipTextColor(p.color) }">
            {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
            <b v-if="state.coop.teamMode">{{ p.team ? t('team.label'+p.team) : t('team.unassigned') }}</b>
          </span>
        </div>
        <p v-if="state.coop.waitingForGuest && state.coop.myId" class="coop-subtext">{{ t('coop.playersCount', { n: state.coop.players.length, max: state.coop.raceMode ? 2 : COOP_MAX_PLAYERS }) }}</p>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:4px" @click="coopReset(); state.coop.role=null">{{ t('common.back') }}</button>
      </div>

    </section>

    <!-- ══ SETTINGS ══ -->
    <section v-else-if="state.screen==='settings'" class="screen settings">
      <header class="topbar"><button class="icon-btn" @click="closeSettings">‹</button><h2>{{ t('settings.title') }}</h2><span></span></header>
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
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.myColor') }}</span>
          <div class="coop-swatches">
            <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" :title="t('common.pickColorTitle')" />
          </div>
          <small class="set-hint">{{ t('settings.colorHint') }}</small>
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

        <div class="set-group-title">{{ t('settings.sound') }}</div>
        <small class="set-hint">{{ t('settings.soundHint') }}</small>
        <div class="set-row" @click="toggleSetting('musicMenu')">
          <span>{{ t('settings.musicMenu') }}</span><span class="switch" :class="{on:state.settings.musicMenu}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('musicSolo')">
          <span>{{ t('settings.musicSolo') }}</span><span class="switch" :class="{on:state.settings.musicSolo}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('musicCoop')">
          <span>{{ t('settings.musicCoop') }}</span><span class="switch" :class="{on:state.settings.musicCoop}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('musicCompetition')">
          <span>{{ t('settings.musicCompetition') }}</span><span class="switch" :class="{on:state.settings.musicCompetition}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('musicTraining')">
          <span>{{ t('settings.musicTraining') }}</span><span class="switch" :class="{on:state.settings.musicTraining}"><i></i></span>
        </div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.musicVolume') }}</span>
          <input type="range" class="set-range" min="0" max="1" step="0.01" :value="state.settings.musicVolume"
                 :style="{ '--rangePct': Math.round(state.settings.musicVolume*100) + '%' }"
                 @input="setSetting('musicVolume', parseFloat($event.target.value))" />
        </div>
        <small class="set-hint">{{ t('settings.sfxHintText') }}</small>
        <div class="set-row" @click="toggleSetting('sfxComplete')">
          <span>{{ t('settings.sfxComplete') }}</span><span class="switch" :class="{on:state.settings.sfxComplete}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('sfxKeep')">
          <span>{{ t('settings.sfxKeep') }}</span><span class="switch" :class="{on:state.settings.sfxKeep}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('sfxRemove')">
          <span>{{ t('settings.sfxRemove') }}</span><span class="switch" :class="{on:state.settings.sfxRemove}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('sfxError')">
          <span>{{ t('settings.sfxError') }}</span><span class="switch" :class="{on:state.settings.sfxError}"><i></i></span>
        </div>
        <div class="set-row" @click="toggleSetting('sfxHint')">
          <span>{{ t('settings.sfxHint') }}</span><span class="switch" :class="{on:state.settings.sfxHint}"><i></i></span>
        </div>

        <div class="set-group-title">{{ t('settings.a11y') }}</div>
        <div class="set-row" @click="toggleSetting('colorBlindMode')">
          <span>{{ t('settings.colorBlindMode') }}</span><span class="switch" :class="{on:state.settings.colorBlindMode}"><i></i></span>
        </div>
        <small class="set-hint">{{ t('settings.colorBlindModeHint') }}</small>

        <div class="set-group-title">{{ t('settings.coop') }}</div>
        <div class="set-row col">
          <span class="set-row-label">{{ t('settings.displayName') }}</span>
          <input class="text-input" v-model="state.settings.coopName" maxlength="32" :placeholder="t('common.namePlaceholder')" />
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
        <button class="btn btn-ghost" @click="state.modal='changelog'">{{ t('settings.changelog') }}</button>
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
        <button class="btn btn-ghost training-btn" @click="state.modal=null; startTrainingGame()">
          <span class="btn-ic">🎓</span>
          <span class="btn-tx"><b>{{ t('home.trainingMode') }}</b><small>{{ t('home.trainingHint') }}</small></span>
        </button>
        <button class="btn btn-primary" @click="state.modal=null">{{ t('howto.understood') }}</button>
      </div>
    </div>

    <div v-if="state.modal==='raceChoice'" class="modal-bg" @click.self="state.modal=null">
      <div class="modal">
        <h3>{{ t('home.raceMode') }}</h3>
        <p class="coop-tagline">{{ t('race.choiceHint') }}</p>
        <button class="btn btn-primary" @click="goRace('1v1')">
          <span class="btn-ic">🆚</span><span class="btn-tx"><b>{{ t('race.choice1v1') }}</b><small>{{ t('home.raceHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" @click="goRace('2v2')">
          <span class="btn-ic">👥</span><span class="btn-tx"><b>{{ t('race.choice2v2') }}</b><small>{{ t('team.assignHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" style="margin-top:8px" @click="state.modal=null">{{ t('common.cancel') }}</button>
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

    <div v-if="state.streakLostNotice" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge">{{ t('streak.lostBadge') }}</div>
        <h3>{{ t('streak.lostTitle') }}</h3>
        <p class="confirm-msg">{{ t('streak.lostBody', { best: state.streak.bestStreak }) }}</p>
        <button class="btn btn-primary" @click="dismissStreakLostNotice">{{ t('common.ok') }}</button>
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
    'region-pulse': m.region >= 0 && !!state.justResolved[`region-${m.region}`],
    'row-pulse': !!state.justResolved[`row-${r}`],
    'col-pulse': !!state.justResolved[`col-${c}`],
    strike: mk === 'removed' && state.settings.eraseStyle === 'strike',
    'coop-mark': !!state.markedBy[r][c],
    'coop-mark-removed': state.coop.active && !!state.markedBy[r][c] && mk === 'removed' && state.settings.coopRemovedOutline,
    'training-highlight': state.isTrainingGame && state.trainingStep?.r === r && state.trainingStep?.c === c,
    'hint-group': inHintGroup(r, c),
  };
}
// Gehört Zelle (r,c) zur Gruppe der aktiven sokratischen Leitfrage? Markiert
// bewusst die GANZE Zeile/Spalte/Käfig (nicht die Zielzelle), damit der Spieler
// den Schluss selbst zieht, ohne dass die konkrete Zelle verraten wird.
function inHintGroup(r, c) {
  const n = state.hintNudge;
  if (!n) return false;
  if (n.group.kind === 'row') return r === n.group.ref;
  if (n.group.kind === 'col') return c === n.group.ref;
  if (n.group.kind === 'region') return state.cellMeta[r][c].region === n.group.ref;
  return false;
}
function cellStyle(r, c) {
  const m = state.cellMeta[r][c];
  const st = { fontSize: 'var(--fs)' };
  if (m.color) { st['--rc-h'] = m.color.h; st['--rc-s'] = m.color.s + '%'; st['--rc-l'] = m.color.l + '%'; }
  const who = state.markedBy[r][c];
  if (who) { const col = who === LOCAL_PLAYER_ID ? state.settings.coopMyColor : playerColor(who); if (col) st['--markcol'] = col; }
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
// Debug-Hook nur lokal (nie auf der echten Domain aktiv). handleCoopMsg ist
// hier zusätzlich exponiert, damit E2E-Tests einen Team-vs-Team-TEAM_DONE
// vom "Gegner-Team" simulieren können, ohne einen echten zweiten Firebase-
// Client zu brauchen. getProgressThrottle() exponiert die beiden internen
// Throttle-Zeitstempel, damit E2E-Tests den Sofort-Push aus registerMistake()
// nachweisen können, ohne einen echten Firebase-Schreibzugriff zu brauchen
// (Coop.setTeamProgress/setRaceProgress sind selbst nicht spionierbar, da
// `import * as Coop` ein eingefrorenes Modul-Namespace-Objekt liefert).
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.__cns = { state, onCellTap, isSolved, handleCoopMsg, cellStyle, cellClasses, Music, getProgressThrottle: () => ({ team: teamProgressThrottle, race: raceProgressThrottle }) };

nextTick(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const remaining = Math.max(0, 1200 - (Date.now() - APP_START));
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 450);
  }, remaining);
});

// Hintergrund-Gnadenfrist: solange die Coop-Lobby/-Session in der RTDB noch
// existiert (siehe COOP_SESSION_TTL_MS, storage.js), bleibt der eigene Platz
// nach Rückkehr aus dem Hintergrund erhalten -- ensurePresence() heilt nur den
// eigenen players/$uid-Eintrag, ohne Listener neu anzuhängen (warmer Fall,
// JS-Kontext lief im Hintergrund weiter). Der kalte Fall (JS-Kontext verloren,
// z.B. App aus dem Speicher entfernt) läuft stattdessen über den "Coop
// fortsetzen"-Button (resumeCoopGame()/Coop.rejoin()) beim nächsten App-Start.
window.addEventListener('pagehide', () => { persistGame(); createBackup('close'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    pauseGame();
    persistGame(); createBackup('close');
  } else if (document.visibilityState === 'visible' && state.coop.active) {
    Coop.ensurePresence({ name: state.settings.coopName, color: state.settings.coopMyColor, role: state.coop.role });
  }
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
          offerUpdate();
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
      // Alle 30 Sekunden auf neue Deployment-Version prüfen.
      setInterval(() => reg.update(), 30000);
    }).catch(e => log('sw', `Service-Worker-Registrierung fehlgeschlagen`, e));
  });
}
