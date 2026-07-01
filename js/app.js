// app.js — Coop Number Sums (Vue 3, esm-browser). Solo-Spiel; Coop folgt später.
import { createApp, reactive, computed, watch, nextTick, onMounted, markRaw } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { DIFFICULTIES, DIFF_BY_ID, REGION_COLORS, COOP_COLORS, COOP_COLORS_CB, DEFAULT_GAME_OPTIONS, LIVES, HINTS, COOP_MAX_PLAYERS, DONATE_URL, regionChipInk, coinReward, coinBaseForIndex } from './config.js';
import { generatePuzzle } from './generator.js';
import { todayDateStr } from './streak.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import { ACHIEVEMENTS, evaluate as evaluateAchievements } from './achievements.js';
import { findTrainingStep, isFullyTier1Solvable } from './training.js';
import * as Music from './music.js';
import {
  loadSettings, saveSettings, loadActiveGame, saveActiveGame, loadActiveGameCoop, saveActiveGameCoop,
  loadStats, recordResult,
  loadSeenVersion, saveSeenVersion,
  exportToFile, importFromFile, deleteAllData, loadStreak, recordStreakResult,
  loadHistory, recordHistory,
  loadAchievements, unlockAchievements, loadRace, recordRaceWin, recordRaceLoss,
  saveCoopSession, loadCoopSession, clearCoopSession,
  loadProfile, loadInventory, grantInventory,
  loadWallet, grantCurrency,
} from './storage.js';
import * as Account from './account.js';
import { SKIN_ID, FOUNDER_ID, qualifiesForV1Skin, eligibleForCelebrationSkin, skinCodeMatches, skinSpeedToDuration, skinVars as buildSkinVars, skinClasses as buildSkinClasses } from './skins.js';
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
  streakExtended: null,      // { current, best, continued, isNewRecord } für den "Streak verlängert"-Screen, sonst null
  raceStats: loadRace(),     // { racesPlayed, racesWon, racesLost, fastestWinMs } — getrennt von state.race (laufendes Match)
  puzzleHistory: loadHistory(), // Ringpuffer gelöster Rätsel (neueste zuerst), siehe storage.js
  achievements: loadAchievements(), // { id: Freischalt-Zeitstempel }, siehe storage.js
  inventory: loadInventory(),    // { itemId: { acquiredAt, source } } — Besitz von Cosmetics (z.B. Skin 'dynamicColor')
  wallet: loadWallet(),          // { balance, updatedAt } — In-Game-Währung (Münzen pro Sieg)
  lastCoinReward: 0,             // zuletzt auf dem Sieg-Screen gutgeschriebene Münzen (0 = ausblenden)
  skinJustUnlocked: false,       // einmalige Feier-Anzeige in dieser Session
  skinCodeInput: '',             // Eingabefeld zum Einlösen des Geheimcodes
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
  status: 'idle',            // idle | playing | won | lost
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
    online: true,              // eigene RTDB-Socket-Verbindung steht (fällt bei stillem Idle-Disconnect auf false, siehe Coop.watchConnection) — Chip zeigt "offline" auch wenn nur die eigene Verbindung abriss
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
    generating: false,           // Rätsel wird gerade (im Worker) für diese Lobby generiert — Start/Bereit ist bis zur Fertigstellung gesperrt

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
    endReason: null,        // 'won' | 'lost' -- WARUM das Match endete (das Team, das
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
    endReason: null,         // 'won' | 'lost' -- WARUM das Match endete (Outcome der
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
  modal: null,               // null | 'howto' | 'changelog' | 'confirm'
  confirm: null,             // { title, msg, onYes }
  showWhatsNew: false,
  syncConflict: null,        // { localTs, cloudTs } — Start-Warnung „Versions-Mismatch", sonst null
  syncConflictBusy: false,
  whatsNewSince: null,       // zuletzt gesehene Version beim App-Start -> "Was ist neu" zeigt alle Einträge seither
  statsTab: 'allgemein',     // aktiver Reiter im Statistik-Screen: allgemein | solo | coop
  settingsTab: 'spiel',      // aktive Sektion im Einstellungen-Screen (Drawer): spiel | darstellung | farbe | ton | konto | daten
  settingsDrawerOpen: false, // Einstellungs-Seitenleiste (von links) offen?
  // Optionaler Account (E-Mail+Username+PW, Cloud-Sync). Anonymous-first: ohne
  // Login bleibt alles lokal. status: 'anon' | 'in'; busy während Auth-Aktionen.
  account: {
    status: 'anon', uid: null, email: '', username: '', role: 'user',
    mode: 'in',              // Formular-Umschalter: 'in' (Anmelden) | 'up' (Registrieren)
    email_in: '', pw_in: '', email_up: '', username_up: '', pw_up: '',
    usernameEditing: false, usernameDraft: '',   // Username im Profil ändern
    busy: false, error: null, notice: null,
    syncState: 'idle',       // 'idle' | 'syncing' | 'ok' | 'error' — sichtbarer Cloud-Sync-Status
    syncErrorMsg: '',        // konkrete Fehlermeldung des letzten fehlgeschlagenen Syncs
    lastSyncAt: 0,           // Zeitstempel der letzten erfolgreichen Cloud-Sicherung
    // Admin (nur sichtbar/aktiv bei role==='admin'; Rules erzwingen es serverseitig)
    adminQuery: '', adminResult: null, adminBusy: false, adminError: null,
    adminBalance: '', adminUsername: '', adminItem: '', adminFieldKey: '', adminFieldVal: '', adminEmail: '',
  },
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
// Längere Gesamtdauer (Stundenbereich) für den Statistik-Überblick: "3 h 42 min"
// bzw. "42 min" — fmtTime (m:ss) reicht dafür nicht.
function fmtDuration(ms) {
  const totalMin = Math.floor((ms || 0) / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h} ${t('stats.durH')} ${m} ${t('stats.durMin')}` : `${m} ${t('stats.durMin')}`;
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
// Host-Lobby-Schwierigkeitskarten zeigen Zeiten passend zum Modus:
// Coop -> Coop-Zeiten, Wettkampf (Race/Team) -> es gibt dort keine eigenen
// Bestzeiten, daher die Solo-Zeiten einblenden.
function lobbyIsCompetition() { return state.coop.raceMode || state.coop.teamMode; }
function lobbyAvgTimeFor(diffId) {
  return lobbyIsCompetition() ? avgTimeFor(diffId) : coopAvgTimeFor(diffId);
}
function lobbyBestTimeMs(diffId) {
  const d = state.stats.byDifficulty[diffId];
  if (!d) return null;
  const v = lobbyIsCompetition() ? d.bestTimeMs : d.coopBestTimeMs;
  return v != null ? v : null;
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
// Bildschirme werden als Stack betrachtet: jede Vorwärtsnavigation legt eine
// "Zurück-Aktion" auf navStack, jeder Zurück-Schritt (goBack) nimmt die oberste
// wieder herunter und führt sie aus. So landet man beim Zurücktippen immer auf
// der unmittelbar zuvor besuchten Stelle statt pauschal auf Home -- auch
// innerhalb verketteter Unterschritte (z.B. Coop: Name → Hosten → Bestätigen).
// Eine Zurück-Aktion ist eine Closure, die genau ihren Vorwärtsschritt rückgängig
// macht (inkl. Seiteneffekten wie Verbindungsabbau) -- dadurch funktioniert der
// Stack auch für Coop-Unterschritte, die keine eigenen Screens sind.
let navStack = [];
function pushNav(backFn) { navStack.push(backFn); }
// Vorwärts zu einem einfachen Menü-Screen, mit dem aktuellen Screen als
// Rückkehrpunkt (nur für Screens ohne Unterschritte verwenden).
function navTo(screen) {
  const from = state.screen;
  pushNav(() => navigate(from));
  navigate(screen);
}
// Einen Schritt zurück im Stack. Leerer Stack = wir sind an einer Wurzel:
// dann (sicherheitshalber) zurück nach Home, im Coop zusätzlich aufräumen.
function goBack() {
  const fn = navStack.pop();
  if (fn) { fn(); return; }
  if (state.screen === 'coop') coopReset();
  navigate('home');
}
// Screen Wake Lock: hält den Bildschirm während eines laufenden Spiels wach.
// Ohne das ging das Gerät nach 1-3 Min ohne Eingabe in den Standby → die PWA
// fiel in den Hintergrund und die Coop-RTDB-Verbindung brach ab (der eigentliche
// Grund der gemeldeten Disconnects — nicht bloß deren Anzeige). Best effort: nicht
// jeder Browser kann die API, Fehler werden geschluckt; die Sperre wird vom Browser
// beim Verstecken der Seite automatisch gelöst und bei Rückkehr neu angefordert.
let wakeLock = null;
async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator) || wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    log('game', 'Wake Lock aktiv (Bildschirm bleibt an)');
  } catch (e) { wakeLock = null; log('game', 'Wake Lock nicht verfügbar', e); }
}
async function releaseWakeLock() {
  const wl = wakeLock; wakeLock = null;
  try { if (wl) { await wl.release(); log('game', 'Wake Lock freigegeben'); } } catch (_) {}
}

function navigate(screen) {
  // Wurzeln des Stacks: Home ist der Ausgangspunkt, das Spiel ein eigener Modus
  // (aus dem Spiel führt der Weg über Pause/Aufgeben, nicht über den Stack).
  if (screen === 'home' || screen === 'game') navStack = [];
  state.screen = screen;
  if (screen === 'game') { startTimer(); requestWakeLock(); } else { stopTimer(); releaseWakeLock(); }
  updateMusic();
  // Ein während des Spiels aufgeschobenes Neuladen (Update/Cloud-Übernahme) jetzt
  // nachholen, sobald wir sicher zurück im Menü sind — nie mitten im Spiel.
  if (screen === 'home') nextTick(flushPendingReload);
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
// Sektionen der Einstellungs-Seitenleiste (Drawer), bewusst nach Relevanz
// sortiert: spielrelevantes zuerst, Farbe/Anpassung als eigener Reiter, Konto,
// Daten/Sicherung ganz zuletzt.
const SETTINGS_SECTIONS = [
  { id: 'spiel',       ic: '🎮', key: 'settings.tabGame' },
  { id: 'darstellung', ic: '🌓', key: 'settings.secAppearance' },
  { id: 'farbe',       ic: '🎨', key: 'settings.secColors' },
  { id: 'ton',         ic: '🔊', key: 'settings.tabSound' },
  { id: 'konto',       ic: '👤', key: 'settings.tabAccount' },
  { id: 'daten',       ic: '💾', key: 'settings.tabData' },
];
// Münz-Belohnung einer Schwierigkeit für die Anzeige auf der Auswahlkarte
// (Basiswert; im Coop/Wettkampf verdoppelt). Perfekt-Bonus bleibt bewusst außen
// vor, da er erst beim Sieg feststeht.
function coinFor(d, coopish) {
  return coinReward(DIFFICULTIES.indexOf(d), { coop: !!coopish });
}
// Shop-Sortiment (vorerst reine Vorschau/WIP — nichts kaufbar). Rein kosmetische
// Ideen, kein Pay-to-win. Namen via i18n (shop.item.<id>).
const SHOP_ITEMS = [
  { id: 'skinPresets', icon: '🎨' },
  { id: 'boardPalettes', icon: '🌈' },
  { id: 'appThemes', icon: '🖌️' },
  { id: 'coopColors', icon: '✨' },
  { id: 'numberFonts', icon: '🔢' },
  { id: 'soundPacks', icon: '🎵' },
  { id: 'winEffects', icon: '🎉' },
  { id: 'profileBadges', icon: '🏅' },
  { id: 'boardFrames', icon: '🖼️' },
  { id: 'moreSoon', icon: '➕' },
];
// Shop öffnen/schließen (eigener Screen; Coins oben, WIP-Kaufkarten).
let shopReturn = null;
function openShop() {
  if (state.screen === 'shop') return;
  shopReturn = state.screen;
  navigate('shop');
}
function closeShop() { const b = shopReturn || 'home'; shopReturn = null; navigate(b); }

function openSettings() {
  if (state.screen === 'settings') return;
  settingsReturn = state.screen;
  if (state.screen === 'game') pauseGame();
  state.settingsDrawerOpen = false;
  navigate('settings');
}
// Sektion in der Seitenleiste wählen: umschalten + Drawer schließen; beim Konto
// zusätzlich den Account-Status auffrischen (wie zuvor beim Tab-Klick).
function selectSettingsSection(id) {
  state.settingsTab = id;
  state.settingsDrawerOpen = false;
  if (id === 'konto') refreshAccount();
}
function toggleSettingsDrawer() { state.settingsDrawerOpen = !state.settingsDrawerOpen; }
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
  // Der Host darf erst final starten, wenn sein EIGENES Rätsel fertig generiert
  // ist (sonst liefe die Zeit ohne Spielfeld los).
  if (state.coop.generating) return;
  // Nur der Host darf final starten, und erst sobald alle Mitspieler bereit
  // sind (siehe Bereit-System oben) -- da ein Gast sich erst nach Abschluss
  // seiner eigenen Generierung bereit melden kann, ist "alle bereit" zugleich
  // die Garantie, dass bei jedem Client ein fertiges Rätsel vorliegt.
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

// ─── OFF-THREAD-GENERIERUNG (on-demand) ───────────────────────────────────────
// Ein Web Worker generiert Rätsel auf Anfrage auf einem eigenen Thread, sodass die
// (bei großen Feldern spürbare) Generierung den Haupt-Thread/die UI nie blockiert.
// Rätsel werden ERST beim Spielstart erzeugt (kein Vorab-Prefetch mehr): Solo zeigt
// dabei das Lade-Overlay, Coop/Race/Team den Ladebalken in der Bereit-Lobby. Die
// frühere Hintergrund-Vorgenerierung ALLER Schwierigkeiten beim App-Start wurde
// entfernt -- sie hat manche Geräte beim Start spürbar ausgebremst.
// Fällt der Worker aus (nicht unterstützt / Fehler), wird synchron generiert.
let genWorker = null;
// Einzel-Generierungen (generateAsync) werden per fortlaufender reqId korreliert,
// damit parallele Anfragen (z.B. mehrere Lobby-Generierungen) sich nicht vermischen.
let genReqSeq = 0;
const genReqPending = new Map();    // reqId -> { resolve, reject }
function initGenWorker() {
  // Ob ein Worker zur Verfügung steht, ist DER entscheidende Performance-Faktor:
  // ohne ihn wird jedes Rätsel synchron auf dem Haupt-Thread erzeugt und friert die
  // UI bei großen Feldern kurz ein (Buttons reagieren dann verzögert). Daher den
  // Worker-Status protokollieren, damit er im Diagnoseprotokoll betroffener Geräte
  // sichtbar wird.
  if (typeof Worker === 'undefined') { log('perf', 'Kein Web-Worker verfügbar – Rätsel werden SYNCHRON erzeugt (kann UI kurz blockieren)'); return; }
  try {
    genWorker = new Worker(new URL('./genworker.js', import.meta.url), { type: 'module' });
    genWorker.onmessage = (e) => {
      const { reqId, puzzle, error } = e.data || {};
      if (reqId == null) return;
      const pend = genReqPending.get(reqId);
      if (pend) { genReqPending.delete(reqId); error ? pend.reject(new Error(error)) : pend.resolve(puzzle); }
    };
    genWorker.onerror = (e) => {
      log('error', 'Generator-Worker abgestürzt – ab jetzt synchrone Generierung', { message: e && e.message });
      genWorker = null;
      // Anhängige Anfragen scheitern lassen, damit ihr .catch() den synchronen
      // Fallback bzw. eine Fehlermeldung auslösen kann.
      genReqPending.forEach(p => p.reject(new Error('worker error')));
      genReqPending.clear();
    };
    log('game', 'Generator-Worker bereit (Off-Thread-Generierung aktiv)');
  } catch (e) { log('error', 'Generator-Worker-Init fehlgeschlagen – synchrone Generierung', e); genWorker = null; }
}
// Generiert ein Rätsel möglichst im Hintergrund-Thread und liefert ein Promise.
// Ohne Worker (oder bei dessen Ausfall) fällt es auf den synchronen Generator
// zurück -- minimal verzögert (setTimeout), damit ein zuvor gesetztes Lade-/
// Lobby-Overlay noch einen Frame rendern kann, bevor der Haupt-Thread blockiert.
function generateAsync(opts) {
  return new Promise((resolve, reject) => {
    if (genWorker) {
      const reqId = ++genReqSeq;
      genReqPending.set(reqId, { resolve, reject });
      genWorker.postMessage({ reqId, opts });
    } else {
      // Kein Worker -> synchrone Generierung blockiert kurz den Haupt-Thread.
      // Protokollieren, um genau solche Geräte im Diagnoseprotokoll zu erkennen.
      log('perf', 'Synchrone Rätselgenerierung (kein Worker) – UI kann kurz blockieren', { difficulty: opts && opts.difficulty });
      setTimeout(() => { try { resolve(generatePuzzle(opts)); } catch (err) { reject(err); } }, 30);
    }
  });
}

// ─── NEUES SPIEL ──────────────────────────────────────────────────────────────
// Übernimmt ein fertiges Rätsel in den Spielzustand und startet (Solo) bzw.
// sendet es im Coop als Host an die Mitspieler. Gemeinsamer Abschluss für den
// Cache- wie den On-Demand-Pfad.
function finishNewGame(puzzle) {
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
}
// In einer aktiven Coop-Session (als Host) wird das neue Rätsel an den Partner
// gesendet, statt dass dieser selbst eines wählen müsste — die Lobby bleibt erhalten.
function newGame(diffId) {
  state.isTrainingGame = false;
  state.screen = 'game';
  // Rätsel erst JETZT erzeugen (kein Vorab-Prefetch mehr). Lade-Overlay zeigen
  // und off-thread generieren (generateAsync), damit der Haupt-Thread auch bei
  // großen Feldern flüssig bleibt und der Ladebalken animiert. Ohne Worker fällt
  // generateAsync selbst auf synchrone Generierung zurück.
  state.generating = true;
  log('game', `Puzzle-Generierung gestartet`, { difficulty: diffId });
  const t0 = performance.now();
  generateAsync({ difficulty: diffId })
    .then(puzzle => {
      // tookMs = Wall-Clock bis zum fertigen Rätsel (inkl. Worker) — zeigt auf
      // langsamen Geräten, ob die Generierung die Wartezeit verursacht.
      log('game', `Puzzle generiert`, { difficulty: diffId, rows: puzzle.rows, cols: puzzle.cols, tookMs: Math.round(performance.now() - t0) });
      finishNewGame(puzzle);
    })
    .catch(e => {
      // Nur ein echter Worker-/Generatorfehler landet hier (fehlender Worker wird
      // in generateAsync bereits synchron abgefangen) -- letzter synchroner Versuch.
      log('game', `Puzzle-Generierung fehlgeschlagen, synchroner Versuch`, e);
      try {
        finishNewGame(generatePuzzle({ difficulty: diffId }));
      } catch (err) {
        log('game', `Synchroner Fallback fehlgeschlagen`, err);
        state.generating = false;
        throw err;
      }
    });
}

// Nach jedem Solo-/Coop-Spiel geht's NIE direkt erneut in dieselbe Schwierigkeit,
// sondern immer zur Schwierigkeitsauswahl, vorbefüllt mit der zuletzt gespielten —
// so wird eine bewusste Bestätigung erzwungen, bevor das nächste Rätsel startet.
function goNextPuzzle() {
  state.sel.difficulty = state.puzzle.difficulty;
  // Aus dem Spiel heraus zur Auswahl: Zurück führt von hier nach Home.
  navStack = [() => { coopReset(); navigate('home'); }];
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
// Zoom auf den Standard (automatische Einpassung, zoom = 1) zurücksetzen. Der
// Button dafür wird nur eingeblendet, wenn überhaupt gezoomt wurde (zoom !== 1).
function resetZoom() {
  if (state.zoom === 1) return;
  state.zoom = 1;
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
  // Das Zielfeld wird DETERMINISTISCH aus dem (geteilten) Brett abgeleitet -> alle
  // Coop-Spieler bekommen denselben Hinweis; sobald es gelöst ist, rückt es für alle
  // gemeinsam weiter. Die Stufen 1/2/3 laufen rein lokal (clientseitig) pro Spieler.
  const target = nextHintTarget();
  if (!target) return;
  const n = state.hintNudge;
  // Nur weiterstufen, wenn der gemerkte Hinweis WIRKLICH zum aktuellen Zielfeld
  // gehört und dieses noch offen ist. Sonst (veralteter/abweichender Hinweis,
  // Session-Überhang, vom Partner gelöst, oder Tier-2-Fallback) beginnt es frisch
  // bei Stufe 1 — statt fälschlich sofort aufzulösen (genau der Coop-Bug).
  const sameTarget = n && n.r === target.r && n.c === target.c && state.marks[target.r][target.c] === 'none';
  if (sameTarget && n.stage >= 2) { // Stufe 3: auflösen
    state.hintNudge = null;
    if (state.settings.sfxHint) Music.sfxHint();
    doRevealCell(target.r, target.c, target.want);
    return;
  }
  if (sameTarget && n.stage === 1) { // Stufe 2: Leitfrage einblenden
    if (state.settings.sfxHint) Music.sfxHint();
    n.stage = 2;
    return;
  }
  // Stufe 1 (frisch fürs aktuelle Zielfeld): erst die einmalige Warnung, dann markieren.
  confirmThenStartHint(target);
}
// Deterministisches nächstes Hinweis-Ziel — rein aus dem geteilten Brett, daher für
// ALLE Coop-Spieler identisch (kein Math.random wie in findHintCell!). Bevorzugt
// einen Tier-1-Schritt mit erklärbarer Leitfrage; sonst die erste noch nicht
// korrekt markierte Zelle in fester Scan-Reihenfolge (KEEP bevorzugt), generisch.
function nextHintTarget() {
  const step = findTrainingStep(state.puzzle, state.marks);
  if (step) return { r: step.r, c: step.c, want: step.action, group: step.group, reason: step.reason, rem: step.rem };
  const p = state.puzzle;
  let firstAny = null;
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
    const want = p.solution[r][c] ? 'kept' : 'removed';
    if (state.marks[r][c] === want) continue;
    if (want === 'kept') return genericTarget(r, c, want);
    if (!firstAny) firstAny = [r, c, want];
  }
  return firstAny ? genericTarget(firstAny[0], firstAny[1], firstAny[2]) : null;
}
// Generischer (Tier-2-)Hinweis: die Cage der Zelle hervorheben, ohne konkrete
// Summen-Leitfrage. Jede Spielzelle gehört zu einer Cage (region >= 0).
function genericTarget(r, c, want) {
  return { r, c, want, group: { kind: 'region', ref: state.cellMeta[r][c].region, target: null }, reason: 'generic', rem: null };
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
function confirmThenStartHint(target) {
  if (!state.hintWarnShown) {
    ask(t('game.hintConfirmTitle'), t('game.hintConfirmMsg'), () => { state.hintWarnShown = true; startHint(target); });
    return;
  }
  startHint(target);
}
// Stufe 1: zieht die Strafe (Bestzeit futsch) und markiert den relevanten Bereich
// für das (synchron bestimmte) Zielfeld. Löst NIE direkt auf — die Auflösung
// passiert ausschließlich über Stufe 3 (doppelter Knopfdruck / "Auflösen").
function startHint(target) {
  registerHintPenalty();
  if (state.settings.sfxHint) Music.sfxHint(); // Stufe 1 — Ton bei jeder Hinweis-Instanz
  state.hintNudge = { group: target.group, reason: target.reason, rem: target.rem, r: target.r, c: target.c, want: target.want, stage: 1 };
  log('game', `Hinweis Stufe 1 (Bereich markiert)`, { group: target.group.kind });
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
  // Ton nur bei eigener Aktion (broadcast=true); ein vom Partner empfangenes
  // UNDO (broadcast=false) soll lokal keinen Sound auslösen.
  if (broadcast && state.settings.sfxUndo) Music.sfxUndo();
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
    // Gäste generieren nichts selbst -- sie bekommen das fertige Rätsel des Hosts
    // und sind damit sofort "fertig" (kein Ladebalken in der Lobby nötig).
    loadPuzzleIntoState(msg.puzzle, { marks: msg.marks, markedBy: msg.markedBy, startTime: msg.startTime });
    state.coop.active = true;
    state.coop.connected = true;
    state.coop.waitingForGuest = false;
    state.coop.awaitingStart = true;
    state.coop.generating = false;
    navigate('game');
  } else if (msg.type === Coop.MSG.START) {
    if (state.coop.awaitingStart) startCoopGame(msg.startTime);
  } else if (msg.type === Coop.MSG.STATUS) {
    const remote = { timeMs: msg.timeMs, mistakes: msg.mistakes, hintsUsed: msg.hintsUsed };
    if (msg.status === 'won') win(remote);
    else if (msg.status === 'lost') lose(remote);
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
    // "won" entscheidet das eigene Team; "lost" gibt den Sieg automatisch
    // an die Gegenseite (kein Zu-Ende-Spielen für eigene Stats, siehe Plan).
    state.team.winningTeam = msg.outcome === 'won' ? msg.team : (msg.team === 'A' ? 'B' : 'A');
    state.team.endReason = msg.outcome;
    if (msg.team === state.team.myTeam) return; // eigenes Team meldet sich direkt aus win()/lose()
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
  state.coop.generating = false;
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
  // Schritt vorwärts (Name → Rollenwahl): Zurück öffnet wieder das Namens-Gate.
  pushNav(() => { state.coop.identityConfirmed = false; });
  state.coop.identityConfirmed = true;
}
// Rollenwahl → Host- bzw. Gast-Einrichtung. Zurück führt zur Rollenwahl.
function coopChooseHost() {
  pushNav(() => { state.coop.role = null; state.coop.error = null; });
  state.coop.role = 'host';
}
function coopChooseGuest() {
  pushNav(() => { state.coop.role = null; state.coop.error = null; });
  state.coop.role = 'guest';
}
// Verbindungsabbau beim Zurückgehen aus der Warte-Ansicht, ohne Rolle/Code zu
// verlieren -- so landet man wieder bei der Host-Einrichtung bzw. Code-Eingabe
// statt einen Schritt zu weit (Rollenwahl) zurückzuspringen. teamMode/raceMode
// bleiben absichtlich erhalten (anders als bei coopReset()), damit der Modus
// beim Zurückblättern durch die Lobby-Schritte gewahrt bleibt.
function coopTeardownWaiting() {
  coopIntentionalLeave = true;
  Coop.leave();
  state.coop.waitingForGuest = false;
  state.coop.connected = false;
  state.coop.players = [];
  state.coop.myId = null;
  state.coop.hostId = null;
  state.coop.error = null;
  state.race.rematchPending = false;
}
// Beim Einstieg ins Coop-Menü erscheint das Namens-Gate jedes Mal erneut (man
// kann den Namen also immer ändern), wird aber mit dem zuletzt gespeicherten
// Namen vorbefüllt, damit man ihn im Normalfall nur bestätigen muss.
function goCoop() {
  coopReset();
  state.coop.nameDraft = state.settings.coopName;
  state.coop.identityConfirmed = false;
  pushNav(() => { coopReset(); navigate('home'); });
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
  pushNav(() => { coopReset(); navigate('home'); });
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

// Gemeinsamer Handler für den EIGENEN RTDB-Verbindungsstatus (Coop.watchConnection).
// Fällt die eigene Socket-Verbindung (z.B. nach 1–3 Min. Inaktivität) aus, sieht
// das bisher nur der Host (der Gast verschwindet aus seiner players-Liste); der
// abgehängte Client selbst zeigte weiter "online". Jetzt spiegelt state.coop.online
// den echten eigenen Verbindungszustand → der Coop-Chip zeigt auch beim Client
// "offline", und bei Wiederverbindung kommt eine Bestätigung.
function handleCoopConnection(online, isReconnect) {
  state.coop.online = online;
  if (!online) {
    log('coop', 'Eigene Verbindung verloren – zeige Offline-Status');
    showToast(t('coop.connectionLost'), 'info', 4000);
  } else if (isReconnect) {
    log('coop', 'Eigene Verbindung wiederhergestellt');
    showToast(t('coop.reconnected'), 'success', 2000);
  }
}

function startHosting() {
  if (!Coop.isAvailable()) { state.coop.error = t('coop.errorWebrtcUnavailable'); return; }
  if (!CODE_RE.test(state.coop.code)) { state.coop.error = t('coop.errorInvalidCode'); return; }
  coopIntentionalLeave = false;
  // Schritt vorwärts (Host-Einrichtung → Warten auf Gast): Zurück baut die
  // Verbindung ab und kehrt zur Host-Einrichtung zurück (Code/Schwierigkeit bleiben).
  pushNav(coopTeardownWaiting);
  state.coop.role = 'host';
  state.coop.waitingForGuest = true;
  state.coop.error = null;
  state.coop.myId = null;
  state.coop.players = [];
  state.coop.online = true;
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
    onConnection: handleCoopConnection,
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
  // Sofort in die "Bereit?"-Lobby wechseln und die Generierung im Hintergrund-
  // Thread starten (kein eingefrorener Haupt-Thread bei großen Feldern). Bis das
  // Rätsel fertig ist, zeigt die Lobby einen laufenden Ladebalken; erst danach
  // verschickt der Host das fertige Rätsel per INIT an die Gäste.
  state.coop.active = true;
  state.coop.waitingForGuest = false;
  state.coop.awaitingStart = true;
  state.coop.generating = true;
  resetReadyFlags();
  navigate('game');
  // Off-thread generieren; bis dahin zeigt die Lobby den laufenden Ladebalken.
  log('game', `Puzzle-Generierung gestartet (Coop)`, { difficulty, players: state.coop.players.length });
  generateAsync({ difficulty }).then(puzzle => {
    if (!state.coop.awaitingStart) return; // Lobby zwischenzeitlich verlassen
    log('game', `Puzzle generiert (Coop)`, { difficulty, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.coop.generating = false;
    Coop.send({ type: Coop.MSG.INIT, puzzle: state.puzzle, marks: state.marks, markedBy: state.markedBy, startTime: state.startTime });
  }).catch(e => onLobbyGenFailed(e, 'Coop'));
}
// Gemeinsamer Fehlerpfad, falls die Lobby-Generierung (Coop-Host/Race/Team)
// fehlschlägt -- selten (Worker-Ausfall o.Ä.). Statt in einer leeren Lobby
// hängenzubleiben, wird die Session sauber beendet und zur Startseite zurück-
// gekehrt, mit kurzer Fehlermeldung.
function onLobbyGenFailed(e, mode) {
  log('game', `Puzzle-Generierung fehlgeschlagen (${mode})`, e);
  state.coop.generating = false;
  showToast(t('coop.genFailed'));
  quitToHome();
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
  // Beide Teams generieren ihr (per Seed identisches) Rätsel lokal im Hintergrund-
  // Thread. Bis es fertig ist, läuft in der Lobby der Ladebalken; ein Gast kann
  // sich erst danach "bereit" melden, der Host erst danach final starten -- so ist
  // garantiert, dass bei allen Clients ein fertiges Rätsel vorliegt (siehe
  // startCoopRound()/Lobby-Overlay).
  state.coop.active = true;
  state.coop.waitingForGuest = false;
  state.coop.awaitingStart = true;
  state.coop.generating = true;
  Coop.listenTeamEvents(state.team.myTeam, handleCoopMsg);
  Coop.listenTeamProgress(onTeamProgressUpdate);
  navigate('game');
  log('game', `Puzzle-Generierung gestartet (Team-Match)`, { difficulty, seed, team: state.team.myTeam });
  generateAsync({ difficulty, seed }).then(puzzle => {
    if (!state.coop.awaitingStart) return;
    log('game', `Puzzle generiert (Team-Match)`, { difficulty, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.coop.generating = false;
  }).catch(e => onLobbyGenFailed(e, 'Team-Match'));
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
  state.coop.waitingForGuest = false;
  state.coop.awaitingStart = true;
  state.coop.generating = true;
  // Der geteilte Renn-Fortschritt (raceProgress/{uid} in der RTDB) überlebt das
  // vorige Match -- ohne Reset läse der Listener beim Rematch den alten Stand
  // wieder ein und beide Balken hingen auf dem Endstand des letzten Spiels fest.
  // Jede Seite setzt darum ihren EIGENEN Eintrag frisch auf 0 (Gegner-Eintrag
  // bleibt der jeweils anderen Seite überlassen) und nullt das Sende-Throttle,
  // damit der erste Zug den neuen Stand sofort publiziert.
  raceProgressThrottle = 0;
  if (raceProgressTimer) { clearTimeout(raceProgressTimer); raceProgressTimer = null; }
  Coop.setRaceProgress(state.coop.myId, { pct: 0, mistakes: 0 });
  Coop.listenRaceProgress(onRaceProgressUpdate);
  navigate('game');
  // Beide Clients generieren ihr (per Seed identisches) Rätsel lokal im
  // Hintergrund-Thread; Start/Bereit ist bis zur Fertigstellung gesperrt (siehe
  // Team-Match oben).
  log('game', `Puzzle-Generierung gestartet (Race-Match)`, { difficulty, seed });
  generateAsync({ difficulty, seed }).then(puzzle => {
    if (!state.coop.awaitingStart) return;
    log('game', `Puzzle generiert (Race-Match)`, { difficulty, rows: puzzle.rows, cols: puzzle.cols });
    loadPuzzleIntoState(puzzle, null);
    state.coop.generating = false;
  }).catch(e => onLobbyGenFailed(e, 'Race-Match'));
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
  // Schritt vorwärts (Code-Eingabe → Warten auf Hoststart): Zurück baut die
  // Verbindung ab und kehrt zur Code-Eingabe zurück (Code bleibt erhalten).
  pushNav(coopTeardownWaiting);
  state.coop.role = 'guest';
  state.coop.waitingForGuest = true;
  state.coop.error = null;
  state.coop.players = [];
  state.coop.online = true;
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
    onConnection: handleCoopConnection,
  });
}

// remote: vom Coop-Partner empfangene, maßgebliche Werte (überschreibt lokal ggf.
// abweichende Zeit/Fehler/Hinweise, damit beide Seiten exakt denselben Endstand zeigen).
// Die Coop-Lobby/Verbindung bleibt nach Rundenende bestehen — sie schließt erst,
// wenn ein Spieler aktiv "Zum Menü" klickt (siehe quitToHome).
// Nach jeder abgeschlossenen Partie aufgerufen (win/lose) -- baut einen
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
// "lost" gewinnt automatisch das andere Team (kein Zu-Ende-Spielen
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
// Gegner erreichen muss. "won" entscheidet den Sieg selbst; bei "lost"
// gewinnt automatisch der Gegner (kein Zu-Ende-Spielen für eigene Stats, analog
// Team-vs-Team).
function broadcastRaceDone(outcome) {
  state.race.matchOver = true;
  state.race.winner = outcome === 'won' ? 'me' : 'opponent';
  state.race.endReason = outcome;
  state.race.myPct = progressPct();
  Coop.send({ type: Coop.MSG.RACE_DONE, from: state.coop.myId, outcome, finalPct: state.race.myPct, finalMistakes: state.mistakes });
}

// Streak nach einer abgeschlossenen Partie fortschreiben und – wenn dies der
// erste Abschluss des Tages war (justCounted) – den "Streak verlängert/gestartet"-
// Screen auslösen. Zählt für JEDES abgeschlossene Spiel des Tages (Sieg ODER
// Niederlage zählt als Aktivität), aber nur einmal täglich; Trainingsrätsel sind
// an den Aufrufstellen bereits ausgeschlossen.
function applyStreakAfterGame() {
  const r = recordStreakResult();
  state.streak = r;
  if (r.justCounted) {
    state.streakExtended = { current: r.currentStreak, best: r.bestStreak, continued: r.continued, isNewRecord: r.isNewRecord };
  }
}

function win(remote) {
  if (state.status === 'won') return;
  state.status = 'won';
  log('game', `Gewonnen`, { remote: !!remote, coop: state.coop.active });
  stopTimer();
  updateMusic();
  if (state.settings.sfxWin) Music.sfxWin();
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
    state.lastCoinReward = 0;  // Training/Race geben keine Münzen (keine gebucketete Leistung)
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
    // Münzen pro Sieg, abhängig von der Schwierigkeit — In-Game-Währung fürs
    // Shop-/Marktplatz-System; erscheint als „+X 💰" auf dem Sieg-Screen. Coop/
    // Wettkampf verdoppeln (Anreiz), makelloser Sieg verdoppelt (stapelt → ×4).
    const dIdx = DIFFICULTIES.findIndex(d => d.id === state.puzzle.difficulty);
    const perfect = state.mistakes === 0 && state.hintsUsed === 0;
    const isCoopish = state.coop.active || state.isRaceGame || state.team.active;
    const coins = coinReward(dIdx, { coop: isCoopish, perfect });
    state.wallet = grantCurrency(coins, 'win');
    state.lastCoinReward = coins;
    if (state.account.status === 'in') Account.scheduleSyncUp();
  }
  if (!state.isTrainingGame) applyStreakAfterGame();
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
  // Cloud-Sync nach jedem Sieg (der Münz-/Stats-Block oben stößt ihn bereits an;
  // hier zur Sicherheit auch für Coop/Team, die den Block überspringen).
  if (state.account.status === 'in') Account.scheduleSyncUp();
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
  if (state.settings.sfxLose) Music.sfxLose();
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
  if (!state.isTrainingGame) applyStreakAfterGame();
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
  if (state.account.status === 'in') Account.scheduleSyncUp();  // nach jedem Spiel (auch Niederlage) sichern
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'lost', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
  if (state.team.active && !remote) broadcastTeamDone('lost');
  if (state.race.active && !remote) broadcastRaceDone('lost');
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
  state.coop.online = true;
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
    onConnection: handleCoopConnection,
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
    else if (key === 'sfxToolSwitch') Music.sfxToolSwitch();
    else if (key === 'sfxWin') Music.sfxWin();
    else if (key === 'sfxLose') Music.sfxLose();
    else if (key === 'sfxUndo') Music.sfxUndo();
  }
}
function setSetting(key, val) {
  state.settings[key] = val;
  if (key === 'language') applyLocale();
  if (key === 'musicVolume') { Music.setVolume(val); updateMusic(); }
}
watch(() => state.settings, (s) => { saveSettings(s); if (state.account.status === 'in') Account.scheduleSyncUp(); }, { deep: true });

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
  if (m.color) { st['--rc-h'] = m.color.h; st['--rc-s'] = m.color.s + '%'; st['--rc-l'] = m.color.l + '%'; st['--rc-ink'] = regionChipInk(m.color); }
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

// ─── Optionaler Account (E-Mail+Username+PW, Cloud-Sync) ──────────────────────
// Spiegelt das lokale Profil ins UI; lädt Firebase NUR, wenn schon eine
// Account-Session existiert (sonst bleibt die App rein lokal/anonym).
function refreshAccountFromLocal() {
  const p = loadProfile();
  state.account.lastSyncAt = Account.lastSyncAt();
  if (p.accountId) { state.account.status = 'in'; state.account.uid = p.accountId; state.account.username = p.displayName || ''; state.account.role = p.role || 'user'; }
  else { state.account.status = 'anon'; state.account.uid = null; }
}
// Sofort ALLE Daten in die Cloud sichern (mit sichtbarem Status). No-op ohne Login.
async function doSyncNow() {
  if (state.account.status !== 'in') return;
  state.account.syncState = 'syncing';
  const r = await Account.syncNow();
  if (r.ok) { state.account.syncState = 'ok'; state.account.lastSyncAt = r.ts; state.account.syncErrorMsg = ''; }
  else if (r.skipped) { state.account.syncState = 'idle'; }
  else { state.account.syncState = 'error'; state.account.syncErrorMsg = r.err ? accErr(r.err) : ''; }
}
// Versions-Mismatch beim Start auflösen: keep = 'local' | 'cloud'.
async function resolveSyncConflict(keep) {
  state.syncConflictBusy = true;
  try {
    const r = await Account.resolveConflict(keep);
    if (!r.ok) { showToast(accErr(r.err || 'generic'), 'error', 2600); return; }
    if (keep === 'cloud') { safeReload('conflict-takeCloud'); return; }  // Cloud übernommen → sauber neu laden
    state.syncConflict = null;
    refreshAccountFromLocal();
    showToast(t('sync.kept'), 'success', 2000);
  } finally { state.syncConflictBusy = false; }
}
// Datum+Uhrzeit für den Konflikt-Dialog (voller Zeitstempel).
function fmtSyncDateTime(ts) {
  if (!ts) return '–';
  try { return new Date(ts).toLocaleString(i18nState.locale || undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (_) { return '–'; }
}
// Zeitpunkt der letzten Cloud-Sicherung als Uhrzeit (locale) — '–' wenn noch nie.
function fmtSyncTime(ts) {
  if (!ts) return '–';
  try { return new Date(ts).toLocaleTimeString(i18nState.locale || undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return '–'; }
}
async function refreshAccount() {
  refreshAccountFromLocal();
  // Genaueren Zustand (E-Mail/Rolle) nur holen, wenn lokal schon ein Account
  // hinterlegt ist — sonst würde Firebase unnötig geladen.
  if (loadProfile().accountId) {
    try {
      const s = await Account.authState();
      if (s.signedIn) { state.account.status = 'in'; state.account.uid = s.uid; state.account.email = s.email || ''; state.account.username = s.username || state.account.username; state.account.role = s.role || 'user'; }
      else state.account.status = 'anon';
    } catch (e) { log('account', 'refreshAccount fehlgeschlagen', e); }
  }
}
function accErr(suffix) { return t('account.err.' + suffix); }
async function doSignUp() {
  const a = state.account;
  a.error = null; a.notice = null; a.busy = true;
  try {
    const r = await Account.signUp({ email: a.email_up.trim(), username: a.username_up.trim(), password: a.pw_up });
    if (!r.ok) { a.error = accErr(r.err); return; }
    showToast(t('account.welcome', { name: a.username_up.trim() }), 'success', 2500);
    if (r.reload) setTimeout(() => safeReload('account-auth'), 600);
  } finally { a.busy = false; }
}
async function doSignIn() {
  const a = state.account;
  a.error = null; a.notice = null; a.busy = true;
  try {
    const r = await Account.signIn({ email: a.email_in.trim(), password: a.pw_in });
    if (!r.ok) { a.error = accErr(r.err); return; }
    showToast(t('account.signedIn'), 'success', 2500);
    if (r.reload) setTimeout(() => safeReload('account-auth'), 600);
  } finally { a.busy = false; }
}
function doSignOut() {
  ask(t('account.signOutTitle'), t('account.signOutMsg'), async () => {
    state.account.busy = true;
    try { const r = await Account.signOutAccount(); if (r.reload) safeReload('account-signout'); }
    finally { state.account.busy = false; }
  });
}
async function doResetPassword() {
  const a = state.account;
  a.error = null; a.notice = null;
  const email = (a.mode === 'in' ? a.email_in : a.email_up).trim();
  const r = await Account.resetPassword(email);
  if (r.ok) a.notice = t('account.resetSent'); else a.error = accErr(r.err);
}
function startUsernameEdit() {
  const a = state.account;
  a.usernameDraft = a.username || '';
  a.usernameEditing = true; a.error = null; a.notice = null;
}
async function doChangeUsername() {
  const a = state.account;
  a.busy = true; a.error = null; a.notice = null;
  try {
    const r = await Account.changeUsername(a.usernameDraft.trim());
    if (!r.ok) { a.error = accErr(r.err); return; }
    a.username = r.username; a.usernameEditing = false;
    showToast(t('account.usernameChanged'), 'success', 2500);
    if (a.status === 'in') Account.scheduleSyncUp();
  } finally { a.busy = false; }
}
function doDeleteAccount() {
  ask(t('account.deleteTitle'), t('account.deleteMsg'), async () => {
    state.account.busy = true;
    try {
      const r = await Account.deleteAccount();
      if (!r.ok) { state.account.error = accErr(r.err); return; }
      showToast(t('account.deleted'), 'success', 2500);
      if (r.reload) setTimeout(() => safeReload('account-auth'), 600);
    } finally { state.account.busy = false; }
  });
}
// ─── Admin (Geschenke/Rollen) ─────────────────────────────────────────────────
async function adminSearch() {
  const a = state.account;
  a.adminError = null; a.adminResult = null; a.adminBusy = true;
  try {
    const r = await Account.adminFindUser(a.adminQuery.trim());
    if (!r.ok) { a.adminError = accErr(r.err); return; }
    a.adminResult = r;
    // Editierfelder mit dem gefundenen Stand vorbelegen.
    a.adminUsername = r.profile?.username || '';
    a.adminEmail = r.profile?.email || '';
    a.adminBalance = String(r.wallet?.balance ?? 0);
    a.adminItem = ''; a.adminFieldKey = ''; a.adminFieldVal = '';
  } finally { a.adminBusy = false; }
}
async function adminAction(fn, ...args) {
  const a = state.account; a.adminError = null; a.adminBusy = true;
  try {
    const r = await fn(...args);
    if (!r.ok) { a.adminError = accErr(r.err); return false; }
    await adminSearch();  // Ansicht aktualisieren
    showToast(t('admin.done'), 'success', 1800);
    return true;
  } finally { a.adminBusy = false; }
}
function adminGrantSkin() { if (state.account.adminResult) adminAction(Account.adminGrantItem, state.account.adminResult.uid, 'dynamicColor'); }
function adminRevokeSkin() { if (state.account.adminResult) adminAction(Account.adminRevokeItem, state.account.adminResult.uid, 'dynamicColor'); }
function adminToggleRole() {
  const r = state.account.adminResult; if (!r) return;
  const next = (r.profile?.role === 'admin') ? 'user' : 'admin';
  adminAction(Account.adminSetRole, r.uid, next);
}
function adminSetBalance() { const r = state.account.adminResult; if (!r) return; adminAction(Account.adminSetCurrency, r.uid, parseInt(state.account.adminBalance || '0', 10)); }
function adminChangeUsername() { const r = state.account.adminResult; const n = state.account.adminUsername.trim(); if (!r || !n) return; adminAction(Account.adminSetUsername, r.uid, n); }
function adminGrantAnyItem() { const r = state.account.adminResult; const id = state.account.adminItem.trim(); if (!r || !id) return; adminAction(Account.adminGrantItem, r.uid, id); }
function adminRevokeAnyItem() { const r = state.account.adminResult; const id = state.account.adminItem.trim(); if (!r || !id) return; adminAction(Account.adminRevokeItem, r.uid, id); }
function adminSetField() { const r = state.account.adminResult; const k = state.account.adminFieldKey.trim(); if (!r || !k) return; adminAction(Account.adminSetProfileField, r.uid, k, state.account.adminFieldVal); }
async function adminResetPw() {
  const a = state.account; const email = (a.adminEmail || a.adminResult?.profile?.email || '').trim();
  if (!email) { a.adminError = accErr('invalidEmail'); return; }
  a.adminBusy = true; a.adminError = null;
  try {
    const res = await Account.adminSendPasswordReset(email);
    if (!res.ok) { a.adminError = accErr(res.err); return; }
    showToast(t('admin.resetSent'), 'success', 2600);
  } finally { a.adminBusy = false; }
}

// ─── Dynamischer Skin: Freischaltung ──────────────────────────────────────────
// Schaltet das Cosmetic 'dynamicColor' frei (idempotent, lokales Inventar) und
// zeigt EINMAL die Feier-Anzeige. Bei eingeloggtem Konto wird der Unlock
// hochgeladen (roamt über /users/{uid}/inventory).
function grantSkin(source) {
  if (state.inventory[SKIN_ID]) return false;
  state.inventory = grantInventory(SKIN_ID, source);
  state.skinJustUnlocked = true;
  if (state.account.status === 'in') Account.scheduleSyncUp();
  log('app', 'Skin freigeschaltet', { source });
  return true;
}
// „Feier des Tages": JEDER ab 1.0 bekommt den Skin geschenkt. Zusätzlich bekommt,
// wer den Sprung von <1.0 aktiv miterlebt hat, einen bleibenden Founder-Marker
// (für später). Liest die zuletzt gesehene Version VOR dismissWhatsNew.
function maybeUnlockV1Skin() {
  if (!state.inventory[SKIN_ID] && eligibleForCelebrationSkin(BUILD)) grantSkin('v1celebration');
  if (!state.inventory[FOUNDER_ID] && qualifiesForV1Skin(loadSeenVersion(), BUILD)) {
    state.inventory = grantInventory(FOUNDER_ID, 'version-jump');
    if (state.account.status === 'in') Account.scheduleSyncUp();
    log('app', 'Founder-Marker vergeben (1.0-Sprung miterlebt)');
  }
}
function redeemSkinCode() {
  const a = state.account;
  if (state.inventory[SKIN_ID]) { showToast(t('skin.alreadyOwned'), 'info', 2200); return; }
  if (skinCodeMatches(state.skinCodeInput)) {
    grantSkin('code');
    state.skinCodeInput = '';
    showToast(t('skin.codeOk'), 'success', 2600);
  } else {
    showToast(t('skin.codeBad'), 'error', 2600);
  }
}
function dismissSkinUnlock() { state.skinJustUnlocked = false; }
function openSkinEditor() {
  // Wer den Skin anpassen möchte, will ihn auch sehen → aktivieren (Default ist aus).
  state.settings.skinEnabled = true;
  state.skinJustUnlocked = false;
  navigate('settings'); state.settingsTab = 'farbe';
  nextTick(() => { document.querySelector('.skin-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
}

// ─── WAS IST NEU ──────────────────────────────────────────────────────────────
// Semver-artiger Vergleich ("0.155" > "0.154"): teilstückweise numerisch.
function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
function maybeShowWhatsNew() {
  const seen = loadSeenVersion();
  if (seen !== BUILD && CHANGELOG.length) {
    state.whatsNewSince = seen; // zuletzt gesehene Version festhalten (siehe whatsNewEntries)
    state.showWhatsNew = true;
  }
}
function dismissWhatsNew() { state.showWhatsNew = false; saveSeenVersion(BUILD); }
function dismissStreakLostNotice() { state.streakLostNotice = false; }
function dismissStreakExtended() { state.streakExtended = null; }

// ─── APP-UPDATE (Service Worker) ──────────────────────────────────────────────
// Hält den im "waiting" wartenden Worker, bis der Nutzer aktiv aktualisiert.
let waitingWorker = null;

// Läuft gerade ein Spiel oder eine Coop-/Wettkampf-Session? Dann darf NICHTS die
// Seite neu laden oder einen Update-Dialog aufpoppen — sonst wird der Nutzer
// mitten im Spiel herausgeworfen (genau die gemeldete Beschwerde). Reloads werden
// stattdessen aufgeschoben, bis der Nutzer wieder auf einem sicheren Screen ist.
function gameSessionActive() {
  return state.screen === 'game' || state.coop.active || state.team.active || state.race.active;
}
let pendingReloadReason = null;
// Harte Reload-Schleifen-Bremse: hält die Zeitstempel der letzten (durchgeführten)
// Neuladungen in localStorage (überlebt Reloads/PWA-Neustarts). Passieren zu viele
// in kurzer Zeit, wird NICHT mehr neu geladen — so kann die App nie in einer
// Endlos-Reload-Schleife (Splash→Menü→Splash…) hängen, egal welcher Auslöser.
const RELOAD_LOG_KEY = 'cns_reload_log';
const RELOAD_WINDOW_MS = 60000, RELOAD_MAX = 3;
function reloadLoopTripped(reason) {
  try {
    const now = Date.now();
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(RELOAD_LOG_KEY) || '[]'); } catch (_) { arr = []; }
    arr = (Array.isArray(arr) ? arr : []).filter(t => now - t < RELOAD_WINDOW_MS);
    if (arr.length >= RELOAD_MAX) {
      log('sw', 'Reload-Schleife erkannt — Neuladen unterdrückt', { reason, count: arr.length });
      try { showToast(t('update.reloadLoop'), 'error', 7000); } catch (_) {}
      return true;
    }
    arr.push(now);
    localStorage.setItem(RELOAD_LOG_KEY, JSON.stringify(arr));
    return false;
  } catch (_) { return false; }
}
// Zentrale, SICHERE Neuladen-Funktion: protokolliert immer (Grund + Kontext),
// lädt nie mitten in einem Spiel/Coop neu (schiebt auf bis navigate('home')) und
// bricht Reload-Schleifen ab.
function safeReload(reason) {
  const deferred = gameSessionActive();
  log('sw', 'Neuladen angefordert', { reason, screen: state.screen, status: state.status, coop: state.coop.active, deferred });
  if (deferred) { pendingReloadReason = reason; return; }
  if (reloadLoopTripped(reason)) return;
  location.reload();
}
function flushPendingReload() {
  if (pendingReloadReason && !gameSessionActive()) {
    const reason = pendingReloadReason; pendingReloadReason = null;
    if (reloadLoopTripped(reason)) return;
    log('sw', 'Aufgeschobenes Neuladen wird jetzt ausgeführt', { reason });
    location.reload();
  }
}
// Zeigt den Update-Dialog — aber NIE während einer Spiel-/Coop-Session. Läuft
// gerade ein Spiel, merkt pendingUpdate das und der Dialog erscheint erst danach.
function offerUpdate() {
  if (gameSessionActive()) {
    state.pendingUpdate = true;
  } else {
    state.updateReady = true;
  }
}
let reloadingForUpdate = false;
function applyUpdate() {
  if (!waitingWorker) { safeReload('sw-update-no-worker'); return; }
  log('sw', `Update wird angewendet`);
  // Sobald der neue Worker die Kontrolle übernimmt, einmalig (sicher) neu laden.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    log('sw', `Neuer Worker aktiv – lade neu`);
    safeReload('sw-controllerchange');
  });
  waitingWorker.postMessage({ type: 'skipWaiting' });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// ─── DIAGNOSE: FEHLER + GERÄT + JANK ──────────────────────────────────────────
// Schreibt aussagekräftige, aber bewusst SELTENE Diagnose-Einträge (debuglog.js →
// Einstellungen ▸ Diagnoseprotokoll exportieren), damit sich Probleme auf fremden
// Geräten nachvollziehen lassen — inkl. Hänger/Jank und "toter" Buttons.
// WICHTIG: nur niederfrequente Ereignisse protokollieren (Start, Fehler, alle 10s
// aggregierter Jank) — NIEMALS pro Frame/Tap. log() macht synchrone localStorage-
// Zugriffe; häufiges Loggen würde die Performance selbst beeinträchtigen.
function initDiagnostics() {
  // 1) Unbehandelte Fehler / Promise-Rejections. Häufige Ursache dafür, dass plötzlich
  //    Buttons "tot" wirken: ein geworfener Handler bricht Folgelogik/Reaktivität ab.
  window.addEventListener('error', (e) => {
    log('error', 'Unbehandelter Fehler', {
      message: e.message, source: e.filename, line: e.lineno, col: e.colno,
      name: e.error && e.error.name,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    log('error', 'Unbehandelte Promise-Rejection', r instanceof Error ? r : { message: String(r) });
  });
  // 2) Einmaliger Geräte-/Umgebungs-Schnappschuss. Kernfrage bei Perf-Problemen:
  //    Welches Gerät/Browser, wie viele Kerne/RAM? Genau eine Zeile -> praktisch gratis.
  try {
    const nav = navigator, scr = screen;
    log('env', 'App gestartet', {
      build: BUILD,
      ua: nav.userAgent,
      platform: nav.platform,
      cores: nav.hardwareConcurrency,
      mem: nav.deviceMemory,
      screen: `${scr.width}x${scr.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
      lang: nav.language,
      online: nav.onLine,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  } catch {}
  // 3) Jank-Erkennung: lange Haupt-Thread-Tasks (>50ms = spürbares Ruckeln, evtl.
  //    "hängende" Buttons) via PerformanceObserver. NICHT jede Task einzeln loggen
  //    (würde das Protokoll fluten und selbst bremsen) — aggregieren und höchstens
  //    alle 10s EINE Zusammenfassung schreiben, nur wenn überhaupt Jank auftrat.
  if (typeof PerformanceObserver === 'function') {
    let count = 0, totalMs = 0, maxMs = 0;
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          count++; totalMs += entry.duration; if (entry.duration > maxMs) maxMs = entry.duration;
        }
      });
      obs.observe({ type: 'longtask', buffered: true });
      setInterval(() => {
        if (!count) return;
        log('perf', 'Längere Haupt-Thread-Blockaden (Jank, 10s-Fenster)', {
          count, maxMs: Math.round(maxMs), totalMs: Math.round(totalMs), screen: state.screen,
        });
        count = 0; totalMs = 0; maxMs = 0;
      }, 10000);
    } catch {}
  }
}

function init() {
  initDiagnostics();
  // Läuft die App 20 s stabil ohne Neuladen, gilt eine evtl. Reload-Serie als
  // beendet → Zähler zurücksetzen, damit ein späteres legitimes Update wieder
  // neu laden darf (die harte Bremse greift nur bei echten Schnell-Schleifen).
  setTimeout(() => { try { localStorage.removeItem(RELOAD_LOG_KEY); } catch (_) {} }, 20000);
  applyTheme();
  applyLocale();
  refreshResume();
  refreshAccountFromLocal();
  if (loadProfile().accountId) {
    refreshAccount();  // genauere Cloud-Infos nachladen (nur wenn eingeloggt)
    // Abgleich lokal↔Cloud beim Start (nie stilles Überschreiben; bei echter
    // Diskrepanz Warnung auf dem Startbildschirm mit Auswahl).
    Account.reconcile().then(r => {
      if (r.decision === 'takeCloud') { safeReload('reconcile-takeCloud'); return; }  // Cloud übernommen → sauber neu laden
      if (r.decision === 'conflict') { state.syncConflict = { localTs: r.localTs, cloudTs: r.cloudTs }; }
      state.inventory = loadInventory();
      state.wallet = loadWallet();
      maybeUnlockV1Skin();
      refreshAccountFromLocal();  // lastSync/Status auffrischen
    });
    // …und automatisch alle 60 s weiter sichern, solange die App offen ist.
    setInterval(() => { if (state.account.status === 'in') doSyncNow(); }, 60000);
  }
  maybeShowWhatsNew();
  maybeUnlockV1Skin();  // 1.0-Feier-Skin beim Versionssprung (vor dismissWhatsNew, das die Version speichert)
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

  // Worker für die Off-Thread-Generierung bereitstellen (siehe oben). Es wird NICHT
  // mehr vorab generiert -- Rätsel entstehen erst beim Spielstart on-demand.
  initGenWorker();
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
        const key = state.mistakes === 0 ? 'race.youWonClean' : 'race.youWonMistakes';
        return t(key, { name, myPct: r.myPct, oppPct: r.opponentPct });
      }
      if (r.endReason === 'lost') return t('race.youLostByLives', { name, myPct: r.myPct, oppPct: r.opponentPct });
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
        return t('team.weWon', params);
      }
      if (tm.endReason === 'lost') return t('team.weLostByLives', params);
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

    // ── Dynamischer Skin (Cosmetic 'dynamicColor') ──
    const skinUnlocked = computed(() => !!state.inventory[SKIN_ID]);
    const skinActive = computed(() => skinUnlocked.value && state.settings.skinEnabled);
    const skinVars = computed(() => skinActive.value ? buildSkinVars(state.settings) : {});
    const skinBoardClasses = computed(() => buildSkinClasses(state.settings, skinActive.value));
    // Editor-Vorschau: IMMER aktiv (unabhängig vom Master-Schalter), damit man die
    // gerade eingestellte Optik sieht.
    const skinPreviewVars = computed(() => buildSkinVars(state.settings));
    const skinPreviewClasses = computed(() => buildSkinClasses(state.settings, true));

    // "Was ist neu": alle Changelog-Einträge NEUER als die zuletzt gesehene Version
    // (neueste oben — CHANGELOG ist bereits absteigend sortiert). Bei Erstinstallation
    // (keine gesehene Version) nur den neuesten Eintrag, sonst würde die komplette
    // Historie aufploppen.
    const whatsNewEntries = computed(() => {
      const since = state.whatsNewSince;
      if (!since) return CHANGELOG.slice(0, 1);
      return CHANGELOG.filter(e => cmpVersion(e.version, since) > 0);
    });

    // Modusübergreifender Überblick für den "Allgemein"-Reiter der Statistik.
    const generalStats = computed(() => {
      const s = state.stats;
      const r1 = state.raceStats['1v1'], r2 = state.raceStats['2v2'];
      const played = (s.played || 0) + (s.coopPlayed || 0) + (r1.racesPlayed || 0) + (r2.racesPlayed || 0);
      const won = (s.won || 0) + (s.coopWon || 0) + (r1.racesWon || 0) + (r2.racesWon || 0);
      // Lieblingslevel = meistgespielte Schwierigkeit (Solo + Coop zusammen).
      let favId = null, favN = 0;
      for (const d of DIFFICULTIES) {
        const bd = s.byDifficulty[d.id]; if (!bd) continue;
        const n = (bd.played || 0) + (bd.coopPlayed || 0);
        if (n > favN) { favN = n; favId = d.id; }
      }
      return {
        played, won,
        winPct: played ? Math.round(won / played * 100) : 0,
        timeMs: (s.totalTimeMs || 0) + (s.coopTotalTimeMs || 0),
        perfect: (s.perfectWins || 0) + (s.coopPerfectWins || 0),
        favId,
      };
    });

    return {
      generalStats, fmtDuration, whatsNewEntries,
      state, BUILD, CHANGELOG, DIFFICULTIES, DIFF_BY_ID, ACHIEVEMENTS, achievementsUnlockedCount,
      livesArr, lifeLossColor, opponentLivesArr, opponentTeamLivesArr, coopPerformance, mvpId, opponentTeamPerformance, progress, myProgressPct, gridStyle, coopAvailable,
      navigate, navTo, goBack, newGame, goNextPuzzle, resumeGame, resumeCoopGame, onCellTap, onCellPointerDown, onCellPointerMove, onCellPointerCancel, undo, useHint, revealHintNudge, dismissHintNudge, doCheck,
      rowSum, colSum, regionSum, rowResolved, colResolved, regionResolved, rowSumMatch, colSumMatch,
      fmtTime, toggleSetting, setSetting, doExport, doExportLog, doImport,
      resetStats, doDeleteAllData, ask, confirmYes, confirmNo, dismissWhatsNew, dismissStreakLostNotice, dismissStreakExtended,
      quitToHome, setZoom, resetZoom, pauseGame, resumeFromPause, openSettings, closeSettings, startCoopRound,
      openShop, closeShop, coinFor, SHOP_ITEMS,
      SETTINGS_SECTIONS, selectSettingsSection, toggleSettingsDrawer,
      cellClasses, cellStyle, cellAriaLabel, toggleTool,
      startHosting, startJoining, coopReset, avgTimeFor, coopAvgTimeFor, lobbyIsCompetition, lobbyAvgTimeFor, lobbyBestTimeMs, racePct,
      doSignUp, doSignIn, doSignOut, doResetPassword, doDeleteAccount, refreshAccount, doSyncNow, fmtSyncTime, resolveSyncConflict, fmtSyncDateTime,
      startUsernameEdit, doChangeUsername,
      adminSearch, adminGrantSkin, adminRevokeSkin, adminToggleRole,
      adminSetBalance, adminChangeUsername, adminGrantAnyItem, adminRevokeAnyItem, adminSetField, adminResetPw,
      skinUnlocked, skinActive, skinVars, skinBoardClasses, skinPreviewVars, skinPreviewClasses, redeemSkinCode, dismissSkinUnlock, openSkinEditor, skinSpeedToDuration,
      startCoopMatch, canStartCoopMatch, COOP_MAX_PLAYERS, DONATE_URL,
      assignTeam, randomizeTeams, canStartTeamMatch, startTeamMatch, goRace, canStartRaceMatch, startRaceMatch, rematchRace,
      chipTextColor, confirmCoopIdentity, coopChooseHost, coopChooseGuest, playerColor, goCoop, applyUpdate,
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
      <button v-if="state.account.role==='admin'" class="home-admin-badge" @click="openSettings" :title="t('admin.title')">👑 {{ t('account.roleAdmin') }}</button>
      <div class="home-topbar-right">
        <button class="icon-btn home-shop-btn" @click="openShop" :aria-label="t('shop.title')" :title="t('shop.title')">🛒</button>
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
        <button class="btn btn-primary" @click="coopReset(); navTo('setup')">
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
          <button class="btn btn-ghost" @click="navTo('stats')"><span class="btn-ic">📊</span> {{ t('home.stats') }}</button>
          <button class="btn btn-ghost" @click="navTo('history')"><span class="btn-ic">🕘</span> {{ t('home.history') }}</button>
        </div>
      </div>
      <div class="home-version">v{{ BUILD }}</div>
    </section>

    <!-- ══ SETUP ══ -->
    <section v-else-if="state.screen==='setup'" class="screen setup">
      <header class="topbar">
        <button class="icon-btn" @click="goBack()">‹</button>
        <h2>{{ t('setup.title') }}</h2>
        <button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button>
      </header>
      <div class="setup-body">
        <div class="setup-label">{{ t('common.difficulty') }}</div>
        <div class="option-grid">
          <button v-for="d in DIFFICULTIES" :key="d.id" class="opt-card" :class="{active: state.sel.difficulty===d.id}" @click="state.sel.difficulty=d.id">
            <span class="opt-coins" :title="t('wallet.rewardHint')">💰 {{ coinFor(d, false) }}</span>
            <span class="opt-head"><span class="opt-emoji">{{ d.emoji }}</span><span class="opt-name">{{ t('difficulty.'+d.id) }}</span></span><span class="opt-dim">{{ d.dim.r }}×{{ d.dim.c }}</span>
            <span class="opt-chips">
              <span class="chip">⌀ {{ avgTimeFor(d.id)!=null ? fmtTime(avgTimeFor(d.id)) : '–:––' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip best-time-chip">🏆 {{ state.stats.byDifficulty[d.id]?.bestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) : '–:––' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
            </span>
          </button>
        </div>
        <button class="btn btn-primary btn-start" @click="newGame(state.sel.difficulty)">
          {{ t('setup.start') }}
        </button>
      </div>
    </section>

    <!-- ══ GAME ══ -->
    <section v-else-if="state.screen==='game'" class="screen game" :class="{ 'race-mode': state.race.active, 'team-mode': state.team.active, 'training-mode': state.isTrainingGame }">
      <!-- Aufgeräumte Spiel-Topbar: oben nur HUD (Leben/Zeit) + Pause. Aufgeben,
           Einstellungen und Anleitung sind ins Pausenmenü gewandert (siehe unten);
           "Zum Menü" gibt es dort ebenfalls (kein Zurück-Pfeil oben mehr). -->
      <header class="topbar game-top">
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
        </div>
      </header>

      <div v-if="state.generating" class="loading loading-overlay">
        <div class="loading-card">
          <div class="spinner"></div>
          <div class="loading-tx">{{ t('game.loading') }}</div>
          <div class="loading-bar"><span></span></div>
          <div class="loading-hint">{{ t('game.loadingHint') }}</div>
        </div>
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
          <span v-if="state.coop.active" class="chip coop-chip" :class="(state.coop.connected && state.coop.online) ? 'coop-on' : 'coop-off'">
            👥 {{ t('game.coopTag') }}{{ (state.coop.connected && state.coop.online) ? '' : t('game.coopOfflineSuffix') }}
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
            <!-- Reset-Knopf bewusst LINKS: die Leiste ist rechtsbündig (margin-left:auto),
                 d.h. ein links eingeschobener Knopf wächst nach links und lässt − / +
                 an ihrer Position -- schnelles, wiederholtes Tippen auf + verrutscht so nicht. -->
            <button v-if="state.zoom !== 1" class="zoom-btn zoom-reset" @click="resetZoom" :aria-label="t('game.zoomReset')" :title="t('game.zoomReset')">↺</button>
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
          <div class="board" :class="skinBoardClasses" :style="[gridStyle, skinVars]">
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
          <b>💡 {{ t('training.group.'+state.hintNudge.group.kind, { n: state.hintNudge.group.ref+1 }) }}<template v-if="state.hintNudge.group.target!=null"> ({{ t('training.target', { n: state.hintNudge.group.target }) }})</template></b>
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
          <p class="result-msg">{{ state.coop.generating ? t('coop.generating') : t('coop.lobbyMsg') }}</p>
          <div class="coop-roster" v-if="nonHostPlayers().length">
            <span v-for="p in nonHostPlayers()" :key="p.id" class="player-chip" :class="{ 'ready-chip': p.ready }"
                  :style="{ background: p.color, color: chipTextColor(p.color) }">
              {{ p.name }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
              {{ p.ready ? '✅' : '⏳' }}
            </span>
          </div>
          <!-- Solange das eigene Rätsel noch generiert wird: laufender Ladebalken
               statt Start/Bereit-Knopf -- so kann niemand starten/sich bereit
               melden, bevor bei ihm wirklich ein Rätsel bereitliegt. -->
          <template v-if="state.coop.generating">
            <div class="loading-bar"><span></span></div>
          </template>
          <template v-else-if="state.coop.role === 'host'">
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
          <!-- Aus dem Pausenmenü erreichbar: Einstellungen (öffnet das Menü, Spiel
               bleibt pausiert), Anleitung und Aufgeben. So läuft beim Öffnen der
               Einstellungen im Spiel exakt dieselbe Pausenmechanik wie über den
               Pause-Knopf (für alle Coop-Spieler synchron pausiert). -->
          <button class="btn btn-ghost" @click="openSettings"><span class="btn-ic">⚙️</span> {{ t('home.settings') }}</button>
          <button class="btn btn-ghost" @click="state.modal='howto'"><span class="btn-ic">📖</span> {{ t('home.howto') }}</button>
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
          <div v-if="state.lastCoinReward > 0" class="coin-reward">💰 +{{ state.lastCoinReward }} <span class="coin-total">({{ t('wallet.total', { n: state.wallet.balance }) }})</span></div>
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
      <!-- Confetti -->
      <div v-if="state.confetti.length" class="confetti" :class="{ perfect: state.perfectWin }">
        <i v-for="p in state.confetti" :key="p.id" :style="{left:p.left+'%', background:p.color, animationDelay:p.delay+'s', animationDuration:p.dur+'s', width:p.size+'px', height:p.size+'px', transform:'rotate('+p.rot+'deg)'}"></i>
      </div>
    </section>

    <!-- ══ STATS ══ -->
    <section v-else-if="state.screen==='stats'" class="screen stats">
      <header class="topbar"><button class="icon-btn" @click="goBack()">‹</button><h2>{{ t('stats.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button></header>
      <div class="stats-body">
        <button class="btn btn-ghost shop-entry-btn" @click="openShop">
          <span class="btn-ic">🛒</span>
          <span class="btn-tx"><b>{{ t('shop.title') }}</b><small>{{ t('shop.entryHint') }}</small></span>
        </button>
        <div class="seg stats-tabs">
          <button :class="{ active: state.statsTab==='allgemein' }" @click="state.statsTab='allgemein'">{{ t('stats.tabGeneral') }}</button>
          <button :class="{ active: state.statsTab==='solo' }" @click="state.statsTab='solo'">{{ t('stats.solo') }}</button>
          <button :class="{ active: state.statsTab==='coop' }" @click="state.statsTab='coop'">{{ t('stats.coop') }}</button>
        </div>

        <!-- Reiter: Allgemein -->
        <template v-if="state.statsTab==='allgemein'">
          <div class="stats-overview">
            <div class="stat-tile"><span class="stat-emoji">🎮</span><b>{{ generalStats.played }}</b><small>{{ t('stats.ovPlayed') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji">🥇</span><b>{{ generalStats.won }} · {{ generalStats.winPct }}%</b><small>{{ t('stats.wonPlayedLabel') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji">⏱️</span><b>{{ fmtDuration(generalStats.timeMs) }}</b><small>{{ t('stats.ovTime') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji">✨</span><b>{{ generalStats.perfect }}</b><small>{{ t('stats.ovPerfect') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji">🔥</span><b>{{ state.streak.currentStreak }} / {{ state.streak.bestStreak }}</b><small>{{ t('stats.ovStreak') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji">⭐</span><b><template v-if="generalStats.favId">{{ DIFF_BY_ID[generalStats.favId].emoji }} {{ t('difficulty.'+generalStats.favId) }}</template><template v-else>–</template></b><small>{{ t('stats.ovFav') }}</small></div>
            <div class="stat-tile clickable" @click="navTo('achievements')"><span class="stat-emoji">🏅</span><b>{{ achievementsUnlockedCount }} / {{ ACHIEVEMENTS.length }}</b><small>{{ t('stats.ovAchievements') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji">💰</span><b>{{ state.wallet.balance }}</b><small>{{ t('wallet.coins') }}</small></div>
          </div>
          <button class="btn btn-ghost achievements-top-btn" @click="navTo('achievements')">{{ t('stats.achievementsButton') }} ({{ achievementsUnlockedCount }}/{{ ACHIEVEMENTS.length }})</button>
        </template>

        <!-- Reiter: Solo -->
        <template v-else-if="state.statsTab==='solo'">
          <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
            <div class="diff-row-top"><span class="diff-name">{{ d.emoji }} {{ t('difficulty.'+d.id) }}</span></div>
            <div class="diff-row-sub">
              <span class="chip">🥇 {{ (state.stats.byDifficulty[d.id]?.won)||0 }} / {{ (state.stats.byDifficulty[d.id]?.played)||0 }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip best-time-chip">🏆 {{ state.stats.byDifficulty[d.id]?.bestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              <span class="chip">⌀ {{ avgTimeFor(d.id)!=null ? fmtTime(avgTimeFor(d.id)) : '-:--' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip">💔 {{ (state.stats.byDifficulty[d.id]?.lost)||0 }}<span class="chip-label">{{ t('stats.lostLabel') }}</span></span>
            </div>
          </div>
        </template>

        <!-- Reiter: Coop (inkl. Wettkampf/Duell) -->
        <template v-else>
          <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
            <div class="diff-row-top"><span class="diff-name">{{ d.emoji }} {{ t('difficulty.'+d.id) }}</span></div>
            <div class="diff-row-sub">
              <span class="chip coop-chip">🥇 {{ (state.stats.byDifficulty[d.id]?.coopWon)||0 }} / {{ (state.stats.byDifficulty[d.id]?.coopPlayed)||0 }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip coop-chip best-time-chip">🏆 {{ state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              <span class="chip coop-chip">⌀ {{ coopAvgTimeFor(d.id)!=null ? fmtTime(coopAvgTimeFor(d.id)) : '-:--' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip coop-chip">💔 {{ (state.stats.byDifficulty[d.id]?.coopLost)||0 }}<span class="chip-label">{{ t('stats.lostLabel') }}</span></span>
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
        </template>

        <button class="btn btn-danger-ghost" @click="resetStats">{{ t('stats.reset') }}</button>
      </div>
    </section>

    <!-- ══ ACHIEVEMENTS ══ -->
    <section v-else-if="state.screen==='achievements'" class="screen achievements">
      <header class="topbar"><button class="icon-btn" @click="goBack()">‹</button><h2>{{ t('achievements.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button></header>
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
      <header class="topbar"><button class="icon-btn" @click="goBack()">‹</button><h2>{{ t('history.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')">⚙️</button></header>
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
        <button class="icon-btn" @click="goBack()">‹</button>
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
        <button class="btn btn-primary" @click="coopChooseHost()">
          <span class="btn-ic">📡</span>
          <span class="btn-tx"><b>{{ t('coop.host') }}</b><small>{{ t('coop.hostHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" @click="coopChooseGuest()">
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
              <span class="opt-coins" :title="t('wallet.rewardHint')">💰 {{ coinFor(d, true) }}</span>
              <span class="opt-head"><span class="opt-emoji">{{ d.emoji }}</span><span class="opt-name">{{ t('difficulty.'+d.id) }}</span></span><span class="opt-dim">{{ d.dim.r }}×{{ d.dim.c }}</span>
              <span class="opt-chips">
                <span class="chip" :class="{ 'coop-chip': !lobbyIsCompetition() }">⌀ {{ lobbyAvgTimeFor(d.id)!=null ? fmtTime(lobbyAvgTimeFor(d.id)) : '–:––' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
                <span class="chip best-time-chip" :class="{ 'coop-chip': !lobbyIsCompetition() }">🏆 {{ lobbyBestTimeMs(d.id)!=null ? fmtTime(lobbyBestTimeMs(d.id)) : '–:––' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              </span>
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
                <span class="opt-coins" :title="t('wallet.rewardHint')">💰 {{ coinFor(d, true) }}</span>
                <span class="opt-head"><span class="opt-emoji">{{ d.emoji }}</span><span class="opt-name">{{ t('difficulty.'+d.id) }}</span></span><span class="opt-dim">{{ d.dim.r }}×{{ d.dim.c }}</span>
                <span class="opt-chips">
                  <span class="chip" :class="{ 'coop-chip': !lobbyIsCompetition() }">⌀ {{ lobbyAvgTimeFor(d.id)!=null ? fmtTime(lobbyAvgTimeFor(d.id)) : '–:––' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
                  <span class="chip best-time-chip" :class="{ 'coop-chip': !lobbyIsCompetition() }">🏆 {{ lobbyBestTimeMs(d.id)!=null ? fmtTime(lobbyBestTimeMs(d.id)) : '–:––' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
                </span>
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
        <button class="btn btn-ghost" style="margin-top:8px" @click="goBack()">{{ t('common.back') }}</button>
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
        <button class="btn btn-ghost" style="margin-top:4px" @click="goBack()">{{ t('common.back') }}</button>
      </div>

    </section>

    <!-- ══ SHOP (Work in Progress) ══ -->
    <section v-else-if="state.screen==='shop'" class="screen shop">
      <header class="topbar">
        <button class="icon-btn" @click="closeShop">‹</button>
        <h2>{{ t('shop.title') }}</h2>
        <span class="coin-chip coin-chip-static">💰 {{ state.wallet.balance || 0 }}</span>
      </header>
      <div class="shop-body">
        <p class="shop-intro">{{ t('shop.intro') }}</p>
        <div class="shop-wip-banner">🚧 {{ t('shop.wip') }}</div>
        <div class="shop-grid">
          <div v-for="it in SHOP_ITEMS" :key="it.id" class="shop-card disabled">
            <span class="shop-card-ic">{{ it.icon }}</span>
            <span class="shop-card-name">{{ t('shop.item.'+it.id) }}</span>
            <span class="shop-card-soon">{{ t('shop.soon') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ SETTINGS ══ -->
    <section v-else-if="state.screen==='settings'" class="screen settings">
      <header class="topbar">
        <button class="icon-btn" @click="closeSettings" :aria-label="t('common.back')">‹</button>
        <h2>{{ t(SETTINGS_SECTIONS.find(s => s.id===state.settingsTab)?.key || 'settings.title') }}</h2>
        <button class="icon-btn settings-menu-btn" @click="toggleSettingsDrawer" :aria-label="t('settings.menu')" :title="t('settings.menu')">☰</button>
      </header>

      <!-- Seitenleiste (Drawer) von links: ersetzt die früheren Top-Tabs -->
      <div v-if="state.settingsDrawerOpen" class="settings-drawer-backdrop" @click="state.settingsDrawerOpen=false"></div>
      <nav class="settings-drawer" :class="{ open: state.settingsDrawerOpen }" :aria-hidden="!state.settingsDrawerOpen">
        <div class="settings-drawer-title">{{ t('settings.title') }}</div>
        <button v-for="s in SETTINGS_SECTIONS" :key="s.id" class="settings-nav-item"
                :class="{ active: state.settingsTab===s.id }" @click="selectSettingsSection(s.id)">
          <span class="nav-ic">{{ s.ic }}</span><span>{{ t(s.key) }}</span>
        </button>
      </nav>

      <div class="settings-body">

        <!-- Sektion: Spiel (Spielhilfe, Anzeige im Spiel) -->
        <template v-if="state.settingsTab==='spiel'">
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

          <div class="set-group-title">{{ t('settings.gameDisplay') }}</div>
          <div class="set-row" @click="toggleSetting('showTimer')">
            <span>{{ t('settings.showTimer') }}</span><span class="switch" :class="{on:state.settings.showTimer}"><i></i></span>
          </div>
          <div class="set-row" @click="toggleSetting('coopRemovedOutline')">
            <span>{{ t('settings.coopRemovedOutline') }}</span><span class="switch" :class="{on:state.settings.coopRemovedOutline}"><i></i></span>
          </div>
          <small class="set-hint">{{ t('settings.coopRemovedOutlineHint') }}</small>
        </template>

        <!-- Sektion: Darstellung (Theme, Sprache, Barrierefreiheit) -->
        <template v-else-if="state.settingsTab==='darstellung'">
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

          <div class="set-group-title">{{ t('settings.a11y') }}</div>
          <div class="set-row" @click="toggleSetting('colorBlindMode')">
            <span>{{ t('settings.colorBlindMode') }}</span><span class="switch" :class="{on:state.settings.colorBlindMode}"><i></i></span>
          </div>
          <small class="set-hint">{{ t('settings.colorBlindModeHint') }}</small>
        </template>

        <!-- Sektion: Farbe & Anpassung (eigene Farbe + dynamischer Skin) -->
        <template v-else-if="state.settingsTab==='farbe'">
          <div class="set-group-title">{{ t('settings.myColor') }}</div>
          <div class="set-row col">
            <div class="coop-swatches">
              <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" :title="t('common.pickColorTitle')" />
            </div>
            <small class="set-hint">{{ t('settings.colorHint') }}</small>
          </div>

          <!-- Dynamischer Skin (1.0): Code-Einlösung immer sichtbar; Editor nur, wenn freigeschaltet -->
          <div class="set-group-title skin-editor">{{ t('skin.title') }}</div>
          <template v-if="skinUnlocked">
            <div class="skin-preview-wrap">
              <div class="board skin-preview" :class="skinPreviewClasses" :style="skinPreviewVars">
                <div class="cell kept coop-mark" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">5</span></div>
                <div class="cell removed coop-mark-removed" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">3</span></div>
              </div>
            </div>
            <div class="set-row" @click="toggleSetting('skinEnabled')">
              <span>{{ t('skin.enabled') }}</span><span class="switch" :class="{on:state.settings.skinEnabled}"><i></i></span>
            </div>
            <div class="set-row col">
              <span class="set-row-label">{{ t('skin.style') }}</span>
              <div class="seg">
                <button :class="{active:state.settings.skinStyle==='solid'}" @click="setSetting('skinStyle','solid')">{{ t('skin.styleSolid') }}</button>
                <button :class="{active:state.settings.skinStyle==='gradient'}" @click="setSetting('skinStyle','gradient')">{{ t('skin.styleGradient') }}</button>
                <button :class="{active:state.settings.skinStyle==='rainbow'}" @click="setSetting('skinStyle','rainbow')">{{ t('skin.styleRainbow') }}</button>
              </div>
            </div>
            <div class="set-row col" v-if="state.settings.skinStyle==='gradient'">
              <span class="set-row-label">{{ t('skin.colors') }}</span>
              <div class="coop-swatches">
                <input type="color" class="swatch-custom" :value="state.settings.skinColor1 || state.settings.coopMyColor" @input="setSetting('skinColor1', $event.target.value)" />
                <input type="color" class="swatch-custom" :value="state.settings.skinColor2 || '#ffffff'" @input="setSetting('skinColor2', $event.target.value)" />
                <input type="color" class="swatch-custom" :value="state.settings.skinColor3 || '#000000'" @input="setSetting('skinColor3', $event.target.value)" />
                <button class="btn-link" @click="setSetting('skinColor1',''); setSetting('skinColor2',''); setSetting('skinColor3','')">{{ t('skin.resetColors') }}</button>
              </div>
              <small class="set-hint">{{ t('skin.colorsHint') }}</small>
            </div>
            <div class="set-row col">
              <span class="set-row-label">{{ t('skin.speed') }}</span>
              <input type="range" class="set-range" min="0" max="12" step="1" :value="state.settings.skinSpeed"
                     :style="{ '--rangePct': Math.round(state.settings.skinSpeed/12*100) + '%' }"
                     @input="setSetting('skinSpeed', parseFloat($event.target.value))" />
              <small class="set-hint">{{ state.settings.skinSpeed>0 ? t('skin.speedOn', { s: skinSpeedToDuration(state.settings.skinSpeed).toFixed(1) }) : t('skin.speedOff') }}</small>
            </div>
            <div class="set-row" v-if="state.settings.skinSpeed>0" @click="setSetting('skinDirection', state.settings.skinDirection==='cw' ? 'ccw' : 'cw')">
              <span>{{ t('skin.direction') }}</span><span class="account-role">{{ state.settings.skinDirection==='ccw' ? t('skin.ccw') : t('skin.cw') }}</span>
            </div>
            <div class="set-row col">
              <span class="set-row-label">{{ t('skin.glow') }}</span>
              <input type="range" class="set-range" min="0" max="16" step="1" :value="state.settings.skinGlow"
                     :style="{ '--rangePct': Math.round(state.settings.skinGlow/16*100) + '%' }"
                     @input="setSetting('skinGlow', parseFloat($event.target.value))" />
            </div>
            <div class="set-row col">
              <span class="set-row-label">{{ t('skin.thickness') }}</span>
              <input type="range" class="set-range" min="1" max="5" step="0.5" :value="state.settings.skinThickness"
                     :style="{ '--rangePct': Math.round((state.settings.skinThickness-1)/4*100) + '%' }"
                     @input="setSetting('skinThickness', parseFloat($event.target.value))" />
            </div>
            <div class="set-row col">
              <span class="set-row-label">{{ t('skin.applyTo') }}</span>
              <div class="seg">
                <button :class="{active:state.settings.skinApplyTo==='kept'}" @click="setSetting('skinApplyTo','kept')">{{ t('skin.applyKept') }}</button>
                <button :class="{active:state.settings.skinApplyTo==='removed'}" @click="setSetting('skinApplyTo','removed')">{{ t('skin.applyRemoved') }}</button>
                <button :class="{active:state.settings.skinApplyTo==='both'}" @click="setSetting('skinApplyTo','both')">{{ t('skin.applyBoth') }}</button>
              </div>
              <small class="set-hint">{{ t('skin.applyHint') }}</small>
            </div>
          </template>
          <template v-else>
            <small class="set-hint">{{ t('skin.lockedHint') }}</small>
            <div class="account-search">
              <input class="text-input" v-model="state.skinCodeInput" :placeholder="t('skin.codePlaceholder')" @keydown.enter="redeemSkinCode" />
              <button class="btn btn-primary" @click="redeemSkinCode">{{ t('skin.redeem') }}</button>
            </div>
          </template>
        </template>

        <!-- Sektion: Ton (Musik + Aktions-Sounds) -->
        <template v-else-if="state.settingsTab==='ton'">
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
          <div class="set-row" @click="toggleSetting('sfxToolSwitch')">
            <span>{{ t('settings.sfxToolSwitch') }}</span><span class="switch" :class="{on:state.settings.sfxToolSwitch}"><i></i></span>
          </div>
          <div class="set-row" @click="toggleSetting('sfxUndo')">
            <span>{{ t('settings.sfxUndo') }}</span><span class="switch" :class="{on:state.settings.sfxUndo}"><i></i></span>
          </div>
          <div class="set-row" @click="toggleSetting('sfxWin')">
            <span>{{ t('settings.sfxWin') }}</span><span class="switch" :class="{on:state.settings.sfxWin}"><i></i></span>
          </div>
          <div class="set-row" @click="toggleSetting('sfxLose')">
            <span>{{ t('settings.sfxLose') }}</span><span class="switch" :class="{on:state.settings.sfxLose}"><i></i></span>
          </div>
        </template>

        <!-- Sektion: Konto (Profil/Anzeigename + optionaler Account + Cloud-Sync) -->
        <template v-else-if="state.settingsTab==='konto'">
          <!-- Profil: Anzeigename (auch ohne Konto nutzbar, z.B. für Coop) -->
          <div class="set-group-title">{{ t('settings.profile') }}</div>
          <div class="set-row col">
            <span class="set-row-label">{{ t('settings.displayName') }}</span>
            <input class="text-input" v-model="state.settings.coopName" maxlength="32" :placeholder="t('common.namePlaceholder')" />
            <small class="set-hint">{{ t('settings.displayNameHint') }}</small>
          </div>

          <div class="set-group-title">{{ t('account.title') }}</div>
          <small class="set-hint">{{ t('account.intro') }}</small>

          <!-- Eingeloggt -->
          <template v-if="state.account.status==='in'">
            <div class="account-card">
              <div class="account-row"><span class="account-label">{{ t('account.username') }}</span>
                <span class="account-username">
                  <b>{{ state.account.username }}</b>
                  <button v-if="!state.account.usernameEditing" class="btn-link" @click="startUsernameEdit">{{ t('account.changeUsername') }}</button>
                </span>
              </div>
              <div v-if="state.account.usernameEditing" class="account-username-form">
                <input class="text-input" v-model="state.account.usernameDraft" maxlength="20" autocapitalize="none" autocomplete="off" :placeholder="t('account.newUsername')" @keydown.enter="doChangeUsername" />
                <div class="account-username-actions">
                  <button class="btn btn-primary btn-sm" :disabled="state.account.busy" @click="doChangeUsername">
                    <span v-if="state.account.busy"><span class="spinner-inline"></span></span><span v-else>{{ t('account.save') }}</span>
                  </button>
                  <button class="btn-link" @click="state.account.usernameEditing=false">{{ t('common.cancel') }}</button>
                </div>
                <small class="set-hint">{{ t('account.usernameHint') }}</small>
              </div>
              <div class="account-row" v-if="state.account.email"><span class="account-label">{{ t('account.email') }}</span><span>{{ state.account.email }}</span></div>
              <div class="account-row"><span class="account-label">{{ t('account.role') }}</span><span class="account-role" :class="{ admin: state.account.role==='admin' }">{{ state.account.role==='admin' ? t('account.roleAdmin') : t('account.roleUser') }}</span></div>
              <div class="account-sync" :class="'sync-'+state.account.syncState">
                <template v-if="state.account.syncState==='syncing'"><span class="spinner-inline"></span> {{ t('account.syncing') }}</template>
                <template v-else-if="state.account.syncState==='error'">⚠️ {{ state.account.syncErrorMsg || t('account.syncError') }}</template>
                <template v-else-if="state.account.lastSyncAt">{{ t('account.syncedAt', { time: fmtSyncTime(state.account.lastSyncAt) }) }}</template>
                <template v-else>☁️ {{ t('account.syncOn') }}</template>
              </div>
              <button class="btn btn-ghost btn-sm" :disabled="state.account.syncState==='syncing'" @click="doSyncNow">🔄 {{ t('account.syncNow') }}</button>
            </div>
            <button class="btn btn-ghost" :disabled="state.account.busy" @click="doSignOut">{{ t('account.signOut') }}</button>
            <button class="btn btn-danger-ghost" :disabled="state.account.busy" @click="doDeleteAccount">{{ t('account.deleteAccount') }}</button>

            <!-- Admin-Bereich (nur bei Rolle 'admin'; Rules erzwingen die Rechte serverseitig) -->
            <template v-if="state.account.role==='admin'">
              <div class="set-group-title">{{ t('admin.title') }}</div>
              <small class="set-hint">{{ t('admin.intro') }}</small>
              <div class="account-search">
                <input class="text-input" v-model="state.account.adminQuery" maxlength="20" :placeholder="t('admin.searchPlaceholder')" @keydown.enter="adminSearch" />
                <button class="btn btn-primary" :disabled="state.account.adminBusy" @click="adminSearch">{{ t('admin.search') }}</button>
              </div>
              <div v-if="state.account.adminResult" class="account-card">
                <div class="account-row"><span class="account-label">{{ t('account.username') }}</span><b>{{ state.account.adminResult.profile.username || state.account.adminResult.uid }}</b></div>
                <div class="account-row"><span class="account-label">{{ t('account.role') }}</span><span class="account-role" :class="{ admin: state.account.adminResult.profile.role==='admin' }">{{ state.account.adminResult.profile.role==='admin' ? t('account.roleAdmin') : t('account.roleUser') }}</span></div>
                <div class="account-row"><span class="account-label">{{ t('admin.dynamicSkin') }}</span><b>{{ state.account.adminResult.inventory && state.account.adminResult.inventory.dynamicColor ? '✅' : '—' }}</b></div>
                <div class="account-row"><span class="account-label">{{ t('admin.balance') }}</span><span>{{ (state.account.adminResult.wallet && state.account.adminResult.wallet.balance) || 0 }}</span></div>
                <div class="account-row"><span class="account-label">uid</span><span class="admin-uid">{{ state.account.adminResult.uid }}</span></div>
                <div class="admin-actions">
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminGrantSkin">🎁 {{ t('admin.grantSkin') }}</button>
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminRevokeSkin">{{ t('admin.revokeSkin') }}</button>
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminToggleRole">{{ state.account.adminResult.profile.role==='admin' ? t('admin.makeUser') : t('admin.makeAdmin') }}</button>
                </div>

                <!-- Username ändern -->
                <div class="admin-field">
                  <span class="set-row-label">{{ t('account.username') }}</span>
                  <div class="admin-field-row">
                    <input class="text-input" v-model="state.account.adminUsername" maxlength="20" autocapitalize="none" :placeholder="t('account.newUsername')" />
                    <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminChangeUsername">{{ t('account.save') }}</button>
                  </div>
                </div>
                <!-- Guthaben exakt setzen -->
                <div class="admin-field">
                  <span class="set-row-label">{{ t('admin.balance') }}</span>
                  <div class="admin-field-row">
                    <input class="text-input" type="number" inputmode="numeric" v-model="state.account.adminBalance" />
                    <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminSetBalance">{{ t('admin.setBalance') }}</button>
                  </div>
                </div>
                <!-- Beliebiges Inventar-Item -->
                <div class="admin-field">
                  <span class="set-row-label">{{ t('admin.item') }}</span>
                  <div class="admin-field-row">
                    <input class="text-input" v-model="state.account.adminItem" :placeholder="t('admin.itemPlaceholder')" />
                    <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminGrantAnyItem">🎁</button>
                    <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminRevokeAnyItem">🗑️</button>
                  </div>
                </div>
                <!-- Beliebiges Profilfeld -->
                <div class="admin-field">
                  <span class="set-row-label">{{ t('admin.profileField') }}</span>
                  <div class="admin-field-row">
                    <input class="text-input" v-model="state.account.adminFieldKey" :placeholder="t('admin.fieldKey')" />
                    <input class="text-input" v-model="state.account.adminFieldVal" :placeholder="t('admin.fieldValue')" />
                    <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminSetField">{{ t('account.save') }}</button>
                  </div>
                  <small class="set-hint">{{ t('admin.fieldHint') }}</small>
                </div>
                <!-- Passwort-Reset-Mail -->
                <div class="admin-field">
                  <span class="set-row-label">{{ t('admin.resetPw') }}</span>
                  <div class="admin-field-row">
                    <input class="text-input" type="email" inputmode="email" v-model="state.account.adminEmail" :placeholder="t('account.email')" />
                    <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminResetPw">📧</button>
                  </div>
                  <small class="set-hint">{{ t('admin.resetPwHint') }}</small>
                </div>
              </div>
              <p v-if="state.account.adminError" class="coop-error">{{ state.account.adminError }}</p>
            </template>
          </template>

          <!-- Nicht eingeloggt: Anmelden/Registrieren -->
          <template v-else>
            <div class="seg">
              <button :class="{active:state.account.mode==='in'}" @click="state.account.mode='in'; state.account.error=null; state.account.notice=null">{{ t('account.signIn') }}</button>
              <button :class="{active:state.account.mode==='up'}" @click="state.account.mode='up'; state.account.error=null; state.account.notice=null">{{ t('account.signUp') }}</button>
            </div>

            <template v-if="state.account.mode==='in'">
              <input class="text-input" type="email" inputmode="email" autocomplete="username" v-model="state.account.email_in" :placeholder="t('account.email')" />
              <input class="text-input" type="password" autocomplete="current-password" v-model="state.account.pw_in" :placeholder="t('account.password')" @keydown.enter="doSignIn" />
              <button class="btn btn-primary" :disabled="state.account.busy" @click="doSignIn">
                <span v-if="state.account.busy"><span class="spinner-inline"></span> {{ t('account.working') }}</span><span v-else>{{ t('account.signIn') }}</span>
              </button>
              <button class="btn-link" @click="doResetPassword">{{ t('account.forgot') }}</button>
            </template>
            <template v-else>
              <input class="text-input" type="email" inputmode="email" autocomplete="email" v-model="state.account.email_up" :placeholder="t('account.email')" />
              <input class="text-input" v-model="state.account.username_up" maxlength="20" autocomplete="username" :placeholder="t('account.usernamePlaceholder')" />
              <input class="text-input" type="password" autocomplete="new-password" v-model="state.account.pw_up" :placeholder="t('account.passwordNew')" @keydown.enter="doSignUp" />
              <button class="btn btn-primary" :disabled="state.account.busy" @click="doSignUp">
                <span v-if="state.account.busy"><span class="spinner-inline"></span> {{ t('account.working') }}</span><span v-else>{{ t('account.createAccount') }}</span>
              </button>
              <small class="set-hint">{{ t('account.usernameHint') }}</small>
            </template>
          </template>

          <p v-if="state.account.error" class="coop-error">{{ state.account.error }}</p>
          <p v-if="state.account.notice" class="account-notice">{{ state.account.notice }}</p>
        </template>

        <!-- Sektion: Daten & Sicherung (Export/Import, Recht, Löschen) — bewusst zuletzt -->
        <template v-else-if="state.settingsTab==='daten'">
          <div class="set-group-title">{{ t('settings.data') }}</div>
          <button class="btn btn-ghost" @click="doExport">{{ t('settings.exportBackup') }}</button>
          <label class="btn btn-ghost file-btn">{{ t('settings.importBackup') }}
            <input type="file" accept="application/json" @change="doImport" hidden>
          </label>
          <button class="btn btn-ghost" @click="doExportLog">{{ t('settings.exportLog') }}</button>
          <button class="btn btn-ghost" @click="state.modal='changelog'">{{ t('settings.changelog') }}</button>
          <a class="btn btn-ghost" href="./privacy.html" target="_blank" rel="noopener">{{ t('settings.privacyPolicy') }}</a>
          <a class="btn btn-ghost" href="./imprint.html" target="_blank" rel="noopener">{{ t('settings.imprint') }}</a>
          <button class="btn btn-danger-ghost" @click="doDeleteAllData">{{ t('settings.deleteAllData') }}</button>
        </template>
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
        <!-- Alle Versionen seit der zuletzt gesehenen (neueste oben, scrollbar). Bei
             nur einer neuen Version entfällt die Versions-Kopfzeile (eine einfache Liste). -->
        <ul v-if="whatsNewEntries.length <= 1" class="whatsnew"><li v-for="(it,i) in (whatsNewEntries[0]?.changes || [])" :key="i">✦ {{ it }}</li></ul>
        <div v-else class="changelog whatsnew-multi">
          <div v-for="e in whatsNewEntries" :key="e.version" class="cl-entry">
            <div class="cl-head"><b>v{{ e.version }}</b><span>{{ e.date }}</span></div>
            <ul><li v-for="(it,i) in e.changes" :key="i">✦ {{ it }}</li></ul>
          </div>
        </div>
        <button class="btn btn-primary" @click="dismissWhatsNew">{{ t('whatsnew.start') }}</button>
      </div>
    </div>

    <!-- Versions-Mismatch beim Start: lokale vs. Cloud-Daten unterscheiden sich → Auswahl -->
    <div v-if="state.syncConflict" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge sync-warn-badge">⚠️ {{ t('sync.mismatchBadge') }}</div>
        <h3>{{ t('sync.mismatchTitle') }}</h3>
        <p class="result-msg">{{ t('sync.mismatchBody') }}</p>
        <button class="btn btn-primary" :disabled="state.syncConflictBusy" @click="resolveSyncConflict('local')">
          <span class="sync-btn-tx"><b>{{ t('sync.keepLocal') }}</b><small>{{ t('sync.changedAt', { time: fmtSyncDateTime(state.syncConflict.localTs) }) }}</small></span>
        </button>
        <button class="btn btn-ghost" :disabled="state.syncConflictBusy" @click="resolveSyncConflict('cloud')">
          <span class="sync-btn-tx"><b>{{ t('sync.keepCloud') }}</b><small>{{ t('sync.changedAt', { time: fmtSyncDateTime(state.syncConflict.cloudTs) }) }}</small></span>
        </button>
      </div>
    </div>

    <!-- Feier-Modal: dynamischer Skin zur 1.0 freigeschaltet (erst NACH „Was ist neu",
         damit nicht zwei Modals übereinander liegen). -->
    <div v-if="state.skinJustUnlocked && !state.showWhatsNew" class="modal-bg">
      <div class="modal skin-unlock-modal">
        <div class="whatsnew-badge">{{ t('skin.unlockBadge') }}</div>
        <div class="skin-unlock-preview board" :class="skinPreviewClasses" :style="skinPreviewVars">
          <div class="cell kept coop-mark" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">1</span></div>
        </div>
        <h3>{{ t('skin.unlockTitle') }}</h3>
        <p class="result-msg">{{ t('skin.unlockBody') }}</p>
        <button class="btn btn-primary" @click="openSkinEditor">{{ t('skin.unlockCustomize') }}</button>
        <button class="btn btn-ghost" @click="dismissSkinUnlock">{{ t('skin.unlockLater') }}</button>
      </div>
    </div>

    <!-- Streak verlängert/gestartet — feuriger Feier-Screen nach dem ersten
         abgeschlossenen Spiel des Tages (analog zum "Gewonnen"-Screen). -->
    <div v-if="state.streakExtended" class="modal-bg">
      <div class="modal streak-modal extended">
        <div class="streak-emoji">🔥</div>
        <h3 class="streak-title">{{ t(state.streakExtended.continued ? 'streak.extendedTitle' : 'streak.startedTitle') }}</h3>
        <div class="streak-count"><b>{{ state.streakExtended.current }}</b><small>{{ t(state.streakExtended.current === 1 ? 'streak.dayLabel' : 'streak.daysLabel') }}</small></div>
        <div v-if="state.streakExtended.isNewRecord" class="highscore-badge">{{ t('streak.recordBadge') }}</div>
        <p class="streak-msg">
          {{ state.streakExtended.isNewRecord
              ? t('streak.recordPraise')
              : t('streak.bestLine', { best: state.streakExtended.best }) }}
        </p>
        <button class="btn btn-primary" @click="dismissStreakExtended">{{ t('streak.continue') }}</button>
      </div>
    </div>

    <!-- Streak verloren — gedämpfter Hinweis beim App-Start, wenn ein Tag fehlte. -->
    <div v-if="state.streakLostNotice" class="modal-bg">
      <div class="modal streak-modal lost">
        <div class="streak-emoji">💔</div>
        <h3 class="streak-title">{{ t('streak.lostTitle') }}</h3>
        <p class="streak-msg">{{ t('streak.lostBody', { best: state.streak.bestStreak }) }}</p>
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
function toggleTool() {
  state.tool = state.tool === 'pen' ? 'eraser' : 'pen';
  state.settings.confirmTool = state.tool;
  if (state.settings.sfxToolSwitch) Music.sfxToolSwitch();
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
  if (m.color) { st['--rc-h'] = m.color.h; st['--rc-s'] = m.color.s + '%'; st['--rc-l'] = m.color.l + '%'; st['--rc-ink'] = regionChipInk(m.color); }
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
window.addEventListener('pagehide', () => { persistGame(); if (state.account.status === 'in') Account.syncNow(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    pauseGame();
    persistGame();
    if (state.account.status === 'in') Account.syncNow();  // beim Schließen/Wegwischen sofort in die Cloud sichern
  } else if (document.visibilityState === 'visible') {
    // Der Browser löst den Wake Lock beim Verstecken → im Spiel neu anfordern,
    // damit der Bildschirm weiter wach bleibt und die Coop-Verbindung hält.
    if (state.screen === 'game') requestWakeLock();
    if (state.coop.active) Coop.ensurePresence({ name: state.settings.coopName, color: state.settings.coopMyColor, role: state.coop.role });
    if (state.account.status === 'in') doSyncNow();  // beim Zurückkehren frisch sichern (Status sichtbar)
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
