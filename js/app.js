// app.js — Coop Number Sums (Vue 3, esm-browser). Solo-Spiel; Coop folgt später.
import { createApp, reactive, computed, watch, nextTick, onMounted, markRaw, ref } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { DIFFICULTIES, DIFF_BY_ID, REGION_COLORS, COOP_COLORS, COOP_COLORS_CB, DEFAULT_GAME_OPTIONS, LIVES, HINTS, COOP_MAX_PLAYERS, DONATE_URL, regionChipInk, coinReward, coinMultiplier, coinBaseForIndex, coinStreakBonus, COIN_STREAK_STEP } from './config.js';
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
  loadProfile, saveProfile, loadInventory, grantInventory, revokeInventory,
  reconcileInventoryFromCloud, applyCloudWallet,
  loadWallet, grantCurrency, spendCurrency, loadWalletLog, noteWalletTransaction,
  setDataRev, setSyncedRev,
  generateId, deviceId, isGameCompleted, markGameCompleted, loadActiveGameBackup, saveActiveGameBackup,
} from './storage.js';
import { decideSessionSync, SESSION_SCHEMA, SESSION_STATUS } from './session.js';
import { WIN_EFFECTS, CONFETTI_ID, effectById, effectPrice, winEffectInvKey, ownsEffect, resolveActiveEffect } from './wineffects.js';
import { SHOP_CATS, SHOP_CATALOG, SKINPRESET_ITEMS, catItems, shopItemById, shopItemPrice, shopInvKey, ownsShopItem, resolveEquipped, applyPaletteFx } from './shopitems.js';
import { badgeMedalMarkup, hasBadgeMedal, badgeDefsMarkup, masterMedalMarkup } from './badgeart.js';
import { winShapeDefs, winShape, dragonMarkup, unicornMarkup, phoenixMarkup, rocketMarkup, discoMarkup } from './winshapes.js';
import { icon as customIcon, hasIcon } from './icons.js';
import { PRESTIGE, allPrestige, categoryProgress, prestigeBySym, isUnlocked, encodeBadge, decodeBadge, MASTER_BADGE, isMasterBadge, masterProgress, hasMasterBadge } from './prestige.js';
import * as Account from './account.js';
import { SKIN_ID, FOUNDER_ID, qualifiesForV1Skin, skinCodeMatches, skinSpeedToDuration, skinVars as buildSkinVars, skinClasses as buildSkinClasses } from './skins.js';
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
  net: (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : 'online', // globaler Netz-Status: 'online' | 'offline' | 'reconnecting'
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
  lastCoinMult: 1,               // Gesamt-Multiplikator des letzten Siegs (Coop·perfekt·Bestzeit·Streak); >1 → Bonus anzeigen
  lastStreakUsed: 0,             // Streak-Tage, die in den letzten Sieg-Multiplikator eingeflossen sind (>0 → Streak-Bonus anzeigen)
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
  saveSlot: 'solo',          // STABILE Speicher-Slot-Kennung ('solo'|'coop'|'race'), beim Laden gesetzt.
                             // persistGame()/quitToHome() entscheiden hierüber — NICHT über die transienten
                             // Flags coop.active/team.active, die bei Rejoin/Rollenwechsel kurz flackern können.
                             // So wird der Solo-Slot NIE von einem Coop-/Team-Spiel überschrieben.
  gameId: null,              // Identität der aktuellen Partie (über Geräte stabil) — für Multi-Device-Session + Belohnungs-Idempotenz.
  sessionRev: 0,             // zuletzt für diese gameId bekannte Cloud-Session-rev (Compare-and-Set-Basis).
  sessionReadonly: false,    // true, wenn ein anderes Gerät die Partie übernommen hat → Brett gesperrt bis „Hier weiterspielen".
  deviceNotice: null,        // { kind:'defunct'|'takeover'|'reload' } — Banner/Hinweis für Cross-Device-Ereignisse (null = keins).
  versionMismatch: null,     // { local:{coins,wins,ts}, cloud:{coins,wins,ts}, busy } — offener Versions-Mismatch-Dialog (offline vs. Cloud), sonst null.
  newHighscore: false,        // true, wenn beim letzten Sieg eine neue Bestzeit erzielt wurde
  wouldHaveBeenBest: false,   // true, wenn die Zeit ohne Fehler/Hinweise eine neue Bestzeit gewesen wäre
  hintWarnShown: false,       // true, sobald die einmalige Hinweis-Warnung dieser Partie bestätigt wurde
  hintNudge: null,            // aktiver sokratischer Hinweis { group:{kind,ref,target}, reason, rem, r, c, want }
                              // — highlightet die Gruppe + zeigt eine Leitfrage, OHNE die Zelle/Aktion zu verraten;
                              // erst ein zweiter Tipp auf den Hinweis-Knopf löst die Zelle wirklich auf.
  bestTimeNotice: null,       // Text der kurzen Top-Banner-Meldung "Bestzeit nicht mehr möglich"
  tool: 'pen',               // pen | eraser
  desktopKeyCapture: false,  // Einstellungen ▸ Desktop: wartet gerade auf einen Tastendruck zum Belegen?
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
    ffaMode: false,                // Host-Lobby-Toggle: Free-for-All (jeder gegen jeden, 3–4 Spieler) — Race-Familie mit N Gegnern
    raceMode: false,               // Host-Lobby-Toggle: Race-/Duell-Modus (1v1, getrennte Fortschritte) statt normalem Coop

    invitePickerOpen: false,       // Freunde-Auswahl zum Einladen in die Lobby offen?
    invitedUids: [],               // in dieser Lobby bereits eingeladene Freunde (uid)
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
    // Free-for-All (jeder gegen jeden, 3–4 Spieler): dieselbe Race-Mechanik
    // (eigenes Gitter, geteilter Seed, per-uid-Fortschritt), aber MEHRERE Gegner.
    // Der Transport (raceProgress/{uid}) ist bereits pro-Spieler; hier halten wir
    // die Liste aller Gegner statt genau eines. Die 1v1-Felder oben bleiben für
    // den klassischen 1v1-Ergebnis-/HUD-Text erhalten.
    ffa: false,             // true, wenn dieses Race-Match ein FFA (≥3 Spieler) ist
    opponents: [],          // [{ id, name, color, pct, mistakes, out }] — alle Gegner (ohne mich)
    winnerName: '',         // Name des ersten Fertigen (für den FFA-Ergebnis-Text)
    rematchPending: false,  // true nur nach einem beendeten Match bis zum nächsten Hosten --
                             // steuert, ob die Race-Lobby ihre eigene Schwierigkeitsauswahl
                             // nochmal zeigt (siehe rematchRace()/startHosting()).
  },

  // UI
  toast: null,
  modal: null,               // null | 'howto' | 'changelog' | 'confirm'
  confirm: null,             // { title, msg, onYes }
  showWhatsNew: false,
  whatsNewSince: null,       // zuletzt gesehene Version beim App-Start -> "Was ist neu" zeigt alle Einträge seither
  statsTab: 'allgemein',     // aktiver Reiter im Statistik-Screen: allgemein | solo | coop
  settingsTab: '',           // aufgeklappte Einstellungs-Karte ('' = alle zu; spiel | darstellung | farbe | ton | konto | daten). Bewusst NICHT persistiert — Einstellungen starten immer zugeklappt.
  // Optionaler Account (E-Mail+Username+PW, Cloud-Sync). Anonymous-first: ohne
  // Login bleibt alles lokal. status: 'anon' | 'in'; busy während Auth-Aktionen.
  account: {
    status: 'anon', uid: null, email: '', username: '', role: 'user',
    mode: 'in',              // Formular-Umschalter: 'in' (Anmelden) | 'up' (Registrieren)
    email_in: '', pw_in: '', email_up: '', username_up: '', pw_up: '',
    usernameEditing: false, usernameDraft: '',   // Username im Profil ändern
    usernameCheck: 'idle',   // Live-Eindeutigkeit: 'idle'|'checking'|'available'|'taken'|'invalid'|'unchanged'|'error'
    busy: false, error: null, notice: null,
    syncState: 'idle',       // 'idle' | 'syncing' | 'ok' | 'error' — sichtbarer Cloud-Sync-Status
    syncErrorMsg: '',        // konkrete Fehlermeldung des letzten fehlgeschlagenen Syncs
    lastSyncAt: 0,           // Zeitstempel der letzten erfolgreichen Cloud-Sicherung
    // Admin (nur sichtbar/aktiv bei role==='admin'; Rules erzwingen es serverseitig)
    adminConsoleOpen: false,  // Vollbild-Admin-Konsole (Nutzer-Tabelle) offen?
    adminUsers: [], adminFilter: '', adminEditUser: null, adminBusy: false, adminError: null,
    adminBalance: '', adminUsername: '', adminItem: '', adminFieldKey: '', adminFieldVal: '', adminEmail: '',
    adminBalanceMode: 'donate', // 'donate' (+) | 'subtract' (−) | 'target' (=) — Guthaben-Änderungsmodus
    adminBalanceAmount: '',     // Eingabe-Menge für den gewählten Modus
    adminNotify: true,        // Haken „Nutzer benachrichtigen" bei Geschenk/Entzug/Guthaben (nicht bei Selbst-Aktionen)
    pwNew1: '', pwNew2: '', pwFormOpen: false,  // „Passwort ändern“-Formular (neues Passwort 2×)
    // Daten-Editor im Bearbeiten-Modal (frischer /users/{uid}/data-Snapshot)
    adminData: null,          // geladener Snapshot (Quelle für die Sektions-Felder)
    adminDataLoading: false,
    adminDataDirty: {},       // pfad -> neuer Wert (ungespeicherte Änderungen)
    adminInvPending: {},      // itemId -> 'grant' | 'revoke' — GESTAGTE Inventar-Änderungen (erst bei „Speichern" gesendet)
    adminGiftPickerOpen: false, // kategorisierter Geschenk-Auswahl-Screen (wie Shop) offen?
    adminDataSection: null,   // aktuell aufgeklappte Sektion ('wallet' | 'stats' | …)
    adminJsonPath: null, adminJsonDraft: '', adminJsonError: null,  // JSON-Untereditor
  },
  // Freunde & Präsenz (nur mit Account nutzbar)
  friends: {
    open: false, tab: 'friends',   // 'friends' | 'leaderboard'
 addOpen: false, // -Popup „Freund hinzufügen" (im Kopf, statt Inline-Formular)
    addName: '', addBusy: false, addError: null, addNotice: null,
    list: [], requests: [], presence: {},   // presence: { uid: {online, game, lastActive} }
  },
  leaderboard: {
    diff: 'sehrleicht',        // aktuell angezeigte Schwierigkeit
    entries: [], loading: false,
  },
  lobbyInvites: [],            // eingehende Lobby-Einladungen von Freunden
  pendingLobbyInvite: null,    // aktuell als Banner angezeigte Einladung (Annehmen/Ablehnen)
  generating: false,
  paused: false,             // Pausenmodus (Feld verdeckt, Zeit gestoppt)
  resumeAvailable: null,     // gespeichertes Solo-Spiel (zum Fortsetzen)
  resumeAvailableCoop: null, // gespeichertes Coop-Spiel (zum Fortsetzen, separater Slot)
  winFx: null,                   // laufende Sieganimation { id, pieces, seq } | null (s. launchWinFx)
  prestigeOpen: false,           // Prestige-Screen (verdiente Abzeichen) offen?
  masterUnlock: false,           // Feier-Screen „Großmeister freigeschaltet" offen?
  chat: { open: false, messages: [], unread: 0, draft: '' },  // Multiplayer-Textchat (ephemer, in-memory)
  shopCategory: null,            // offene Shop-Kategorie ('winfx' | null = Kategorien-Übersicht)
  shopPreview: null,             // Item-Vorschau im Shop { cat, id } | null (▶ auf einer Karte, s. shopPreviewIt)
  walletLogOpen: false,          // Geldverlauf-Modal offen? (Transaktionshistorie)
  walletLog: [],                 // gecachte Transaktionsliste (neueste zuerst), s. openWalletLog
  adminNotice: null,             // aktuell angezeigte Admin-Benachrichtigung {id, kind, item|amount, from} (Modal)
  perfectWin: false,         // gradueller Konfetti-/Glanz-Effekt für makellose Siege
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
// Effektives Theme: manuelle Wahl gewinnt; 'auto' folgt dem System-Theme
// (prefers-color-scheme) — der Listener in init() wendet Systemwechsel live an.
function isDarkTheme() {
  const m = state.settings.themeMode;
  if (m === 'dark') return true;
  if (m === 'light') return false;
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) { return true; }
}
function applyTheme(previewThemeId) {
  // Ausgerüstetes Shop-Theme (komplette Farbwelt) hat Vorrang: es bestimmt die
  // Grundwelt (data-theme steuert Farbblind-Overrides & Co.) und liefert die
  // Browser-Chrome-Farbe. Ohne Theme gilt das eingebaute Hell/Dunkel (themeMode).
  // previewThemeId: temporäre Shop-Vorschau ohne Setting-Änderung (s. shopPreviewIt).
  const themeIt = shopItemById(previewThemeId !== undefined ? previewThemeId : shopEquippedId('theme'));
  const dark = themeIt ? themeIt.data.base === 'dark' : isDarkTheme();
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  if (themeIt) document.documentElement.setAttribute('data-apptheme', themeIt.id);
  else document.documentElement.removeAttribute('data-apptheme');
  document.documentElement.classList.toggle('colorblind', state.settings.colorBlindMode);
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', themeIt ? themeIt.data.top : (dark ? '#0b1020' : '#eef2f9'));
}
// Ausgerüstetes Sound-Paket beim Start scharf schalten (music.js hält es im Modul).
function applySfxPack() { Music.setSfxPack(shopEquippedId('sfx')); }
function applyMusicPack() { Music.setMusicPack(shopEquippedId('music')); }
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
  // Präsenz für Freunde aktualisieren (im Spiel vs. Menü) — nur wenn eingeloggt.
  if (state.account.status === 'in') pushPresence();
  // Beim Zurückkehren ins Hauptmenü die Rolle (u.a. Admin) frisch aus der Cloud
  // holen — gedrosselt (max. alle 30 s), damit ein neu gesetzter Admin-Status
  // ohne App-Neustart sichtbar wird. Der refreshAccount-Aufruf persistiert die
  // Rolle zudem lokal (siehe dort), sodass sie danach sofort verfügbar ist.
  if (screen === 'home' && state.account.status === 'in') maybeRefreshRole();
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
// true, solange eine ▶-Sound/Musik-Vorschau (Shop/Einstellungen) läuft — dann
// steuert die Vorschau die Wiedergabe selbst und updateMusic() greift NICHT ein
// (sonst würgt ein zwischenzeitlicher Aufruf die Vorschau ab oder stummt sie).
let soundPreviewActive = false;
// Shop-Untermenü „Klänge" (sfx) oder „Musik" (music): dort soll ALLES still sein
// (keine Menü-Musik, keine beiläufigen UI-Sounds) — nur die ▶-Vorschau macht Ton.
function inSoundShop() {
  return state.screen === 'shop' && (state.shopCategory === 'sfx' || state.shopCategory === 'music');
}
function updateMusic() {
  // „Alles stummschalten": Musik komplett aus (spart auch CPU) — die UI-Sounds
  // sind zusätzlich über den zentralen makeup-Gain (Music.setMuted) still.
  if (state.settings.muteAll) { Music.stop(); return; }
  // Läuft gerade eine Vorschau, die Wiedergabe NICHT anfassen; nur sicherstellen,
  // dass die UI-Sounds hörbar sind (die Vorschau räumt selbst wieder auf).
  if (soundPreviewActive) { Music.setSfxMuted(false); return; }
  const inActiveGame = state.screen === 'game' && state.status === 'playing'
    && !state.paused && !state.coop.awaitingStart;
  // Im Sound-Untermenü des Shops: Menü-Musik aus + beiläufige UI-Sounds stumm.
  const soundShop = inSoundShop();
  Music.setSfxMuted(soundShop);
  const shouldPlay = inActiveGame ? musicEnabledForMode(currentMusicMode()) : (state.settings.musicMenu && !soundShop);
  if (shouldPlay) Music.play(state.settings.musicVolume);
  else Music.stop();
}
// Ein-Klick „Alles stumm" (Home-Menü) — zusätzlich zur Master-Lautstärke.
function toggleMuteAll() {
  setSetting('muteAll', !state.settings.muteAll);
  Music.setMuted(state.settings.muteAll);
  updateMusic();
  log('app', 'Alles-Stumm umgeschaltet', { muted: state.settings.muteAll });
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
// Geräteübergreifend konsistente „Jetzt"-Zeit für den Spieltimer: in
// Mehrspielerpartien (Coop/Race/Team) die serverkorrigierte Zeit (Coop.serverNow),
// damit alle Geräte trotz abweichender lokaler Uhr denselben — und nie negativen —
// Timer zeigen. Solo bleibt reines Date.now() (Offset 0). Der Startzeitpunkt
// (state.startTime) MUSS mit derselben Uhr gestempelt werden, die ihn ausliest.
function gameNow() {
  return (state.coop.active || state.race.active || state.team.active) ? Coop.serverNow() : Date.now();
}
function startTimer() {
  stopTimer();
  if (state.status !== 'playing' || state.paused || state.coop.awaitingStart) return;
  timerHandle = setInterval(() => {
    state.elapsed = Math.max(0, gameNow() - state.startTime);
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
  state.elapsed = remoteElapsed != null ? remoteElapsed : Math.max(0, gameNow() - state.startTime); // einfrieren
  stopTimer();
  updateMusic();
  if (broadcast) {
    // Race: state.coop.active bleibt absichtlich false (siehe state.race-Kommentar),
    // coopSend() wäre hier also ein No-op -- analog zum MSG.START-Versand direkt
    // über Coop.send(), damit der Gegner trotzdem mitpausiert/-startet wird.
    if (state.race.active) Coop.send({ type: Coop.MSG.PAUSE, paused: true, elapsed: state.elapsed });
    else if (state.coop.active) coopSend({ type: Coop.MSG.PAUSE, paused: true, elapsed: state.elapsed });
  }
  persistGame();          // aktuellen Stand lokal sichern …
  syncCloudNow('pause');  // … und beim Pausieren sofort in die Cloud
}
function resumeFromPause(broadcast = true) {
  if (!state.paused) return;
  state.paused = false;
  state.startTime = gameNow() - state.elapsed; // Zeit fortsetzen
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
  { id: 'spiel',       ic: 'controller', key: 'settings.tabGame' },
  { id: 'darstellung', ic: 'theme', key: 'settings.secAppearance' },
  { id: 'farbe',       ic: 'palette', key: 'settings.secColors' },
  { id: 'ton',         ic: 'sound', key: 'settings.tabSound' },
  { id: 'konto',       ic: 'user', key: 'settings.tabAccount' },
  { id: 'daten',       ic: 'save', key: 'settings.tabData' },
];
// Münz-Belohnung einer Schwierigkeit für die Anzeige auf der Auswahlkarte
// (Basiswert; im Coop/Wettkampf verdoppelt). Perfekt-Bonus bleibt bewusst außen
// vor, da er erst beim Sieg feststeht.
function coinFor(d, coopish) {
  return coinReward(DIFFICULTIES.indexOf(d), { coop: !!coopish });
}

// ─── SLIDER-SCHWIERIGKEITSAUSWAHL ─────────────────────────────────────────────
// Die Auswahl läuft über EINEN Slider statt eine Kartenwand — in ALLEN Modi
// (Solo-Setup + Coop/Race/Team-Lobby). Die gemeinsame Optik/Logik steckt in der
// wiederverwendbaren Vue-Komponente <difficulty-slider> (s. DifficultySlider
// weiter unten). Hier nur die Morph-Variablen für den Hintergrund einer Stufe:
// der Container (Solo-Section bzw. Coop-Karte) setzt sie via :style, die
// registrierten @property-Vars (--dacc/--dacc-d/--dheat, styles.css) vererben in
// die Komponente und morphen den Verlauf smooth. NICHT das app-weite --accent.
function diffVars(id) {
  const d = DIFF_BY_ID[id] || DIFFICULTIES[0];
  return { '--dacc': d.accent, '--dacc-d': d.accentD, '--dheat': String(d.heat) };
}
// Streak-Münz-Bonus in Prozent (für die Anzeige, z.B. Streak 5 ⇒ 25).
function streakBonusPct(streak) {
  return Math.round(coinStreakBonus(streak) * 100);
}
// Shop öffnen/schließen (eigener Screen; Coins oben).
let shopReturn = null;
function openShop(category) {
  // Direkteinstieg in eine Kategorie erlaubt (z.B. Settings-Link „Shop ›"),
  // sonst startet der Shop in der Kategorien-Übersicht. WICHTIG: nur bekannte
  // Kategorie-Strings akzeptieren — @click="openShop" übergibt sonst das
  // Click-EVENT als „Kategorie" und der Kategorie-Zweig rendert mit Unsinn.
  const valid = category === 'winfx' || !!SHOP_CATS[category];
  state.shopCategory = valid ? category : null;
  if (state.screen === 'shop') { updateMusic(); return; }
  shopReturn = state.screen;
  navigate('shop'); // ruft updateMusic() → Sound-Untermenü ggf. sofort still
}
function closeShop() { const b = shopReturn || 'home'; shopReturn = null; state.shopCategory = null; navigate(b); }
// Kategorie öffnen/schließen — Zurück in der Kategorie führt zur Übersicht, nicht raus.
// updateMusic() nach jedem Kategoriewechsel, damit das Sound-Untermenü (sfx/music)
// die Menü-Musik + UI-Sounds sofort stummt bzw. beim Verlassen wieder freigibt.
function openShopCategory(cat) {
  state.shopCategory = cat; state.shopPreview = null; updateMusic();
  if (cat === 'sfx' || cat === 'music') log('app', 'Shop-Sound-Untermenü: Ton isoliert (nur Vorschau)', { cat });
}
function closeShopCategory() { state.shopCategory = null; state.shopPreview = null; updateMusic(); }

// ── Geldverlauf (Transaktionshistorie) ────────────────────────────────────────
// Lädt die persistierte Liste (neueste zuerst) frisch beim Öffnen — so ist sie
// nach zwischenzeitlichen Käufen/Siegen/Geschenken aktuell.
function openWalletLog() { state.walletLog = loadWalletLog(); state.walletLogOpen = true; }
function closeWalletLog() { state.walletLogOpen = false; }
// Lesbarer Text zur maschinellen `reason`-Kennung einer Buchung. 'shop:<id>' und
// 'winfx:<id>'/'winfx_<id>' referenzieren ein gekauftes Item → dessen Namen zeigen.
function walletReasonLabel(reason) {
  if (!reason) return t('wallet.reason.other');
  const shopMatch = /^shop:(.+)$/.exec(reason);
  if (shopMatch) {
    const name = shopItemDisplayName(shopMatch[1]);
    return t('wallet.reason.purchase', { item: name || shopMatch[1] });
  }
  const key = 'wallet.reason.' + reason;
  const s = t(key);
  return s === key ? reason : s;
}
// Item-Anzeigename zur rohen Item-Kennung aus einem 'shop:<id>'-reason. Der Kauf
// speichert die ROHE Item-id (Sieganimation wie 'stars' oder generischer
// Shop-Artikel wie eine Paletten-id) — beide Namensräume der Reihe nach probieren.
function shopItemDisplayName(id) {
  const eff = t('shop.effect.' + id); if (eff !== 'shop.effect.' + id) return eff;
  const it = t('shop.it.' + id); if (it !== 'shop.it.' + id) return it;
  return id;
}

// ── Sieganimationen: erste echte Shop-Kategorie (Katalog: js/wineffects.js) ────
function ownsWinFx(id) { return ownsEffect(state.inventory, id); }
// EINE Quelle der Wahrheit für "welche Animation ist aktiv": dieselbe Auflösung
// wie im Shop (resolveActiveEffect). Der Settings-Picker MUSS diesen Wert nutzen
// (statt roh state.settings.winEffect), sonst können Einstellungen und Shop
// auseinanderlaufen, falls die gespeicherte Wahl (noch) nicht besessen ist —
// dann fällt der Shop auf Confetti zurück, das Settings-Dropdown zeigte aber den
// nicht-besessenen Rohwert. So sind beide garantiert verknüpft.
function activeWinFxId() { return resolveActiveEffect(state.settings.winEffect, state.inventory); }
function winFxActive(id) { return activeWinFxId() === id; }
// Liste der eigenen (kaufbaren + gekauften) Effekte für den Settings-Picker.
function ownedWinFx() { return WIN_EFFECTS.filter(e => ownsWinFx(e.id)); }
function buyWinFx(id) {
  if (ownsWinFx(id)) return;
  const price = effectPrice(id);
  const r = spendCurrency(price, 'shop:' + id);
  if (!r.ok) { showToast(t('shop.notEnough'), 'error', 2600); return; }
  state.wallet = loadWallet();
  state.inventory = grantInventory(winEffectInvKey(id), 'shop');
  setSetting('winEffect', id); // Gekauftes direkt aktivieren — das will man praktisch immer
  log('game', 'Sieganimation gekauft', { id, price, balance: r.balance });
  showToast(t('shop.bought'), 'success', 2400);
  if (state.account.status === 'in') Account.scheduleSyncUp();
}
function activateWinFx(id) {
  if (!ownsWinFx(id)) return;
  setSetting('winEffect', id);
  showToast(t('shop.activated'), 'success', 1800);
}
// Vorschau: spielt die Animation sofort auf dem aktuellen Screen ab (Overlay ist
// global) — ohne Kauf, ohne Sieg. Perfekt-Variante zeigt das volle Spektakel.
function previewWinFx(id) { launchWinFx(true, id); }

// ── Generische Shop-Artikel (Katalog: js/shopitems.js) ────────────────────────
// Gleiche Mechanik wie Sieganimationen: kaufen (Coins → Inventar, Union-synct),
// ausrüsten (settings[settingKey]), Gratis-Standard immer verfügbar.
function shopCatItems(cat) { return catItems(cat); }
function ownsShop(it) { return ownsShopItem(state.inventory, it); }
function shopEquippedId(cat) {
  const meta = SHOP_CATS[cat];
  return resolveEquipped(cat, meta && meta.settingKey ? state.settings[meta.settingKey] : null, state.inventory);
}
function shopOwnedCount(cat) { return catItems(cat).filter((it) => ownsShop(it)).length; }
function equipShopItem(it) {
  if (!ownsShop(it) || !SHOP_CATS[it.cat].settingKey) return;
  setSetting(SHOP_CATS[it.cat].settingKey, it.id);
  showToast(t('shop.activated'), 'success', 1800);
}
// ── Ausrüsten direkt in den Einstellungen ─────────────────────────────────────
// „Alles Erworbene ausrüstbar": je Shop-Kategorie ein Auswahl-Picker (Gratis-
// Standard + besessene Items). Wird pro Kategorie nur gezeigt, wenn man dort
// mindestens ein Item besitzt (sonst ist ohnehin nur der Standard aktiv).
// skinpreset ist ausgenommen (wird ANGEWENDET, nicht ausgerüstet — s. Skin-Editor).
function settingsVisualCats() { return ['theme', 'palette', 'font', 'frame'].filter((c) => shopOwnedCount(c) > 0); }
function settingsSoundCats() { return ['sfx', 'music'].filter((c) => shopOwnedCount(c) > 0); }
function settingsCatOptions(cat) {
  const meta = SHOP_CATS[cat];
  const opts = [{ id: meta.free, name: t('shop.free.' + cat) }];
  for (const it of catItems(cat)) if (ownsShop(it)) opts.push({ id: it.id, name: shopItemDisplayName(it.id) });
  return opts;
}
function equipCatFromSettings(cat, id) {
  const meta = SHOP_CATS[cat];
  if (id === meta.free) { equipShopFree(cat); return; }
  const it = shopItemById(id);
  if (it && it.cat === cat) equipShopItem(it);
}
// Hör-Vorschau eines Sound-Pakets: Paket kurz aktivieren, kleine Demo-Sequenz
// spielen, danach das ausgerüstete Paket wiederherstellen (auch ohne Kauf).
// soundPreviewActive + setSfxMuted(false) sorgen dafür, dass die Vorschau AUCH im
// Sound-Untermenü (wo UI-Sounds sonst stumm sind) hörbar ist; nach der Demo wird
// per updateMusic() der Ausgangszustand (Untermenü wieder still) hergestellt.
let sfxPreviewTimer = null;
function previewSfxPack(it) {
  soundPreviewActive = true;
  Music.setSfxMuted(false);
  Music.setSfxPack(it.id);
  Music.sfxKeep();
  setTimeout(() => Music.sfxComplete(2), 320);
  setTimeout(() => Music.sfxWin(), 760);
  clearTimeout(sfxPreviewTimer);
  sfxPreviewTimer = setTimeout(() => {
    Music.setSfxPack(shopEquippedId('sfx'));
    soundPreviewActive = false;
    updateMusic();
  }, 2600);
}
// Hör-Vorschau eines Musik-Pakets: Paket setzen + Musik kurz anspielen, danach
// das ausgerüstete Paket wiederherstellen. soundPreviewActive schützt die Vorschau
// davor, von einem zwischenzeitlichen updateMusic() gestoppt zu werden; am Ende
// stellt updateMusic() den Ausgangszustand her (Menü-Musik an, außer im Sound-
// Untermenü — dort bleibt es still). State/Settings bleiben unberührt.
let musicPreviewTimer = null;
function previewMusicPack(it) {
  soundPreviewActive = true;
  Music.setMusicPack(it.id);
  if (!Music.isPlaying()) Music.play(state.settings.musicVolume ?? 0.6);
  clearTimeout(musicPreviewTimer);
  musicPreviewTimer = setTimeout(() => {
    Music.setMusicPack(shopEquippedId('music'));
    soundPreviewActive = false;
    updateMusic();
  }, 5200);
}
function equipShopFree(cat) {
  if (!SHOP_CATS[cat].settingKey) return;
  setSetting(SHOP_CATS[cat].settingKey, SHOP_CATS[cat].free);
  showToast(t('shop.activated'), 'success', 1800);
}
// ── Item-Vorschau im Shop: JEDES Item vorher ansehen (auch ohne Kauf) ─────────
// Brett-Kategorien (palette/font/frame/skinpreset) rendern ein Live-Demo-Brett
// über den Karten; ▶ wählt das Vorschau-Item (Toggle), ohne Auswahl zeigt das
// Demo den ausgerüsteten Zustand. Badges → Namens-Chip; Sound → Hör-Demo;
// Theme → echte App-Optik wechselt für 4 s (danach zurück zum Ausgerüsteten).
function shopPreviewIt(it) {
  if (it.cat === 'sfx') { previewSfxPack(it); return; }
  if (it.cat === 'music') { previewMusicPack(it); return; }
  if (it.cat === 'theme') { previewThemeTemp(it.id); return; }
  const cur = state.shopPreview;
  state.shopPreview = (cur && cur.id === it.id) ? null : { cat: it.cat, id: it.id };
}
// ▶ auf der Gratis-Standard-Karte: Vorschau des eingebauten Defaults.
function shopPreviewFree(cat) {
  if (cat === 'sfx') { previewSfxPack({ id: SHOP_CATS.sfx.free }); return; }
  if (cat === 'music') { previewMusicPack({ id: SHOP_CATS.music.free }); return; }
  if (cat === 'theme') { previewThemeTemp(SHOP_CATS.theme.free); return; }
  const cur = state.shopPreview;
  const id = SHOP_CATS[cat].free;
  state.shopPreview = (cur && cur.id === id) ? null : { cat, id };
}
let themePreviewTimer = 0;
function previewThemeTemp(id) {
  applyTheme(id); // rein optisch, kein Setting — nach 4 s zurück zum Ausgerüsteten
  log('game', 'Theme-Vorschau', { id });
  showToast(t('shop.previewTheme'), 'info', 3600);
  clearTimeout(themePreviewTimer);
  themePreviewTimer = setTimeout(() => applyTheme(), 4000);
}
// Vorschau-Item einer Kategorie (▶-Auswahl), sonst der ausgerüstete Zustand.
function shopDemoId(cat) {
  if (state.shopPreview && state.shopPreview.cat === cat) return state.shopPreview.id;
  return cat === 'skinpreset' ? null : shopEquippedId(cat);
}
function shopDemoActive(it) { return !!(state.shopPreview && state.shopPreview.id === it.id); }
// Demo-Brett: 4 Cage-Farben in der Vorschau-Palette (classic = unverändert).
function shopDemoCells() {
  const it = shopItemById(shopDemoId('palette'));
  return [0, 2, 5, 9].map((i) => {
    const c = applyPaletteFx(REGION_COLORS[i], it ? it.fx : null);
    return `hsl(${c.h} ${c.s}% ${c.l}%)`;
  });
}
// Klassen fürs Demo-Brett (Zahlen-Stil/Rahmen); Gratis-Standard = keine Klasse.
function shopDemoClass(cat) {
  const id = shopDemoId(cat);
  if (!id || id === SHOP_CATS[cat].free) return '';
  return (cat === 'font' ? 'font-' : 'frame-') + id;
}
// Skin-Demo: Vorschau-Preset als Pseudo-Einstellungen rendern, sonst die
// aktuellen Skin-Einstellungen des Nutzers (wie in Einstellungen ▸ Farbe).
function shopDemoSkin() {
  const it = shopItemById(shopDemoId('skinpreset'));
  const s = it ? {
    skinStyle: it.data.style, skinColor1: it.data.c[0] || '', skinColor2: it.data.c[1] || '', skinColor3: it.data.c[2] || '',
    skinSpeed: it.data.speed, skinGlow: it.data.glow, skinThickness: it.data.thickness, skinApplyTo: 'both', skinDirection: 'cw',
  } : state.settings;
  return { vars: buildSkinVars(s), classes: buildSkinClasses(s, true) };
}
// Badge-Demo: eigener Name + Vorschau-/ausgerüstetes Abzeichen als Chip.
function shopDemoBadgeName() { return myUsername() || state.settings.coopName || '?'; }
// Anzeige-Elemente der Gratis-Standard-Karte („Klassisch"): dieselbe Vorschau
// wie auf den Kauf-Karten — Original-Cage-Farben bzw. die eingebaute Farbwelt.
function shopFreeDots(cat) {
  if (cat === 'palette') return [0, 3, 6, 9, 12, 15].map((i) => { const c = REGION_COLORS[i]; return `hsl(${c.h} ${c.s}% ${c.l}%)`; });
  if (cat === 'theme') return isDarkTheme() ? ['#0b1020', '#151b2e', '#4f7dff', '#e8ebf5'] : ['#eef2f9', '#ffffff', '#4f7dff', '#1c2333'];
  return null;
}
function buyShopItem(it) {
  if (ownsShop(it)) return;
  const price = shopItemPrice(it);
  const r = spendCurrency(price, 'shop:' + it.id);
  if (!r.ok) { showToast(t('shop.notEnough'), 'error', 2600); return; }
  state.wallet = loadWallet();
  state.inventory = grantInventory(shopInvKey(it), 'shop');
  if (SHOP_CATS[it.cat].settingKey) setSetting(SHOP_CATS[it.cat].settingKey, it.id); // direkt ausrüsten
  if (it.cat === 'skinpreset') applySkinPreset(it); // Gekauftes direkt anwenden
  log('game', 'Shop-Artikel gekauft', { id: it.id, cat: it.cat, price, balance: r.balance });
  showToast(t('shop.bought'), 'success', 2400);
  if (state.account.status === 'in') Account.scheduleSyncUp();
}
// 🎨 Skin-Vorlage anwenden: schreibt die Skin-Einstellungen (Stil/Farben/
// Tempo/Glow/Dicke) und schaltet den Skin ein. Frei kaufbar/anwendbar OHNE
// den exklusiven dynamischen Skin — der schaltet nur zusätzlich den freien
// Skin-EDITOR frei (Vorlagen-Besitz aktiviert das Rendering, s. skinActive).
function applySkinPreset(it) {
  if (!ownsShop(it)) return;
  const d = it.data || {};
  setSetting('skinStyle', d.style || 'gradient');
  setSetting('skinColor1', (d.c && d.c[0]) || '');
  setSetting('skinColor2', (d.c && d.c[1]) || '');
  setSetting('skinColor3', (d.c && d.c[2]) || '');
  if (d.speed != null) setSetting('skinSpeed', d.speed);
  if (d.glow != null) setSetting('skinGlow', d.glow);
  if (d.thickness != null) setSetting('skinThickness', d.thickness);
  setSetting('skinEnabled', true);
  log('game', 'Skin-Vorlage angewendet', { id: it.id });
  showToast(t('shop.applied'), 'success', 1800);
}
// Brett-Klasse des ausgerüsteten Zahlen-Stils ('' = Klassisch).
function boardFontClass() {
  const id = shopEquippedId('font');
  return id && id !== 'classic' ? 'font-' + id : '';
}
// Brett-Klasse des ausgerüsteten Rahmens ('' = keiner).
function boardFrameClass() {
  const id = shopEquippedId('frame');
  return id && id !== 'none' ? 'frame-' + id : '';
}
// Aktive Paletten-Transformation für cellStyle (null = Klassisch/unverändert).
function activePaletteFx() {
  const it = shopItemById(shopEquippedId('palette'));
  return it ? it.fx : null;
}
// Vorschau-Punkte einer Karte: Paletten zeigen 6 transformierte Cage-Farben,
// Themes ihre 4 Kern-Farben (bg, Karte, Akzent, Text); sonst keine Punkte.
function shopPreviewDots(it) {
  if (it.cat === 'palette') {
    return [0, 3, 6, 9, 12, 15].map((i) => {
      const c = applyPaletteFx(REGION_COLORS[i], it.fx);
      return `hsl(${c.h} ${c.s}% ${c.l}%)`;
    });
  }
  if (it.cat === 'theme') return it.data.sw;
  if (it.cat === 'skinpreset') {
    if (it.data.style === 'rainbow') return [0, 60, 120, 180, 240, 300].map((h) => `hsl(${h} 90% 55%)`);
    return it.data.c;
  }
  return null;
}
// Kategorie-Titel für die Shop-Topbar (Kategorie-Karten nutzen dieselben Keys).
function shopCategoryTitle(cat) {
  if (cat === 'winfx') return t('shop.winFxTitle');
  if (cat === 'palette') return t('shop.item.boardPalettes');
  if (cat === 'theme') return t('shop.item.appThemes');
  if (cat === 'sfx') return t('shop.item.soundPacks');
  if (cat === 'music') return t('shop.item.musicPacks');
  if (cat === 'font') return t('shop.item.numberFonts');
  if (cat === 'frame') return t('shop.item.boardFrames');
  if (cat === 'skinpreset') return t('shop.item.skinPresets');
  return t('shop.title');
}

function openSettings() {
  if (state.screen === 'settings') return;
  settingsReturn = state.screen;
  if (state.screen === 'game') pauseGame();
  // Immer zugeklappt starten — die zuletzt offene Karte wird bewusst nicht
  // gemerkt (Deep-Links wie „Konto" setzen ihre Karte direkt NACH dem Öffnen).
  state.settingsTab = '';
  navigate('settings');
}
// Sektion direkt öffnen (Deep-Links von Home: Konto, Skin-Editor). Beim Konto
// zusätzlich den Account-Status auffrischen (wie zuvor beim Tab-Klick).
function selectSettingsSection(id) {
  state.settingsTab = id;
  if (id === 'konto') refreshAccount();
}
// Accordion-Karte auf-/zuklappen (der frühere Drawer entfällt — alle Bereiche
// sind als Karten-Köpfe direkt auf der Seite sichtbar). Erneuter Tap schließt.
function toggleSettingsCard(id) {
  if (state.settingsTab === id) { state.settingsTab = ''; return; }
  selectSettingsSection(id);
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
  // Diagnose: eigene Uhr-Abweichung zur (server-korrigierten) Startzeit festhalten
  // — so lässt sich ein „falsche/negative Zeit"-Report im Protokoll nachvollziehen.
  log('coop', 'Coop-Timer gestartet', { startTime, localNow: Date.now(), serverNow: gameNow(), skewMs: gameNow() - Date.now() });
  startTimer();
  updateMusic();
  syncCloudNow('coopStart'); // Runden-Start: Stand sofort in die Cloud
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
  // Serverkorrigierter Startzeitpunkt (siehe gameNow): der Host stempelt hier mit
  // derselben Server-Uhr, gegen die alle Clients ihre Spielzeit rechnen — sonst
  // ergab die Uhr-Abweichung des Hosts bei Gästen eine falsche/negative Zeit.
  const startTime = gameNow();
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
    syncCloudNow('gameStart'); // Solo-Start: frisches Spiel sofort in die Cloud
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
  resetChat();  // Chat ist pro Partie frisch (ephemer)
  // Speicher-Slot JETZT festnageln (die Aufrufer setzen coop/team/race VOR diesem
  // Aufruf korrekt) — immun gegen späteres Flackern von coop.active bei Rejoin/
  // Rollenwechsel. Team läuft (wie Coop) im Coop-Slot; Race wird nie persistiert.
  state.saveSlot = state.race.active ? 'race' : (state.coop.active || state.team.active) ? 'coop' : 'solo';
  log('game', 'loadPuzzle: saveSlot festgelegt', { slot: state.saveSlot, coop: state.coop.active, team: state.team.active, race: state.race.active });
  // Partie-Identität: beim Fortsetzen die gespeicherte gameId behalten, sonst eine
  // neue erzeugen (Multi-Device-Session + Belohnungs-Idempotenz). sessionRev-Basis
  // frisch: ein fortgesetztes Spiel kennt seine Cloud-rev erst nach dem Reconcile.
  state.gameId = (saved && saved.gameId) || generateId();
  state.sessionRev = 0;
  state.sessionReadonly = false;
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
  state.startTime = saved?.startTime ?? (gameNow() - state.elapsed);
  state.zoom = 1;
  computeCellSize();
  // .board-wrap existiert beim ersten Aufruf (vor dem nächsten Vue-Render) noch
  // nicht im DOM -- der nextTick-Nachschlag korrigiert die Fallback-Schätzung,
  // sobald die echte Größe (Hoch- oder Querformat) feststeht. Zusätzlich ab jetzt
  // per ResizeObserver auf .board-wrap dauerhaft nachziehen (Layout-Settle,
  // Adressleiste, Rotation) → Brett bleibt immer vollständig eingepasst.
  nextTick(() => { computeCellSize(); observeBoardWrap(); });
  persistGame();
}

// ─── ZELLGRÖSSE (responsiv + Zoom) ────────────────────────────────────────────
// Misst die tatsächlich verfügbare Fläche von .board-wrap (Breite UND Höhe),
// damit Zellen im Querformat (wo die Höhe statt der Breite limitiert) nicht zu
// groß werden. Vor dem ersten Render (DOM noch nicht da) greift ein grober
// Fallback über window.innerWidth/-Height, den der nextTick-Aufruf in
// loadPuzzleIntoState() danach durch die echte Messung ersetzt.
// Desktop = Maus-Zeiger + breites Fenster. Muss zur gleichnamigen CSS-Media-
// Query (.app.app-game-Breite) passen, damit JS-Zellgröße und CSS-Breite
// dieselbe Fläche annehmen.
function desktopBoard() {
  try { return window.matchMedia && window.matchMedia('(min-width: 720px) and (pointer: fine)').matches; }
  catch (_) { return false; }
}
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
  // Aktiver Brett-Rahmen legt außen einen 10px-Innenabstand um die Spielfläche
  // (2*10 = 20px je Achse, s. .board[class*="frame-"] in styles.css). Dieser
  // Platz muss VOR der Zellgröße abgezogen werden, sonst wird das Brett um 20px
  // breiter/höher als der verfügbare Raum und ragt aus dem Bildschirm.
  const framePad = boardFrameClass() ? 20 : 0;
  availW -= framePad; availH -= framePad;
  const idealW = Math.floor(availW / (cols + 1)); // +1 für Kopfspalte
  const idealH = Math.floor(availH / (rows + 1)); // +1 für Kopfzeile
  const ideal = Math.min(idealW, idealH);
  // Am Handy deckelt die Auto-Einpassung die Zellgröße bei 56px (sonst wirken
  // die Zellen bei kleinen Brettern auf hohen Displays riesig). Am DESKTOP
  // (Maus + breites Fenster) darf das Brett dagegen den ganzen verfügbaren
  // Platz nutzen — dort ist .app.app-game breiter (s. styles.css), also greift
  // ein höherer Deckel, damit das Feld standardmäßig groß ist und beim Zoomen
  // erst am Fensterrand (statt am schmalen Mobil-Rahmen) beschnitten wird.
  // Deckel: Handy 56px (sonst wirken kleine Bretter auf hohen Displays riesig),
  // Desktop 128px (breite .app.app-game, s. styles.css).
  const cap = desktopBoard() ? 128 : 56;
  // KEIN hoher Mindestwert mehr: Beim Öffnen MUSS das ganze Brett passen — lieber
  // kleine Zellen als eine abgeschnittene Zeile/Spalte. Der frühere 26px-Boden
  // ließ das größte Brett (14×14 = 15 Einheiten) auf schmalen Handys eine Spalte
  // aus dem Bild ragen. Nur ein winziger Boden gegen 0 in Extremfällen.
  const base = Math.max(10, Math.min(cap, ideal));
  state.cellPx = Math.round(base * state.zoom);
}
// Beobachtet die tatsächliche Größe von .board-wrap und passt die Zellgröße neu
// an, sobald sie sich ändert (Layout-Settle nach dem Öffnen, Adressleiste ein-/
// ausblenden, Rotation, Sidebar). So ist das Brett IMMER sofort vollständig
// eingepasst — die erste (evtl. noch nicht ausgemessene) Berechnung wird direkt
// korrigiert, kein Zeilen/Spalten-Overflow beim Start/Fortsetzen.
let boardResizeObserver = null;
function observeBoardWrap() {
  try {
    if (typeof ResizeObserver !== 'function') return;
    const wrap = document.querySelector('.board-wrap');
    if (!wrap) return;
    if (!boardResizeObserver) boardResizeObserver = new ResizeObserver(() => computeCellSize());
    else boardResizeObserver.disconnect();
    boardResizeObserver.observe(wrap);
  } catch (_) {}
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
  // Long-Press-Zurücknahme gab es nur im entfernten „Beim Prüfen"-Modus. Fehler
  // werden jetzt immer sofort aufgedeckt (falsche Markierung greift gar nicht
  // erst), daher gibt es nichts zurückzunehmen → Feature deaktiviert.
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
  // Nur-Lese: ein anderes Gerät hat diese Solo-Partie übernommen — Brett gesperrt,
  // bis der Nutzer im Banner „Hier weiterspielen" wählt (holt den Besitz zurück).
  if (state.sessionReadonly) return;
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

  // Fehler werden IMMER sofort aufgedeckt: eine falsche Markierung wird gar nicht
  // erst gesetzt, sondern rot geblitzt und als Fehler gezählt.
  if (user) {
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
  // Leben sind immer aktiv: jeder Fehler zieht ein Leben ab.
  state.lives--;
  if (state.coop.active) state.coop.lifeLossBy.push(by);
  showBestTimeNotice(t('game.lifeLostNotice'));
  if (state.lives <= 0) { state.lives = 0; lose(); }
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
  // Leben sind immer aktiv (siehe registerMistake).
  for (let i = 0; i < n; i++) {
    state.lives--;
    state.coop.lifeLossBy.push(by);
    showBestTimeNotice(t('game.lifeLostNotice'));
    if (state.lives <= 0) { state.lives = 0; lose(); return; }
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
  // FFA: Fortschritt/Fehler ALLER Gegner aus der per-uid-Map aktualisieren.
  if (state.race.ffa) {
    for (const o of state.race.opponents) {
      const p = progressByUid[o.id];
      if (p) { o.pct = p.pct || 0; o.mistakes = p.mistakes || 0; }
    }
  }
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
  // Leben sind immer aktiv.
  state.lives--;
  if (state.coop.active) state.coop.lifeLossBy.push(by);
  showBestTimeNotice(t('game.lifeLostNotice'));
  if (state.lives <= 0) { state.lives = 0; lose(); return; }
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
// Ausgangs-Puffer für die Roster-Lücke: ist ein Mitspieler kurz weg
// (connected=false), werden eigene Züge NICHT mehr stillschweigend verworfen
// (das ließ die Bretter unbemerkt auseinanderlaufen — „halbe Lobby"), sondern
// gepuffert und beim Wiederauftauchen in Originalreihenfolge nachgesendet.
// Eigene Socket-Ausfälle puffert das Firebase-SDK ohnehin selbst.
let coopOutbox = [];
const COOP_OUTBOX_MAX = 300;
function coopSend(msg) {
  if (!state.coop.active) return;
  if (!state.coop.connected) {
    coopOutbox.push(msg);
    if (coopOutbox.length > COOP_OUTBOX_MAX) coopOutbox.shift();
    return;
  }
  if (state.team.active) Coop.sendTeamEvent(state.team.myTeam, msg);
  else Coop.send(msg);
}
function flushCoopOutbox() {
  if (!coopOutbox.length) return;
  const pending = coopOutbox; coopOutbox = [];
  log('coop', `Sende ${pending.length} gepufferte Züge nach Roster-Heilung nach`);
  for (const m of pending) {
    if (state.team.active) Coop.sendTeamEvent(state.team.myTeam, m);
    else Coop.send(m);
  }
}

// ─── Multiplayer-Chat ─────────────────────────────────────────────────────────
// Läuft über die room-weiten Events (Coop.send) — erreicht in ALLEN Modi
// (Coop, Race/1v1, FFA, Team) alle im Raum. Nachrichten sind ephemer (nur
// in-memory), werden pro Partie geleert. Der Absender empfängt sein eigenes
// Event NICHT zurück (coop.js filtert author===uid), daher lokal einfügen.
const CHAT_MAX = 120;      // Ringpuffer-Länge
const CHAT_TEXT_MAX = 300; // max. Zeichen je Nachricht
function isMultiplayer() { return !!(state.coop.active || state.race.active || state.team.active); }
function chatSenderName() { return myUsername() || state.settings.coopName || t('chat.anon'); }
function pushChatMessage(m) {
  const msgs = state.chat.messages;
  msgs.push(m);
  if (msgs.length > CHAT_MAX) msgs.splice(0, msgs.length - CHAT_MAX);
  if (!state.chat.open && !m.self) state.chat.unread = Math.min(99, state.chat.unread + 1);
  if (state.chat.open) nextTick(scrollChatToEnd);
}
function receiveChat(msg) {
  const text = String(msg.text || '').slice(0, CHAT_TEXT_MAX);
  if (!text) return;
  pushChatMessage({ uid: msg.author || null, name: String(msg.name || t('chat.anon')).slice(0, 40), color: msg.color || null, badge: msg.badge || null, text, self: false, ts: Date.now() });
  if (state.settings.sfxHint) Music.sfxHint();  // dezenter Ton für neue Nachricht
  log('coop', 'Chat empfangen', { len: text.length });
}
function sendChat() {
  const text = String(state.chat.draft || '').trim().slice(0, CHAT_TEXT_MAX);
  if (!text || !isMultiplayer()) return;
  const name = chatSenderName();
  const color = state.settings.coopMyColor;
  const badge = myBadge();
  Coop.send({ type: Coop.MSG.CHAT, name, color, badge, text });  // room-weit (auch im Team-Modus an alle 4)
  pushChatMessage({ uid: state.coop.myId, name, color, badge, text, self: true, ts: Date.now() });
  state.chat.draft = '';
  log('coop', 'Chat gesendet', { len: text.length });
}
function scrollChatToEnd() {
  const el = document.querySelector('.chat-msgs');
  if (el) el.scrollTop = el.scrollHeight;
}
function openChat() { state.chat.open = true; state.chat.unread = 0; nextTick(() => { scrollChatToEnd(); document.querySelector('.chat-input')?.focus(); }); }
function closeChat() { state.chat.open = false; }
function toggleChat() { state.chat.open ? closeChat() : openChat(); }
function resetChat() { state.chat.messages = []; state.chat.unread = 0; state.chat.open = false; state.chat.draft = ''; }

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
    hostRegisterPlayer(msg.author, msg.name, msg.color, msg.username, msg.badge);
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
        const newHostName = playerLabel(msg.players.find(p => p.id === msg.hostId)) || t('common.defaultPlayerName');
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
    // Eigenen Endstand-Prozentwert für die Ergebnisanzeige festhalten (analog zu
    // RACE_DONE, Zeile darunter) -- ohne das blieb state.team.myPct auf der
    // empfangenden Seite stehen (0/veraltet) und der 2v2-Endscreen zeigte einen
    // falschen eigenen Prozentwert an.
    state.team.myPct = progressPct();
    if (state.status === 'playing') {
      const remote = { timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed };
      if (state.team.winningTeam === state.team.myTeam) win(remote);
      else lose(remote);
    }
  } else if (msg.type === Coop.MSG.RACE_START) {
    applyRaceStart(msg.seed, msg.difficulty);
  } else if (msg.type === Coop.MSG.RACE_DONE) {
    if (!state.race.active) return;
    if (msg.from === state.coop.myId) return; // eigenes Ergebnis wird lokal in win()/lose() behandelt
    // Endstand des Melders für die Ergebnis-Balken festhalten.
    const fin = state.race.opponents.find(o => o.id === msg.from);
    if (fin) { fin.pct = msg.finalPct ?? fin.pct; fin.mistakes = msg.finalMistakes ?? fin.mistakes; }
    if (msg.from === state.race.opponentId) {
      state.race.opponentPct = msg.finalPct ?? state.race.opponentPct;
      state.race.opponentMistakes = msg.finalMistakes ?? state.race.opponentMistakes;
    }
    if (state.race.ffa) {
      // FFA (jeder gegen jeden): nur ein GELÖSTES Spiel ("won") beendet das Match
      // für alle -- der erste Fertige gewinnt, alle anderen verlieren. Ein
      // Ausgeschiedener ("lost": Leben verloren/aufgegeben) fällt nur raus, die
      // Übrigen spielen weiter; bin danach nur noch ich übrig, gewinne ich.
      if (msg.outcome === 'won') {
        if (state.race.matchOver) return;
        state.race.matchOver = true;
        state.race.winner = 'opponent';
        state.race.endReason = 'won';
        state.race.winnerName = (fin && fin.name) || t('common.defaultPlayerName');
        state.race.myPct = progressPct();
        if (state.status === 'playing') lose({ timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
        return;
      }
      if (fin) fin.out = true;
      if (state.race.matchOver) return;
      if (state.race.opponents.every(o => o.out) && state.status === 'playing') {
        state.race.matchOver = true;
        state.race.winner = 'me';
        state.race.endReason = 'lost';
        state.race.winnerName = myUsername() || t('common.you');
        state.race.myPct = progressPct();
        win({ timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
      }
      return;
    }
    // Strikt 1v1: jede empfangene RACE_DONE stammt notwendig vom (einzigen)
    // Gegner und beendet das Match binär.
    if (state.race.matchOver) return;
    state.race.matchOver = true;
    state.race.winner = msg.outcome === 'won' ? 'opponent' : 'me';
    state.race.endReason = msg.outcome;
    state.race.myPct = progressPct();
    if (state.status === 'playing') {
      const remote = { timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed };
      if (state.race.winner === 'me') win(remote);
      else lose(remote);
    }
  } else if (msg.type === Coop.MSG.CHAT) {
    receiveChat(msg);
  }
}

function coopReset() {
  coopIntentionalLeave = true;
  coopOutbox = [];
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
  state.coop.ffaMode = false;
  state.coop.invitePickerOpen = false; state.coop.invitedUids = [];
  state.team.active = false; state.team.myTeam = null; state.team.matchOver = false;
  state.team.winningTeam = null; state.team.endReason = null; state.team.opponentPct = 0; state.team.opponentMistakes = 0; state.team.myPct = 0;
  state.team.opponentMistakesByPlayer = {};
  state.race.active = false; state.race.opponentId = null; state.race.opponentName = '';
  state.race.opponentColor = '#888'; state.race.matchOver = false; state.race.winner = null; state.race.endReason = null;
  state.race.myPct = 0; state.race.opponentPct = 0; state.race.opponentMistakes = 0;
  state.race.ffa = false; state.race.opponents = []; state.race.winnerName = '';
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
function upsertPlayer(id, name, requestedColor, username, badge) {
  const others = state.coop.players.filter(p => p.id !== id);
  const color = pickAvailableColor(requestedColor, others);
  const existing = state.coop.players.find(p => p.id === id);
  state.coop.players = [...others, { id, name: (name || '').trim() || t('common.defaultPlayerName'), color, username: (username || existing?.username || '').trim(), badge: badge ?? existing?.badge ?? null, team: existing?.team ?? null, ready: existing?.ready ?? false }];
  updateConnectedFlag();
}
// Ausgerüstetes Profil-Abzeichen als kodierte Prestige-ID "sym-tier" (z.B.
// "drache-3") oder null. Wird mit IDENTITY/Präsenz/Bestzeit mitgesendet;
// Fremd-Clients dekodieren (decodeBadge akzeptiert auch das alte Nur-Symbol-
// Format aus der gekauften Ära → als Stufe 1). Prestige-System: nicht mehr
// gekauft, sondern verdient (s. prestige.js / Prestige-Screen).
function myBadge() { const id = state.settings.profileBadge; if (isMasterBadge(id)) return id; return id && id !== 'none' && decodeBadge(id) ? id : null; }
// Prestige-Kontext für alle Kategorie-Berechnungen (aus den lokalen Statistiken).
function prestigeCtx() {
  return { stats: state.stats, streak: state.streak, race: state.raceStats,
    difficulties: DIFFICULTIES.map(d => d.id) };
}
// Selbstgezeichnete Abzeichen-Medaille (SVG-String) für eine kodierte Badge-ID
// ("sym-tier"). Überall gerendert (Home-Chip, Coop-Roster, Freunde, Bestenliste,
// Prestige-Screen). ribbon=true = große Medaille am Halsband. Unbekannt ⇒ ''.
function badgeSvg(id, ribbon = false) {
  if (isMasterBadge(id)) return masterMedalMarkup({ size: ribbon ? 96 : 40 });
  const b = decodeBadge(id);
  return b ? badgeMedalMarkup(b.sym, { tier: b.tier, ribbon, size: ribbon ? 96 : 40 }) : '';
}
// Ist die (kodierte) Badge-ID darstellbar? (für v-if in Templates)
function badgeShown(id) { return isMasterBadge(id) || !!decodeBadge(id); }
function badgeDefs() { return badgeDefsMarkup(); }

// ─── Prestige-Screen (verdiente Abzeichen) ────────────────────────────────────
function openPrestige() { state.prestigeOpen = true; log('app', 'Prestige geöffnet'); }
function closePrestige() { state.prestigeOpen = false; }
// Fortschritt aller Kategorien inkl. i18n-Name/Metrik-Label für die Anzeige.
function prestigeList() {
  return allPrestige(prestigeCtx()).map(p => ({
    ...p,
    name: t('prestige.cat.' + p.key),
    metricLabel: t('prestige.metric.' + p.key),
  }));
}
// Ist genau diese (Symbol, Stufe) aktuell ausgerüstet?
function isBadgeEquipped(sym, tier) { return state.settings.profileBadge === encodeBadge(sym, tier); }
// Höchste freigeschaltete Stufe einer Kategorie (0 = keine).
function earnedTier(sym) { const c = categoryProgress(prestigeBySym(sym), prestigeCtx()); return c.tier; }
// Eine freigeschaltete Stufe als Profil-Abzeichen ausrüsten (oder abnehmen).
function equipBadge(sym, tier) {
  if (!isUnlocked(sym, tier, prestigeCtx())) return;
  setSetting('profileBadge', encodeBadge(sym, tier));
  log('app', 'Abzeichen ausgerüstet', { sym, tier });
  afterBadgeChange();
}
function unequipBadge() { setSetting('profileBadge', 'none'); afterBadgeChange(); }
// Nach einer Abzeichen-Änderung: Coop-Identität/Präsenz mit neuem Badge auffrischen.
function afterBadgeChange() {
  if (state.coop.active && state.coop.myId) {
    Coop.send({ type: Coop.MSG.IDENTITY, name: state.settings.coopName, color: state.settings.coopMyColor, username: myUsername(), badge: myBadge() });
  }
  if (state.account.status === 'in') { Account.publishPresence(currentGameInfo(), myBadge()); Account.scheduleSyncUp(); }
}
function prestigeTierName(tier) { return tier ? t('prestige.tier.t' + tier) : t('prestige.locked'); }
// ── Master-Badge „Großmeister" ────────────────────────────────────────────────
function masterInfo() { return masterProgress(prestigeCtx()); }
function isMasterEquipped() { return isMasterBadge(state.settings.profileBadge); }
function equipMaster() {
  if (!hasMasterBadge(prestigeCtx())) return;
  setSetting('profileBadge', MASTER_BADGE);
  log('app', 'Großmeister ausgerüstet');
  afterBadgeChange();
}
// Einmalige Feier, sobald ALLE 12 Kategorien auf Legendär stehen. masterCelebrated
// (Settings, cloud-synct) verhindert Wiederholung; Alt-Spieler, die schon alles
// gemeistert haben, bekommen die Feier beim ersten Start nach dem Update EINMAL.
function checkMasterUnlock() {
  if (state.settings.masterCelebrated) return;
  if (!hasMasterBadge(prestigeCtx())) return;
  setSetting('masterCelebrated', true);
  state.masterUnlock = true;
  log('app', 'Großmeister freigeschaltet — alle 12 Kategorien auf Legendär');
  try { launchWinFx(true); } catch (_) {}   // große Feier-Animation (inkl. Fanfare)
}
function dismissMasterUnlock() {
  state.masterUnlock = false;
  // Direkt ausrüsten, damit der Nutzer sein neues Abzeichen sofort trägt.
  if (!isMasterEquipped()) equipMaster();
}
// Custom-Icon (SVG-String) für ein UI-Glyph — Emoji-Ersatz, per v-html gerendert.
// Unbekannte Namen ⇒ '' (nie rohen Fremdtext rendern). Größe/Farbe via CSS (.ico).
function ic(name) { return customIcon(name); }
// Eigener eindeutiger Account-Username (nur eingeloggt) — wird im Coop mitgesendet.
function myUsername() { return state.account.status === 'in' && state.account.username ? state.account.username : ''; }
// Anzeige „Anzeigename (username)" – nur wenn ein (abweichender) Account-Username bekannt ist.
function playerLabel(p) {
  if (!p) return '';
  const u = (p.username || '').trim();
  const n = (p.name || '').trim() || t('common.defaultPlayerName');
  return u && u.toLowerCase() !== n.toLowerCase() ? `${n} (${u})` : n;
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
  const was = state.coop.connected;
  state.coop.connected = state.coop.players.some(p => p.id !== state.coop.myId);
  // Mitspieler wieder da → während der Lücke gepufferte eigene Züge nachsenden.
  if (!was && state.coop.connected) flushCoopOutbox();
}
// Roster-Broadcast läuft unabhängig vom "Spiel aktiv"-Status (auch schon in der
// Lobby vor dem Start nötig) — bewusst über Coop.send direkt statt coopSend(),
// dessen Guard `state.coop.active` voraussetzt.
function broadcastRoster() {
  Coop.send({ type: Coop.MSG.ROSTER, players: state.coop.players, hostId: state.coop.hostId, teamMode: state.coop.teamMode });
}
// Host-Pfad: Spieler in den Roster aufnehmen + an alle verteilen. Wird sowohl
// von IDENTITY-Nachrichten als auch direkt vom players/-onChildAdded gespeist —
// Letzteres heilt den Fall, dass ein Mitspieler nach stillem Verbindungsabriss
// (Hintergrund/Standby) wieder auftaucht, ohne erneut IDENTITY zu senden (ältere
// App-Version): ohne Aufnahme bliebe connected=false und unsere Züge würden nie
// mehr gesendet. Toast nur beim ERSTEN Auftauchen; mitten im Spiel als
// „ist wieder da" statt „ist der Lobby beigetreten".
function hostRegisterPlayer(id, name, color, username, badge) {
  if (state.coop.role !== 'host' || !id || id === state.coop.myId) return;
  const known = state.coop.players.some(p => p.id === id);
  upsertPlayer(id, name, color, username, badge);
  broadcastRoster();
  if (!known) {
    const label = playerLabel({ name, username }) || t('common.defaultPlayerName');
    const midGame = state.coop.active && state.status === 'playing';
    showToast(t(midGame ? 'coop.partnerReconnected' : 'coop.playerJoinedLobby', { name: label }), midGame ? 'success' : 'info', 3000);
  }
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
  if (!isOnline()) { showToast(t('offline.unavailable'), 'error', 2600); return; }
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
  if (!isOnline()) { showToast(t('offline.unavailable'), 'error', 2600); return; }
  coopReset();
  state.coop.nameDraft = state.settings.coopName;
  state.coop.identityConfirmed = false;
  // Race-Familie (eigenes Gitter, geteilter Seed): 1v1 UND ffa. teamMode ist die
  // separate 2v2-Variante (geteiltes Gitter je Team). ffaMode unterscheidet das
  // FFA (≥3 Spieler) vom strikten 1v1 (Spielerzahl-Cap, Start-Gate, N Gegner).
  state.coop.teamMode = mode === '2v2';
  state.coop.ffaMode = mode === 'ffa';
  state.coop.raceMode = mode === '1v1' || mode === 'ffa';
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
function handleCoopConnection(online, isReconnect, currentHostId) {
  state.coop.online = online;
  if (!online) {
    log('coop', 'Eigene Verbindung verloren – zeige Offline-Status');
    showToast(t('coop.connectionLost'), 'info', 4000);
    return;
  }
  if (!isReconnect) return;
  log('coop', 'Eigene Verbindung wiederhergestellt');
  showToast(t('coop.reconnected'), 'success', 2000);
  // Warmer Reconnect: die eigene Anwesenheit hat coop.js schon neu gesetzt —
  // aber die MITSPIELER haben uns beim Abriss aus ihrem Roster entfernt
  // (onChildRemoved) und ihr connected-Flag steht auf false. Ohne erneute
  // Anmeldung entstand die „halbe Lobby": ihre Züge wurden nie mehr gesendet
  // (coopSend blockt bei connected=false), unsere kamen weiter an. Daher wie
  // beim kalten rejoin(): Rolle ggf. abgeben + IDENTITY neu melden, damit der
  // Host uns wieder aufnimmt und den Roster an alle verteilt.
  if (!state.coop.myId) return; // kein Raum aktiv (z.B. Verbindungs-Watch überlebt Teardown-Race)
  if (currentHostId && currentHostId !== state.coop.myId && state.coop.role === 'host') {
    state.coop.role = 'guest';
    state.coop.hostId = currentHostId;
    log('coop', 'Host-Rolle wurde während Abwesenheit übernommen – jetzt Gast', { newHost: currentHostId });
  }
  Coop.send({ type: Coop.MSG.IDENTITY, name: state.settings.coopName, color: state.settings.coopMyColor, username: myUsername(), badge: myBadge() });
  if (state.coop.role === 'host') broadcastRoster();
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
      upsertPlayer(id, state.settings.coopName, state.settings.coopMyColor, myUsername(), myBadge());
    },
    onError(e) {
      state.coop.waitingForGuest = false;
      state.coop.error = e.type === 'code-taken'
        ? t('coop.errorCodeTaken') : t('coop.errorConnection');
    },
    // Spieler direkt aus dem players-Snapshot aufnehmen (name/color stehen im
    // Präsenz-Eintrag) — die kurz darauf eintreffende IDENTITY-Nachricht ergänzt
    // nur noch den Account-Username. So heilt auch ein still abgerissener und
    // wieder auftauchender Mitspieler den Roster sofort (siehe hostRegisterPlayer).
    onJoin(id, data) {
      log('game', `Mitspieler (wieder) im Raum (Coop)`, { id });
      if (data && data.name) hostRegisterPlayer(id, data.name, data.color);
    },
    onLeave(id) {
      const leavingName = playerLabel(state.coop.players.find(p => p.id === id)) || t('common.defaultPlayerName');
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
  if (state.coop.role !== 'host') return false;
  // FFA (jeder gegen jeden): mind. 3 Spieler; strikt 1v1: genau 2.
  return state.coop.ffaMode ? state.coop.players.length >= 3 : state.coop.players.length === 2;
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
  const others = state.coop.players.filter(p => p.id !== state.coop.myId);
  state.race.ffa = !!state.coop.ffaMode;
  // Alle Gegner (im 1v1 genau einer). Der per-uid-Fortschritt (raceProgress/{uid})
  // wird pro Eintrag gepflegt (onRaceProgressUpdate); `out` markiert Ausgeschiedene
  // (Leben verloren/aufgegeben) im FFA — das Match läuft dann für die Übrigen weiter.
  state.race.opponents = others.map(p => ({ id: p.id, name: playerLabel(p) || '', color: p.color || '#888', pct: 0, mistakes: 0, out: false }));
  const opponent = others[0];
  state.race.opponentId = opponent?.id || null;
  state.race.opponentName = playerLabel(opponent) || '';
  state.race.opponentColor = opponent?.color || '#888';
  state.race.active = true;
  state.race.matchOver = false;
  state.race.winner = null;
  state.race.winnerName = '';
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
    maxPlayers: (state.coop.raceMode && !state.coop.ffaMode) ? 2 : COOP_MAX_PLAYERS,
    onOpen(id) {
      // Eigene ID dieser Session sichern und sofort dem Host die eigene Identität
      // melden — coopSend() blockt hier noch (state.coop.connected wird erst nach
      // der ersten ROSTER-Antwort true), daher direkt über die Transportschicht senden.
      state.coop.myId = id;
      upsertPlayer(id, state.settings.coopName, state.settings.coopMyColor, myUsername(), myBadge());
      Coop.send({ type: Coop.MSG.IDENTITY, name: state.settings.coopName, color: state.settings.coopMyColor, username: myUsername(), badge: myBadge() });
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
      const leavingName = playerLabel(state.coop.players.find(p => p.id === id)) || t('common.defaultPlayerName');
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
  if (state.race.ffa && outcome === 'lost') {
    // FFA: selbst ausgeschieden (Leben verloren/aufgegeben) -- das Match läuft für
    // die Übrigen weiter, deshalb 'out' statt eines Gegner-Siegs anzeigen.
    state.race.winner = 'out';
  } else {
    state.race.winner = outcome === 'won' ? 'me' : 'opponent';
    if (outcome === 'won') state.race.winnerName = myUsername() || t('common.you');
  }
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

// Führt cb NACH dem nächsten gepainteten Frame aus (zwei rAF = ein sicher
// gerenderter Frame dazwischen). So kann der Browser erst die Sieganimation +
// den Dialog painten, bevor schwere, den Main-Thread blockierende Arbeit läuft.
// Fallback (kein rAF, z.B. Tests): kurzer Timeout.
function afterPaint(cb) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(cb));
  } else {
    setTimeout(cb, 32);
  }
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
  // Sieganimation + Sieg-Sound SOFORT starten (Sound läuft in launchWinFx, an die
  // Animation/Stufe gekoppelt). Der Ergebnis-Dialog erscheint ebenfalls sofort —
  // KEIN Vorlauf mehr; die Animation liegt per z-index ohnehin ÜBER dem Dialog.
  launchWinFx((state.mistakes || 0) === 0 && (state.hintsUsed || 0) === 0);
  // Anzeige-Werte auf sichere Defaults, damit der sofort sichtbare Dialog keine
  // Werte des Vorspiels zeigt — die echten folgen unten (Münzen zählen von 0 hoch).
  state.lastCoinReward = 0;
  state.newHighscore = false;
  state.wouldHaveBeenBest = false;
  // Die gesamte (teils schwere) Buchhaltung — Streak, Statistik/Bestzeit, Münzen,
  // Verlauf, Achievements, Speichern, Cloud-Sync und Coop/Team/Race-Broadcasts —
  // läuft ERST NACH dem ersten gepainteten Frame. Vorher blockierte sie den
  // Main-Thread, BEVOR der Browser Animation + Dialog painten konnte → der
  // Auftakt ruckelte und „verschluckte" die erste Sekunde der Animation.
  afterPaint(() => {
    // Streak ZUERST buchen (vor der Münz-Belohnung), damit der heutige Sieg bereits
    // in der Streak steckt und der Streak-Münz-Multiplikator (+5% je Streak-Tag)
    // ihn mitzählt — z.B. 5er-Streak ⇒ +25%.
    if (!state.isTrainingGame) applyStreakAfterGame();
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
      // Shop-/Marktplatz-System; erscheint als „+X 💰" auf dem Sieg-Screen. Drei
      // Boni stapeln multiplikativ (kein Cap): Coop/Wettkampf ×2, makelloser Sieg
      // ×2, neue Bestzeit ×2 → bis ×8.
      const dIdx = DIFFICULTIES.findIndex(d => d.id === state.puzzle.difficulty);
      const perfect = state.mistakes === 0 && state.hintsUsed === 0;
      const isCoopish = state.coop.active || state.isRaceGame || state.team.active;
      // Streak-Bonus (+5% je Streak-Tag, additiv) fließt in den Gesamt-Multiplikator
      // ein — applyStreakAfterGame() lief oben bereits, state.streak ist aktuell.
      const streakDays = state.streak.currentStreak || 0;
      const bonus = { coop: isCoopish, perfect, bestTime: newHighscore, streak: streakDays };
      // Belohnungs-Idempotenz: dieselbe Partie (gameId) darf über alle Geräte
      // hinweg NUR EINMAL Münzen geben — sonst zählt ein Sieg doppelt, wenn er
      // (offline) auf zwei Geräten beendet wird. Online verhindert der Reconnect-
      // Reconcile das ohnehin (die Partie ist dann schon „defunct").
      const alreadyRewarded = !isCoopish && state.gameId && isGameCompleted(state.gameId);
      const coins = alreadyRewarded ? 0 : coinReward(dIdx, bonus);
      if (coins) state.wallet = grantCurrency(coins, 'win');
      if (!isCoopish && state.gameId) markGameCompleted(state.gameId);
      state.lastCoinReward = coins;
      state.lastCoinMult = Math.round(coinMultiplier(bonus) * 100) / 100;
      state.lastStreakUsed = streakDays;
      log('game', 'Münz-Belohnung', { coins, mult: state.lastCoinMult, streakDays, coop: isCoopish, perfect, bestTime: newHighscore, alreadyRewarded });
      // (Cloud-Sync erfolgt gebündelt am Ende als sofortiges syncCloudNow.)
      // Neue Solo-Bestzeit (nur perfekte Solo-Siege) in die globale Bestenliste
      // schreiben — Coop/Wettkampf/Training zählen dort bewusst nicht mit.
      if (newHighscore && !isCoopish && state.account.status === 'in') {
        Account.publishBestTime(state.puzzle.difficulty, state.elapsed, state.account.username, myBadge());
      }
    }
    if (!state.isTrainingGame) applyStreakAfterGame();
    if (state.isRaceGame) state.raceStats = recordRaceWin(state.race.ffa ? 'ffa' : '1v1', state.elapsed);
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
      checkMasterUnlock();   // ggf. „Großmeister" freischalten (alle 12 auf Legendär)
    }
    persistGame();
    // SOFORTIGE Cloud-Sicherung bei Spielende (nicht entprellt): so ist der Sieg
    // inkl. Belohnung/gelöschtem Fortsetzen-Stand sofort in der Cloud, auch wenn
    // die App direkt danach geschlossen wird.
    syncCloudNow('win');
    if (state.coop.active && !remote) {
      coopSend({ type: Coop.MSG.STATUS, status: 'won', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
    }
    if (state.team.active && !remote) broadcastTeamDone('won');
    if (state.race.active && !remote) broadcastRaceDone('won');
  });
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
  if (state.isRaceGame) state.raceStats = recordRaceLoss(state.race.ffa ? 'ffa' : '1v1');
  if (state.team.active) state.raceStats = recordRaceLoss('2v2');
  if (!state.isTrainingGame) {
    state.puzzleHistory = recordHistory({
      difficulty: state.puzzle.difficulty, dim: { r: state.puzzle.rows, c: state.puzzle.cols },
      seed: state.puzzle.seed, marks: state.marks.map(row => row.slice()),
      timeMs: state.elapsed, outcome: 'lost', coop: state.coop.active,
    });
    checkAchievements();
    checkMasterUnlock();   // z.B. „Ausdauer" kann auch durch eine Niederlage voll werden
  }
  persistGame();
  syncCloudNow('lose');  // sofortige Sicherung bei Spielende (auch Niederlage)
  if (state.coop.active && !remote) {
    coopSend({ type: Coop.MSG.STATUS, status: 'lost', timeMs: state.elapsed, mistakes: state.mistakes, hintsUsed: state.hintsUsed });
  }
  if (state.team.active && !remote) broadcastTeamDone('lost');
  if (state.race.active && !remote) broadcastRaceDone('lost');
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
  // Slot über die STABILE state.saveSlot (nicht coop.active) — sonst würde ein
  // Coop-/Team-Spiel, dessen coop.active gerade flackert, hier als Solo gesichert
  // und der echte Solo-Stand überschrieben.
  const slot = state.saveSlot;
  const wasPlaying = state.status === 'playing' && !state.isTrainingGame;
  // Coop-Spielstand und Session sichern BEVOR coopReset()/clearCoopSession()
  // sie wegräumt — nur wenn das Spiel noch lief (Race wird nie persistiert).
  const coopSnap = slot === 'coop' && wasPlaying ? activeSnapshot() : null;
  // lastEventKey VOR coopReset() abgreifen — Coop.leave() setzt ihn zurück.
  const coopSess = coopSnap ? { code: state.coop.code, role: state.coop.role, name: state.settings.coopName, color: state.settings.coopMyColor, hostId: state.coop.hostId, lastEventKey: Coop.getLastEventKey() } : null;
  if (state.coop.role) coopReset();
  // Solo- und Coop-Spielstände leben in getrennten Storage-Slots (siehe
  // persistGame()) -- ein Verlassen des einen Modus darf den gespeicherten
  // Stand des anderen nicht überschreiben/löschen. Der Solo-Slot wird NUR bei
  // slot==='solo' angefasst.
  if (slot === 'coop') {
    if (coopSnap) { saveActiveGameCoop(coopSnap); saveCoopSession(coopSess); }
    else saveActiveGameCoop(null);
  } else if (slot === 'solo') {
    saveActiveGame(wasPlaying ? activeSnapshot() : null);
  }
  // 'race'/unbekannt → nichts speichern/löschen (Solo-Slot bleibt unberührt)
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
    gameId: state.gameId,   // Partie-Identität mitsichern (Multi-Device-Session/Fortsetzen)
    ts: Date.now(),
  };
}
function persistGame() {
  // Slot-Entscheidung über die STABILE state.saveSlot (beim Laden gesetzt), NICHT
  // über state.coop.active — dessen kurzes Flackern bei Rejoin/Rollenwechsel führte
  // sonst dazu, dass ein Coop-/Team-Spiel in den SOLO-Slot geschrieben und der
  // Solo-Stand überschrieben wurde. Solo-Slot wird AUSSCHLIESSLICH bei saveSlot==='solo'
  // angefasst.
  // Race-Matches sind strikt live/Wettkampf -- ein Fortsetzen nach Verbindungs-
  // abbruch wäre unfair/sinnlos (siehe state.race-Kommentar), daher nie persistiert.
  if (state.saveSlot === 'race' || state.race.active) return;
  // Solo- und Coop-Spielstände leben in getrennten Storage-Slots, sonst
  // überschreibt ein 400ms-Autosave aus dem jeweils anderen Modus den
  // gespeicherten Stand des anderen.
  // Trainingsrätsel werden nie persistiert/fortgesetzt -- sie sind als
  // wiederholbarer Lerndurchlauf gedacht, kein "Spielstand".
  // Training fasst gespeicherte Spielstände NIE an: ein Trainingsrätsel läuft
  // parallel zu einem evtl. unterbrochenen Solo-Spiel — vorher löschte jeder
  // Trainings-Zug (und jedes Ausblenden während des Trainings) den Solo-Slot.
  if (state.isTrainingGame) return;
  // 'idle' = in dieser Sitzung wurde (noch) nichts geladen (frischer App-Start).
  // Früher lief das in den Lösch-Zweig: App öffnen → ohne zu spielen wieder
  // schließen/hintergrund → pagehide/persistGame löschte den gespeicherten
  // Solo-Stand („Fortsetzen" verschwand scheinbar grundlos). Nur ein wirklich
  // BEENDETES Spiel ('won'/'lost') räumt den Slot auf.
  if (state.status === 'idle') return;
  if (state.status !== 'playing') {
    if (state.saveSlot === 'coop') { saveActiveGameCoop(null); clearCoopSession(); }
    else if (state.saveSlot === 'solo') saveActiveGame(null);
    // unbekannter/kein Slot → nichts anfassen (Solo-Slot bleibt unberührt)
    return;
  }
  const now = Date.now();
  if (now - saveThrottle < 400) return;
  saveThrottle = now;
  if (state.saveSlot === 'coop') {
    saveActiveGameCoop(activeSnapshot());
    // lastEventKey = Wiederaufsetzpunkt: der spätere rejoin() hängt den Event-
    // Listener HINTER diesem Key an, statt die komplette Historie (inkl. INIT/
    // START/STATUS) erneut abzuspielen — Snapshot und Key werden im selben
    // Moment gesichert und sind damit konsistent zueinander.
    saveCoopSession({ code: state.coop.code, role: state.coop.role, name: state.settings.coopName, color: state.settings.coopMyColor, hostId: state.coop.hostId, lastEventKey: Coop.getLastEventKey() });
  } else if (state.saveSlot === 'solo') {
    saveActiveGame(activeSnapshot());
  }
  // unbekannter Slot → NICHTS schreiben (Solo-Slot bleibt garantiert unberührt)
}
function refreshResume() {
  const g = loadActiveGame();
  state.resumeAvailable = (g && g.puzzle) ? g : null;
  const gc = loadActiveGameCoop();
  // Coop-Fortsetzen nur anbieten, solange auch das Wiederverbindungs-Token
  // (Coop-Session mit Raumcode/Rolle) noch gültig ist — vorher zeigte der
  // Button ins Leere: der Spielstand-Snapshot hat keine TTL, die Session schon;
  // ein Klick nach Ablauf tat schlicht nichts. Verwaiste Snapshots aufräumen.
  const sess = (gc && gc.puzzle) ? loadCoopSession() : null;
  state.resumeAvailableCoop = (gc && gc.puzzle && sess) ? gc : null;
  if (gc && gc.puzzle && !sess) saveActiveGameCoop(null);
}
function resumeGame() {
  const g = state.resumeAvailable;
  if (!g) return;
  // Alt-Spielstände (vor der Eigene-Farbe-Markierung) haben kein oder lücken-
  // haftes markedBy. Ohne Besitzer bekommt eine wiederhergestellte Markierung
  // weder die eigene Farbe noch den dynamischen Skin (Symptom: „bereits
  // eingekreiste Zahlen sind nach dem Fortsetzen nicht animiert"). Eigene
  // Solo-Züge daher nachträglich als eigene ausweisen.
  if (g.marks) {
    if (!Array.isArray(g.markedBy)) g.markedBy = g.marks.map((row) => row.map(() => null));
    for (let r = 0; r < g.marks.length; r++) {
      if (!Array.isArray(g.markedBy[r])) g.markedBy[r] = g.marks[r].map(() => null);
      for (let c = 0; c < g.marks[r].length; c++) {
        if (g.marks[r][c] !== 'none' && !g.markedBy[r][c]) g.markedBy[r][c] = LOCAL_PLAYER_ID;
      }
    }
  }
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
    // Nur die während der Abwesenheit verpassten Events nachziehen — ohne den
    // Anker würde die komplette Historie replayed (INIT überschreibt den
    // wiederhergestellten Spielstand und reaktiviert die Bereit-Lobby).
    afterEventKey: sess.lastEventKey || null,
    onOpen(id, actualRole) {
      state.coop.myId = id;
      state.coop.waitingForGuest = false;
      // actualRole kommt von Coop.rejoin(): falls inzwischen ein anderer Host
      // gewählt wurde, wird die eigene Rolle auf 'guest' korrigiert.
      if (actualRole && actualRole !== state.coop.role) {
        state.coop.role = actualRole;
      }
      upsertPlayer(id, sess.name, sess.color, myUsername());
      // Informiert einen ggf. noch aktiven Host über die eigene Rückkehr --
      // identisch zum normalen Beitritts-Pfad (confirmCoopIdentity()), löst
      // beim Host upsertPlayer()+broadcastRoster() aus (handleCoopMsg/IDENTITY).
      Coop.send({ type: Coop.MSG.IDENTITY, name: sess.name, color: sess.color, username: myUsername(), badge: myBadge() });
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
      const leavingName = playerLabel(state.coop.players.find(p => p.id === id)) || t('common.defaultPlayerName');
      removePlayer(id);
      if (state.coop.role === 'host') broadcastRoster();
      if (!coopIntentionalLeave) showToast(t('coop.partnerDisconnected', { name: leavingName }), 'info', 3000);
    },
    onMessage: handleCoopMsg,
    onConnection: handleCoopConnection,
  });
}

// ─── SIEGANIMATIONEN (Confetti + kaufbare Shop-Effekte) ───────────────────────
// Bei einem makellosen Sieg (keine Fehler, keine Hinweise) fällt jede Animation
// dichter/länger aus -- abgestufte Belohnung statt eines festen Effekts.
//
// Architektur: js/wineffects.js hält den Katalog (ids/Preise/Besitzlogik), hier
// erzeugt PIECE_GENERATORS pro Effekt einmalig ein Partikel-Array; gerendert
// wird alles in EINEM fixed Overlay (.winfx.fx-<id>), dessen Optik komplett in
// css/styles.css lebt (nur transform/opacity-Animationen — GPU-Kompositor,
// keine Repaints; Lehre aus dem iOS-Skin-Crash). markRaw: die Teilchen ändern
// sich nach dem Erzeugen nie wieder -- ohne markRaw würde Vue für jedes der bis
// zu ~180 Objekte einen reaktiven Proxy anlegen (Initial-Ruckler).
const R = (a, b) => a + Math.random() * (b - a);
// Standard-Faller (Confetti/Sterne/Blüten/Schnee/Münzen …): von oben herab.
function fallPieces(n, make) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: i, left: R(0, 100), delay: R(0, 0.9), dur: R(1.8, 3.4), rot: R(0, 360), ...make(i) });
  return out;
}
// Aufsteiger (Ballons/Blasen/Flammen): von unten nach oben.
function risePieces(n, make) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: i, left: R(0, 100), delay: R(0, 1.4), dur: R(2.2, 4), rot: R(-20, 20), ...make(i) });
  return out;
}
const PIECE_GENERATORS = {
  confetti(perfect) {
    // 2.0: Fall-Regen + Seiten-Kanonen (k1, diagonal geschossen) + Luftschlangen (k2).
    const colors = REGION_COLORS.map(c => `hsl(${c.h} ${c.s}% ${c.l}%)`);
    const out = fallPieces(perfect ? 170 : 90, (i) => ({
      color: colors[i % colors.length], size: perfect ? R(8, 18) : R(6, 14), delay: R(0, 0.5), dur: R(1.6, 3),
    }));
    for (let i = 0; i < (perfect ? 44 : 26); i++) {
      const left = i % 2 === 0;
      out.push({ id: 600 + i, left: left ? -2 : 102, top: R(70, 100), delay: R(0, 0.5) + (i % 2) * 0.15, dur: R(1, 1.6), size: R(7, 13),
        color: colors[i % colors.length], dx: (left ? 1 : -1) * R(120, 420), dy: -R(220, 560), kind: 1 });
    }
    for (let i = 0; i < (perfect ? 16 : 9); i++) out.push({ id: 800 + i, left: R(0, 100), delay: R(0.2, 1.4), dur: R(2.2, 3.6), size: R(30, 60), hue: Math.floor(R(0, 360)), kind: 2 });
    return out;
  },
  balloons(perfect) {
    // 2.0: Ballons steigen UND platzen (k1 = Knall-Ring mittig oben), danach
    // regnen bunte Schnipsel (k2) aus den Platz-Höhen.
    const out = risePieces(perfect ? 30 : 18, () => ({ shape: 'balloon', size: R(26, 48), hue: Math.floor(R(0, 360)) }));
    for (let i = 0; i < (perfect ? 12 : 7); i++) {
      const delay = R(1.2, 2.8), left = R(10, 90), top = R(8, 42);
      out.push({ id: 500 + i, left, top, delay, dur: 0.55, size: R(52, 84), hue: Math.floor(R(0, 360)), kind: 1 });
      for (let k = 0; k < 6; k++) out.push({ id: 600 + i * 6 + k, left: left + R(-4, 4), top, delay: delay + 0.1, dur: R(1, 1.8), size: R(5, 9), hue: Math.floor(R(0, 360)), kind: 2 });
    }
    return out;
  },
  stars(perfect) {
    // 2.0: Sternenregen + Starburst-Strahlen aus der Mitte (k1) + Kometen mit
    // Glitzerschweif (k2), die diagonal übers Bild ziehen.
    const chs = ['star', 'star', 'sparkle'];
    const out = fallPieces(perfect ? 100 : 56, (i) => ({ shape: chs[i % 3], size: R(12, 30) }));
    for (let i = 0; i < 12; i++) out.push({ id: 500 + i, left: 50, top: 42, delay: R(0, 0.2), dur: R(0.9, 1.3), size: R(4, 7), ang: i * 30 + R(-8, 8), rad: R(180, 380), kind: 1 });
    for (let i = 0; i < (perfect ? 6 : 3); i++) out.push({ id: 600 + i, left: R(-10, 40), top: R(5, 35), delay: R(0.4, 2.6), dur: R(1, 1.5), size: R(14, 22), kind: 2 });
    return out;
  },
  bubbles(perfect) {
    // 2.0: Blasen steigen, ein Teil PLATZT oben in Tröpfchen (k1); große
    // verschwommene Vordergrund-Blasen (k2) geben Tiefe.
    const out = risePieces(perfect ? 66 : 40, () => ({ size: R(10, 44), dx: R(-30, 30) }));
    for (let i = 0; i < (perfect ? 30 : 16); i++) { const ang = R(0, Math.PI * 2); out.push({ id: 500 + i, left: R(15, 85), top: R(6, 34), delay: R(1, 2.8), dur: 0.7, size: R(3, 6), dx: Math.cos(ang) * R(20, 60), dy: Math.sin(ang) * R(20, 60), kind: 1 }); }
    for (let i = 0; i < 6; i++) out.push({ id: 600 + i, left: R(0, 100), delay: R(0, 1.6), dur: R(3, 4.5), size: R(70, 130), kind: 2 });
    return out;
  },
  petals(perfect) {
    // 2.0: Blütenregen + Windböen-Schleier (k1) + rosa Blüten-Wirbel um die
    // Mitte (k2, Spiralarm wie Galaxie).
    const chs = ['petal', 'petal'];
    const out = fallPieces(perfect ? 66 : 40, (i) => ({ shape: chs[i % 2], size: R(14, 28), dx: R(30, 120), dur: R(3, 5) }));
    for (let i = 0; i < 4; i++) out.push({ id: 500 + i, top: R(10, 80), delay: i * 0.8 + R(0, 0.3), dur: 1.6, size: R(60, 110), kind: 1 });
    for (let i = 0; i < (perfect ? 26 : 14); i++) out.push({ id: 600 + i, left: 50, top: 45, ang: R(0, 360), rad: R(60, 220), delay: R(0.4, 2), dur: R(1.8, 2.8), size: R(10, 18), kind: 2, shape: 'petal' });
    return out;
  },
  snow(perfect) {
    // 2.0: Schneefall in zwei Tiefen (nah = groß/verschwommen) + Sturm-Böen
    // (k1, horizontale Schleier) + anwachsende Schneedecke am Boden (k2).
    const chs = ['snowflake', 'snowflake', 'snowflake'];
    const out = fallPieces(perfect ? 100 : 56, (i) => ({ shape: chs[i % 3], size: i % 5 === 0 ? R(28, 44) : R(10, 26), dx: R(-40, 40), dur: R(2.6, 4.6) }));
    for (let i = 0; i < 4; i++) out.push({ id: 500 + i, top: R(15, 75), delay: i * 0.9 + R(0, 0.3), dur: 1.4, size: R(70, 120), kind: 1 });
    out.push({ id: 900, left: 0, delay: 0.4, dur: 3.6, size: 0, kind: 2 });
    return out;
  },
  sparklers(perfect) {
    // 2.0: Ecken-Fontänen + rotierendes Funkenrad in der Mitte (k1) +
    // niederprasselnde Glutfunken (k2).
    const n = perfect ? 130 : 80, out = [];
    for (let i = 0; i < n; i++) {
      const corner = i % 4;
      out.push({ id: i, corner, delay: R(0, 1.6), dur: R(0.9, 1.8), size: R(6, 14),
        dx: R(18, 60) * (corner % 2 === 0 ? 1 : -1), dy: R(12, 45) * (corner < 2 ? 1 : -1) });
    }
    for (let i = 0; i < 18; i++) out.push({ id: 500 + i, left: 50, top: 45, ang: i * 20, rad: R(40, 90), delay: R(0, 0.4), dur: R(1.6, 2.4), size: R(4, 7), kind: 1 });
    for (let i = 0; i < (perfect ? 30 : 16); i++) out.push({ id: 600 + i, left: R(30, 70), delay: R(0.8, 2.6), dur: R(1, 1.8), size: R(3, 6), kind: 2 });
    return out;
  },
  fireworks(perfect) {
    // 2.0: Raketen steigen sichtbar auf (k1) und ERST DANN platzt am Zielpunkt
    // der Burst; dazu Doppel-Ringe (k2) und Glitzer-Nachregen (k3) je Explosion.
    const bursts = perfect ? 8 : 5, out = []; let id = 0;
    for (let b = 0; b < bursts; b++) {
      const cx = R(15, 85), cy = R(10, 42), rise = R(0.5, 0.7), delay = b * 0.45 + R(0, 0.2), hue = Math.floor(R(0, 360));
      out.push({ id: id++, left: cx + R(-3, 3), top: 104, delay, dur: rise, size: R(4, 6), hue, dy: -((104 - cy) / 100) * window.innerHeight, kind: 1 });
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2, r = R(70, 150);
        out.push({ id: id++, left: cx, top: cy, delay: delay + rise, dur: R(1, 1.6), size: R(5, 9), hue,
          dx: Math.cos(ang) * r, dy: Math.sin(ang) * r });
      }
      out.push({ id: id++, left: cx, top: cy, delay: delay + rise, dur: 0.9, size: R(120, 190), hue, kind: 2 });
      for (let k = 0; k < 8; k++) out.push({ id: id++, left: cx + R(-8, 8), top: cy + R(-4, 4), delay: delay + rise + 0.5, dur: R(1.2, 2), size: R(3, 5), hue, kind: 3 });
    }
    return out;
  },
  coins(perfect) {
    // 2.0: Münzregen + Münz-VULKAN aus der Bodenmitte (k1, Parabelflug) +
    // goldener Glanz-Sweep (k2) übers Bild.
    const chs = ['coin', 'coin'];
    const out = fallPieces(perfect ? 76 : 46, (i) => ({ shape: chs[i % 5 === 0 ? 1 : 0], size: R(16, 32), dur: R(1.4, 2.6) }));
    for (let i = 0; i < (perfect ? 30 : 18); i++) out.push({ id: 500 + i, shape: 'coin', left: R(42, 58), top: 100, delay: R(0.2, 1.6), dur: R(1.2, 1.7), size: R(16, 30), dx: R(-220, 220), dy: -R(320, 620), kind: 1 });
    out.push({ id: 900, top: 0, left: 0, delay: 0.8, dur: 1.4, size: 0, kind: 2 });
    return out;
  },
  rainbow(perfect) {
    // 2.0: DOPPEL-Regenbogen (zweite, versetzte Bahnen-Garnitur) + Glitzer +
    // Regenbogen-Komet (k1) mit Schweif + bunter Tropfenregen (k2).
    const out = [];
    for (let i = 0; i < 7; i++) out.push({ id: i, band: i, delay: i * 0.12, dur: 1.8, hue: [0, 30, 55, 120, 200, 240, 280][i] });
    for (let i = 0; i < 7; i++) out.push({ id: 50 + i, band: i, delay: 1.3 + i * 0.12, dur: 1.8, hue: [0, 30, 55, 120, 200, 240, 280][i] });
    for (let i = 0; i < (perfect ? 50 : 28); i++) out.push({ id: 100 + i, shape: 'sparkle', left: R(0, 100), delay: R(0.6, 2.4), dur: R(1, 2), size: R(10, 20) });
    for (let i = 0; i < 3; i++) out.push({ id: 200 + i, left: -8, top: R(8, 40), delay: 0.5 + i * 1.1, dur: 1.2, size: R(16, 24), kind: 1 });
    for (let i = 0; i < (perfect ? 36 : 20); i++) out.push({ id: 300 + i, left: R(0, 100), delay: R(1, 2.4), dur: R(1, 1.6), size: R(5, 9), hue: Math.floor(R(0, 360)), kind: 2 });
    return out;
  },
  wave(perfect) {
    // 2.0: 5 Wellenkämme in zwei Tiefen + Gischt-Schaum (k1) + springende
    // Delfine (k2, Parabelbogen) + Tropfen.
    const out = [];
    for (let i = 0; i < 5; i++) out.push({ id: i, band: i % 3, delay: i * 0.35, dur: 2.4 });
    for (let i = 0; i < (perfect ? 50 : 30); i++) out.push({ id: 100 + i, shape: 'droplet', left: R(0, 100), delay: R(0.4, 2.2), dur: R(0.9, 1.6), size: R(10, 20), dy: R(-160, -60) });
    for (let i = 0; i < (perfect ? 26 : 14); i++) out.push({ id: 200 + i, left: R(0, 100), top: R(52, 78), delay: R(0.5, 2.4), dur: R(0.7, 1.2), size: R(5, 10), kind: 1 });
    for (let i = 0; i < 3; i++) out.push({ id: 300 + i, shape: 'dolphin', left: R(10, 70), top: 70, delay: 0.6 + i * 0.9, dur: 1.3, size: R(28, 40), kind: 2 });
    return out;
  },
  matrix(perfect) {
    // 2.0: Zahlenkolonnen in zwei Tempi + Glitch-Balken (k1, horizontale
    // Blitze) + heller Scan-Streifen (k2), der einmal durchläuft.
    const cols = perfect ? 30 : 18, out = [];
    for (let i = 0; i < cols; i++) {
      let txt = ''; const len = Math.floor(R(6, 14));
      for (let k = 0; k < len; k++) txt += Math.floor(R(1, 10)) + '\n';
      out.push({ id: i, left: (i + 0.5) * (100 / cols), delay: R(0, 1.2), dur: i % 4 === 0 ? R(1.2, 1.6) : R(1.8, 3.2), size: i % 4 === 0 ? R(18, 24) : R(12, 18), txt });
    }
    for (let i = 0; i < (perfect ? 10 : 6); i++) out.push({ id: 500 + i, left: 0, top: R(5, 95), delay: R(0.3, 3), dur: 0.28, size: R(2, 5), kind: 1 });
    out.push({ id: 900, left: 0, top: 0, delay: 1, dur: 1.6, size: 0, kind: 2 });
    return out;
  },
  disco(perfect) {
    // 2.0: Lichtflecken + ROTIERENDE Lichtkegel von der Kugel (k1) +
    // Strobo-Blitze (k2) + tanzende Noten (k3).
    const n = perfect ? 28 : 16, out = [];
    for (let i = 0; i < n; i++) out.push({ id: i, left: R(0, 100), top: R(10, 90), delay: R(0, 1.5), dur: R(1.2, 2.4), size: R(40, 110), hue: Math.floor(R(0, 360)), dx: R(-120, 120), dy: R(-80, 80) });
    for (let i = 0; i < 4; i++) out.push({ id: 500 + i, left: 50, top: 27, delay: i * 0.1, dur: R(2.6, 3.4), size: 0, ang: -39 + i * 26, hue: Math.floor(R(0, 360)), kind: 1 });
    for (let i = 0; i < 5; i++) out.push({ id: 600 + i, left: 0, top: 0, delay: 0.6 + i * 0.7, dur: 0.18, size: 0, kind: 2 });
    for (let i = 0; i < (perfect ? 14 : 8); i++) out.push({ id: 700 + i, shape: 'note', left: R(5, 95), delay: R(0.3, 2.4), dur: R(1.4, 2.2), size: R(16, 28), kind: 3 });
    out.push({ id: 'cr', creature: discoMarkup(), size: 96, delay: 0, dur: 3 }); // SVG-Discokugel (Emoji-Ersatz)
    return out;
  },
  arcade(perfect) {
    // 2.0: Pixel-Explosion + marschierende Invader-Reihe (k1, eckige steps-
    // Bewegung) + hochzählende Score-Popups (k2) — Retro pur.
    const n = perfect ? 100 : 56, colors = ['#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#ff77a8'];
    const out = fallPieces(n, (i) => ({ color: colors[i % colors.length], size: Math.floor(R(1, 4)) * 6, dur: R(1.2, 2.2), rot: 0 }));
    for (let i = 0; i < 6; i++) out.push({ id: 500 + i, shape: 'invader', left: -10 - i * 9, top: 12 + (i % 2) * 7, delay: 0.3 + i * 0.05, dur: 2.8, size: R(22, 30), kind: 1 });
    for (let i = 0; i < (perfect ? 8 : 5); i++) out.push({ id: 600 + i, txt: ['+100', '+250', '+500'][i % 3], left: R(12, 82), top: R(30, 75), delay: R(0.4, 2.4), dur: 1.1, size: R(16, 24), kind: 2 });
    return out;
  },
  galaxy(perfect) {
    // 2.0: Spiralsterne + rotierender Nebelarm (::before, CSS) + Komet mit
    // Funkenschweif (k1) + Mini-Supernova-Puls im Zentrum (k2).
    const n = perfect ? 90 : 54, out = [];
    for (let i = 0; i < n; i++) out.push({ id: i, ang: R(0, 360), rad: R(30, 240), delay: R(0, 0.8), dur: R(2.4, 4), size: R(3, 7), hue: R(190, 300) });
    for (let i = 0; i < (perfect ? 6 : 3); i++) out.push({ id: 500 + i, shape: 'sparkle', left: R(0, 70), top: R(5, 40), delay: R(0.4, 2.4), dur: 1.1, size: R(16, 26) });
    for (let i = 0; i < 14; i++) { const p = i / 14; out.push({ id: 600 + i, left: p * 90, top: 12 + p * 42, delay: 1 + p * 0.9, dur: 0.9, size: R(3, 6), hue: R(190, 300), kind: 1 }); }
    for (let i = 0; i < 3; i++) out.push({ id: 700 + i, left: 50, top: 45, delay: 0.8 + i * 1.1, dur: 0.9, size: R(60, 100), hue: 260, kind: 2 });
    return out;
  },
  blackhole(perfect) {
    // Phase im CSS: erst spiralig einwärts (Sog), dann Supernova-Burst (::after).
    const n = perfect ? 90 : 54, out = [];
    for (let i = 0; i < n; i++) out.push({ id: i, ang: R(0, 360), rad: R(120, 420), delay: R(0, 0.7), dur: R(1.2, 2), size: R(3, 8), hue: R(20, 60) });
    return out;
  },
  chain(perfect) {
    // 2.0: Ringwelle + große Ganzbild-Schockwellen (k1) + rotierende Trümmer-
    // Brocken (k2), die aus jedem Explosionszentrum davonfliegen.
    const cols = 6, rows = 4, out = []; let id = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const left = (c + 0.5) * (100 / cols), top = (r + 0.5) * (100 / rows), delay = (c + r) * 0.16 + R(0, 0.06);
      out.push({ id: id++, left, top, delay, dur: 0.9, size: perfect ? 130 : 100, hue: R(10, 50) });
      if ((c + r) % 3 === 0) for (let k = 0; k < 4; k++) { const ang = R(0, Math.PI * 2); out.push({ id: id++, left, top, delay: delay + 0.1, dur: R(0.9, 1.4), size: R(6, 12), hue: R(10, 50), dx: Math.cos(ang) * R(80, 200), dy: Math.sin(ang) * R(80, 200), rot: R(180, 720), kind: 2 }); }
    }
    for (let i = 0; i < 3; i++) out.push({ id: 800 + i, left: 50, top: 50, delay: 0.5 + i * 0.55, dur: 1, size: R(200, 300), hue: 30, kind: 1 });
    for (let i = 0; i < (perfect ? 40 : 24); i++) out.push({ id: 900 + i, shape: 'burst', left: R(0, 100), top: R(0, 100), delay: R(0.2, 1.8), dur: 0.8, size: R(16, 30) });
    return out;
  },
  dragon(perfect) {
    // 2.0: Funken-Spur + FEUERATEM: der Drache stößt entlang der Bahn Flammen-
    // Kegel aus (k1, nach vorn geschleuderte Glut) + Rauchfahnen (k2).
    const n = perfect ? 76 : 46, out = [];
    for (let i = 0; i < n; i++) { const p = i / n; out.push({ id: i, left: p * 110 - 5, top: 26 + Math.sin(p * Math.PI * 2) * 14, delay: p * 2 + R(0, 0.12), dur: R(0.8, 1.6), size: R(5, 11), hue: R(10, 55) }); }
    for (let b = 0; b < 3; b++) { const p = 0.25 + b * 0.25, left = p * 110 - 5, top = 26 + Math.sin(p * Math.PI * 2) * 14;
      for (let k = 0; k < 10; k++) out.push({ id: 500 + b * 10 + k, left: left + 4, top: top + 2, delay: p * 2 + R(0, 0.15), dur: R(0.5, 0.9), size: R(6, 14), hue: R(10, 45), dx: R(60, 200), dy: R(20, 90), kind: 1 }); }
    for (let i = 0; i < 8; i++) { const p = i / 8; out.push({ id: 700 + i, shape: 'puff', left: p * 100, top: 24 + Math.sin(p * Math.PI * 2) * 14, delay: p * 2 + 0.3, dur: R(1.2, 2), size: R(14, 26), kind: 2 }); }
    // Gezeichneter Drache fliegt über die Bahn (SVG, Flügelschlag via CSS).
    out.push({ id: 'cr', creature: dragonMarkup(), size: 150, delay: 0, dur: 4.4 });
    return out;
  },
  rocket(perfect) {
    // 2.0: Start + STUFENTRENNUNG (k3, abgesprengter Ring auf halber Höhe) +
    // Satellit im Orbit (k4) + Warp-Sterne, die schneller werden.
    const out = [];
    for (let i = 0; i < (perfect ? 28 : 18); i++) out.push({ id: i, shape: 'puff', left: R(35, 65), delay: R(0, 1.4), dur: R(1.2, 2), size: R(18, 38), kind: 1 });
    for (let i = 0; i < (perfect ? 56 : 34); i++) out.push({ id: 100 + i, shape: 'sparkle', left: R(0, 100), delay: R(0, 2), dur: R(0.5, 1.4), size: R(8, 16), kind: 2 });
    out.push({ id: 800, left: 50, top: 45, delay: 1.15, dur: 0.9, size: 90, hue: 35, kind: 3 });
    out.push({ id: 801, shape: 'satellite', left: 50, top: 24, delay: 1.6, dur: 2.4, size: 26, ang: 0, rad: 90, kind: 4 });
    out.push({ id: 'cr', creature: rocketMarkup(), size: 70, delay: 0, dur: 2.6 }); // SVG-Rakete (Emoji-Ersatz)
    return out;
  },
  shatter(perfect) {
    // 2.0: Kristall WÄCHST erst in der Mitte (k2), Glanz läuft durch, DANN
    // Blitz + radialer Scherbenflug + Diamanten + Funkel-Glints (k3).
    const n = perfect ? 66 : 40, out = [];
    out.push({ id: 990, shape: 'gem', left: 50, top: 42, delay: 0, dur: 0.85, size: 84, kind: 2 });
    for (let i = 0; i < n; i++) { const ang = R(0, Math.PI * 2), r = R(140, 420); out.push({ id: i, dx: Math.cos(ang) * r, dy: Math.sin(ang) * r, delay: 0.85 + R(0, 0.2), dur: R(1, 1.8), size: R(10, 26), rot: R(0, 720) }); }
    for (let i = 0; i < 8; i++) out.push({ id: 500 + i, shape: 'gem', left: R(10, 90), delay: R(1, 1.8), dur: R(1.4, 2.2), size: R(16, 28), kind: 1 });
    for (let i = 0; i < (perfect ? 22 : 12); i++) out.push({ id: 600 + i, shape: 'sparkle', left: R(5, 95), top: R(10, 90), delay: R(1, 2.6), dur: 0.8, size: R(8, 16), kind: 3 });
    return out;
  },
  phoenix(perfect) {
    // 2.0: Wiedergeburts-Blitz (::after, CSS) + Flammenmeer + Glut-Spirale um
    // die Aufstiegsbahn (k1) + herabsegelnde Glutfedern (k2).
    const out = risePieces(perfect ? 86 : 50, () => ({ shape: 'flame', size: R(16, 40), dur: R(1.4, 2.6), delay: R(0, 1.8) }));
    for (let i = 0; i < (perfect ? 30 : 18); i++) out.push({ id: 500 + i, left: 50, top: 100, ang: R(0, 360), rad: R(20, 90), delay: R(0.2, 1.6), dur: R(1.6, 2.4), size: R(4, 8), hue: R(12, 50), kind: 1 });
    for (let i = 0; i < 10; i++) out.push({ id: 600 + i, shape: 'feather', left: R(20, 80), delay: R(1.4, 2.6), dur: R(1.6, 2.4), size: R(14, 24), kind: 2 });
    // Gezeichneter Phönix steigt aus den Flammen auf (SVG, Schwingen via CSS).
    out.push({ id: 'cr', creature: phoenixMarkup(), size: 140, delay: 0, dur: 3.6 });
    return out;
  },
  jackpot(perfect) {
    // 2.0: Lichterkranz + Münzschauer + 777 + Münz-ERUPTION aus der Bodenmitte
    // (k2, Parabel) + blinkende Gewinn-Sterne (k3).
    const out = fallPieces(perfect ? 76 : 46, (i) => ({ shape: 'coin', size: R(16, 32), dur: R(1.3, 2.4) }));
    for (let i = 0; i < 3; i++) out.push({ id: 800 + i, shape: 'seven', left: 32 + i * 16, top: 30, delay: 0.3 + i * 0.35, dur: 1.6, size: 44, kind: 1 });
    for (let i = 0; i < (perfect ? 26 : 16); i++) out.push({ id: 850 + i, shape: 'coin', left: R(44, 56), top: 100, delay: 1.4 + R(0, 0.5), dur: R(1.1, 1.6), size: R(16, 28), dx: R(-260, 260), dy: -R(300, 600), kind: 2 });
    for (let i = 0; i < 10; i++) out.push({ id: 950 + i, shape: 'sparkle', left: R(5, 95), top: R(5, 60), delay: R(0.4, 2.6), dur: 0.7, size: R(12, 22), kind: 3 });
    return out;
  },
  unicorn(perfect) {
    // 2.0: Galopp + dichtere Regenbogenspur + Herz-Pops (k2) + Funkel-Regen-
    // Finale (k3), wenn das Einhorn durch ist.
    const n = perfect ? 70 : 44, out = [];
    for (let i = 0; i < n; i++) { const p = i / n; out.push({ id: i, left: p * 110 - 5, top: 55 - Math.sin(p * Math.PI) * 18, delay: p * 2.2, dur: 1.6, size: R(10, 20), hue: Math.floor(p * 360) }); }
    for (let i = 0; i < 14; i++) out.push({ id: 500 + i, shape: 'sparkle', left: R(0, 100), top: R(30, 75), delay: R(0.5, 2.4), dur: 1, size: R(10, 18), kind: 1 });
    for (let i = 0; i < (perfect ? 12 : 7); i++) out.push({ id: 600 + i, shape: 'heart', left: R(10, 90), top: R(25, 70), delay: R(0.8, 2.6), dur: 0.9, size: R(14, 26), kind: 2 });
    for (let i = 0; i < (perfect ? 30 : 16); i++) out.push({ id: 700 + i, shape: 'sparkle', left: R(0, 100), delay: R(2.4, 3.4), dur: R(1, 1.6), size: R(8, 16), kind: 3 });
    // Gezeichnetes Einhorn galoppiert über die Bahn (SVG, Beine/Mähne via CSS).
    out.push({ id: 'cr', creature: unicornMarkup(), size: 130, delay: 0, dur: 4.2 });
    return out;
  },
  // ── Tier 4 (Legendär): mehrphasige Groß-Spektakel ──────────────────────────
  meteor(perfect) {
    // Feuerbälle mit Glühschweif stürzen diagonal herab; je Meteor ein
    // Einschlags-Ring (k1) unten, danach glimmender Glut-Regen (k2).
    const out = []; let id = 0;
    for (let i = 0; i < (perfect ? 10 : 6); i++) {
      const delay = i * 0.34 + R(0, 0.15);
      out.push({ id: id++, left: R(25, 115), top: -8, delay, dur: R(0.7, 1), size: R(10, 18), hue: R(15, 45) });
      out.push({ id: id++, left: R(5, 90), top: R(55, 92), delay: delay + 0.5, dur: 0.9, size: R(90, 160), hue: R(15, 45), kind: 1 });
    }
    for (let i = 0; i < (perfect ? 50 : 30); i++) out.push({ id: 500 + i, left: R(0, 100), delay: R(1.2, 3.2), dur: R(1.4, 2.4), size: R(3, 7), hue: R(15, 50), kind: 2 });
    return out;
  },
  gewitter(perfect) {
    // Zickzack-Blitze (clip-path, via scaleY gestreckt) schlagen versetzt ein;
    // Ganzbild-Wetterleuchten + Wolkenbank sind ::before/::after, Regen = k2 (endlos).
    const out = []; let id = 0;
    for (let i = 0; i < (perfect ? 9 : 6); i++) out.push({ id: id++, left: R(8, 92), top: 0, delay: i * 0.42 + R(0, 0.2), dur: 0.5, size: R(40, 70), hue: R(200, 260) });
    for (let i = 0; i < (perfect ? 80 : 50); i++) out.push({ id: 500 + i, left: R(0, 100), top: -12, delay: R(0, 1.2), dur: R(0.5, 0.9), size: R(60, 110), kind: 2 });
    return out;
  },
  portal(perfect) {
    // Wirbel-Portal (rotierendes Conic-Ring-::before) reißt in der Mitte auf;
    // Sterne schießen daraus aufs Auge zu (Scale 0.15 → 3), am Ende kollabiert es.
    const n = perfect ? 70 : 42, out = [];
    for (let i = 0; i < n; i++) { const ang = R(0, Math.PI * 2), r = R(120, 480); out.push({ id: i, dx: Math.cos(ang) * r, dy: Math.sin(ang) * r, delay: R(0.5, 2.6), dur: R(0.9, 1.6), size: R(4, 9), hue: R(160, 320) }); }
    for (let i = 0; i < 10; i++) out.push({ id: 500 + i, shape: 'sparkle', left: R(10, 90), top: R(10, 90), delay: R(0.8, 3), dur: 1, size: R(10, 20), kind: 1 });
    return out;
  },
  feuertornado(perfect) {
    // Flammenwirbel: Partikel kreisen um die Mittelachse (rotate+translateX) und
    // steigen dabei vom Boden auf; 🔥-Funken (k1) sprühen aus dem Trichter.
    const n = perfect ? 90 : 56, out = [];
    for (let i = 0; i < n; i++) out.push({ id: i, ang: R(0, 360), rad: R(14, 110), delay: R(0, 1.6), dur: R(1.6, 2.6), size: R(4, 10), hue: R(12, 55) });
    for (let i = 0; i < (perfect ? 24 : 14); i++) out.push({ id: 500 + i, shape: 'flame', left: R(20, 80), top: R(30, 95), delay: R(0.4, 2.4), dur: R(0.8, 1.4), size: R(14, 26), kind: 1 });
    return out;
  },
  synthgrid(perfect) {
    // Retro-Sonnenaufgang: scrollendes Perspektiv-Grid (::before) + aufgehende
    // Neon-Sonne (::after); quer schießende Neon-Streifen + funkelnde Sterne (k1).
    const out = [];
    for (let i = 0; i < (perfect ? 22 : 14); i++) out.push({ id: i, left: -20, top: R(6, 58), delay: R(0, 2.2), dur: R(0.9, 1.6), size: R(50, 130), hue: [300, 190, 320, 210][i % 4] });
    for (let i = 0; i < (perfect ? 40 : 24); i++) out.push({ id: 500 + i, shape: 'sparkle', left: R(0, 100), top: R(0, 55), delay: R(0, 2.6), dur: 1.1, size: R(8, 16), kind: 1 });
    return out;
  },
};
// Overlay-Lebensdauer je Effekt [normal, perfekt] — möglichst dicht an der
// tatsächlich sichtbaren Animation, damit nach ihrem Ende nichts „nachhängt"
// (Nutzerreport: Schwarzes Loch ließ 2-3 Pixel nachglühen und fühlte sich
// blockierend an, obwohl das Overlay pointer-events: none hat).
const WINFX_DURATION = {
  confetti: [3500, 4800],
  blackhole: [3500, 3600],   // Sog ~2,7s + Supernova endet bei ~3,3s
  chain: [3200, 3400],       // Diagonalwelle (max delay ~1,7s) + Ringe 0,9s
 shatter: [2600, 2800], // Scherbenflug ≤ 2,05s + -Fall
  fireworks: [3400, 4600],   // letzte Burst-Welle je nach Anzahl
  meteor: [4600, 5600], gewitter: [4400, 5200], portal: [4200, 5000],
  feuertornado: [4200, 5000], synthgrid: [4600, 5600],
};
function launchWinFx(perfect, forceId) {
  const id = forceId || resolveActiveEffect(state.settings.winEffect, state.inventory);
  const gen = PIECE_GENERATORS[id] || PIECE_GENERATORS[CONFETTI_ID];
  state.perfectWin = !!perfect;
  const [durNormal, durPerfect] = WINFX_DURATION[id] || [4200, 5600];
  state.winFx = { id, pieces: gen(!!perfect).map(p => markRaw(p)), seq: (state.winFx?.seq || 0) + 1 };
  const mySeq = state.winFx.seq;
  // Sound zur Animation: an den Effekt gekoppelt und mit dessen Stufe grandioser
  // (perfekte Siege eine Stufe höher). Läuft damit auch in der Shop-Vorschau.
  if (state.settings.sfxWin) Music.sfxWinFx(Math.min(4, (effectById(id)?.tier || 0) + (perfect ? 1 : 0)));
  setTimeout(() => { if (state.winFx && state.winFx.seq === mySeq) state.winFx = null; }, perfect ? durPerfect : durNormal);
}
// Stil-Bindung eines Partikels (nur einmal beim Erzeugen ausgewertet; die
// eigentliche Bewegung machen CSS-Keyframes über transform/opacity).
function winFxStyle(p) {
  const s = { animationDelay: p.delay + 's', animationDuration: p.dur + 's' };
  if (p.left != null) s.left = p.left + '%';
  if (p.top != null) s.top = p.top + '%';
  if (p.txt) s.fontSize = p.size + 'px';
  else { s.width = p.size + 'px'; s.height = p.size + 'px'; }
  if (p.color) s.background = p.color;
  if (p.hue != null) s['--hue'] = p.hue;
  if (p.dx != null) s['--dx'] = p.dx + 'px';
  if (p.dy != null) s['--dy'] = p.dy + 'px';
  if (p.ang != null) s['--ang'] = p.ang + 'deg';
  if (p.rad != null) s['--rad'] = p.rad + 'px';
  if (p.rot) s['--rot'] = p.rot + 'deg';
  return s;
}

// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────
function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  if (key === 'colorBlindMode') applyTheme();
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
  if (key === 'themeMode' || key === 'appTheme') applyTheme();
  if (key === 'sfxPack') Music.setSfxPack(shopEquippedId('sfx'));
  if (key === 'musicPack') { Music.setMusicPack(shopEquippedId('music')); updateMusic(); }
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
      state.settings = loadSettings(); state.stats = loadStats(); applyTheme(); applySfxPack(); applyMusicPack(); applyLocale(); refreshResume();
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
    state.settings = loadSettings(); state.stats = loadStats(); state.streak = loadStreak(); state.puzzleHistory = loadHistory(); applyTheme(); applySfxPack(); applyMusicPack(); applyLocale(); refreshResume();
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
  if (m.color) {
    // Ausgerüstete Brett-Palette (Shop): reine HSL-Transformation der Cage-Farbe —
    // Rotation/Skalierung erhält die optimierten Farb-Abstände (shopitems.js).
    const col = applyPaletteFx(m.color, activePaletteFx());
    st['--rc-h'] = col.h; st['--rc-s'] = col.s + '%'; st['--rc-l'] = col.l + '%'; st['--rc-ink'] = regionChipInk(col);
  }
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
// ─── Lobby-Einladungen an Freunde ──────────────────────────────────────────────
// Aktueller Lobby-Modus als kompakter String für die Einladung.
function lobbyMode() { return state.coop.teamMode ? '2v2' : state.coop.ffaMode ? 'ffa' : state.coop.raceMode ? '1v1' : 'coop'; }
function lobbyModeLabel(mode) {
  return mode === '2v2' ? t('coop.modeTeam') : mode === 'ffa' ? t('coop.modeFfa') : mode === '1v1' ? t('coop.modeRace') : t('coop.modeCoop');
}
// „Freunde einladen" in der Lobby: öffnet die Auswahl (nur wenn eingeloggt).
function openInvitePicker() {
  if (state.account.status !== 'in') { showToast(t('friends.needLogin'), 'info', 2600); return; }
  state.coop.invitePickerOpen = true;
  startFriendsWatch();   // Freundesliste/Präsenz laden (falls noch nicht aktiv)
}
function closeInvitePicker() { state.coop.invitePickerOpen = false; }
async function inviteFriendToLobby(fr) {
  if (!fr || !state.coop.code) return;
  if (!state.coop.invitedUids.includes(fr.uid)) state.coop.invitedUids.push(fr.uid);
  const r = await Account.sendLobbyInvite(fr.uid, { code: state.coop.code, mode: lobbyMode(), username: myUsername() });
  if (r && r.ok) showToast(t('coop.inviteSent', { name: fr.username || fr.uid }), 'success', 2400);
  else { showToast(accErr((r && r.err) || 'generic'), 'error', 2600); state.coop.invitedUids = state.coop.invitedUids.filter(u => u !== fr.uid); }
}
// Offene (weder angenommene noch abgelehnte) Einladung zurückziehen: löscht sie
// beim Freund (sein Banner verschwindet live via onValue) und gibt den Button
// wieder als „Einladen" frei — erneutes Einladen sofort möglich.
async function withdrawLobbyInvite(fr) {
  if (!fr) return;
  const r = await Account.cancelLobbyInvite(fr.uid);
  if (r && r.ok) {
    state.coop.invitedUids = state.coop.invitedUids.filter((u) => u !== fr.uid);
    showToast(t('coop.inviteWithdrawn', { name: fr.username || fr.uid }), 'info', 2400);
  } else {
    showToast(accErr((r && r.err) || 'generic'), 'error', 2600);
  }
}

// ─── Eingehende Einladungen (global, solange eingeloggt) ────────────────────────
let lobbyInvitesUnwatch = null, lobbyResponsesUnwatch = null;
async function startLobbyInviteWatch() {
  if (lobbyInvitesUnwatch) return;
  lobbyInvitesUnwatch = await Account.watchLobbyInvites((arr) => {
    state.lobbyInvites = arr;
    // Neueste offene Einladung als Banner zeigen — AUCH mitten im Spiel
    // (Nutzerwunsch: Einladungen sollen immer ankommen; wer spielt, kann sie
    // ablehnen oder ignorieren; Annahme sichert den Solo-Stand, s.u.). Wichtig:
    // bedingungslos setzen — zieht der Einladende zurück (cancelLobbyInvite),
    // fällt sie aus arr und das Banner verschwindet live (bzw. wechselt zur
    // nächsten offenen), sonst nähme man eine Geister-Einladung an. Die alte
    // Spiel-Sperre hatte zudem ein Loch: endete das Spiel, feuerte der
    // onValue-Listener nicht erneut (Daten unverändert) — die Einladung blieb
    // für immer unsichtbar.
    state.pendingLobbyInvite = arr.length ? arr[arr.length - 1] : null;
  });
  lobbyResponsesUnwatch = await Account.watchLobbyInviteResponses((arr) => {
    for (const resp of arr) {
      if (resp.status === 'declined') {
        showToast(t('coop.inviteDeclined', { name: resp.username || resp.targetUid }), 'info', 3200);
        // Button wieder auf „Einladen" zurücksetzen, damit man es erneut versuchen kann.
        state.coop.invitedUids = state.coop.invitedUids.filter((u) => u !== resp.targetUid);
      } else if (resp.status === 'accepted') {
        showToast(t('coop.inviteAccepted', { name: resp.username || resp.targetUid }), 'success', 3200);
        // Auch bei Annahme zurücksetzen: sobald der Freund die Runde verlässt,
        // soll man ihn erneut einladen können (sonst bliebe „Eingeladen" hängen).
        state.coop.invitedUids = state.coop.invitedUids.filter((u) => u !== resp.targetUid);
      }
      Account.clearLobbyInviteResponse(resp.targetUid);
    }
  });
}
function stopLobbyInviteWatch() {
  try { lobbyInvitesUnwatch && lobbyInvitesUnwatch(); } catch (_) {}
  try { lobbyResponsesUnwatch && lobbyResponsesUnwatch(); } catch (_) {}
  lobbyInvitesUnwatch = lobbyResponsesUnwatch = null;
}
// Einladung annehmen: eigene Einladung entfernen und der Lobby (Code+Modus) als Gast beitreten.
function acceptLobbyInvite(inv) {
  if (!inv) return;
  // Einladungen erscheinen jetzt auch MITTEN im Spiel: läuft gerade eine
  // Solo-Partie, wird sie vor dem Wechsel in die Lobby gesichert (Fortsetzen-
  // Button wie bei „Zum Menü"), damit kein Fortschritt verloren geht.
  if (state.status === 'playing' && !state.isTrainingGame && state.saveSlot === 'solo') {
    saveActiveGame(activeSnapshot());
  }
  Account.acceptLobbyInvite(inv.fromUid, myUsername());
  state.pendingLobbyInvite = null;
  state.lobbyInvites = state.lobbyInvites.filter(i => i.fromUid !== inv.fromUid);
  coopReset();
  state.coop.teamMode = inv.mode === '2v2';
  state.coop.ffaMode = inv.mode === 'ffa';
  state.coop.raceMode = inv.mode === '1v1' || inv.mode === 'ffa';
  state.coop.identityConfirmed = true;              // gespeicherten Namen verwenden
  state.coop.nameDraft = state.settings.coopName;
  state.coop.code = String(inv.code || '');
  navigate('coop');
  startJoining();
}
function declineLobbyInviteUI(inv) {
  if (!inv) return;
  Account.declineLobbyInvite(inv.fromUid, myUsername());
  state.pendingLobbyInvite = null;
  state.lobbyInvites = state.lobbyInvites.filter(i => i.fromUid !== inv.fromUid);
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
// Sofortige (NICHT entprellte) Cloud-Sicherung bei Hauptevents: Spielstart,
// Pause, Sieg, Niederlage, App-Verstecken/Schließen. `scheduleSyncUp()` wartet bis
// zu 30 s (SYNC_MIN_GAP) — wurde die App vorher geschlossen, ging der Upload
// verloren und ein FERTIGES Spiel tauchte danach wieder als „Fortsetzen" auf
// (Belohnung/Abschluss nicht in der Cloud). Diese Events sind selten (kein
// Per-Zug-Sync!) → kein Speicher-/Socket-Churn wie beim früheren Dauer-Entpreller;
// der damalige iOS-Absturz kam von den Animationen, nicht von der Sync-Rate.
function syncCloudNow(reason) {
  if (state.account.status !== 'in') return;
  log('account', 'Getriggerte Cloud-Sync', { reason });
  doSyncNow();
  // Zusätzlich die autoritative Aktivspiel-Session aktualisieren (nur Solo-Slot;
  // pushSession filtert selbst). Status aus dem Anlass ableiten.
  const sessStatus = (reason === 'win' || reason === 'lose') ? SESSION_STATUS.DONE
    : (reason === 'pause' || reason === 'hide' || reason === 'pagehide') ? SESSION_STATUS.PAUSED
    : (reason === 'gameStart') ? SESSION_STATUS.PLAYING
    : (state.status === 'playing' ? SESSION_STATUS.PLAYING : SESSION_STATUS.NONE);
  if (sessStatus !== SESSION_STATUS.NONE || reason === 'win' || reason === 'lose') pushSession(sessStatus);
}
async function doSyncNow() {
  if (state.account.status !== 'in') return;
  state.account.syncState = 'syncing';
  const r = await Account.syncNow();
  if (r.ok) { state.account.syncState = 'ok'; state.account.lastSyncAt = r.ts; state.account.syncErrorMsg = ''; }
  else if (r.skipped) { state.account.syncState = 'idle'; }
  else { state.account.syncState = 'error'; state.account.syncErrorMsg = r.err ? accErr(r.err) : ''; }
}
// ─── Multi-Device: geräteübergreifende Konsistenz des AKTIVEN Solo-Spiels ──────
// Nur für angemeldete Accounts (anonym/rein lokal = ein Gerät). Die Cloud-Session
// (/users/{uid}/session) ist die autoritative Quelle der laufenden Partie; hier
// wird sie geschrieben (Compare-and-Set) und beim Sichtbarwerden/Live-Event
// abgeglichen — statt heute beim Zurückkehren blind hochzuladen und dabei einen
// neueren Fremdstand zu überschreiben.

// Aktive Solo-Partie in die Cloud-Session schreiben. status: 'playing'|'paused'|'done'.
async function pushSession(status) {
  if (state.account.status !== 'in') return;
  if (state.saveSlot !== 'solo' || state.isTrainingGame || !state.gameId) return;
  const active = status !== SESSION_STATUS.DONE && status !== SESSION_STATUS.NONE;
  const payload = active && state.puzzle ? activeSnapshot() : null;
  const r = await Account.writeSession({
    gameId: state.gameId, status, payload,
    appBuild: BUILD, schema: SESSION_SCHEMA, baseRev: state.sessionRev,
  });
  if (r && r.ok) { state.sessionRev = r.rev; }
  else if (r && r.stale) { log('account', 'pushSession veraltet → reconcile'); reconcileSession(); }
}

// Solo-Slot leeren, weil die Partie woanders beendet/überholt wurde. Räumt eine
// laufende In-Memory-Partie sauber ab (kein Rauswurf mitten im Zug: nur der Stand
// ist weg, wir gehen bewusst ins Menü) und aktualisiert die Fortsetzen-Liste.
function clearDefunctSolo(showNotice) {
  saveActiveGame(null);
  if (state.saveSlot === 'solo' && !state.isTrainingGame && (state.screen === 'game' || state.status === 'playing')) {
    state.status = 'idle';
    state.sessionReadonly = false;
    stopTimer();
    if (showNotice) state.deviceNotice = { kind: 'defunct' };
    navigate('home');
  }
  refreshResume();
}

// Cloud-Partie lokal übernehmen. readonly = ein anderes Gerät ist Besitzer → Brett
// gesperrt bis „Hier weiterspielen". Ist der Spieler gerade in genau dieser Partie,
// wird das Brett auf den Cloud-Stand nachgezogen; sonst als „Fortsetzen" abgelegt.
function adoptCloudSession(cloud, readonly) {
  if (!cloud || !cloud.payload) { state.sessionRev = cloud ? (cloud.rev || 0) : 0; return; }
  const snap = cloud.payload;
  saveActiveGame(snap);                 // in den Solo-Slot (Fortsetzen)
  state.sessionRev = cloud.rev || 0;
  const inThisGame = state.screen === 'game' && state.saveSlot === 'solo' && state.gameId === cloud.gameId;
  if (inThisGame && snap.puzzle) {
    // Live nachziehen: dieselbe Partie ist auf einem anderen Gerät weitergelaufen.
    loadPuzzleIntoState(snap.puzzle, snap);
    state.status = 'playing';
    state.sessionRev = cloud.rev || 0;
    state.sessionReadonly = !!readonly;
    if (readonly) { state.deviceNotice = { kind: 'takeover' }; stopTimer(); }
  }
  refreshResume();
}

// Entscheidet & handelt beim Sichtbarwerden/Live-Event: was tun mit der offenen Partie?
function handleSessionDecision(d, cloud, local) {
  switch (d.action) {
    case 'inSync': break;
    case 'uploadLocal': pushSession(state.paused ? SESSION_STATUS.PAUSED : SESSION_STATUS.PLAYING); break;
    case 'reloadRequired':
      // Cloud stammt aus neuerer App-Version → defunctes Spiel räumen, neu laden.
      clearDefunctSolo(false);
      state.deviceNotice = { kind: 'reload' };
      safeReload('session-schema-ahead');
      break;
    case 'defunct':
      if (d.backupLocal) { const g = loadActiveGame(); if (g) saveActiveGameBackup(g); }
      clearDefunctSolo(true);
      break;
    case 'takeCloud': adoptCloudSession(cloud, false); break;
    case 'takeCloudReadonly': adoptCloudSession(cloud, true); break;
  }
}

// Abgleich der Session beim Sichtbarwerden/focus/online/Live-Event. ERSETZT das
// frühere blinde doSyncNow() beim Zurückkehren (das den veralteten Stand hochlud).
let reconcileSessionBusy = false;
async function reconcileSession() {
  if (state.account.status !== 'in' || reconcileSessionBusy) return;
  reconcileSessionBusy = true;
  try {
    const cloud = await Account.readSession();
    const inSolo = state.saveSlot === 'solo' && !state.isTrainingGame && !!state.puzzle
      && (state.status === 'playing' || state.status === 'idle' && state.screen === 'game');
    const savedTs = (() => { const g = loadActiveGame(); return g && g.ts || 0; })();
    const local = inSolo
      ? { gameId: state.gameId, rev: state.sessionRev, status: state.paused ? SESSION_STATUS.PAUSED : SESSION_STATUS.PLAYING, updatedAt: savedTs }
      : null;
    const d = decideSessionSync({ local, cloud, selfDevice: deviceId(), knownSchema: SESSION_SCHEMA });
    log('account', 'reconcileSession', { action: d.action, reason: d.reason, hasLocal: !!local, hasCloud: !!cloud });
    handleSessionDecision(d, cloud, local);
  } catch (e) { log('account', 'reconcileSession fehlgeschlagen', e); }
  finally { reconcileSessionBusy = false; }
}

// „Hier weiterspielen" aus dem Übernahme-Banner: Besitz zurückholen (rev bumpen),
// Brett entsperren, Hinweis schließen und Timer wieder laufen lassen.
function reclaimSession() {
  state.sessionReadonly = false;
  state.deviceNotice = null;
  if (state.screen === 'game' && state.status === 'playing') startTimer();
  pushSession(SESSION_STATUS.PLAYING);
}
function dismissDeviceNotice() { state.deviceNotice = null; }

// Live-Invalidierung: der Watcher feuert, sobald ein anderes Gerät die Session
// ändert → sofortiger Reconcile (Brett sperren/Stand nachziehen/defunct räumen).
let sessionUnwatch = null;
async function startSessionWatch() {
  if (sessionUnwatch || state.account.status !== 'in') return;
  sessionUnwatch = await Account.watchSession((cloudSession) => {
    // Eigene Schreibvorgänge nicht gegen sich selbst reconcilen (deviceId-Filter):
    if (cloudSession && cloudSession.deviceId === deviceId()) { state.sessionRev = cloudSession.rev || state.sessionRev; return; }
    reconcileSession();
  });
}
function stopSessionWatch() { if (sessionUnwatch) { try { sessionUnwatch(); } catch (_) {} sessionUnwatch = null; } }

// ─── Versions-Mismatch-Dialog (offline gespielt UND woanders online) ──────────
// Kurz-Zusammenfassung eines Datensnapshots für die Konflikt-Karten: Guthaben,
// Gesamtsiege, letzter Änderungszeitpunkt. Rein zur Anzeige.
function syncSummary(data) {
  if (!data) return { coins: 0, wins: 0, ts: 0 };
  const coins = (data.wallet && data.wallet.balance) || 0;
  let wins = 0;
  const by = data.stats && data.stats.byDifficulty;
  if (by) for (const k in by) { wins += (by[k].won || 0) + (by[k].coopWon || 0); }
  return { coins, wins, ts: data.ts || data.rev || 0 };
}
function openVersionMismatch(r) {
  state.versionMismatch = {
    local: syncSummary(r.localData),
    cloud: syncSummary(r.cloud),
    busy: false,
  };
  log('account', 'Versions-Mismatch-Dialog geöffnet', { local: state.versionMismatch.local, cloud: state.versionMismatch.cloud });
}
// Nutzerwahl anwenden: 'local' = dieses Gerät behalten, 'cloud' = Cloud behalten.
// Die unterlegene Seite sichert resolveConflict als Backup. Danach sauber neu laden.
function resolveVersionMismatch(choice) {
  if (!state.versionMismatch || state.versionMismatch.busy) return;
  state.versionMismatch.busy = true;
  Account.resolveConflict(choice).then((res) => {
    log('account', 'Versions-Mismatch beantwortet', { choice, ok: res && res.ok });
    state.versionMismatch = null;
    safeReload('version-mismatch-' + choice);
  });
}
function fmtMismatchTime(ts) {
  if (!ts) return '–';
  try { return new Date(ts).toLocaleString(i18nState.locale || undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch (_) { return '–'; }
}

// Zeitpunkt der letzten Cloud-Sicherung als Uhrzeit (locale) — '–' wenn noch nie.
function fmtSyncTime(ts) {
  if (!ts) return '–';
  try { return new Date(ts).toLocaleTimeString(i18nState.locale || undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return '–'; }
}
// Gedrosseltes Nachladen der Rolle (Admin) beim Navigieren ins Hauptmenü — nicht
// häufiger als alle 30 s, damit häufiges Hin- und Herwechseln keine Firebase-
// Last erzeugt. refreshAccount() holt Rolle/E-Mail frisch und persistiert sie.
let lastRoleRefresh = 0;
function maybeRefreshRole() {
  const now = Date.now();
  if (now - lastRoleRefresh < 30000) return;
  lastRoleRefresh = now;
  refreshAccount();
}
// Live-Listener auf die eigene Rolle: der Admin-Status (Home-Badge, Admin-Bereich)
// aktualisiert sich SOFORT, wenn er per Console/anderem Admin gesetzt/entfernt wird
// — ohne App-Neustart oder Menü-Wechsel. Rolle wird zusätzlich lokal persistiert.
let roleUnwatch = null;
async function startRoleWatch() {
  if (roleUnwatch) return;   // schon aktiv
  roleUnwatch = await Account.watchRole((role) => {
    if (state.account.status !== 'in') return;
    if (state.account.role !== role) log('account', 'Rolle live aktualisiert', { role });
    state.account.role = role;
    saveProfile({ role });
  });
}
async function refreshAccount() {
  refreshAccountFromLocal();
  // Genaueren Zustand (E-Mail/Rolle) nur holen, wenn lokal schon ein Account
  // hinterlegt ist — sonst würde Firebase unnötig geladen.
  if (loadProfile().accountId) {
    try {
      const s = await Account.authState();
      if (s.signedIn) {
        state.account.status = 'in'; state.account.uid = s.uid; state.account.email = s.email || ''; state.account.username = s.username || state.account.username; state.account.role = s.role || 'user';
        // Rolle lokal persistieren, damit ein frisch (z.B. per Admin) gesetzter
        // Status beim nächsten Start SOFORT sichtbar ist statt erst nach dem
        // asynchronen Cloud-Abgleich (Ursache der gemeldeten Verzögerung).
        saveProfile({ role: state.account.role });
        pushPresence();          // Präsenz melden, sobald der Account bestätigt ist
        startFriendsWatch();     // Freundes-/Anfragen-Listener (Badge) starten
        startLobbyInviteWatch(); // eingehende Lobby-Einladungen + Ablehnungen beobachten
        startNoticeWatch();      // Admin-Benachrichtigungen (Geschenk/Entzug/Guthaben) empfangen
        startGiftWatch();        // Inventar/Wallet live: Geschenke ohne Neustart nutzbar
        syncBestTimesToLeaderboard(); // vorhandene Bestzeiten in die Bestenliste heben
        startRoleWatch();        // Admin-Status live halten (ohne Neustart/Navigation)
      }
      else state.account.status = 'anon';
    } catch (e) { log('account', 'refreshAccount fehlgeschlagen', e); }
  }
}
// ─── Admin-Benachrichtigungen (Empfängerseite) ────────────────────────────────
// Persistente Notizen unter /users/{uid}/notices: onValue liefert alle offenen;
// angezeigt wird eine nach der anderen (Modal), OK löscht sie in der RTDB und
// der Listener rückt automatisch zur nächsten vor.
let noticesUnwatch = null;
async function startNoticeWatch() {
  if (noticesUnwatch) return;
  noticesUnwatch = await Account.watchNotices((arr) => {
    arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    state.adminNotice = arr[0] || null;
  });
}
// Vorhandene Solo-Bestzeiten in die globale Bestenliste heben. Nötig, weil
// publishBestTime sonst nur bei einer NEUEN Bestzeit feuert — wer seine
// Bestzeiten VOR Einführung der Bestenliste (oder vor dem Login) erzielt hat,
// tauchte dort nie auf. Idempotent: publishBestTime schreibt nur, wenn der
// Cloud-Eintrag fehlt oder langsamer ist.
function syncBestTimesToLeaderboard() {
  try {
    const stats = loadStats();
    let n = 0;
    for (const [diff, d] of Object.entries(stats.byDifficulty || {})) {
      if (d && d.bestTimeMs > 0) { Account.publishBestTime(diff, d.bestTimeMs, state.account.username, myBadge()); n++; }
    }
    if (n) log('account', 'Bestzeiten-Sync zur Bestenliste angestoßen', { count: n });
  } catch (e) { log('account', 'Bestzeiten-Sync fehlgeschlagen', e); }
}
// Inventar + Wallet live aus der Cloud übernehmen: Admin-Geschenke/-Entzüge und
// Guthaben-Änderungen sind damit SOFORT nutzbar (kein App-Neustart nötig) — auch
// dann, wenn der Admin die Benachrichtigung abgewählt hat. Käufe auf einem
// anderen eigenen Gerät erscheinen so ebenfalls live.
let giftsUnwatch = null;
async function startGiftWatch() {
  if (giftsUnwatch) return;
  giftsUnwatch = await Account.watchGifts((upd) => {
    if (upd.inventory) {
      const before = Object.keys(state.inventory || {}).length;
      state.inventory = reconcileInventoryFromCloud(upd.inventory);
      const after = Object.keys(state.inventory).length;
      if (after !== before) log('account', 'Inventar live abgeglichen', { before, after });
    }
    if (upd.wallet && (upd.wallet.updatedAt || 0) > (loadWallet().updatedAt || 0)) {
      state.wallet = applyCloudWallet(upd.wallet);
    }
  });
}
function dismissAdminNotice() {
  const n = state.adminNotice;
  if (!n) return;
  if (!n.self) Account.clearNotice(n.id); // lokale Selbst-Notiz hat keinen Cloud-Eintrag
  state.adminNotice = null; // onValue liefert danach ggf. die nächste
}
function adminNoticeText(n) {
  if (!n) return '';
  const from = n.from || 'Admin';
  // Selbstgabe: eigener Text (kein „{from} hat dir …"); Betrag mit Vorzeichen.
  if (n.self) {
    if (n.kind === 'currency') { const a = n.amount ?? 0; return t('notice.currencySelf', { n: (a >= 0 ? '+' : '') + a }); }
    const it = adminItemLabel(n.item || '');
    return t(n.kind === 'revoke' ? 'notice.revokeSelf' : 'notice.giftSelf', { item: it });
  }
  if (n.kind === 'currency') return t('notice.currency', { from, n: n.amount ?? 0 });
  const item = adminItemLabel(n.item || '');
  return t(n.kind === 'revoke' ? 'notice.revoke' : 'notice.gift', { from, item });
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
    try {
      // Erst den letzten Stand in die Cloud sichern (best effort), dann lokal
      // ALLES löschen: Die Cloud ist die Wahrheit — blieben die Daten lokal,
      // könnte man sie mit einem frisch registrierten Zweit-Account erneut
      // hochladen (Duplikat). Beim erneuten Login desselben Kontos kommt alles
      // aus der Cloud zurück (reconcile: takeCloud).
      await Account.syncNow();
      const r = await Account.signOutAccount();
      if (r.ok) { deleteAllData(); log('account', 'Abgemeldet — lokale Daten zurückgesetzt'); }
      if (r.reload) safeReload('account-signout');
    } finally { state.account.busy = false; }
  });
}
// Passwort direkt ändern: neues Passwort zweimal eingeben + Speichern (ohne altes).
async function doChangePassword() {
  const a = state.account;
  a.error = null; a.notice = null;
  if (a.pwNew1 !== a.pwNew2) { a.error = t('account.pwMismatch'); return; }
  a.busy = true;
  try {
    const r = await Account.changePassword(a.pwNew1);
    if (!r.ok) { a.error = accErr(r.err); return; }
    a.pwNew1 = ''; a.pwNew2 = '';
    showToast(t('account.pwChanged'), 'success', 2200);
  } finally { a.busy = false; }
}
async function doResetPassword() {
  const a = state.account;
  a.error = null; a.notice = null;
  const email = (a.mode === 'in' ? a.email_in : a.email_up).trim();
  const r = await Account.resetPassword(email);
  if (r.ok) a.notice = t('account.resetSent'); else a.error = accErr(r.err);
}
let usernameCheckTimer = 0, usernameCheckSeq = 0;
function startUsernameEdit() {
  const a = state.account;
  a.usernameDraft = a.username || '';
  a.usernameEditing = true; a.usernameCheck = 'unchanged'; a.error = null; a.notice = null;
}
// Live-Eindeutigkeitsprüfung mit Debounce, während getippt wird.
function onUsernameInput() {
  const a = state.account;
  clearTimeout(usernameCheckTimer);
  const draft = (a.usernameDraft || '').trim();
  if (!draft || Account.normalizeUsername(draft) === Account.normalizeUsername(a.username || '')) {
    a.usernameCheck = 'unchanged'; return;
  }
  a.usernameCheck = 'checking';
  const seq = ++usernameCheckSeq;
  usernameCheckTimer = setTimeout(async () => {
    const r = await Account.checkUsernameAvailable(draft, a.username || '');
    if (seq !== usernameCheckSeq) return;   // veraltete Antwort verwerfen
    a.usernameCheck = r.state;
  }, 400);
}
// Speichern nur erlauben, wenn frei/unverändert (oder Prüfung fehlgeschlagen → Server prüft final).
function canSaveUsername() {
  return ['available', 'unchanged', 'error'].includes(state.account.usernameCheck);
}
async function doChangeUsername() {
  const a = state.account;
  if (!canSaveUsername()) return;
  a.busy = true; a.error = null; a.notice = null;
  try {
    const r = await Account.changeUsername(a.usernameDraft.trim());
    if (!r.ok) { a.error = accErr(r.err); if (r.err === 'usernameTaken') a.usernameCheck = 'taken'; return; }
    a.username = r.username; a.usernameEditing = false; a.usernameCheck = 'idle';
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
      deleteAllData();  // wie beim Abmelden: lokale Kopie nicht für neue Konten wiederverwendbar
      showToast(t('account.deleted'), 'success', 2500);
      if (r.reload) setTimeout(() => safeReload('account-auth'), 600);
    } finally { state.account.busy = false; }
  });
}
// ─── Admin (Geschenke/Rollen) ─────────────────────────────────────────────────
// Vollbild-Admin-Konsole öffnen/schließen. Als eigenes Modal (statt inline im
// Konto-Tab), damit die Nutzer-Tabelle nicht unter den Seitenfalz rutscht und
// sicher scrollbar ist — die frühere Inline-Liste war auf iOS oft nicht sichtbar.
function openAdminConsole() {
  state.account.adminConsoleOpen = true;
  if (!state.account.adminUsers.length) adminLoadUsers();
}
function closeAdminConsole() { state.account.adminConsoleOpen = false; }
// Alle User laden (für den durchsuchbaren Browser).
async function adminLoadUsers() {
  const a = state.account; a.adminError = null; a.adminBusy = true;
  try {
    const r = await Account.adminListUsers();
    if (!r.ok) { a.adminError = accErr(r.err); return; }
    a.adminUsers = r.users;
  } finally { a.adminBusy = false; }
}
// Erstellungsdatum eines Users lesbar (leer, wenn unbekannt/Server-Timestamp fehlt).
function adminFmtDate(ts) {
  if (!ts || typeof ts !== 'number') return '—';
  try { return new Date(ts).toLocaleDateString(state.settings.locale || 'de'); } catch { return '—'; }
}
// Auswahl-Listen fürs Bearbeiten-Modal: statt Freitext alle BEKANNTEN Werte
// anbieten (statisch bekannte IDs + alles, was in den geladenen Nutzern real
// vorkommt) — der Admin muss keine Schlüssel auswendig kennen.
function adminItemOptions() {
  const ids = new Set([SKIN_ID, FOUNDER_ID]);
  // Alle kaufbaren Sieganimationen sind auch verschenkbar (Confetti nicht — die gehört allen).
  for (const e of WIN_EFFECTS) if (e.id !== CONFETTI_ID) ids.add(winEffectInvKey(e.id));
  for (const it of SHOP_CATALOG) ids.add(shopInvKey(it));
  for (const u of state.account.adminUsers) Object.keys(u.inventory || {}).forEach((k) => ids.add(k));
  return [...ids].sort();
}
// Verschenkbare Artikel NACH KATEGORIE gruppiert — für den Shop-artigen
// Geschenk-Auswahl-Screen (statt einer rohen Dropdown-Liste aus IDs). Jede
// Kategorie: { key, title (übersetzt), icon, items:[{id (Inventar-Key), label, icon}] }.
function adminGiftCategories() {
  const cats = [];
  // 1) Sieganimationen (alle außer Confetti)
  cats.push({
    key: 'winfx', title: t('shop.winFxTitle'), icon: 'party',
    items: WIN_EFFECTS.filter((e) => e.id !== CONFETTI_ID)
      .map((e) => ({ id: winEffectInvKey(e.id), label: adminItemLabel(winEffectInvKey(e.id)), icon: e.icon || 'party' })),
  });
  // 2) Shop-Kategorien (Paletten/Themes/Rahmen/Schriften/Skin-Presets/Sounds/Musik)
  for (const cat of Object.keys(SHOP_CATS)) {
    const items = shopCatItems(cat).map((it) => ({ id: shopInvKey(it), label: adminItemLabel(shopInvKey(it)), icon: it.icon || SHOP_CATS[cat].icon }));
    if (items.length) cats.push({ key: cat, title: shopCategoryTitle(cat), icon: SHOP_CATS[cat].icon, items });
  }
  // 3) Besonderes: dynamischer Skin + Gründer-Abzeichen
  cats.push({
    key: 'special', title: t('admin.giftSpecial'), icon: 'star',
    items: [
      { id: SKIN_ID, label: adminItemLabel(SKIN_ID), icon: 'brush' },
      { id: FOUNDER_ID, label: adminItemLabel(FOUNDER_ID), icon: 'crown' },
    ],
  });
  return cats;
}
// Gesamtzahl der freischaltbaren Artikel (für die „besessen / möglich"-Anzeige):
// alle Sieganimationen außer Confetti + kompletter Shop-Katalog + Skin + Founder.
function adminGiftTotal() {
  return WIN_EFFECTS.filter((e) => e.id !== CONFETTI_ID).length + SHOP_CATALOG.length + 2;
}
// Wie viele der freischaltbaren Katalog-Artikel besitzt der Nutzer? (Zähler, damit
// „X / Y" konsistent aus DERSELBEN Menge kommt und nie größer als das Total wird.)
function adminOwnedOfTotal(u) {
  const inv = (u && u.inventory) || {};
  let n = 0;
  for (const e of WIN_EFFECTS) if (e.id !== CONFETTI_ID && inv[winEffectInvKey(e.id)]) n++;
  for (const it of SHOP_CATALOG) if (inv[shopInvKey(it)]) n++;
  if (inv[SKIN_ID]) n++; if (inv[FOUNDER_ID]) n++;
  return n;
}
function openAdminGiftPicker() { state.account.adminGiftPickerOpen = true; }
function closeAdminGiftPicker() { state.account.adminGiftPickerOpen = false; }
// Zustand eines Artikels im Picker: 'owned' (hat der Nutzer schon) | 'grant'
// (gestaged zu verschenken) | null. Revokes laufen weiter über die Chip-Xe.
function adminGiftItemState(id) {
  const a = state.account;
  if (a.adminInvPending[id] === 'grant') return 'grant';
  const inv = (a.adminEditUser && a.adminEditUser.inventory) || {};
  return inv[id] ? 'owned' : null;
}
// Klick im Picker: nicht-besessene Artikel als Geschenk vor-/abwählen.
function adminToggleGiftItem(id) {
  if (adminGiftItemState(id) === 'owned') return; // besitzt er schon → nichts tun
  if (state.account.adminInvPending[id] === 'grant') adminUnstageItem(id);
  else adminStageItem(id, 'grant');
}
function adminGiftPendingCount() {
  return Object.values(state.account.adminInvPending).filter((v) => v === 'grant').length;
}
function adminFieldOptions() {
  const keys = new Set(['displayName', 'email']);
  for (const u of state.account.adminUsers) Object.keys(u.profile || {}).forEach((k) => keys.add(k));
  keys.delete('role'); keys.delete('username');  // haben eigene, sichere Admin-Aktionen
  return [...keys].sort();
}
// Client-Filter über die geladene Liste (Username/E-Mail/uid).
function filteredAdminUsers() {
  const q = (state.account.adminFilter || '').trim().toLowerCase();
  const list = state.account.adminUsers || [];
  if (!q) return list;
  return list.filter(u => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || u.uid.toLowerCase().includes(q));
}
// Bearbeiten-Modal für einen User öffnen und Felder vorbelegen.
function openAdminEdit(u) {
  const a = state.account;
  a.adminEditUser = u; a.adminError = null;
  a.adminUsername = u.username || '';
  a.adminEmail = u.email || '';
  a.adminBalance = String(u.balance ?? 0);
  a.adminBalanceMode = 'donate'; a.adminBalanceAmount = '';
  a.adminItem = ''; a.adminFieldKey = ''; a.adminFieldVal = '';
  a.adminData = null; a.adminDataDirty = {}; a.adminInvPending = {}; a.adminDataSection = null;
  a.adminJsonPath = null; a.adminJsonDraft = ''; a.adminJsonError = null;
  adminReloadData();  // frischen /data-Snapshot für den Daten-Editor laden
}
function closeAdminEdit() { state.account.adminEditUser = null; state.account.adminDataDirty = {}; state.account.adminInvPending = {}; state.account.adminJsonPath = null; }

// ─── Admin-Daten-Editor: JEDES Feld des Nutzer-Snapshots einsehbar/setzbar ─────
// Sektionen mit Icon + i18n-Label; bekannte zuerst in sinnvoller Reihenfolge,
// alles Übrige (z.B. activeGame) generisch dahinter — nichts bleibt uneditierbar.
const ADMIN_DATA_SECTIONS = [
  { key: 'wallet', ic: 'coin' }, { key: 'daily', ic: 'flame' }, { key: 'stats', ic: 'chart' },
  { key: 'achievements', ic: 'medal' }, { key: 'race', ic: 'swords' }, { key: 'settings', ic: 'gear' },
  { key: 'profile', ic: 'user' }, { key: 'history', ic: 'scroll' },
];
const ADMIN_DATA_META_KEYS = ['rev', 'ts', 'v', 'label'];  // Sync-Metadaten, nie editieren
async function adminReloadData() {
  const uid = adminEditUid(); if (!uid) return;
  const a = state.account; a.adminDataLoading = true;
  try {
    const r = await Account.adminGetUserData(uid);
    if (r.ok) a.adminData = r.data; else a.adminError = accErr(r.err);
  } finally { a.adminDataLoading = false; }
}
function adminDataSections() {
  const d = state.account.adminData; if (!d) return [];
  // 💰 Wallet IMMER anzeigen, auch wenn im Snapshot noch kein wallet-Knoten liegt
  // (frisch angelegter Nutzer): sonst gäbe es kein editierbares Guthaben-Feld und
  // der Admin könnte gar nichts anklicken. adminFieldRows synthetisiert dann balance:0.
  const known = ADMIN_DATA_SECTIONS.filter(s => d[s.key] !== undefined || s.key === 'wallet');
  const rest = Object.keys(d)
    .filter(k => !ADMIN_DATA_SECTIONS.some(s => s.key === k) && !ADMIN_DATA_META_KEYS.includes(k))
    .sort().map(k => ({ key: k, ic: 'box' }));
  return [...known, ...rest];
}
function adminSectionLabel(key) { const k = 'admin.sec.' + key; const s = t(k); return s === k ? key : s; }
// Felder einer Sektion als flache, typisierte Zeilen. Eine Ebene tief werden
// reine Primitiv-Objekte aufgefaltet (z.B. daily.currentStreak); alles Tiefere
// (byDifficulty, Arrays, activeGame) bekommt den JSON-Untereditor.
function adminFieldRows(secKey) {
  let sec = state.account.adminData ? state.account.adminData[secKey] : undefined;
  // Fehlt der Wallet-Knoten (frischer Nutzer), trotzdem ein editierbares
  // balance-Feld mit Standard 0 anbieten — Speichern legt wallet/balance neu an.
  if (secKey === 'wallet' && (sec === undefined || sec === null)) sec = { balance: 0 };
  const rows = [];
  const push = (path, label, val) => {
    const ty = typeof val;
    if (val === null || ty === 'string' || ty === 'number' || ty === 'boolean') {
      rows.push({ path, label, type: val === null ? 'string' : ty, value: val });
    } else rows.push({ path, label, type: 'json', value: val });
  };
  if (sec === null || typeof sec !== 'object') { push(secKey, secKey, sec); return rows; }
  if (Array.isArray(sec)) { push(secKey, secKey, sec); return rows; }
  for (const [k, v] of Object.entries(sec)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const entries = Object.entries(v);
      const allPrim = entries.length && entries.every(([, x]) => x === null || typeof x !== 'object');
      if (allPrim && entries.length <= 12) entries.forEach(([k2, v2]) => push(`${secKey}/${k}/${k2}`, `${k} · ${k2}`, v2));
      else push(`${secKey}/${k}`, k, v);
    } else push(`${secKey}/${k}`, k, v);
  }
  return rows;
}
function toggleAdminSection(key) { const a = state.account; a.adminDataSection = a.adminDataSection === key ? null : key; }
// Sektion gezielt aufklappen (nicht toggeln) — für die Kennzahlen-Chips oben.
function openAdminSection(key) { state.account.adminDataSection = key; }
// ── Klartext-Übersetzung (admin.dict in i18n): Der Admin soll NICHTS über die
//    DB wissen müssen — jedes bekannte Feld bekommt Klarnamen + Beschreibung,
//    Auswahlfelder eine Dropdown-Liste aller möglichen Werte in Klartext und
//    Zeitstempel ein lesbares Datum. Unbekannte Felder fallen auf den rohen
//    Schlüssel zurück und bleiben voll editierbar. ─────────────────────────────
function adminDictLookup(path, kind) {
  const parts = path.split('/');
  const tries = [path];
  if (parts.length === 3) tries.push(`${parts[0]}/*/${parts[2]}`);  // z.B. race/1v1/racesWon
  for (const k of tries) {
    const key = `admin.dict.f.${k}.${kind}`;
    const v = t(key);
    if (v !== key) return { v, wildcard: k !== path };
  }
  return null;
}
function adminRowLabel(row) {
  const parts = row.path.split('/');
  // Erfolge: reguläre Achievement-Texte wiederverwenden statt eigener Einträge.
  if (parts[0] === 'achievements' && parts[1]) {
    const key = `achievements.${parts[1]}.title`;
    const v = t(key); if (v !== key) return v;
  }
  const hit = adminDictLookup(row.path, 'l');
  if (!hit) return row.label;
  return hit.wildcard ? `${parts[1]} · ${hit.v}` : hit.v;
}
function adminRowDesc(row) {
  const parts = row.path.split('/');
  if (parts[0] === 'achievements' && parts[1]) {
    const key = `achievements.${parts[1]}.desc`;
    const v = t(key); if (v !== key) return v;
  }
  const hit = adminDictLookup(row.path, 'd');
  return hit ? hit.v : null;
}
// Auswahlfelder: bekannte Wertelisten je Pfad → Dropdown statt Freitext.
const ADMIN_ENUM_VALUES = {
  'settings/themeMode': ['auto', 'light', 'dark'],
  'settings/confirmTool': ['pen', 'eraser'],
  'settings/eraseStyle': ['hide', 'strike'],
  'settings/skinStyle': ['solid', 'gradient', 'rainbow'],
  'settings/skinDirection': ['cw', 'ccw'],
  'settings/skinApplyTo': ['kept', 'removed', 'both'],
};
function adminEnumOptions(row) {
  if (row.path === 'settings/language') return SUPPORTED_LOCALES.map((l) => ({ v: l.id, label: l.label }));
  const vals = ADMIN_ENUM_VALUES[row.path];
  if (!vals) return null;
  const leaf = row.path.split('/').pop();
  return vals.map((v) => {
    const key = `admin.dict.o.${leaf}.${v}`;
    const s = t(key);
    return { v, label: s === key ? v : s };
  });
}
function adminItemLabel(id) {
  if (id === 'ALL') return t('admin.allItems'); // Sammel-Geschenk „Alles freischalten"
  if (id === FOUNDER_ID) return t('admin.giftFounder'); // Gründer-Abzeichen (kein Shop-/Dict-Eintrag)
  const key = `admin.dict.o.item.${id}`; const s = t(key);
  if (s !== key) return s;
  // Sieganimationen: Shop-Namen wiederverwenden statt eigener Dict-Einträge.
  if (id.startsWith('winfx_')) { const k2 = `shop.effect.${id.slice(6)}`; const s2 = t(k2); if (s2 !== k2) return s2; }
  // Generische Shop-Artikel: Kategorie-Präfix abtrennen, Shop-Namen nutzen.
  const us = id.indexOf('_');
  if (us > 0 && SHOP_CATS[id.slice(0, us)]) { const k3 = `shop.it.${id.slice(us + 1)}`; const s3 = t(k3); if (s3 !== k3) return s3; }
  return id;
}
// Klartext-Label eines Profilfelds (Auswahl im „Profilfeld setzen“-Dropdown) —
// dieselbe Klartext-Dict wie der Daten-Editor; Unbekanntes bleibt als lesbarer
// Schlüssel (nie leer, aber auch nie ein roher DB-Key, wenn eine Übersetzung existiert).
function adminProfileFieldLabel(k) {
  const key = `admin.dict.f.profile/${k}.l`; const s = t(key);
  return s === key ? k : s;
}
// Klartext-Titel für den JSON-Untereditor: ganze Sektion → Sektions-Klarname,
// Feld-Pfad → Feld-Klarname, sonst der rohe Pfad.
function adminPathLabel(path) {
  if (!path) return '';
  const secK = 'admin.sec.' + path; const secV = t(secK); if (secV !== secK) return secV;
  const fK = `admin.dict.f.${path}.l`; const fV = t(fK); if (fV !== fK) return fV;
  return path;
}
// Epoch-Millisekunden als lesbares Datum unter dem Zahlenfeld anzeigen.
function adminRowTimestamp(row) {
  const v = adminFieldValue(row);
  if (typeof v !== 'number' || v < 1e12) return null;
  try { return new Date(v).toLocaleString(state.settings.language || 'de'); } catch (_) { return null; }
}
// Datums-String-Felder (JJJJ-MM-TT) bekommen einen nativen Datums-Picker.
function adminIsDateField(row) { return row.path === 'daily/lastCompletedDate'; }
// Anzeige-Wert einer Zeile: ungespeicherte Änderung gewinnt über den Snapshot.
function adminFieldValue(row) { const d = state.account.adminDataDirty; return row.path in d ? d[row.path] : row.value; }
function adminMarkDirty(path, v) { state.account.adminDataDirty = { ...state.account.adminDataDirty, [path]: v }; }
function adminInputField(row, ev) {
  let v = ev.target.value;
  if (row.type === 'number') { v = Number(v); if (!Number.isFinite(v)) return; }
  adminMarkDirty(row.path, v);
}
function adminToggleField(row) { adminMarkDirty(row.path, !adminFieldValue(row)); }
function adminDirtyCount() { return Object.keys(state.account.adminDataDirty).length + Object.keys(state.account.adminInvPending).length; }
function adminDiscardData() { state.account.adminDataDirty = {}; state.account.adminInvPending = {}; }
// ─── Inventar-Staging (Admin-Gift) ────────────────────────────────────────────
// Grants/Revokes werden NICHT sofort gesendet, sondern gesammelt und erst beim
// „Speichern" (adminSaveData) an die Cloud geschickt — analog zum Daten-Editor.
// So löst z.B. „Alles freischalten" nichts aus, bevor final bestätigt wird.
function adminStageItem(id, action) {
  if (!id) return;
  const a = state.account;
  const owned = !!(a.adminEditUser && a.adminEditUser.inventory && a.adminEditUser.inventory[id]);
  const pend = { ...a.adminInvPending };
  // Staging, das den bereits vorhandenen Zustand wiederherstellt, ist ein No-op
  // (z.B. ein Revoke eines ohnehin nicht besessenen Items) → Eintrag entfernen.
  if ((action === 'grant' && owned) || (action === 'revoke' && !owned)) delete pend[id];
  else pend[id] = action;
  a.adminInvPending = pend;
}
function adminUnstageItem(id) { const pend = { ...state.account.adminInvPending }; delete pend[id]; state.account.adminInvPending = pend; }
// Effektiver Besitz-Zustand FÜR DIE ANZEIGE inkl. gestagter Änderungen:
// besessen ⊕ pending. Liefert die Item-ids, die nach dem Speichern besessen wären.
function adminEffectiveInventoryIds() {
  const a = state.account;
  const owned = (a.adminEditUser && a.adminEditUser.inventory) || {};
  const ids = new Set(Object.keys(owned));
  for (const [id, act] of Object.entries(a.adminInvPending)) {
    if (act === 'grant') ids.add(id); else ids.delete(id);
  }
  return [...ids];
}
function adminItemPendingState(id) { return state.account.adminInvPending[id] || null; }
// ─── Guthaben ändern: spenden (+) / abziehen (−) / Zielwert (=) ────────────────
// Statt das Guthaben fix zu setzen, kann der Admin eine Menge spenden/abziehen
// oder einen Zielwert vorgeben; die Differenz wird berechnet und angezeigt. Die
// Änderung wird — wie alles im Modal — als wallet/balance in adminDataDirty
// GESTAGT und erst beim „Speichern" gesendet. Der Empfänger sieht die Differenz
// dann im Geldverlauf (applyCloudWallet bucht sie beim Sync, s. storage.js).
function adminBalanceCurrent() {
  // Aktueller (ggf. bereits gestagter) Stand — konsistent mit den Kopf-Chips.
  const v = adminChipValue('wallet/balance', (state.account.adminEditUser && state.account.adminEditUser.balance) ?? 0);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function adminBalanceTarget() {
  const cur = adminBalanceCurrent();
  const amt = Math.max(0, Math.floor(parseInt(state.account.adminBalanceAmount, 10) || 0));
  const mode = state.account.adminBalanceMode;
  if (mode === 'donate') return cur + amt;
  if (mode === 'subtract') return Math.max(0, cur - amt);
  return amt; // 'target'
}
function adminBalanceDelta() { return adminBalanceTarget() - adminBalanceCurrent(); }
function adminSetBalanceMode(m) { state.account.adminBalanceMode = m; }
// Vormerken: den berechneten Zielwert als wallet/balance stagen (Speichern sendet).
function adminApplyBalanceChange() {
  if (!state.account.adminBalanceAmount) return;
  adminMarkDirty('wallet/balance', adminBalanceTarget());
  state.account.adminBalanceAmount = '';
}
// Kurzer Hinweis auf ungespeicherte Inventar-Änderungen (erst beim Speichern gesendet).
function adminPendingSummary() {
  const pend = state.account.adminInvPending;
  const g = Object.values(pend).filter((v) => v === 'grant').length;
  const r = Object.values(pend).filter((v) => v === 'revoke').length;
  if (!g && !r) return '';
  return t('admin.pendingItems', { grant: g, revoke: r });
}
// Chip-Liste fürs Inventar inkl. Staging: besessene Items (evtl. als Revoke
// markiert) + vorgemerkte Grants (noch nicht besessen). `pending` steuert die Optik.
function adminInventoryDisplay() {
  const a = state.account;
  const owned = (a.adminEditUser && a.adminEditUser.inventory) || {};
  const ids = new Set(Object.keys(owned));
  for (const [id, act] of Object.entries(a.adminInvPending)) if (act === 'grant') ids.add(id);
  return [...ids].sort().map((id) => ({ id, label: adminItemLabel(id), pending: adminItemPendingState(id) }));
}
async function adminSaveData() {
  const a = state.account; const uid = adminEditUid();
  if (!uid || !adminDirtyCount()) return;
  a.adminBusy = true; a.adminError = null;
  // Selbst-Bearbeitung des eigenen Guthabens: vorherigen Stand + ob überhaupt eine
  // Guthaben-Änderung gestaged ist merken, um die Differenz danach im EIGENEN
  // Geldverlauf zu buchen (der Snapshot-Import unten setzt den Saldo, protokolliert
  // ihn aber nicht — Ursache dafür, dass Selbstgaben nicht im Verlauf auftauchten).
  const isSelfEdit = uid === state.account.uid;
  const selfPrevBalance = isSelfEdit ? (loadWallet().balance || 0) : 0;
  const selfBalanceStaged = isSelfEdit && ('wallet/balance' in a.adminDataDirty);
  // Guthaben-Änderung an einen ANDEREN Nutzer: Vorher-Stand + Zielwert festhalten,
  // um danach eine Benachrichtigung mit der Differenz zu senden.
  const walletStaged = 'wallet/balance' in a.adminDataDirty;
  const otherPrevBalance = (!isSelfEdit && a.adminEditUser) ? (a.adminEditUser.balance || 0) : 0;
  const walletTarget = walletStaged ? (Number(a.adminDataDirty['wallet/balance']) || 0) : 0;
  // updatedAt MITSCHREIBEN, sobald sich der Saldo ändert — sonst greift die
  // watchGifts-Gate (Cloud.updatedAt > lokal.updatedAt) beim Empfänger nicht →
  // keine Live-Übernahme und KEIN Eintrag im Geldverlauf (applyCloudWallet).
  if (walletStaged) a.adminDataDirty['wallet/updatedAt'] = Date.now();
  try {
    // 1) /data-Snapshot-Änderungen (falls vorhanden) senden.
    if (Object.keys(a.adminDataDirty).length) {
      const r = await Account.adminSetUserData(uid, a.adminDataDirty);
      if (!r.ok) { a.adminError = accErr(r.err); return; }
      a.adminDataDirty = {};
    }
    // Fremd-Empfänger über die Guthaben-Änderung benachrichtigen (Selbstgabe wird
    // weiter unten separat behandelt). Der Geldverlauf des Empfängers wird bei IHM
    // via applyCloudWallet (watchGifts, dank updatedAt-Bump) gebucht.
    if (!isSelfEdit && walletStaged) {
      const delta = walletTarget - otherPrevBalance;
      if (delta) adminNotifyUser(uid, { kind: 'currency', amount: delta });
    }
    // 2) Gestagte Inventar-Änderungen (Grants/Revokes) JETZT anwenden — vorher
    // löste jeder Klick sofort aus; jetzt erst hier beim „Speichern".
    const pend = a.adminInvPending;
    const grants = Object.keys(pend).filter((id) => pend[id] === 'grant');
    const revokes = Object.keys(pend).filter((id) => pend[id] === 'revoke');
    if (grants.length) {
      const r = await Account.adminGrantItems(uid, grants);
      if (!r.ok) { a.adminError = accErr(r.err); return; }
      for (const id of grants) adminMirrorSelfItem(uid, id, true);
      adminNotifyUser(uid, { kind: 'gift', item: grants.length > 1 ? 'ALL' : grants[0] });
      log('account', 'Admin: Items freigeschaltet (gestaged)', { uid, count: grants.length });
    }
    for (const id of revokes) {
      const r = await Account.adminRevokeItem(uid, id);
      if (!r.ok) { a.adminError = accErr(r.err); return; }
      adminMirrorSelfItem(uid, id, false);
      adminNotifyUser(uid, { kind: 'revoke', item: id });
    }
    a.adminInvPending = {};
    await adminReloadData();   // frischer Stand ins Formular…
    // SELBST-Bearbeitung: sofort auf DIESEM Gerät übernehmen. Ohne das bliebe
    // lokal der alte Stand — und der eigene Auto-Sync würde die Cloud-Änderung
    // beim nächsten Upload wieder überschreiben (Symptom: „speichert nicht").
    // Import bewahrt role/accountId (siehe importFromFile); rev-Abgleich stellt
    // lokal == Cloud == Basislinie her, damit weder Upload noch reconcile die
    // Änderung anfassen. Danach die reaktiven States auffrischen (Muster wie
    // beim Datei-Import).
    if (uid === state.account.uid && a.adminData) {
      importFromFile(JSON.stringify(a.adminData));
      const rev = a.adminData.rev || 0;
      setDataRev(rev); setSyncedRev(rev);
      // Das VOLLE Union-Inventar aus der Cloud nachziehen: der `data`-Snapshot hat nur
      // die zuletzt hochgeladene Inventar-Kopie — gerade freigeschaltete Items (auch
      // via „Alles freischalten"), die schon im Union-Knoten liegen, aber nie
      // synchronisiert wurden, fehlten sonst lokal bis zum Neustart.
      await Account.syncInventoryFromCloud(uid);
      state.settings = loadSettings(); state.stats = loadStats(); state.streak = loadStreak();
      state.wallet = loadWallet(); state.inventory = loadInventory(); state.puzzleHistory = loadHistory();
      applyTheme(); applySfxPack(); applyMusicPack(); applyLocale(); refreshResume();
      log('account', 'Admin: eigene Daten lokal übernommen');
      // Eigene Guthaben-Änderung nachträglich im Geldverlauf buchen (Saldo ist
      // durch den Import schon korrekt) + lokale Benachrichtigung zeigen.
      if (selfBalanceStaged) {
        const delta = (loadWallet().balance || 0) - selfPrevBalance;
        if (delta) {
          noteWalletTransaction(delta, 'admin');
          adminNotifyUser(uid, { kind: 'currency', amount: delta });
          log('account', 'Admin: Selbst-Guthaben gebucht', { delta });
        }
      }
    }
    await adminLoadUsers();    // …und Tabelle (Guthaben etc.) auffrischen
    const fresh = a.adminUsers.find(u => u.uid === uid);
    if (fresh) a.adminEditUser = fresh;
    showToast(t('admin.saved'), 'success', 1800);
  } finally { a.adminBusy = false; }
}
// JSON-Untereditor für tiefe Strukturen (byDifficulty, history, activeGame, …).
function openAdminJson(row) {
  const a = state.account;
  a.adminJsonPath = row.path; a.adminJsonError = null;
  a.adminJsonDraft = JSON.stringify(adminFieldValue(row), null, 2);
}
function closeAdminJson() { state.account.adminJsonPath = null; state.account.adminJsonError = null; }
function saveAdminJson() {
  const a = state.account;
  try {
    const parsed = JSON.parse(a.adminJsonDraft);
    adminMarkDirty(a.adminJsonPath, parsed);
    closeAdminJson();
  } catch (e) { a.adminJsonError = String(e.message || e); }
}
// Kopf-Chips: Live-Werte bevorzugt aus dem frischen Snapshot (inkl. Dirty-Werte).
function adminChipValue(path, fallback) {
  const dirty = state.account.adminDataDirty;
  if (path in dirty) return dirty[path];
  const parts = path.split('/');
  let cur = state.account.adminData;
  for (const p of parts) { if (cur == null || typeof cur !== 'object') { cur = undefined; break; } cur = cur[p]; }
  return cur ?? fallback;
}
async function adminAction(fn, ...args) {
  const a = state.account; a.adminError = null; a.adminBusy = true;
  try {
    const r = await fn(...args);
    if (!r.ok) { a.adminError = accErr(r.err); return false; }
    await adminLoadUsers();  // Liste auffrischen…
    // …und das offene Modal auf den frischen Stand des Users heben.
    if (a.adminEditUser) {
      const fresh = a.adminUsers.find(u => u.uid === a.adminEditUser.uid);
      if (fresh) { a.adminEditUser = fresh; a.adminBalance = String(fresh.balance ?? 0); a.adminEmail = fresh.email || ''; a.adminUsername = fresh.username || ''; }
    }
    showToast(t('admin.done'), 'success', 1800);
    return true;
  } finally { a.adminBusy = false; }
}
function adminEditUid() { return state.account.adminEditUser && state.account.adminEditUser.uid; }
// Selbst-gerichtete Admin-Aktionen sofort lokal spiegeln: Grant/Revoke/Guthaben
// schreiben direkt in die Cloud — das EIGENE Gerät sähe das sonst erst beim
// Start-Reconcile (Symptom: selbst verschenkte Items erst nach Neustart
// ausrüstbar). Inventar lokal idempotent nachziehen (Union-Semantik bleibt
// gewahrt), Wallet per Differenz angleichen; die reaktiven States springen mit.
// Fremde Nutzer über die Änderung benachrichtigen (persistente RTDB-Notiz;
// kommt auch offline an — beim nächsten App-Start). Nur wenn der Haken an ist.
function adminNotifyUser(uid, notice) {
  if (!uid || !state.account.adminNotify) return;
  // Selbst-Aktion: es gibt keinen fremden Empfänger — die Benachrichtigung lokal
  // anzeigen (statt sie zu verschlucken), damit man auch bei Selbstgabe Feedback
  // bekommt. Fremde Nutzer bekommen die persistente RTDB-Notiz wie bisher.
  if (uid === state.account.uid) { showSelfAdminNotice(notice); return; }
  Account.sendAdminNotice(uid, { ...notice, from: state.account.username || 'Admin' });
}
// Lokale Admin-Benachrichtigung (Selbstgabe): nutzt dasselbe Notice-Modal wie
// eine empfangene Gabe, aber ohne Cloud-Umweg. `self:true` steuert den Text +
// verhindert das Cloud-Löschen beim Schließen (es gibt keinen Cloud-Eintrag).
function showSelfAdminNotice(notice) {
  state.adminNotice = { ...notice, self: true, id: 'self-' + Date.now() };
}
function adminAfterItem(uid, id, granted) {
  adminMirrorSelfItem(uid, id, granted);
  adminNotifyUser(uid, { kind: granted ? 'gift' : 'revoke', item: id });
}
function adminAfterBalance(uid, n) {
  adminMirrorSelfBalance(uid, n);
  adminNotifyUser(uid, { kind: 'currency', amount: n });
}
function adminMirrorSelfItem(uid, id, granted) {
  if (!uid || uid !== state.account.uid) return;
  state.inventory = granted ? grantInventory(id, 'gift') : revokeInventory(id);
  log('account', 'Admin: Selbst-Geschenk lokal gespiegelt', { id, granted });
}
function adminMirrorSelfBalance(uid, n) {
  if (!uid || uid !== state.account.uid) return;
  const cur = loadWallet().balance || 0;
  if (n > cur) grantCurrency(n - cur, 'admin');
  else if (n < cur) spendCurrency(cur - n, 'admin');
  state.wallet = loadWallet();
}
// Grant/Revoke werden jetzt GESTAGT (erst bei „Speichern" gesendet, s.
// adminSaveData) statt sofort geschrieben.
function adminGrantSkin() { adminStageItem('dynamicColor', 'grant'); }
function adminRevokeSkin() { adminStageItem('dynamicColor', 'revoke'); }
function adminToggleRole() {
  const u = state.account.adminEditUser; if (!u) return;
  adminAction(Account.adminSetRole, u.uid, u.role === 'admin' ? 'user' : 'admin');
}
function adminSetBalance() { const uid = adminEditUid(); const n = parseInt(state.account.adminBalance || '0', 10); if (uid) adminAction(Account.adminSetCurrency, uid, n).then((ok) => ok && adminAfterBalance(uid, Math.max(0, Math.floor(n || 0)))); }
function adminChangeUsername() { const uid = adminEditUid(); const n = state.account.adminUsername.trim(); if (uid && n) adminAction(Account.adminSetUsername, uid, n); }
// Auswahl aus dem Dropdown STAGEN (nicht sofort senden); danach die Auswahl leeren.
function adminGrantAnyItem() { const id = state.account.adminItem.trim(); if (id) { adminStageItem(id, 'grant'); state.account.adminItem = ''; } }
// „Alles freischalten": alle bekannten Items (Sieganimationen, Shop-Artikel, Skin,
// Founder), die der Nutzer nach aktuellem Staging noch NICHT besitzt, als Grant
// vormerken — wird ebenfalls erst beim „Speichern" gesendet.
function adminGrantAllItems() {
  const have = new Set(adminEffectiveInventoryIds());
  const ids = adminItemOptions().filter((id) => !have.has(id));
  if (!ids.length) { showToast(t('admin.nothingToGrant'), 'success', 1800); return; }
  for (const id of ids) adminStageItem(id, 'grant');
}
// ✕ an einem Chip toggelt den Staging-Zustand: gestagten Grant/Revoke zurücknehmen,
// sonst (besessenes Item) einen Revoke vormerken. Nichts wird sofort gesendet.
function adminRevokeItemId(id) {
  if (!id) return;
  if (state.account.adminInvPending[id]) adminUnstageItem(id); // gestagte Änderung rückgängig
  else adminStageItem(id, 'revoke');
}
function adminRevokeAnyItem() { const id = state.account.adminItem.trim(); if (id) { adminStageItem(id, 'revoke'); state.account.adminItem = ''; } }
function adminSetField() { const uid = adminEditUid(); const k = state.account.adminFieldKey.trim(); if (uid && k) adminAction(Account.adminSetProfileField, uid, k, state.account.adminFieldVal); }
async function adminResetPw() {
  const a = state.account; const email = (a.adminEmail || (a.adminEditUser && a.adminEditUser.email) || '').trim();
  if (!email) { a.adminError = accErr('invalidEmail'); return; }
  a.adminBusy = true; a.adminError = null;
  try {
    const res = await Account.adminSendPasswordReset(email);
    if (!res.ok) { a.adminError = accErr(res.err); return; }
    showToast(t('admin.resetSent'), 'success', 2600);
  } finally { a.adminBusy = false; }
}

// ─── Freunde & Präsenz ────────────────────────────────────────────────────────
let friendsUnwatch = null, presenceUnwatch = null, presenceGameTimer = 0;
function openFriends() {
  if (!isOnline()) { showToast(t('offline.unavailable'), 'error', 2600); return; }
  if (state.account.status !== 'in') { openSettings(); state.settingsTab = 'konto'; return; }
  state.friends.open = true; state.friends.tab = 'friends';
  state.friends.addName = ''; state.friends.addError = null; state.friends.addNotice = null;
  startFriendsWatch();
}
function closeFriends() { state.friends.open = false; stopLeaderboardWatch(); }
function setFriendsTab(tab) {
  state.friends.tab = tab;
  if (tab === 'leaderboard') startLeaderboardWatch();
  else stopLeaderboardWatch();
}
// ─── Bestenliste ──────────────────────────────────────────────────────────────
let leaderboardUnwatch = null;
async function startLeaderboardWatch() {
  stopLeaderboardWatch();
  // Alte Einträge stehen lassen, bis die neuen ankommen — verhindert das
  // Leer-/Lade-Flackern beim Schwierigkeit-Wechsel. Nur beim ERSTEN Laden
  // (noch keine Einträge) zeigen wir den Lade-Hinweis.
  state.leaderboard.loading = !state.leaderboard.entries.length;
  const forDiff = state.leaderboard.diff;
  leaderboardUnwatch = await Account.watchLeaderboard(forDiff, (entries) => {
    // Nur anwenden, wenn die Antwort noch zur aktuell gewählten Schwierigkeit passt.
    if (state.leaderboard.diff !== forDiff) return;
    state.leaderboard.entries = entries;
    state.leaderboard.loading = false;
  });
}
function stopLeaderboardWatch() {
  try { leaderboardUnwatch && leaderboardUnwatch(); } catch (_) {}
  leaderboardUnwatch = null;
}
function selectLeaderboardDiff(id) {
  if (state.leaderboard.diff === id) return;
  log('app', 'Bestenliste: Schwierigkeit gewechselt', { diff: id });
  state.leaderboard.diff = id;
  if (state.friends.tab === 'leaderboard') startLeaderboardWatch();
}
// Live-Listener auf Freunde/Anfragen aufsetzen und Präsenz aller Freunde nachziehen.
async function startFriendsWatch() {
  if (friendsUnwatch) return;   // schon aktiv
  friendsUnwatch = await Account.watchFriends((upd) => {
    if (upd.friends) state.friends.list = upd.friends;
    if (upd.requests) state.friends.requests = upd.requests;
    rearmPresenceWatch();
  });
}
function stopFriendsWatch() {
  try { friendsUnwatch && friendsUnwatch(); } catch (_) {}
  try { presenceUnwatch && presenceUnwatch(); } catch (_) {}
  friendsUnwatch = presenceUnwatch = null;
}
// Präsenz-Listener auf die aktuelle Freundes-uid-Menge neu aufsetzen.
async function rearmPresenceWatch() {
  try { presenceUnwatch && presenceUnwatch(); } catch (_) {}
  const uids = state.friends.list.map((f) => f.uid);
  presenceUnwatch = await Account.watchPresence(uids, (uid, status) => { state.friends.presence[uid] = status; });
}
function openAddFriend() { const f = state.friends; f.addOpen = true; f.addName = ''; f.addError = null; f.addNotice = null; }
function closeAddFriend() { state.friends.addOpen = false; }
async function addFriend() {
  const f = state.friends;
  const name = (f.addName || '').trim();
  if (!name) return;
  f.addBusy = true; f.addError = null; f.addNotice = null;
  try {
    const r = await Account.sendFriendRequest(name);
    if (!r.ok) { const k = 'friends.err.' + r.err, s = t(k); f.addError = s === k ? accErr(r.err) : s; return; }
    f.addName = ''; f.addOpen = false;
    showToast(t('friends.requestSent', { name }), 'success', 2600);
  } finally { f.addBusy = false; }
}
async function acceptFriend(req) {
  const r = await Account.acceptFriendRequest(req.uid, req.username);
  if (r.ok) showToast(t('friends.nowFriends', { name: req.username || req.uid }), 'success', 2500);
}
async function declineFriend(req) { await Account.declineFriendRequest(req.uid); }
function removeFriendAsk(fr) {
  ask(t('friends.removeTitle'), t('friends.removeMsg', { name: fr.username || fr.uid }), async () => {
    await Account.removeFriend(fr.uid);
  });
}
// Sortierte Freundesliste (im Spiel > online > offline, dann alphabetisch).
function friendsSorted() { return Account.sortFriends(state.friends.list, state.friends.presence); }
function friendPresence(uid) { return state.friends.presence[uid] || null; }
// „Im Spiel" nur, wenn ONLINE und eine Partie läuft — eine veraltete game-Info
// eines offline gegangenen Freundes darf nie als „im Spiel" gezeigt werden.
function friendOnline(uid) { const p = state.friends.presence[uid]; return !!(p && p.online); }
// Ist mindestens ein Freund online (egal ob im Spiel)? → grüner Punkt am 👫-Button.
function anyFriendOnline() { return state.friends.list.some((f) => friendOnline(f.uid)); }
function friendInGame(uid) { const p = state.friends.presence[uid]; return !!(p && p.online && p.game); }
// Relative Zeitangabe („vor 5 Min", „gestern", „vor 3 Tagen") aus einem
// Epoch-Millisekunden-Zeitstempel — via Intl.RelativeTimeFormat in der UI-Sprache.
function fmtRelative(ts) {
  if (!ts || typeof ts !== 'number') return '';
  const diffMs = Date.now() - ts;
  const abs = Math.abs(diffMs);
  const locale = state.settings.language || i18nState.locale || 'de';
  let rtf; try { rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }); } catch (_) { return ''; }
  const units = [['year', 31536e6], ['month', 2592e6], ['day', 864e5], ['hour', 36e5], ['minute', 6e4]];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'minute') return rtf.format(-Math.round(diffMs / ms), unit);
  }
  return '';
}
// Menschlicher Aktivitätstext für einen Freund.
function friendActivityText(uid) {
  const p = state.friends.presence[uid];
  if (!p || !p.online) {
    // Offline: wenn bekannt, zeigen, wann der Freund zuletzt aktiv war.
    const rel = p && p.lastActive ? fmtRelative(p.lastActive) : '';
    return rel ? t('friends.offlineSince', { when: rel }) : t('friends.offline');
  }
  if (!p.game) return t('friends.online');
  const g = p.game;
  const mode = t('friends.mode.' + (g.mode || 'solo'));
  const diff = g.difficulty ? t('difficulty.' + g.difficulty) : '';
  const parts = [mode, diff, g.size].filter(Boolean).join(' · ');
  return t('friends.inGame', { info: parts });
}
// ── Eigene Präsenz veröffentlichen ──
// gameInfo aus dem aktuellen State ableiten (oder null im Menü).
function currentGameInfo() {
  if (!gameSessionActive() || !state.puzzle) return null;
  return {
    mode: state.coop.active ? (state.race.active ? 'race' : state.team.active ? 'team' : 'coop') : 'solo',
    difficulty: state.puzzle.difficulty || null,
    size: `${state.puzzle.rows}×${state.puzzle.cols}`,
    pct: progressPct(),
  };
}
function pushPresence() {
  if (state.account.status !== 'in') return;
  Account.publishPresence(currentGameInfo(), myBadge());
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
  // EXKLUSIV für Bestandsspieler, die den Sprung auf 1.0 aktiv miterlebt haben
  // (zuletzt gesehene Version <1.0). Neue Installationen bekommen weder Skin
  // noch Founder-Abzeichen automatisch — nur per Freischaltcode/Admin-Geschenk.
  if (!qualifiesForV1Skin(loadSeenVersion(), BUILD)) return;
  if (!state.inventory[SKIN_ID]) grantSkin('v1celebration');
  if (!state.inventory[FOUNDER_ID]) {
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
// Fenster BEWUSST großzügig (3 min): ein Reload-Loop muss auch dann erkannt werden,
// wenn die Zyklen LANGSAM sind (z.B. exakt alle ~36 s durch einen periodischen
// Auslöser). Bei 60 s Fenster passten bei 36-s-Abstand nie 3 Reloads hinein → die
// Bremse hätte nie ausgelöst und der Loop wäre endlos gelaufen. Nur unsere EIGENEN
// (safeReload-)Neuladungen zählen hier — ein normales Kalt-Öffnen der PWA nicht.
const RELOAD_WINDOW_MS = 180000, RELOAD_MAX = 3;
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
  // 1b) Lebenszyklus-Diagnose: warum verschwindet die App mitten im Spiel? pagehide/
  //     freeze feuern, wenn iOS/der Browser die PWA in den Hintergrund oder aus dem
  //     Speicher schiebt; ein direkt danach folgender „App gestartet"-Eintrag im
  //     Protokoll bedeutet: das OS hat die App neu geladen (nicht unser Code). Ein
  //     'error'-Eintrag davor bedeutet stattdessen einen Absturz im JS. Alle Events
  //     sind selten (nutzergetrieben) → unbedenklich fürs Protokoll.
  const lifeInfo = () => ({ screen: state.screen, status: state.status, coop: !!state.coop.active, inGame: gameSessionActive() });
  window.addEventListener('pagehide', (e) => log('app', 'pagehide (Seite versteckt/entladen)', { persisted: !!e.persisted, ...lifeInfo() }));
  window.addEventListener('beforeunload', () => log('app', 'beforeunload (Seite wird entladen)', lifeInfo()));
  document.addEventListener('freeze', () => log('app', 'freeze (Browser friert Seite ein)', lifeInfo()));
  document.addEventListener('resume', () => log('app', 'resume (aus dem Freeze zurück)', lifeInfo()));
  document.addEventListener('visibilitychange', () => log('app', 'visibility → ' + document.visibilityState, lifeInfo()));
  // „Letzter Lebenszustand": alle 15 s in einen EIGENEN localStorage-Key schreiben
  // (kein Protokoll-Spam). Beim nächsten Start wird er als eine Zeile protokolliert
  // → so ist der letzte bekannte Zustand VOR einem harten OS-Kill/Absturz sichtbar,
  // auch wenn kein pagehide mehr durchkam.
  try {
    const prev = localStorage.getItem('cns_last_alive');
    if (prev) log('app', 'Letzter Zustand vor (Neu-)Start', JSON.parse(prev));
  } catch (_) {}
  setInterval(() => { try { localStorage.setItem('cns_last_alive', JSON.stringify({ atISO: new Date().toISOString(), ...lifeInfo() })); } catch (_) {} }, 15000);
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

// ── Globaler Netz-Status (Offline-Bewusstsein) ────────────────────────────────
// Solo/Training laufen komplett lokal; das Netz ist optional (Cloud-Backup,
// Multiplayer, Bestenliste). state.net spiegelt die Erreichbarkeit, damit die UI
// netzabhängige Aktionen sauber ausgraut statt in Firebase-Timeouts zu laufen.
function isOnline() { return state.net !== 'offline'; }
function setNet(status) {
  if (state.net === status) return;
  const wasOffline = state.net === 'offline';
  state.net = status;
  log('app', 'Netz-Status geändert', { net: status });
  if (status === 'online' && wasOffline) onReconnect();
}
function onReconnect() {
  // Zurück online: den aktiven Spielstand + Nutzdaten frisch abgleichen. Die
  // durable Outbox (ausstehende Cloud-Schreibvorgänge) wird in einem Folge-PR
  // hier abgespielt; heute reicht der bestehende Reconcile/Sync.
  if (state.account.status === 'in') { try { reconcileSession(); doSyncNow(); } catch (_) {} }
}
function initConnectivity() {
  const update = () => setNet(navigator.onLine === false ? 'offline' : 'online');
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  // Beim Sichtbarwerden zusätzlich prüfen (navigator.onLine wird beim Wecken aktualisiert).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') update(); });
  update();
}

function init() {
  initDiagnostics();
  initConnectivity();
  // Läuft die App STABIL (länger als das Loop-Fenster) ohne Neuladen, gilt eine
  // evtl. Reload-Serie als beendet → Zähler zurücksetzen, damit ein späteres
  // legitimes Update wieder neu laden darf. WICHTIG: Der Reset MUSS länger sein als
  // das Loop-Fenster (RELOAD_WINDOW_MS) — sonst würde er den Zähler bei langsamen
  // Loops (z.B. ~36 s) immer VOR dem nächsten Reload leeren und die Bremse aushebeln.
  setTimeout(() => { try { localStorage.removeItem(RELOAD_LOG_KEY); } catch (_) {} }, RELOAD_WINDOW_MS + 30000);
  // Diagnose: Abstand zum vorherigen (Neu-)Start protokollieren. Ein regelmäßiger,
  // kurzer Abstand (z.B. exakt ~36 s) ist der Fingerabdruck einer Reload-Schleife
  // (im Gegensatz zu unregelmäßigen iOS-Speicher-Kills). Genau ein Eintrag pro Start.
  try {
    const prevStart = parseInt(localStorage.getItem('cns_last_start') || '0', 10);
    const now = Date.now();
    if (prevStart) log('app', 'Zeit seit letztem Start', { seconds: Math.round((now - prevStart) / 1000) });
    localStorage.setItem('cns_last_start', String(now));
  } catch (_) {}
  applyTheme();
  applySfxPack(); applyMusicPack();
  Music.setMuted(state.settings.muteAll);  // „Alles stumm"-Zustand vom letzten Mal übernehmen
  // Bei themeMode 'auto' Systemwechsel (hell/dunkel) live übernehmen — ohne Neustart.
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.settings.themeMode === 'auto') applyTheme();
    });
  } catch (_) {}
  applyLocale();
  refreshResume();
  refreshAccountFromLocal();
  if (loadProfile().accountId) {
    refreshAccount();  // genauere Cloud-Infos nachladen (nur wenn eingeloggt)
    // Abgleich lokal↔Cloud beim Start. Bei echter Divergenz gewinnt IMMER die
    // Cloud (kein Auswahldialog mehr) → sauberes Neuladen nach der Übernahme.
    Account.reconcile().then(r => {
      // ECHTE Divergenz (offline gespielt UND woanders online): den Versions-
      // Mismatch-Dialog zeigen statt still „Cloud gewinnt". Erst die Nutzerwahl
      // (resolveVersionMismatch) wendet an und lädt neu.
      if (r.decision === 'conflict') { openVersionMismatch(r); return; }
      if (r.decision === 'takeCloud') { safeReload('reconcile-takeCloud'); return; }  // Cloud übernommen → sauber neu laden
      state.inventory = loadInventory();
      state.wallet = loadWallet();
      maybeUnlockV1Skin();
      refreshAccountFromLocal();  // lastSync/Status auffrischen
      // Multi-Device: Aktivspiel-Session live überwachen (Fremd-Änderung → sofortiger
      // Reconcile) und einmal beim Start abgleichen (z.B. auf einem frischen Gerät
      // erscheint eine anderswo laufende Partie als „Fortsetzen").
      startSessionWatch();
      reconcileSession();
    });
    // …und automatisch alle 60 s weiter sichern, solange die App offen ist.
    // Periodischer Cloud-Sync NICHT während einer laufenden Partie (schont die
    // Verbindung/den Speicher im konzentrationskritischen Moment; der lokale
    // Autosave sichert den Fortschritt ohnehin). Gesichert wird stattdessen bei
    // Spielende, beim Wechsel ins Menü und beim Verstecken/Schließen der App.
    setInterval(() => { if (state.account.status === 'in' && !gameSessionActive()) doSyncNow(); }, 30000);
  }
  // Präsenz für Freunde alle 20 s auffrischen, solange ein Spiel läuft (Fortschritt/%).
  setInterval(() => { if (state.account.status === 'in' && gameSessionActive()) pushPresence(); }, 20000);
  maybeShowWhatsNew();
  maybeUnlockV1Skin();  // 1.0-Feier-Skin beim Versionssprung (vor dismissWhatsNew, das die Version speichert)
  // Alt-Spieler, die bereits ALLE 12 Kategorien gemeistert haben, bekommen die
  // Großmeister-Feier EINMAL beim ersten Start nach dem Update (nur auf Home).
  setTimeout(() => { if (state.screen === 'home') checkMasterUnlock(); }, 1200);
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
  // Desktop-Werkzeugtaste (z.B. Tab) — capture:true, damit wir Tab abfangen,
  // BEVOR der Browser den Fokus verschiebt.
  window.addEventListener('keydown', onDesktopKeydown, true);
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  // App im Hintergrund: AudioContext KOMPLETT schließen (suspendForBackground),
  // damit das OS nichts mehr glitchen kann. Zurück im Vordergrund sofort wieder
  // starten (und falls iOS das blockt, beim ersten Tap, s.o.).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Music.suspendForBackground(); persistGame(); syncCloudNow('hide'); }
    else updateMusic();
  });
  // pagehide/pageshow zusätzlich: feuert auf iOS-PWA beim Backgrounding oft
  // zuverlässiger/früher als visibilitychange. Auch hier sofort sichern, damit
  // ein fertiges/laufendes Spiel beim Schließen zuverlässig in der Cloud landet.
  window.addEventListener('pagehide', () => { Music.suspendForBackground(); persistGame(); syncCloudNow('pagehide'); });
  window.addEventListener('pageshow', () => updateMusic());
  window.addEventListener('blur', () => { if (document.hidden) Music.suspendForBackground(); });

  // Worker für die Off-Thread-Generierung bereitstellen (siehe oben). Es wird NICHT
  // mehr vorab generiert -- Rätsel entstehen erst beim Spielstart on-demand.
  initGenWorker();
}

// ════════════════════════════════════════════════════════════════════════════
//  KOMPONENTE: Slider-Schwierigkeitsauswahl (wiederverwendbar in ALLEN Modi)
// ════════════════════════════════════════════════════════════════════════════
// v-model = Schwierigkeits-ID; `coop` schaltet Münz-/Zeitanzeige auf Mehrspieler
// (Coop-Münzen ×2, Lobby-Zeiten). Der morphende Hintergrund liegt am umgebenden
// Container (setzt --dacc via diffVars); die Komponente erbt die Vars und rendert
// nur den Inhalt (Medaillon, Name, Maße, Stats, Regler). Eigene Münz-Count-up-
// Animation je Instanz. Reagiert flott (styles.css --snapT), morpht smooth.
const DifficultySlider = {
  props: {
    modelValue: { type: String, required: true },
    coop: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const coin = ref(0);
    const list = DIFFICULTIES;
    let raf = 0, dragging = false;
    const curDiff = () => DIFF_BY_ID[props.modelValue] || list[0];
    const idxOf = () => { const i = list.findIndex(d => d.id === props.modelValue); return i < 0 ? 0 : i; };
    const pct = () => list.length > 1 ? (idxOf() / (list.length - 1)) * 100 : 0;
    const coinVal = (id) => coinReward(list.findIndex(d => d.id === id), { coop: props.coop });
    // Zeiten modusgerecht: Coop/Race/Team → Lobby-Zeiten, Solo → Solo-Zeiten.
    const avgFor = (id) => props.coop ? lobbyAvgTimeFor(id) : avgTimeFor(id);
    const bestFor = (id) => {
      if (props.coop) return lobbyBestTimeMs(id);
      const s = state.stats.byDifficulty[id];
      return s && s.bestTimeMs != null ? s.bestTimeMs : null;
    };
    function animCoin(to) {
      cancelAnimationFrame(raf);
      const from = coin.value || 0, t0 = performance.now(), dur = 420;
      const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); coin.value = Math.round(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    function setIdx(i) {
      i = Math.max(0, Math.min(list.length - 1, i));
      const id = list[i].id;
      if (id === props.modelValue) return;
      emit('update:modelValue', id);
      if (state.settings.sfxToolSwitch) Music.sfxToolSwitch();
    }
    function idxFromX(clientX, el) {
      const r = el.getBoundingClientRect(), pad = 16, span = Math.max(1, r.width - pad * 2);
      const p = Math.max(0, Math.min(1, (clientX - r.left - pad) / span));
      return Math.round(p * (list.length - 1));
    }
    function down(e) { dragging = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} setIdx(idxFromX(e.clientX, e.currentTarget)); }
    function move(e) { if (dragging) setIdx(idxFromX(e.clientX, e.currentTarget)); }
    function up() { dragging = false; }
    function key(e) {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowUp') { setIdx(idxOf() + 1); e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'ArrowDown') { setIdx(idxOf() - 1); e.preventDefault(); }
      else if (k === 'Home') { setIdx(0); e.preventDefault(); }
      else if (k === 'End') { setIdx(list.length - 1); e.preventDefault(); }
    }
    watch(() => props.modelValue, (nv) => animCoin(coinVal(nv)));
    onMounted(() => { coin.value = coinVal(props.modelValue); });
    return { t, ic, fmtTime, DIFFICULTIES: list, coin, curDiff, idxOf, pct, avgFor, bestFor, down, move, up, key };
  },
  template: `
  <div class="diff-picker">
    <div class="setup-hero">
      <div class="diff-medallion">
        <div class="dm-ring"></div>
        <div class="dm-disc" :key="modelValue"><span class="dm-ic" v-html="ic(curDiff().emoji)"></span></div>
      </div>
      <div class="diff-eyebrow">{{ t('setup.step') }} {{ idxOf()+1 }} / {{ DIFFICULTIES.length }}</div>
      <h3 class="diff-name" :key="'n-'+modelValue">{{ t('difficulty.'+modelValue) }}</h3>
      <div class="diff-dim">{{ curDiff().dim.r }} × {{ curDiff().dim.c }}</div>
      <div class="diff-stats">
        <div class="ds-tile ds-coins">
          <div class="ds-k">{{ t('setup.reward') }}</div>
          <div class="ds-v"><span class="ei" v-html="ic('coin')"></span> {{ coin||0 }}</div>
        </div>
        <div class="ds-tile">
          <div class="ds-k">{{ t('stats.avgTimeLabel') }}</div>
          <div class="ds-v">{{ avgFor(modelValue)!=null ? fmtTime(avgFor(modelValue)) : '–:––' }}</div>
        </div>
        <div class="ds-tile">
          <div class="ds-k">{{ t('stats.bestTimeLabel') }}</div>
          <div class="ds-v">{{ bestFor(modelValue)!=null ? fmtTime(bestFor(modelValue)) : '–:––' }}</div>
        </div>
      </div>
    </div>
    <div class="setup-controls">
      <div class="diff-slabel"><span>{{ t('common.difficulty') }}</span><b>{{ idxOf()+1 }} / {{ DIFFICULTIES.length }}</b></div>
      <div class="diff-track" tabindex="0" role="slider" :aria-valuemin="1" :aria-valuemax="DIFFICULTIES.length" :aria-valuenow="idxOf()+1" :aria-label="t('common.difficulty')" :aria-valuetext="t('difficulty.'+modelValue)"
           @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="key">
        <div class="dt-inner">
          <div class="dt-rail"><div class="dt-fill" :style="{width: pct()+'%'}"></div></div>
          <i v-for="(d,i) in DIFFICULTIES" :key="d.id" class="dt-tick" :class="{on:i<=idxOf(), cur:i===idxOf()}" :style="{left: (DIFFICULTIES.length>1 ? i/(DIFFICULTIES.length-1)*100 : 0)+'%', '--tk': d.accent}"></i>
          <div class="dt-thumb" :style="{left: pct()+'%'}"></div>
        </div>
      </div>
    </div>
  </div>`,
};

// ════════════════════════════════════════════════════════════════════════════
//  KOMPONENTE / TEMPLATE
// ════════════════════════════════════════════════════════════════════════════
const App = {
  components: { DifficultySlider },
  setup() {
    const livesArr = computed(() => Array.from({ length: state.maxLives }, (_, i) => i < state.lives));
    // Coop/Race/Team: zeigt der Coop-Screen gerade die Host-Schwierigkeitsauswahl?
    // Dann bekommt die Section den Vollflächen-Slider-Look (setup-slider) wie Solo.
    const isCoopDiffView = computed(() => state.coop.identityConfirmed && state.coop.role === 'host' && !state.coop.waitingForGuest);
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
        return { id: pl.id, name: pl.name, username: pl.username, color: pl.color, correctKept, correctRemoved, mistakes, correct: correctKept + correctRemoved };
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
        .map(pl => ({ id: pl.id, name: pl.name, username: pl.username, color: pl.color, mistakes: state.team.opponentMistakesByPlayer[pl.id] || 0 }));
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
      // FFA (jeder gegen jeden): kein 1v1-„Du vs {name}"-Text, sondern Platz/
      // Sieger unter N Spielern. `winner==='out'` = selbst ausgeschieden, Match
      // läuft für die Übrigen weiter.
      if (r.ffa) {
        const n = r.opponents.length + 1;
        if (r.winner === 'me') return t('race.ffaYouWon', { n, myPct: r.myPct });
        if (r.winner === 'out') return t('race.ffaEliminated', { myPct: r.myPct });
        return t('race.ffaYouLost', { name: r.winnerName || name, n, myPct: r.myPct });
      }
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
    // Mindestens eine gekaufte Skin-Vorlage aktiviert das Skin-Rendering auch
    // OHNE den exklusiven Skin (der schaltet nur den freien Editor frei).
    const skinPresetOwned = computed(() => SKINPRESET_ITEMS.some((p) => ownsShopItem(state.inventory, p)));
    const skinActive = computed(() => (skinUnlocked.value || skinPresetOwned.value) && state.settings.skinEnabled);
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
      openShop, closeShop, openShopCategory, closeShopCategory, coinFor, streakBonusPct,
      diffVars, isCoopDiffView,
      openWalletLog, closeWalletLog, walletReasonLabel,
      SHOP_CATS, shopCatItems, ownsShop, shopEquippedId, shopOwnedCount, equipShopItem, equipShopFree, buyShopItem, shopItemPrice, shopPreviewDots, shopCategoryTitle, previewSfxPack, boardFontClass, boardFrameClass, applySkinPreset,
      settingsVisualCats, settingsSoundCats, settingsCatOptions, equipCatFromSettings,
      shopPreviewIt, shopPreviewFree, shopDemoId, shopDemoActive, shopDemoCells, shopDemoClass, shopDemoSkin, shopDemoBadgeName, shopFreeDots, adminGrantAllItems, myBadge, badgeSvg, badgeDefs, badgeShown, ic,
      openPrestige, closePrestige, prestigeList, isBadgeEquipped, earnedTier, equipBadge, unequipBadge, prestigeTierName,
      masterInfo, isMasterEquipped, equipMaster, dismissMasterUnlock, MASTER_BADGE,
      WIN_EFFECTS, effectPrice, ownsWinFx, winFxActive, activeWinFxId, ownedWinFx, buyWinFx, activateWinFx, previewWinFx, winFxStyle, winShape, winShapeDefs,
      SETTINGS_SECTIONS, selectSettingsSection, toggleSettingsCard,
      cellClasses, cellStyle, cellAriaLabel, toggleTool,
      desktopKeyLabel, startDesktopKeyCapture, cancelDesktopKeyCapture, clearDesktopToolKey,
      isMultiplayer, sendChat, openChat, closeChat, toggleChat, toggleMuteAll,
      reclaimSession, dismissDeviceNotice,
      resolveVersionMismatch, fmtMismatchTime,
      startHosting, startJoining, coopReset, avgTimeFor, coopAvgTimeFor, lobbyIsCompetition, lobbyAvgTimeFor, lobbyBestTimeMs, racePct,
      doSignUp, doSignIn, doSignOut, doResetPassword, doChangePassword, doDeleteAccount, refreshAccount, doSyncNow, fmtSyncTime,
      startUsernameEdit, doChangeUsername, onUsernameInput, canSaveUsername, playerLabel,
      openAdminConsole, closeAdminConsole, adminFmtDate, adminItemOptions, adminFieldOptions, adminLoadUsers, filteredAdminUsers, openAdminEdit, closeAdminEdit, adminGrantSkin, adminRevokeSkin, adminToggleRole,
      adminGiftCategories, openAdminGiftPicker, closeAdminGiftPicker, adminToggleGiftItem, adminGiftItemState, adminGiftPendingCount, adminGiftTotal, adminOwnedOfTotal,
      adminDataSections, adminSectionLabel, adminFieldRows, toggleAdminSection, openAdminSection, adminFieldValue, adminInputField, adminToggleField, adminDirtyCount, adminSaveData, adminDiscardData, adminReloadData,
      openAdminJson, closeAdminJson, saveAdminJson, adminChipValue, adminRevokeItemId, adminInventoryDisplay, adminPendingSummary,
      adminBalanceCurrent, adminBalanceTarget, adminBalanceDelta, adminSetBalanceMode, adminApplyBalanceChange,
      adminRowLabel, adminRowDesc, adminEnumOptions, adminItemLabel, adminProfileFieldLabel, adminPathLabel, adminRowTimestamp, adminIsDateField, adminMarkDirty,
      adminSetBalance, adminChangeUsername, adminGrantAnyItem, adminRevokeAnyItem, adminSetField, adminResetPw, dismissAdminNotice, adminNoticeText,
      openFriends, closeFriends, setFriendsTab, selectLeaderboardDiff, addFriend, openAddFriend, closeAddFriend, acceptFriend, declineFriend, removeFriendAsk,
      friendsSorted, friendPresence, friendOnline, friendInGame, anyFriendOnline, friendActivityText,
      skinUnlocked, skinPresetOwned, skinActive, skinVars, skinBoardClasses, skinPreviewVars, skinPreviewClasses, redeemSkinCode, dismissSkinUnlock, openSkinEditor, skinSpeedToDuration,
      startCoopMatch, canStartCoopMatch, COOP_MAX_PLAYERS, DONATE_URL,
      assignTeam, randomizeTeams, canStartTeamMatch, startTeamMatch, goRace, canStartRaceMatch, startRaceMatch, rematchRace,
      chipTextColor, confirmCoopIdentity, coopChooseHost, coopChooseGuest, playerColor, goCoop,
      nonHostPlayers, readyCount, allGuestsReady, myReady, markReady, unmarkReady,
      openInvitePicker, closeInvitePicker, inviteFriendToLobby, withdrawLobbyInvite, acceptLobbyInvite, declineLobbyInviteUI, lobbyModeLabel, raceResultMsg, teamResultMsg, winTitle,
      startTrainingGame, applyTrainingStep,
      openHistoryDetail, closeHistoryDetail, historyGridStyle, historyCellClasses, historyCellStyle, replayHistoryEntry,
      isOnline,
      t, i18nState, SUPPORTED_LOCALES,
    };
  },
  template: `
  <div class="app" :class="{ generating: state.generating, 'modal-open': !!state.modal, 'app-game': state.screen === 'game', 'app-home': state.screen === 'home' }">

    <!-- Gemeinsame SVG-Defs (Verläufe/Symbole) für alle Abzeichen-Medaillen, EINMAL im Dokument. -->
    <span class="badge-defs-holder" v-html="badgeDefs()" aria-hidden="true"></span>
    <span class="badge-defs-holder" v-html="winShapeDefs()" aria-hidden="true"></span>

    <!-- ══ HOME ══ -->
    <section v-if="state.screen==='home'" class="screen home">
      <span v-if="!isOnline()" class="offline-chip" :title="t('offline.chipHint')"><span class="ei" v-html="ic('cloud')"></span> {{ t('offline.chip') }}</span>
      <a class="icon-btn home-donate-btn" :href="DONATE_URL" target="_blank" rel="noopener" :aria-label="t('home.donate')" :title="t('home.donate')"><span class="ico-wrap" v-html="ic('coffee')"></span><span class="home-donate-heart ico-wrap" aria-hidden="true" v-html="ic('heart')"></span></a>
      <span v-if="state.streak.currentStreak>0" class="home-streak-badge"><span class="ico-lead" v-html="ic('flame')"></span>{{ state.streak.currentStreak }}</span>
      <div class="home-topbar-right">
        <button v-if="state.account.status==='in'" class="icon-btn home-friends-btn" @click="openFriends" :aria-label="t('friends.title')" :title="t('friends.title')"><span class="ico-wrap" v-html="ic('users')"></span><span v-if="state.friends.requests.length" class="friends-req-badge">{{ state.friends.requests.length }}</span><span v-if="anyFriendOnline()" class="friends-online-dot"></span></button>
        <button class="icon-btn home-shop-btn" @click="openShop" :aria-label="t('shop.title')" :title="t('shop.title')"><span class="ico-wrap" v-html="ic('cart')"></span></button>
        <button class="icon-btn home-settings-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')"><span class="ico-wrap" v-html="ic('gear')"></span></button>
      </div>
      <div class="brand">
        <img class="brand-logo" src="./icons/icon-192.png" alt="" />
        <h1 class="brand-title">Coop<br>Number Sums</h1>
        <!-- Profil-Chip: öffnet den Prestige-Screen. Zeigt das ausgerüstete
             verdiente Abzeichen (oder eine Einladung, eins zu verdienen). -->
        <button class="home-profile-chip" :class="{ master: isMasterEquipped() }" @click="openPrestige">
          <template v-if="myBadge()"><span class="hpc-name">{{ shopDemoBadgeName() }}</span> <b class="badge-medal-inline" v-html="badgeSvg(myBadge())"></b></template>
          <template v-else><span class="ico-wrap" v-html="ic('medal')"></span> {{ t('prestige.title') }}</template>
        </button>
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
            <span class="btn-ic"><span class="ei" v-html="ic('users')"></span></span>
            <span class="btn-tx"><b>{{ t('home.resumeCoop') }}</b>
              <small>{{ t('difficulty.'+state.resumeAvailableCoop.difficulty) }} · {{ DIFF_BY_ID[state.resumeAvailableCoop.difficulty]?.dim.r }}×{{ DIFF_BY_ID[state.resumeAvailableCoop.difficulty]?.dim.c }} · {{ fmtTime(state.resumeAvailableCoop.elapsed||0) }}</small>
            </span>
          </button>
        </div>
        <button class="btn btn-primary" @click="coopReset(); navTo('setup')">
          <span class="btn-ic"><span class="ei" v-html="ic('puzzle')"></span></span><span class="btn-tx"><b>{{ t('home.newGame') }}</b><small>{{ t('home.newGameHint') }}</small></span>
        </button>
        <button class="btn btn-coop" :disabled="!coopAvailable || !isOnline()" @click="goCoop">
          <span class="btn-ic"><span class="ei" v-html="ic('users')"></span></span><span class="btn-tx"><b>{{ t('home.coopMode') }}</b><small>{{ t('home.coopHint') }}</small></span>
          <span v-if="!isOnline()" class="badge-soon">{{ t('offline.badge') }}</span>
          <span v-else-if="!coopAvailable" class="badge-soon">{{ t('home.comingSoon') }}</span>
        </button>
        <button class="btn btn-ghost race-btn" :disabled="!coopAvailable || !isOnline()" @click="state.modal='raceChoice'">
          <span class="btn-ic"><span class="ei" v-html="ic('versus')"></span></span><span class="btn-tx"><b>{{ t('home.raceMode') }}</b><small>{{ t('home.raceHint') }}</small></span>
          <span v-if="!isOnline()" class="badge-soon">{{ t('offline.badge') }}</span>
        </button>
        <div class="home-grid">
          <button class="btn btn-ghost" @click="navTo('stats')"><span class="btn-ic"><span class="ei" v-html="ic('chart')"></span></span> {{ t('home.stats') }}</button>
          <button class="btn btn-ghost" @click="navTo('history')"><span class="btn-ic"><span class="ei" v-html="ic('clock')"></span></span> {{ t('home.history') }}</button>
        </div>
      </div>
      <div class="home-version">v{{ BUILD }}</div>
    </section>

    <!-- ══ SETUP (Slider-Schwierigkeitsauswahl mit morphendem Hintergrund) ══ -->
    <section v-else-if="state.screen==='setup'" class="screen setup setup-slider" :style="diffVars(state.sel.difficulty)">
      <div class="setup-aura" aria-hidden="true"><b></b><b></b><b></b></div>
      <header class="topbar setup-top">
        <button class="icon-btn" @click="goBack()">‹</button>
        <h2>{{ t('setup.title') }}</h2>
        <button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')"><span class="ico-wrap" v-html="ic('gear')"></span></button>
      </header>

      <difficulty-slider v-model="state.sel.difficulty"></difficulty-slider>

      <div class="setup-startrow">
        <button class="btn btn-primary btn-start diff-start" @click="newGame(state.sel.difficulty)">
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
          <div class="hud-item lives">
            <span v-for="(full,i) in livesArr" :key="i" class="heart" :class="{empty:!full}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <i v-if="!full && state.coop.active && lifeLossColor(i)" class="heart-strike" :style="{background: lifeLossColor(i)}"></i>
            </span>
          </div>
          <div class="hud-item timer"><span class="timer-icon"><span class="ei" v-html="ic('clock')"></span></span><span>{{ fmtTime(state.elapsed) }}</span></div>
        </div>
        <div class="top-actions">
          <button class="icon-btn chat-btn" v-if="isMultiplayer()" @click="toggleChat" :aria-label="t('chat.title')" :title="t('chat.title')">
            <span class="ico-wrap" v-html="ic('chat')"></span>
            <span v-if="state.chat.unread" class="chat-unread">{{ state.chat.unread }}</span>
          </button>
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
          <span class="chip"><span class="ei" v-html="ic(DIFF_BY_ID[state.puzzle.difficulty].emoji)"></span> {{ t('difficulty.'+state.puzzle.difficulty) }}</span>
          <span class="chip">{{ state.puzzle.rows }}×{{ state.puzzle.cols }}</span>
          <span v-if="state.coop.active" class="chip coop-chip" :class="(state.coop.connected && state.coop.online) ? 'coop-on' : 'coop-off'">
            <span class="ei" v-html="ic('users')"></span> {{ t('game.coopTag') }}{{ (state.coop.connected && state.coop.online) ? '' : t('game.coopOfflineSuffix') }}
          </span>
          <span v-if="state.team.active" class="chip coop-chip"><span class="ei" v-html="ic('versus')"></span> {{ t('team.label'+state.team.myTeam) }}</span>
          <span v-if="state.race.active" class="chip coop-chip"><span class="ei" v-html="ic('versus')"></span> {{ state.race.ffa ? t('race.ffaTag', { n: state.race.opponents.length + 1 }) : state.race.opponentName }}</span>
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
            <span v-else-if="state.team.active" class="progress-label">{{ t('team.label'+state.team.myTeam) }}</span>
            <span class="progress-pct">{{ myProgressPct }}%</span>
            <span class="progress-bar"><span class="progress-bar-fill mine" :style="{ width: myProgressPct + '%' }"></span></span>
          </div>
          <!-- Team-vs-Team (2v2): Gegner-Team als Fortschrittsbalken + Leben-Zeile,
               exakt wie im 1v1-Race (statt der früheren Chip-Anzeige). -->
          <template v-if="state.team.active">
            <div class="progress-line" :aria-label="t('team.opponentProgress', { pct: state.team.opponentPct })">
              <span class="progress-label">{{ t('team.label'+(state.team.myTeam==='A'?'B':'A')) }}</span>
              <span class="progress-pct">{{ state.team.opponentPct }}%</span>
              <span class="progress-bar"><span class="progress-bar-fill opp" :style="{ width: state.team.opponentPct + '%' }"></span></span>
            </div>
            <div class="progress-line opponent-lives-line" :aria-label="t('win.mistakesCount', { count: state.team.opponentMistakes })">
              <span class="progress-label"></span>
              <span class="opponent-lives">
                <span v-for="(full,i) in opponentTeamLivesArr" :key="i" class="heart" :class="{empty:!full}">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  <i v-if="!full" class="heart-strike opp-heart-strike"></i>
                </span>
              </span>
            </div>
          </template>
          <!-- FFA (jeder gegen jeden): ein Fortschrittsbalken je Gegner. -->
          <template v-if="state.race.active && state.race.ffa">
            <div class="progress-line" v-for="o in state.race.opponents" :key="o.id" :class="{ 'ffa-out': o.out }" :aria-label="t('race.opponentProgress', { pct: o.pct })">
              <span class="progress-label">{{ o.name }}<template v-if="o.out"> · {{ t('race.ffaOutTag') }}</template></span>
              <span class="progress-pct">{{ o.pct }}%</span>
              <span class="progress-bar"><span class="progress-bar-fill opp" :style="{ width: o.pct + '%', background: o.color }"></span></span>
            </div>
          </template>
          <!-- Strikt 1v1: einzelner Gegner-Balken + Leben-Anzeige. -->
          <div class="progress-line" v-if="state.race.active && !state.race.ffa" :aria-label="t('race.opponentProgress', { pct: state.race.opponentPct })">
            <span class="progress-label">{{ state.race.opponentName }}</span>
            <span class="progress-pct">{{ state.race.opponentPct }}%</span>
            <span class="progress-bar"><span class="progress-bar-fill opp" :style="{ width: state.race.opponentPct + '%', background: state.race.opponentColor }"></span></span>
          </div>
          <div class="progress-line opponent-lives-line" v-if="state.race.active && !state.race.ffa" :aria-label="t('win.mistakesCount', { count: state.race.opponentMistakes })">
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
            {{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
          </span>
        </div>
        </div>

        <div class="board-wrap" :class="{ blurred: state.paused || state.coop.awaitingStart }">
          <div class="board" :class="[skinBoardClasses, boardFontClass(), boardFrameClass()]" :style="[gridStyle, skinVars]">
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
          <b><span class="ei" v-html="ic('bulb')"></span> {{ t('training.group.'+state.hintNudge.group.kind, { n: state.hintNudge.group.ref+1 }) }}<template v-if="state.hintNudge.group.target!=null"> ({{ t('training.target', { n: state.hintNudge.group.target }) }})</template></b>
          <span>{{ t('hint.socratic.'+state.hintNudge.reason, { rem: state.hintNudge.rem }) }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="revealHintNudge">{{ t('hint.reveal') }}</button>
        <button class="hint-dismiss" @click="dismissHintNudge" :aria-label="t('hint.dismiss')" :title="t('hint.dismiss')"><span class="ico-wrap" v-html="ic('close')"></span></button>
      </div>

      <!-- Coop-Lobby: Rätsel ist da, Zeit läuft erst nach "Starten" -->
      <div v-if="state.coop.awaitingStart" class="overlay coop-lobby-overlay">
        <div class="result-card">
          <div class="result-emoji"><span class="ei" v-html="ic('users')"></span></div>
          <h2>{{ t('coop.lobbyTitle') }}</h2>
          <p class="result-msg">{{ state.coop.generating ? t('coop.generating') : t('coop.lobbyMsg') }}</p>
          <div class="coop-roster" v-if="nonHostPlayers().length">
            <span v-for="p in nonHostPlayers()" :key="p.id" class="player-chip" :class="{ 'ready-chip': p.ready }"
                  :style="{ background: p.color, color: chipTextColor(p.color) }">
              <span v-if="badgeShown(p.badge)" class="badge-medal-inline" v-html="badgeSvg(p.badge)"></span>{{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
              <span class="ei" v-html="ic(p.ready ? 'check' : 'hourglass')"></span>
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
          <div class="result-emoji"><span class="ei" v-html="ic('pause')"></span></div>
          <h2>{{ t('pause.title') }}</h2>
          <div class="pause-time"><span class="ei" v-html="ic('clock')"></span> {{ fmtTime(state.elapsed) }}</div>
          <p class="result-msg">{{ t('pause.msg') }}</p>
          <button class="btn btn-primary" @click="resumeFromPause">{{ t('pause.resume') }}</button>
          <!-- Aus dem Pausenmenü erreichbar: Einstellungen (öffnet das Menü, Spiel
               bleibt pausiert), Anleitung und Aufgeben. So läuft beim Öffnen der
               Einstellungen im Spiel exakt dieselbe Pausenmechanik wie über den
               Pause-Knopf (für alle Coop-Spieler synchron pausiert). -->
          <button class="btn btn-ghost" @click="openSettings"><span class="btn-ic"><span class="ei" v-html="ic('gear')"></span></span> {{ t('home.settings') }}</button>
          <button class="btn btn-ghost" @click="state.modal='howto'"><span class="btn-ic"><span class="ei" v-html="ic('book')"></span></span> {{ t('home.howto') }}</button>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>

      <!-- Gewonnen / Verloren -->
      <div v-if="state.status==='won'" class="overlay">
        <div class="result-card win" :class="{ perfect: state.perfectWin }">
          <div class="result-emoji"><span class="ei" v-html="ic('party')"></span></div>
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
          <div v-if="state.lastCoinReward > 0" class="coin-reward"><span class="ei" v-html="ic('coin')"></span> +{{ state.lastCoinReward }} <span v-if="state.lastCoinMult > 1" class="coin-mult">×{{ state.lastCoinMult }}</span> <span class="coin-total">({{ t('wallet.total', { n: state.wallet.balance }) }})</span></div>
          <div v-if="state.lastStreakUsed > 0" class="coin-streak-bonus"><span class="ei" v-html="ic('flame')"></span> {{ t('wallet.streakBonus', { days: state.lastStreakUsed, pct: streakBonusPct(state.lastStreakUsed) }) }}</div>
          <div class="result-stats">
            <div><b>{{ fmtTime(state.elapsed) }}</b><small>{{ t('win.timeLabel') }}</small></div>
            <div><b>{{ state.mistakes }}</b><small>{{ t('win.mistakesLabel') }}</small></div>
            <div><b>{{ state.hintsUsed }}</b><small>{{ t('win.hintsLabel') }}</small></div>
          </div>
          <div v-if="coopPerformance.length" class="coop-performance">
            <div class="perf-title">{{ t('win.teamPerformance') }}</div>
            <div v-for="pl in coopPerformance" :key="pl.id" class="perf-row" :class="{mvp: pl.id===mvpId}">
              <div class="perf-head">
                <span class="perf-name" :style="{color: pl.color}">{{ playerLabel(pl) }}<template v-if="pl.id===mvpId"> {{ t('win.mvp') }}</template></span>
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
            <span v-for="pl in opponentTeamPerformance" :key="pl.id" class="chip" :style="{color: pl.color}">{{ playerLabel(pl) }}: {{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
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
          <div class="result-emoji"><span class="ei" v-html="ic('heart-broken')"></span></div>
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
                <span class="perf-name" :style="{color: pl.color}">{{ playerLabel(pl) }}<template v-if="pl.id===mvpId"> {{ t('win.mvp') }}</template></span>
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
            <span v-for="pl in opponentTeamPerformance" :key="pl.id" class="chip" :style="{color: pl.color}">{{ playerLabel(pl) }}: {{ t('win.mistakesCount', { count: pl.mistakes }) }}</span>
          </div>
          <button class="btn btn-primary" v-if="state.isTrainingGame" @click="startTrainingGame">{{ t('training.another') }}</button>
          <button class="btn btn-primary" v-else-if="!state.team.active && !state.race.active && (!state.coop.active || state.coop.role==='host')" @click="goNextPuzzle">{{ t('common.newGame') }}</button>
          <p v-else-if="!state.team.active && !state.race.active && state.coop.active && state.coop.role!=='host'" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-primary" v-else-if="state.race.active && state.coop.role==='host'" @click="rematchRace">{{ t('race.rematch') }}</button>
          <p v-else-if="state.race.active" class="result-msg">{{ t('win.waitingForHost') }}</p>
          <button class="btn btn-ghost" @click="quitToHome">{{ t('common.menu') }}</button>
        </div>
      </div>
    </section>

    <!-- ══ STATS ══ -->
    <section v-else-if="state.screen==='stats'" class="screen stats">
      <header class="topbar"><button class="icon-btn" @click="goBack()">‹</button><h2>{{ t('stats.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')"><span class="ico-wrap" v-html="ic('gear')"></span></button></header>
      <div class="stats-body">
        <button class="btn btn-ghost shop-entry-btn" @click="openShop">
          <span class="btn-ic"><span class="ei" v-html="ic('cart')"></span></span>
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
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('controller')"></span></span><b>{{ generalStats.played }}</b><small>{{ t('stats.ovPlayed') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('medal')"></span></span><b>{{ generalStats.won }} · {{ generalStats.winPct }}%</b><small>{{ t('stats.wonPlayedLabel') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('clock')"></span></span><b>{{ fmtDuration(generalStats.timeMs) }}</b><small>{{ t('stats.ovTime') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('sparkles')"></span></span><b>{{ generalStats.perfect }}</b><small>{{ t('stats.ovPerfect') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('flame')"></span></span><b>{{ state.streak.currentStreak }} / {{ state.streak.bestStreak }}</b><small>{{ t('stats.ovStreak') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('star')"></span></span><b><template v-if="generalStats.favId"><span class="ei" v-html="ic(DIFF_BY_ID[generalStats.favId].emoji)"></span> {{ t('difficulty.'+generalStats.favId) }}</template><template v-else>–</template></b><small>{{ t('stats.ovFav') }}</small></div>
            <div class="stat-tile clickable" @click="navTo('achievements')"><span class="stat-emoji"><span class="ei" v-html="ic('medal')"></span></span><b>{{ achievementsUnlockedCount }} / {{ ACHIEVEMENTS.length }}</b><small>{{ t('stats.ovAchievements') }}</small></div>
            <div class="stat-tile"><span class="stat-emoji"><span class="ei" v-html="ic('coin')"></span></span><b>{{ state.wallet.balance }}</b><small>{{ t('wallet.coins') }}</small></div>
          </div>
          <button class="btn btn-ghost achievements-top-btn" @click="navTo('achievements')">{{ t('stats.achievementsButton') }} ({{ achievementsUnlockedCount }}/{{ ACHIEVEMENTS.length }})</button>
        </template>

        <!-- Reiter: Solo -->
        <template v-else-if="state.statsTab==='solo'">
          <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
            <div class="diff-row-top"><span class="diff-name"><span class="ei" v-html="ic(d.emoji)"></span> {{ t('difficulty.'+d.id) }}</span></div>
            <div class="diff-row-sub">
              <span class="chip"><span class="ei" v-html="ic('medal')"></span> {{ (state.stats.byDifficulty[d.id]?.won)||0 }} / {{ (state.stats.byDifficulty[d.id]?.played)||0 }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip best-time-chip"><span class="ei" v-html="ic('trophy')"></span> {{ state.stats.byDifficulty[d.id]?.bestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].bestTimeMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              <span class="chip">⌀ {{ avgTimeFor(d.id)!=null ? fmtTime(avgTimeFor(d.id)) : '-:--' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip"><span class="ei" v-html="ic('heart-broken')"></span> {{ (state.stats.byDifficulty[d.id]?.lost)||0 }}<span class="chip-label">{{ t('stats.lostLabel') }}</span></span>
            </div>
          </div>
        </template>

        <!-- Reiter: Coop (inkl. Wettkampf/Duell) -->
        <template v-else>
          <div v-for="d in DIFFICULTIES" :key="d.id" class="diff-row">
            <div class="diff-row-top"><span class="diff-name"><span class="ei" v-html="ic(d.emoji)"></span> {{ t('difficulty.'+d.id) }}</span></div>
            <div class="diff-row-sub">
              <span class="chip coop-chip"><span class="ei" v-html="ic('medal')"></span> {{ (state.stats.byDifficulty[d.id]?.coopWon)||0 }} / {{ (state.stats.byDifficulty[d.id]?.coopPlayed)||0 }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
              <span class="chip coop-chip best-time-chip"><span class="ei" v-html="ic('trophy')"></span> {{ state.stats.byDifficulty[d.id]?.coopBestTimeMs!=null ? fmtTime(state.stats.byDifficulty[d.id].coopBestTimeMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              <span class="chip coop-chip">⌀ {{ coopAvgTimeFor(d.id)!=null ? fmtTime(coopAvgTimeFor(d.id)) : '-:--' }}<span class="chip-label">{{ t('stats.avgTimeLabel') }}</span></span>
              <span class="chip coop-chip"><span class="ei" v-html="ic('heart-broken')"></span> {{ (state.stats.byDifficulty[d.id]?.coopLost)||0 }}<span class="chip-label">{{ t('stats.lostLabel') }}</span></span>
            </div>
          </div>
          <div class="stats-section-title">{{ t('stats.raceSection') }}</div>
          <div class="diff-row">
            <div class="diff-sub">
              <div class="diff-sub-label">{{ t('stats.race1v1') }}</div>
              <div class="diff-row-sub">
                <span class="chip"><span class="ei" v-html="ic('medal')"></span> {{ state.raceStats['1v1'].racesWon }} / {{ state.raceStats['1v1'].racesPlayed }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
                <span class="chip"><span class="ei" v-html="ic('chart-up')"></span> {{ racePct(state.raceStats['1v1']) }}%<span class="chip-label">{{ t('stats.winPctLabel') }}</span></span>
                <span class="chip best-time-chip"><span class="ei" v-html="ic('trophy')"></span> {{ state.raceStats['1v1'].fastestWinMs!=null ? fmtTime(state.raceStats['1v1'].fastestWinMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              </div>
            </div>
            <div class="diff-sub">
              <div class="diff-sub-label coop">{{ t('stats.race2v2') }}</div>
              <div class="diff-row-sub">
                <span class="chip coop-chip"><span class="ei" v-html="ic('medal')"></span> {{ state.raceStats['2v2'].racesWon }} / {{ state.raceStats['2v2'].racesPlayed }}<span class="chip-label">{{ t('stats.wonPlayedLabel') }}</span></span>
                <span class="chip coop-chip"><span class="ei" v-html="ic('chart-up')"></span> {{ racePct(state.raceStats['2v2']) }}%<span class="chip-label">{{ t('stats.winPctLabel') }}</span></span>
                <span class="chip coop-chip best-time-chip"><span class="ei" v-html="ic('trophy')"></span> {{ state.raceStats['2v2'].fastestWinMs!=null ? fmtTime(state.raceStats['2v2'].fastestWinMs) : '-:--' }}<span class="chip-label">{{ t('stats.bestTimeLabel') }}</span></span>
              </div>
            </div>
          </div>
        </template>

        <button class="btn btn-danger-ghost" @click="resetStats">{{ t('stats.reset') }}</button>
      </div>
    </section>

    <!-- ══ ACHIEVEMENTS ══ -->
    <section v-else-if="state.screen==='achievements'" class="screen achievements">
      <header class="topbar"><button class="icon-btn" @click="goBack()">‹</button><h2>{{ t('achievements.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')"><span class="ico-wrap" v-html="ic('gear')"></span></button></header>
      <div class="achievements-body">
        <div class="achievements-progress">
          <span class="achievements-progress-label">{{ t('achievements.progress', { unlocked: achievementsUnlockedCount, total: ACHIEVEMENTS.length }) }}</span>
          <div class="progress-bar"><span class="progress-bar-fill" :style="{ width: (achievementsUnlockedCount / ACHIEVEMENTS.length * 100) + '%' }"></span></div>
        </div>
        <div v-for="a in ACHIEVEMENTS" :key="a.id" class="achievement-row" :class="{ unlocked: !!state.achievements[a.id] }">
          <span class="achievement-icon" :class="{ locked: !state.achievements[a.id] }" v-html="state.achievements[a.id] ? ic(a.icon) : ic('lock')"></span>
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
      <header class="topbar"><button class="icon-btn" @click="goBack()">‹</button><h2>{{ t('history.title') }}</h2><button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')"><span class="ico-wrap" v-html="ic('gear')"></span></button></header>
      <div class="history-body">
        <div v-if="!state.puzzleHistory.length" class="empty">{{ t('history.empty') }}</div>
        <div v-for="h in state.puzzleHistory" :key="h.ts" class="history-row">
          <div class="history-row-main">
            <span class="history-outcome" :class="'outcome-'+h.outcome"><span class="ei" v-html="ic(h.outcome==='won' ? 'trophy' : (h.outcome==='lost' ? 'heart-broken' : 'flag'))"></span></span>
            <span class="diff-name"><span class="ei" v-html="ic(DIFF_BY_ID[h.difficulty]?.emoji)"></span> {{ t('difficulty.'+h.difficulty) }}</span>
            <span class="chip">{{ h.dim.r }}×{{ h.dim.c }}</span>
            <span v-if="h.coop" class="chip coop-chip"><span class="ei" v-html="ic('users')"></span></span>
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
    <section v-else-if="state.screen==='coop'" class="screen coop-screen" :class="{ 'setup-slider': isCoopDiffView }" :style="isCoopDiffView ? diffVars(state.coop.lobbyDiffId) : null">
      <div v-if="isCoopDiffView" class="setup-aura" aria-hidden="true"><b></b><b></b><b></b></div>
      <header class="topbar setup-top">
        <button class="icon-btn" @click="goBack()">‹</button>
        <h2>{{ t('coop.title') }}</h2>
        <button class="icon-btn" @click="openSettings" :aria-label="t('home.settings')" :title="t('home.settings')"><span class="ico-wrap" v-html="ic('gear')"></span></button>
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
          <span class="btn-ic"><span class="ei" v-html="ic('signal')"></span></span>
          <span class="btn-tx"><b>{{ t('coop.host') }}</b><small>{{ t('coop.hostHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" @click="coopChooseGuest()">
          <span class="btn-ic"><span class="ei" v-html="ic('link')"></span></span>
          <span class="btn-tx"><b>{{ t('coop.join') }}</b><small>{{ t('coop.joinHint') }}</small></span>
        </button>
      </div>

      <!-- Host: Code + Schwierigkeit — identischer Vollflächen-Slider wie Solo,
           Raumcode INNERHALB des Screens integriert (setup-slider auf der Section). -->
      <template v-else-if="state.coop.role === 'host' && !state.coop.waitingForGuest">
        <div class="setup-coderow">
          <label for="coopcode">{{ t('coop.setCode') }}</label>
          <input id="coopcode" class="setup-codeinput" v-model="state.coop.code" maxlength="6" inputmode="numeric" pattern="[0-9]*"
                 :placeholder="t('common.codePlaceholder')" @input="state.coop.code=state.coop.code.replace(/\D/g,'')" />
        </div>
        <difficulty-slider v-model="state.coop.lobbyDiffId" :coop="true"></difficulty-slider>
        <div class="setup-startrow">
          <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
          <button class="btn btn-primary btn-start diff-start" @click="startHosting">{{ t('coop.startHosting') }}</button>
        </div>
      </template>

      <!-- Host: warten auf Gast -->
      <div v-else-if="state.coop.role === 'host'" class="coop-body">
        <template v-if="true">
          <div class="coop-code-label">{{ t('coop.yourCode') }}</div>
          <div class="coop-code">{{ state.coop.code }}</div>
          <p class="coop-subtext">{{ t('coop.shareCode') }}</p>
          <button class="btn btn-ghost btn-sm" @click="openInvitePicker"><span class="ei" v-html="ic('users')"></span> {{ t('coop.inviteFriends') }}</button>
          <!-- Freunde-Auswahl zum Einladen in diese Lobby -->
          <div v-if="state.coop.invitePickerOpen" class="invite-picker">
            <div class="invite-picker-head">
              <span>{{ t('coop.inviteFriends') }}</span>
              <button class="icon-btn" @click="closeInvitePicker" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
            </div>
            <p v-if="!state.friends.list.length" class="set-hint">{{ t('friends.empty') }}</p>
            <div v-for="fr in friendsSorted()" :key="fr.uid" class="invite-row">
              <span class="friends-dot" :class="{ online: friendOnline(fr.uid), ingame: friendInGame(fr.uid) }"></span>
              <span class="invite-name">{{ fr.username || fr.uid }}</span>
              <!-- Offene Einladung → „Zurückziehen" (löscht sie live beim Freund),
                   danach ist erneutes Einladen sofort wieder möglich. -->
              <button v-if="state.coop.invitedUids.includes(fr.uid)" class="btn btn-ghost btn-sm invite-withdraw" @click="withdrawLobbyInvite(fr)">{{ t('coop.inviteWithdraw') }}</button>
              <button v-else class="btn btn-primary btn-sm" @click="inviteFriendToLobby(fr)">{{ t('coop.invite') }}</button>
            </div>
          </div>
          <p v-if="state.coop.teamMode" class="coop-subtext">{{ t('team.assignHint') }}</p>
          <button v-if="state.coop.teamMode && state.coop.role==='host'" class="btn btn-ghost btn-sm randomize-teams-btn" :disabled="state.coop.players.length<2" @click="randomizeTeams"><span class="ei" v-html="ic('shuffle')"></span> {{ t('team.randomize') }}</button>
          <div class="team-picker" v-if="state.coop.teamMode && state.coop.players.length">
            <div class="team-picker-header team-picker-header-a">{{ t('team.labelA') }}</div>
            <div class="team-picker-header team-picker-header-mid"></div>
            <div class="team-picker-header team-picker-header-b">{{ t('team.labelB') }}</div>
            <template v-for="p in state.coop.players" :key="p.id">
              <div class="team-slot team-slot-a">
                <span v-if="p.team==='A'" class="player-chip" :style="{ background: p.color, color: chipTextColor(p.color) }">
                  {{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
                </span>
              </div>
              <div class="team-slot team-slot-mid">
                <template v-if="!p.team">
                  <span class="team-mid-name">{{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template></span>
                  <button type="button" class="team-arrow-btn" :disabled="state.coop.role!=='host'" @click="assignTeam(p.id,'A')" :aria-label="t('team.moveTo',{team:t('team.labelA')})">◀</button>
                  <button type="button" class="team-arrow-btn" :disabled="state.coop.role!=='host'" @click="assignTeam(p.id,'B')" :aria-label="t('team.moveTo',{team:t('team.labelB')})">▶</button>
                </template>
                <template v-else>
                  <button type="button" class="team-arrow-btn team-swap-btn" :disabled="state.coop.role!=='host'"
                          @click="assignTeam(p.id, p.team==='A' ? 'B' : 'A')"
                          :aria-label="t('team.moveTo',{team:t('team.label'+(p.team==='A'?'B':'A'))})">{{ p.team==='A' ? '▶' : '◀' }}</button>
                  <button type="button" class="team-arrow-btn team-unassign-btn" :disabled="state.coop.role!=='host'" @click="assignTeam(p.id,null)" :aria-label="t('team.unassign')"><span class="ico-wrap" v-html="ic('close')"></span></button>
                </template>
              </div>
              <div class="team-slot team-slot-b">
                <span v-if="p.team==='B'" class="player-chip" :style="{ background: p.color, color: chipTextColor(p.color) }">
                  {{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
                </span>
              </div>
            </template>
          </div>
          <div class="coop-roster" v-if="!state.coop.teamMode && state.coop.players.length">
            <span v-for="p in state.coop.players" :key="p.id" class="player-chip"
                  :style="{ background: p.color, color: chipTextColor(p.color) }">
              {{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
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
            <div class="diff-card" :style="diffVars(state.coop.lobbyDiffId)">
              <div class="setup-aura" aria-hidden="true"><b></b><b></b><b></b></div>
              <difficulty-slider v-model="state.coop.lobbyDiffId" :coop="true"></difficulty-slider>
            </div>
          </template>
          <p class="coop-subtext">{{ t('coop.playersCount', { n: state.coop.players.length, max: (state.coop.raceMode && !state.coop.ffaMode) ? 2 : COOP_MAX_PLAYERS }) }}</p>
          <button v-if="state.coop.teamMode" class="btn btn-primary" :disabled="!canStartTeamMatch()" @click="startTeamMatch">{{ t('team.startMatch') }}</button>
          <button v-else-if="state.coop.raceMode" class="btn btn-primary" :disabled="!canStartRaceMatch()" @click="startRaceMatch">{{ t('race.startMatch') }}</button>
          <button v-else class="btn btn-primary" :disabled="!canStartCoopMatch()" @click="startCoopMatch">{{ t('coop.startMatch') }}</button>
          <div v-if="state.coop.teamMode ? !canStartTeamMatch() : (state.coop.raceMode ? !canStartRaceMatch() : !canStartCoopMatch())" class="coop-waiting">
            <div class="spinner"></div>
            <div class="loading-tx">{{ t(state.coop.teamMode ? 'team.waitingForTeams' : (state.coop.raceMode ? (state.coop.ffaMode ? 'race.waitingForPlayers' : 'race.waitingForOpponent') : 'coop.waitingForGuest')) }}</div>
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
            {{ playerLabel(p) }}<template v-if="p.id===state.coop.myId">{{ t('common.youSuffix') }}</template>
            <b v-if="state.coop.teamMode">{{ p.team ? t('team.label'+p.team) : t('team.unassigned') }}</b>
          </span>
        </div>
        <p v-if="state.coop.waitingForGuest && state.coop.myId" class="coop-subtext">{{ t('coop.playersCount', { n: state.coop.players.length, max: (state.coop.raceMode && !state.coop.ffaMode) ? 2 : COOP_MAX_PLAYERS }) }}</p>
        <p v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</p>
        <button class="btn btn-ghost" style="margin-top:4px" @click="goBack()">{{ t('common.back') }}</button>
      </div>

    </section>

    <!-- ══ SHOP (Work in Progress) ══ -->
    <section v-else-if="state.screen==='shop'" class="screen shop">
      <header class="topbar">
        <!-- Zurück: aus einer Kategorie erst zur Kategorien-Übersicht, dann raus. -->
        <button class="icon-btn" @click="state.shopCategory ? closeShopCategory() : closeShop()">‹</button>
        <h2>{{ state.shopCategory ? shopCategoryTitle(state.shopCategory) : t('shop.title') }}</h2>
        <!-- Guthaben-Chip öffnet den Geldverlauf (Transaktionshistorie). -->
        <button class="coin-chip coin-chip-btn" @click="openWalletLog" :aria-label="t('wallet.historyTitle')" :title="t('wallet.historyTitle')"><span class="ico-lead" v-html="ic('coin')"></span>{{ state.wallet.balance || 0 }}</button>
      </header>

      <!-- Kategorie: 🎉 Sieganimationen (kaufen/aktivieren/Vorschau) -->
      <div v-if="state.shopCategory === 'winfx'" class="shop-body">
        <p class="shop-sec-hint">{{ t('shop.winFxHint') }}</p>
        <div class="shop-grid">
          <div v-for="e in WIN_EFFECTS" :key="e.id" class="shop-card fx" :class="{ owned: ownsWinFx(e.id), fxactive: winFxActive(e.id) }">
            <button class="shop-fx-preview" @click="previewWinFx(e.id)" :aria-label="t('shop.preview')" :title="t('shop.preview')">▶</button>
            <span class="shop-card-ic" v-html="ic(e.icon)"></span>
            <span class="shop-card-name">{{ t('shop.effect.'+e.id) }}</span>
            <button v-if="!ownsWinFx(e.id)" class="btn btn-primary btn-sm shop-buy-btn" :disabled="(state.wallet.balance||0) < effectPrice(e.id)" @click="buyWinFx(e.id)"><span class="ei" v-html="ic('coin')"></span> {{ effectPrice(e.id) }}</button>
            <span v-else-if="winFxActive(e.id)" class="shop-fx-state on"><span class="ei" v-html="ic('check')"></span> {{ t('shop.active') }}</span>
            <button v-else class="btn btn-ghost btn-sm shop-buy-btn" @click="activateWinFx(e.id)">{{ t('shop.activate') }}</button>
          </div>
        </div>
      </div>

      <!-- Generische Artikel-Kategorie (Paletten & künftige): Gratis-Standard +
           Kaufkarten mit kategoriespezifischer Vorschau. -->
      <div v-if="state.shopCategory && state.shopCategory !== 'winfx'" class="shop-body">
        <p class="shop-sec-hint">{{ t('shop.catHint.' + state.shopCategory) }}</p>

        <!-- Live-Demo: Brett-Kategorien zeigen das per ▶ gewählte Item sofort -->
        <div v-if="['palette','font','frame','skinpreset'].includes(state.shopCategory)" class="shop-demo-wrap">
          <div class="board shop-demo" :class="[shopDemoClass('font') && state.shopCategory==='font' ? shopDemoClass('font') : '', shopDemoClass('frame') && state.shopCategory==='frame' ? shopDemoClass('frame') : '', state.shopCategory==='skinpreset' ? shopDemoSkin().classes : '']" :style="state.shopCategory==='skinpreset' ? shopDemoSkin().vars : null">
            <template v-if="state.shopCategory==='palette'">
              <div v-for="(c, i) in shopDemoCells()" :key="i" class="cell" :style="{ background: c }"><span class="cnum">{{ [3,8,5,9][i] }}</span></div>
            </template>
            <template v-else-if="state.shopCategory==='skinpreset'">
              <div class="cell kept coop-mark" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">5</span></div>
              <div class="cell removed coop-mark-removed" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">3</span></div>
            </template>
            <template v-else>
              <div v-for="(n, i) in [3,8,5,9]" :key="i" class="cell"><span class="cnum">{{ n }}</span></div>
            </template>
          </div>
          <small class="shop-demo-hint">{{ t('shop.demoHint') }}</small>
        </div>

        <div class="shop-grid">
          <!-- Gratis-Standard (entfällt bei Anwenden-Kategorien wie Skin-Vorlagen) -->
          <div v-if="SHOP_CATS[state.shopCategory].free" class="shop-card fx" :class="{ fxactive: shopEquippedId(state.shopCategory) === SHOP_CATS[state.shopCategory].free }">
            <span class="shop-card-ic"><span class="ei" v-html="ic('check')"></span></span>
            <button class="shop-fx-preview" :class="{ prevon: state.shopPreview && state.shopPreview.id === SHOP_CATS[state.shopCategory].free }" @click="shopPreviewFree(state.shopCategory)" :aria-label="t('shop.preview')" :title="t('shop.preview')">▶</button>
            <span v-if="state.shopCategory === 'font'" class="font-demo">123</span>
            <span v-if="state.shopCategory === 'frame'" class="frame-demo"></span>
            <span v-if="shopFreeDots(state.shopCategory)" class="shop-pal-dots"><i v-for="(c, di) in shopFreeDots(state.shopCategory)" :key="di" :style="{ background: c }"></i></span>
            <span class="shop-card-name">{{ t('shop.free.' + state.shopCategory) }}</span>
            <span v-if="shopEquippedId(state.shopCategory) === SHOP_CATS[state.shopCategory].free" class="shop-fx-state on"><span class="ei" v-html="ic('check')"></span> {{ t('shop.active') }}</span>
            <button v-else class="btn btn-ghost btn-sm shop-buy-btn" @click="equipShopFree(state.shopCategory)">{{ t('shop.activate') }}</button>
          </div>
          <div v-for="it in shopCatItems(state.shopCategory)" :key="it.id" class="shop-card fx" :class="{ owned: ownsShop(it), fxactive: shopEquippedId(state.shopCategory) === it.id }">
            <span class="shop-card-ic" v-html="ic(it.icon)"></span>
            <button class="shop-fx-preview" :class="{ prevon: shopDemoActive(it) }" @click="shopPreviewIt(it)" :aria-label="t('shop.preview')" :title="t('shop.preview')">▶</button>
            <span v-if="it.cat === 'font'" class="font-demo" :class="'font-' + it.id">123</span>
            <span v-if="it.cat === 'frame'" class="frame-demo" :class="'frame-' + it.id"></span>
            <span v-if="shopPreviewDots(it)" class="shop-pal-dots"><i v-for="(c, di) in shopPreviewDots(it)" :key="di" :style="{ background: c }"></i></span>
            <span class="shop-card-name">{{ t('shop.it.' + it.id) }}</span>
            <button v-if="!ownsShop(it)" class="btn btn-primary btn-sm shop-buy-btn" :disabled="(state.wallet.balance||0) < shopItemPrice(it)" @click="buyShopItem(it)"><span class="ei" v-html="ic('coin')"></span> {{ shopItemPrice(it) }}</button>
            <button v-else-if="it.cat === 'skinpreset'" class="btn btn-ghost btn-sm shop-buy-btn" @click="applySkinPreset(it)">{{ t('shop.apply') }}</button>
            <span v-else-if="shopEquippedId(state.shopCategory) === it.id" class="shop-fx-state on"><span class="ei" v-html="ic('check')"></span> {{ t('shop.active') }}</span>
            <button v-else class="btn btn-ghost btn-sm shop-buy-btn" @click="equipShopItem(it)">{{ t('shop.activate') }}</button>
          </div>
        </div>
      </div>

      <!-- Kategorien-Übersicht: erst die Kategorie wählen, dann die Artikel. -->
      <div v-if="!state.shopCategory" class="shop-body">
        <p class="shop-intro">{{ t('shop.intro') }}</p>
        <div class="shop-grid">
          <button class="shop-card shop-cat" @click="openShopCategory('winfx')">
            <span class="shop-card-ic" v-html="ic('party')"></span>
            <span class="shop-card-name">{{ t('shop.winFxTitle') }}</span>
            <span class="shop-cat-count">{{ ownedWinFx().length }}/{{ WIN_EFFECTS.length }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('palette')">
            <span class="shop-card-ic" v-html="ic('rainbow')"></span>
            <span class="shop-card-name">{{ t('shop.item.boardPalettes') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('palette') + 1 }}/{{ shopCatItems('palette').length + 1 }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('sfx')">
            <span class="shop-card-ic" v-html="ic('music')"></span>
            <span class="shop-card-name">{{ t('shop.item.soundPacks') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('sfx') + 1 }}/{{ shopCatItems('sfx').length + 1 }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('music')">
            <span class="shop-card-ic" v-html="ic('music')"></span>
            <span class="shop-card-name">{{ t('shop.item.musicPacks') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('music') + 1 }}/{{ shopCatItems('music').length + 1 }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('font')">
            <span class="shop-card-ic" v-html="ic('digits')"></span>
            <span class="shop-card-name">{{ t('shop.item.numberFonts') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('font') + 1 }}/{{ shopCatItems('font').length + 1 }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('frame')">
            <span class="shop-card-ic" v-html="ic('frame')"></span>
            <span class="shop-card-name">{{ t('shop.item.boardFrames') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('frame') + 1 }}/{{ shopCatItems('frame').length + 1 }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('theme')">
            <span class="shop-card-ic" v-html="ic('palette')"></span>
            <span class="shop-card-name">{{ t('shop.item.appThemes') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('theme') + 1 }}/{{ shopCatItems('theme').length + 1 }} ›</span>
          </button>
          <button class="shop-card shop-cat" @click="openShopCategory('skinpreset')">
            <span class="shop-card-ic" v-html="ic('brush')"></span>
            <span class="shop-card-name">{{ t('shop.item.skinPresets') }}</span>
            <span class="shop-cat-count">{{ shopOwnedCount('skinpreset') }}/{{ shopCatItems('skinpreset').length }} ›</span>
          </button>
        </div>
      </div>
    </section>

    <!-- ══ SETTINGS ══ -->
    <section v-else-if="state.screen==='settings'" class="screen settings">
      <header class="topbar">
        <button class="icon-btn" @click="closeSettings" :aria-label="t('common.back')">‹</button>
        <h2>{{ t('settings.title') }}</h2>
        <span class="topbar-spacer"></span>
      </header>

      <!-- EINE scrollbare Seite mit Accordion-Karten (Look des Admin-Editors):
           alle Bereiche sind als Karten-Köpfe immer sichtbar — nichts versteckt
           sich mehr hinter einem Drawer oder unterhalb eines scheinbar vollen
           Bildschirms. state.settingsTab = aktuell aufgeklappte Karte (Deep-Links
           wie „Konto" von Home setzen sie weiterhin direkt). -->
      <div class="settings-body settings-cards">

        <!-- 🎮 Spiel -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('spiel')">
            <span><span class="ico-lead" v-html="ic('controller')"></span>{{ t('settings.tabGame') }}</span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='spiel' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='spiel'" class="admin-acc-body">
          <button class="btn btn-ghost set-howto-btn" @click="state.modal='howto'"><span class="btn-ic"><span class="ei" v-html="ic('book')"></span></span> {{ t('home.howto') }}</button>
          <div class="set-row col">
            <span class="set-row-label">{{ t('settings.eraseStyle') }}</span>
            <div class="seg">
              <button :class="{active:state.settings.eraseStyle==='hide'}" @click="setSetting('eraseStyle','hide')">{{ t('settings.hide') }}</button>
              <button :class="{active:state.settings.eraseStyle==='strike'}" @click="setSetting('eraseStyle','strike')">{{ t('settings.strike') }}</button>
            </div>
          </div>
          <div class="set-row" @click="toggleSetting('coopRemovedOutline')">
            <span>{{ t('settings.coopRemovedOutline') }}</span><span class="switch" :class="{on:state.settings.coopRemovedOutline}"><i></i></span>
          </div>
          <small class="set-hint">{{ t('settings.coopRemovedOutlineHint') }}</small>
          </div>
        </div>

        <!-- 🖥️ Desktop (Tastatur-Kürzel) -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('desktop')">
            <span><span class="ico-lead" v-html="ic('keyboard')"></span>{{ t('settings.secDesktop') }}</span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='desktop' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='desktop'" class="admin-acc-body">
            <div class="set-row col">
              <span class="set-row-label">{{ t('settings.desktop.toolKey') }}</span>
              <div class="desktop-key-row">
                <button class="btn btn-ghost btn-sm desktop-key-cap" :class="{ capturing: state.desktopKeyCapture }" @click="startDesktopKeyCapture">
                  {{ state.desktopKeyCapture ? t('settings.desktop.press') : desktopKeyLabel(state.settings.desktopToolKey) }}
                </button>
                <button v-if="state.desktopKeyCapture" class="btn-link" @click="cancelDesktopKeyCapture">{{ t('common.cancel') }}</button>
                <button v-else-if="state.settings.desktopToolKey" class="btn-link" @click="clearDesktopToolKey">{{ t('settings.desktop.off') }}</button>
              </div>
              <small class="set-hint">{{ t('settings.desktop.hint') }}</small>
            </div>
          </div>
        </div>

        <!-- 🌓 Darstellung (Theme, Sprache, Barrierefreiheit) -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('darstellung')">
            <span><span class="ico-lead" v-html="ic('theme')"></span>{{ t('settings.secAppearance') }}</span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='darstellung' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='darstellung'" class="admin-acc-body">
          <div class="set-row col">
            <span class="set-row-label">{{ t('settings.theme') }}</span>
            <div class="seg">
              <button :class="{active:state.settings.themeMode==='auto'}" @click="setSetting('themeMode','auto')">{{ t('settings.themeAuto') }}</button>
              <button :class="{active:state.settings.themeMode==='light'}" @click="setSetting('themeMode','light')"><span class="ei" v-html="ic('sun')"></span> {{ t('settings.themeLight') }}</button>
              <button :class="{active:state.settings.themeMode==='dark'}" @click="setSetting('themeMode','dark')"><span class="ei" v-html="ic('moon')"></span> {{ t('settings.themeDark') }}</button>
            </div>
            <small class="set-hint">{{ t('settings.themeHint') }}</small>
          </div>
          <div class="set-row col">
            <span class="set-row-label">{{ t('settings.language') }}</span>
            <!-- lang-select: eindeutiger Anker für E2E-Tests (die Darstellung-Sektion
                 enthält inzwischen mehrere Selects, u.a. die Sieganimation). -->
            <select class="text-input lang-select" :value="state.settings.language" @change="setSetting('language', $event.target.value)">
              <option v-for="l in SUPPORTED_LOCALES" :key="l.id" :value="l.id">{{ l.label }}</option>
            </select>
          </div>

          <!-- 🎉 Sieganimation: Auswahl aller GEKAUFTEN Effekte (Kauf im Shop) + ▶ Vorschau -->
          <div class="set-row col">
            <span class="set-row-label"><span class="ei" v-html="ic('party')"></span> {{ t('settings.winEffect') }}</span>
            <div class="set-fx-row">
              <select class="text-input" :value="activeWinFxId()" @change="activateWinFx($event.target.value)">
                <option v-for="e in ownedWinFx()" :key="e.id" :value="e.id">{{ t('shop.effect.'+e.id) }}</option>
              </select>
              <button class="shop-fx-preview set-fx-preview" @click="previewWinFx(activeWinFxId())" :aria-label="t('shop.preview')" :title="t('shop.preview')">▶</button>
            </div>
            <small class="set-hint">{{ t('settings.winEffectHint') }} <button class="btn-link" @click="openShop('winfx')">{{ t('shop.title') }} ›</button></small>
          </div>

          <!-- Alle erworbenen Optik-Cosmetics ausrüsten (Theme/Palette/Font/Rahmen) -->
          <div class="set-row col" v-for="cat in settingsVisualCats()" :key="cat">
            <span class="set-row-label"><span class="ei" v-html="ic(SHOP_CATS[cat].icon)"></span> {{ shopCategoryTitle(cat) }}</span>
            <select class="text-input" :value="shopEquippedId(cat)" @change="equipCatFromSettings(cat, $event.target.value)">
              <option v-for="o in settingsCatOptions(cat)" :key="o.id" :value="o.id">{{ o.name }}</option>
            </select>
          </div>

          <div class="set-group-title">{{ t('settings.a11y') }}</div>
          <div class="set-row" @click="toggleSetting('colorBlindMode')">
            <span>{{ t('settings.colorBlindMode') }}</span><span class="switch" :class="{on:state.settings.colorBlindMode}"><i></i></span>
          </div>
          <small class="set-hint">{{ t('settings.colorBlindModeHint') }}</small>
          </div>
        </div>

        <!-- 🎨 Farbe & Anpassung (eigene Farbe + dynamischer Skin) -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('farbe')">
            <span><span class="ico-lead" v-html="ic('palette')"></span>{{ t('settings.secColors') }}</span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='farbe' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='farbe'" class="admin-acc-body">
          <div class="set-group-title">{{ t('settings.myColor') }}</div>
          <div class="set-row col">
            <div class="coop-swatches">
              <input type="color" class="swatch-custom" v-model="state.settings.coopMyColor" :title="t('common.pickColorTitle')" />
            </div>
            <small class="set-hint">{{ t('settings.colorHint') }}</small>
          </div>

          <!-- Dynamischer Skin (1.0): Code-Einlösung immer sichtbar; Editor nur, wenn freigeschaltet -->
          <div class="set-group-title skin-editor">{{ t('skin.title') }}</div>
          <!-- Vorschau + An/Aus: für Besitzer des exklusiven Skins ODER einer
               gekauften Skin-Vorlage. Der freie EDITOR darunter bleibt exklusiv. -->
          <template v-if="skinUnlocked || skinPresetOwned">
            <div class="skin-preview-wrap">
              <div class="board skin-preview" :class="skinPreviewClasses" :style="skinPreviewVars">
                <div class="cell kept coop-mark" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">5</span></div>
                <div class="cell removed coop-mark-removed" :style="{ '--markcol': state.settings.coopMyColor }"><span class="cnum">3</span></div>
              </div>
            </div>
            <div class="set-row" @click="toggleSetting('skinEnabled')">
              <span>{{ t('skin.enabled') }}</span><span class="switch" :class="{on:state.settings.skinEnabled}"><i></i></span>
            </div>
            <small v-if="!skinUnlocked" class="set-hint">{{ t('skin.presetOnlyHint') }} <button class="btn-link" @click="openShop('skinpreset')">{{ t('shop.title') }} ›</button></small>
          </template>
          <template v-if="skinUnlocked">
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
          </div>
        </div>

        <!-- 🔊 Ton (Musik + Aktions-Sounds) -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('ton')">
            <span><span class="ico-lead" v-html="ic('sound')"></span>{{ t('settings.tabSound') }}</span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='ton' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='ton'" class="admin-acc-body">
          <!-- „Alles stummschalten": Ein-Schalter, der Musik UND alle UI-Sounds
               still legt (zusätzlich zur Master-Lautstärke). Nutzt toggleMuteAll
               (nicht toggleSetting), weil zusätzlich Music.setMuted greifen muss. -->
          <div class="set-row" @click="toggleMuteAll">
            <span>{{ t('settings.muteAll') }}</span><span class="switch" :class="{on:state.settings.muteAll}"><i></i></span>
          </div>
          <!-- Erworbene Sound-/Musik-Pakete ausrüsten (mit ▶ Hör-Vorschau) -->
          <div class="set-row col" v-for="cat in settingsSoundCats()" :key="cat">
            <span class="set-row-label"><span class="ei" v-html="ic(SHOP_CATS[cat].icon)"></span> {{ shopCategoryTitle(cat) }}</span>
            <div class="set-fx-row">
              <select class="text-input" :value="shopEquippedId(cat)" @change="equipCatFromSettings(cat, $event.target.value)">
                <option v-for="o in settingsCatOptions(cat)" :key="o.id" :value="o.id">{{ o.name }}</option>
              </select>
              <button class="shop-fx-preview set-fx-preview" @click="shopPreviewIt({ cat, id: shopEquippedId(cat) })" :aria-label="t('shop.preview')" :title="t('shop.preview')">▶</button>
            </div>
          </div>
          <div class="set-row col">
            <span class="set-row-label">{{ t('settings.musicVolume') }}</span>
            <input type="range" class="set-range" min="0" max="1" step="0.01" :value="state.settings.musicVolume"
                   :style="{ '--rangePct': Math.round(state.settings.musicVolume*100) + '%' }"
                   @input="setSetting('musicVolume', parseFloat($event.target.value))" />
          </div>
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
          </div>
        </div>

        <!-- 👤 Konto (Profil/Anzeigename + optionaler Account + Cloud-Sync) -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('konto')">
            <span><span class="ico-lead" v-html="ic('user')"></span>{{ t('settings.tabAccount') }}<span v-if="state.account.status==='in'" class="admin-acc-count">{{ state.account.username }}</span></span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='konto' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='konto'" class="admin-acc-body">
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
                <input class="text-input" :class="{ 'input-invalid': ['taken','invalid'].includes(state.account.usernameCheck), 'input-valid': ['available'].includes(state.account.usernameCheck) }" v-model="state.account.usernameDraft" maxlength="20" autocapitalize="none" autocomplete="off" :placeholder="t('account.newUsername')" @input="onUsernameInput" @keydown.enter="doChangeUsername" />
                <small v-if="state.account.usernameCheck==='checking'" class="username-status checking">{{ t('account.usernameChecking') }}</small>
                <small v-else-if="state.account.usernameCheck==='available'" class="username-status ok"><span class="ei" v-html="ic('check')"></span> {{ t('account.usernameAvailable') }}</small>
                <small v-else-if="state.account.usernameCheck==='taken'" class="username-status err"><span class="ei" v-html="ic('close')"></span> {{ t('account.usernameTaken') }}</small>
                <small v-else-if="state.account.usernameCheck==='invalid'" class="username-status err"><span class="ei" v-html="ic('close')"></span> {{ t('account.usernameInvalid') }}</small>
                <div class="account-username-actions">
                  <button class="btn btn-primary btn-sm" :disabled="state.account.busy || !canSaveUsername()" @click="doChangeUsername">
                    <span v-if="state.account.busy"><span class="spinner-inline"></span></span><span v-else>{{ t('account.save') }}</span>
                  </button>
                  <button class="btn-link" @click="state.account.usernameEditing=false; state.account.usernameCheck='idle'">{{ t('common.cancel') }}</button>
                </div>
                <small class="set-hint">{{ t('account.usernameHint') }}</small>
              </div>
              <div class="account-row" v-if="state.account.email"><span class="account-label">{{ t('account.email') }}</span><span>{{ state.account.email }}</span></div>
              <div class="account-row"><span class="account-label">{{ t('account.role') }}</span><span class="account-role" :class="{ admin: state.account.role==='admin' }"><span v-if="state.account.role==='admin'" class="ei" v-html="ic('crown')"></span> {{ state.account.role==='admin' ? t('account.roleAdmin') : t('account.roleUser') }}</span></div>
              <div class="account-sync" :class="'sync-'+state.account.syncState">
                <template v-if="state.account.syncState==='syncing'"><span class="spinner-inline"></span> {{ t('account.syncing') }}</template>
                <template v-else-if="state.account.syncState==='error'"><span class="ei" v-html="ic('warning')"></span> {{ state.account.syncErrorMsg || t('account.syncError') }}</template>
                <template v-else-if="state.account.lastSyncAt">{{ t('account.syncedAt', { time: fmtSyncTime(state.account.lastSyncAt) }) }}</template>
                <template v-else><span class="ei" v-html="ic('cloud')"></span> {{ t('account.syncOn') }}</template>
              </div>
              <button class="btn btn-ghost btn-sm" :disabled="state.account.syncState==='syncing'" @click="doSyncNow"><span class="ei" v-html="ic('refresh')"></span> {{ t('account.syncNow') }}</button>
            </div>
            <!-- Passwort ändern: neues Passwort 2× + Speichern (ohne altes Passwort) -->
            <div class="admin-acc">
              <button class="admin-acc-head" @click="state.account.pwFormOpen = !state.account.pwFormOpen">
                <span><span class="ei" v-html="ic('key')"></span> {{ t('account.changePw') }}</span>
                <span class="admin-acc-chev" :class="{ open: state.account.pwFormOpen }">▾</span>
              </button>
              <div v-if="state.account.pwFormOpen" class="admin-acc-body">
                <input class="text-input" type="password" autocomplete="new-password" v-model="state.account.pwNew1" :placeholder="t('account.pwNew')" />
                <input class="text-input" type="password" autocomplete="new-password" v-model="state.account.pwNew2" :placeholder="t('account.pwRepeat')" @keydown.enter="doChangePassword" />
                <button class="btn btn-primary" :disabled="state.account.busy || !state.account.pwNew1 || !state.account.pwNew2" @click="doChangePassword">
                  <span v-if="state.account.busy"><span class="spinner-inline"></span></span>
                  <span v-else>{{ t('account.save') }}</span>
                </button>
              </div>
            </div>
            <button class="btn btn-ghost" :disabled="state.account.busy" @click="doSignOut">{{ t('account.signOut') }}</button>
            <button class="btn btn-danger-ghost" :disabled="state.account.busy" @click="doDeleteAccount">{{ t('account.deleteAccount') }}</button>

            <!-- Admin-Bereich (nur bei Rolle 'admin'; Rules erzwingen die Rechte serverseitig) -->
            <template v-if="state.account.role==='admin'">
              <div class="set-group-title">{{ t('admin.title') }}</div>
              <small class="set-hint">{{ t('admin.intro') }}</small>
              <button class="btn btn-primary" @click="openAdminConsole"><span class="ei" v-html="ic('users')"></span> {{ t('admin.openConsole') }}</button>
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
          </div>
        </div>

        <!-- 💾 Daten & Sicherung (Export/Import, Recht, Löschen) — bewusst zuletzt -->
        <div class="admin-acc">
          <button class="admin-acc-head" @click="toggleSettingsCard('daten')">
            <span><span class="ico-lead" v-html="ic('save')"></span>{{ t('settings.tabData') }}</span>
            <span class="admin-acc-chev" :class="{ open: state.settingsTab==='daten' }">▾</span>
          </button>
          <div v-if="state.settingsTab==='daten'" class="admin-acc-body">
          <button class="btn btn-ghost" @click="doExport">{{ t('settings.exportBackup') }}</button>
          <label class="btn btn-ghost file-btn">{{ t('settings.importBackup') }}
            <input type="file" accept="application/json" @change="doImport" hidden>
          </label>
          <button class="btn btn-ghost" @click="doExportLog">{{ t('settings.exportLog') }}</button>
          <button class="btn btn-ghost" @click="state.modal='changelog'">{{ t('settings.changelog') }}</button>
          <a class="btn btn-ghost" href="./privacy.html" target="_blank" rel="noopener">{{ t('settings.privacyPolicy') }}</a>
          <a class="btn btn-ghost" href="./imprint.html" target="_blank" rel="noopener">{{ t('settings.imprint') }}</a>
          <button class="btn btn-danger-ghost" @click="doDeleteAllData">{{ t('settings.deleteAllData') }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ TOAST ══ -->
    <transition name="toast">
      <div v-if="state.toast" class="toast" :class="state.toast.type">{{ state.toast.msg }}</div>
    </transition>

    <!-- ══ MULTI-DEVICE-HINWEIS ══ Cross-Device-Ereignisse (Partie woanders beendet /
         auf anderem Gerät übernommen / neue Version). Fixed Banner, immer sichtbar. -->
    <transition name="toast">
      <div v-if="state.deviceNotice" class="device-notice" :class="'dn-' + state.deviceNotice.kind">
        <span class="dn-ico ico-wrap" v-html="ic(state.deviceNotice.kind === 'takeover' ? 'signal' : state.deviceNotice.kind === 'reload' ? 'refresh' : 'cloud')"></span>
        <div class="dn-body">
          <div class="dn-title">{{ t('device.' + state.deviceNotice.kind + '.title') }}</div>
          <div class="dn-text">{{ t('device.' + state.deviceNotice.kind + '.text') }}</div>
        </div>
        <div class="dn-actions">
          <button v-if="state.deviceNotice.kind === 'takeover'" class="btn btn-sm" @click="reclaimSession">{{ t('device.takeover.resume') }}</button>
          <button class="btn btn-sm btn-ghost" @click="dismissDeviceNotice">{{ t('common.ok') }}</button>
        </div>
      </div>
    </transition>

    <!-- ══ VERSIONS-MISMATCH ══ Offline gespielt UND woanders online → Auswahl
         lokal vs. Cloud (die unterlegene Seite wird als Backup gesichert). -->
    <div v-if="state.versionMismatch" class="modal-overlay mismatch-overlay">
      <div class="modal mismatch-modal">
        <h2 class="mismatch-title"><span class="ei" v-html="ic('warning')"></span> {{ t('mismatch.title') }}</h2>
        <p class="mismatch-sub">{{ t('mismatch.sub') }}</p>
        <div class="mismatch-cards">
          <button class="mismatch-card" :disabled="state.versionMismatch.busy" @click="resolveVersionMismatch('local')">
            <div class="mc-head">{{ t('mismatch.local') }}</div>
            <div class="mc-time">{{ fmtMismatchTime(state.versionMismatch.local.ts) }}</div>
            <div class="mc-stats"><span><span class="ei" v-html="ic('coin')"></span> {{ state.versionMismatch.local.coins }}</span><span><span class="ei" v-html="ic('trophy')"></span> {{ state.versionMismatch.local.wins }}</span></div>
            <div class="mc-pick">{{ t('mismatch.keepLocal') }}</div>
          </button>
          <button class="mismatch-card" :disabled="state.versionMismatch.busy" @click="resolveVersionMismatch('cloud')">
            <div class="mc-head">{{ t('mismatch.cloud') }}</div>
            <div class="mc-time">{{ fmtMismatchTime(state.versionMismatch.cloud.ts) }}</div>
            <div class="mc-stats"><span><span class="ei" v-html="ic('coin')"></span> {{ state.versionMismatch.cloud.coins }}</span><span><span class="ei" v-html="ic('trophy')"></span> {{ state.versionMismatch.cloud.wins }}</span></div>
            <div class="mc-pick">{{ t('mismatch.keepCloud') }}</div>
          </button>
        </div>
        <p class="mismatch-note">{{ t('mismatch.note') }}</p>
      </div>
    </div>

    <!-- Sieganimation: global (fixed Overlay), damit die Shop-Vorschau auf jedem
         Screen funktioniert — nicht nur im Spiel. MUSS ein eigenständiges Element
         sein (NICHT im <transition> des Toasts): eine Vue-<transition> rendert nur
         EIN Kind — mit-verschachtelt wurde die komplette Sieganimation verschluckt
         (sie war praktisch nie im DOM). -->
    <div v-if="state.winFx" class="winfx" :class="['fx-' + state.winFx.id, { perfect: state.perfectWin }]" :key="state.winFx.seq">
      <i v-for="p in state.winFx.pieces" :key="p.id" :class="[p.creature ? 'cr' : '', p.shape ? 'sv' : '', p.txt ? 'tx' : '', p.kind ? 'k' + p.kind : '', p.corner != null ? 'c' + p.corner : '', p.band != null ? 'b' + p.band : '']" :style="winFxStyle(p)" v-html="p.creature || (p.shape ? winShape(p.shape, p.hue) : (p.txt || ''))"></i>
      <b v-if="state.winFx.id==='arcade'" class="winfx-label">YOU WIN</b>
    </div>
    <!-- Top-Banner statt Toast: verdeckt nie das Spielfeld, sitzt am oberen Rand. -->
    <transition name="toast">
      <div v-if="state.bestTimeNotice" class="best-time-banner"><span class="ei" v-html="ic('clock')"></span> {{ state.bestTimeNotice }}</div>
    </transition>

    <!-- ══ MODALS ══ -->
    <!-- Admin-Konsole: vollständige, editierbare Nutzer-Tabelle (Vollbild-Modal) -->
    <div v-if="state.account.adminConsoleOpen" class="modal-bg" @click.self="closeAdminConsole">
      <div class="modal admin-console-modal">
        <header class="friends-head">
          <h3><span class="ei" v-html="ic('crown')"></span> {{ t('admin.consoleTitle') }}</h3>
          <button class="icon-btn" @click="closeAdminConsole" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
        </header>
        <div class="admin-console-toolbar">
          <input class="text-input" v-model="state.account.adminFilter" :placeholder="t('admin.filterPlaceholder')" autocapitalize="none" />
          <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminLoadUsers" :aria-label="t('admin.reload')">
            <span v-if="state.account.adminBusy" class="spinner-inline"></span>
            <span v-else><span class="ei" v-html="ic('refresh')"></span></span>
          </button>
        </div>
        <p class="set-hint admin-console-count">{{ t('admin.userCount', { n: filteredAdminUsers().length, total: state.account.adminUsers.length }) }}</p>
        <p v-if="state.account.adminError" class="coop-error">{{ state.account.adminError }}</p>
        <div v-if="state.account.adminBusy && !state.account.adminUsers.length" class="admin-console-empty"><span class="spinner-inline"></span> {{ t('account.working') }}</div>
        <div v-else class="admin-console-table">
          <div class="admin-tbl-head">
            <span class="admin-col-user">{{ t('admin.colUser') }}</span>
            <span class="admin-col-bal"><span class="ei" v-html="ic('coin')"></span></span>
            <span class="admin-col-skin"><span class="ei" v-html="ic('palette')"></span></span>
          </div>
          <button v-for="u in filteredAdminUsers()" :key="u.uid" class="admin-tbl-row" @click="openAdminEdit(u)">
            <span class="admin-col-user">
              <span class="admin-tbl-name">
                <b>{{ u.username || '—' }}</b>
                <span v-if="u.role==='admin'" class="account-role admin admin-role-tag"><span class="ei" v-html="ic('crown')"></span></span>
              </span>
              <small class="admin-tbl-sub">{{ u.email || t('admin.noEmail') }}</small>
              <small class="admin-tbl-sub admin-tbl-uid">{{ u.uid }}</small>
            </span>
            <span class="admin-col-bal">{{ u.balance }}</span>
            <span class="admin-col-skin"><span v-if="u.hasSkin" class="ei" v-html="ic('check')"></span><span v-else>—</span></span>
          </button>
          <p v-if="!filteredAdminUsers().length && !state.account.adminBusy" class="set-hint admin-console-empty">{{ t('admin.noMatch') }}</p>
        </div>
        <button class="btn btn-primary" @click="closeAdminConsole">{{ t('admin.done') }}</button>
      </div>
    </div>
    <!-- Admin: User bearbeiten — vollständiger Daten-Editor -->
    <div v-if="state.account.adminEditUser" class="modal-bg" @click.self="closeAdminEdit">
      <div class="modal admin-edit-modal">
        <header class="admin-edit-head">
          <span class="admin-avatar">{{ (state.account.adminEditUser.username || state.account.adminEditUser.uid || '?').slice(0,1).toUpperCase() }}</span>
          <div class="admin-edit-title">
            <span class="admin-edit-name">
              <b>{{ state.account.adminEditUser.username || '—' }}</b>
              <span class="account-role" :class="{ admin: state.account.adminEditUser.role==='admin' }">{{ state.account.adminEditUser.role==='admin' ? t('account.roleAdmin') : t('account.roleUser') }}</span>
            </span>
            <small class="admin-uid">{{ state.account.adminEditUser.uid }}</small>
          </div>
          <button class="icon-btn" @click="closeAdminEdit" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
        </header>

        <!-- Kennzahlen-Chips (live aus dem frischen Snapshot, inkl. ungespeicherter Werte).
 Antippen springt in die passende Sektion — z.B. öffnet die Wallet. -->
        <div class="admin-chips">
          <button class="admin-chip admin-chip-btn" @click="openAdminSection('wallet')"><span class="ei" v-html="ic('coin')"></span> {{ adminChipValue('wallet/balance', state.account.adminEditUser.balance ?? 0) }}</button>
          <button class="admin-chip admin-chip-btn" @click="openAdminSection('daily')"><span class="ei" v-html="ic('flame')"></span> {{ adminChipValue('daily/currentStreak', 0) }}</button>
          <button class="admin-chip admin-chip-btn" @click="openAdminSection('stats')"><span class="ei" v-html="ic('trophy')"></span> {{ adminChipValue('stats/won', 0) }}</button>
          <button class="admin-chip admin-chip-btn" @click="openAdminSection('_inventory')"><span class="ei" v-html="ic('palette')"></span> {{ state.account.adminEditUser.itemCount || 0 }}</button>
        </div>

        <!-- JSON-Untereditor (tiefe Strukturen) ersetzt den Inhalt, solange offen -->
        <template v-if="state.account.adminJsonPath">
          <b class="admin-json-title">{ } {{ adminPathLabel(state.account.adminJsonPath) }}</b>
          <textarea class="text-input admin-json-area" v-model="state.account.adminJsonDraft" spellcheck="false" autocapitalize="none"></textarea>
          <p v-if="state.account.adminJsonError" class="coop-error">{{ state.account.adminJsonError }}</p>
          <div class="admin-field-row">
            <button class="btn btn-ghost" @click="closeAdminJson">{{ t('common.back') }}</button>
            <button class="btn btn-primary admin-json-save" @click="saveAdminJson">{{ t('account.save') }}</button>
          </div>
        </template>

        <template v-else>
          <div class="admin-edit-scroll">
            <!-- ⚡ Konto-Aktionen (echte Knoten: Rolle, Username, Reset — kein Snapshot) -->
            <div class="admin-acc">
              <button class="admin-acc-head" @click="toggleAdminSection('_actions')">
                <span><span class="ei" v-html="ic('bolt')"></span> {{ t('admin.accountActions') }}</span>
                <span class="admin-acc-chev" :class="{ open: state.account.adminDataSection==='_actions' }">▾</span>
              </button>
              <div v-if="state.account.adminDataSection==='_actions'" class="admin-acc-body">
                <div class="account-row"><span class="account-label">{{ t('account.email') }}</span><span class="admin-uid">{{ state.account.adminEditUser.email || t('admin.noEmail') }}</span></div>
                <div class="account-row"><span class="account-label">{{ t('admin.createdAt') }}</span><span>{{ adminFmtDate(state.account.adminEditUser.createdAt) }}</span></div>
                <div class="admin-actions">
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminToggleRole">{{ state.account.adminEditUser.role==='admin' ? t('admin.makeUser') : t('admin.makeAdmin') }}</button>
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminResetPw"><span class="ei" v-html="ic('mail')"></span> {{ t('admin.resetPw') }}</button>
                </div>
                <!-- Haken: Betroffenen über Geschenk/Entzug/Guthaben benachrichtigen -->
                <div class="set-row" @click="state.account.adminNotify = !state.account.adminNotify">
                  <span><span class="ei" v-html="ic('bell')"></span> {{ t('admin.notifyUser') }}</span><span class="switch" :class="{on:state.account.adminNotify}"><i></i></span>
                </div>
                <div class="admin-field-row">
                  <input class="text-input" v-model="state.account.adminUsername" maxlength="20" autocapitalize="none" :placeholder="t('account.newUsername')" />
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminChangeUsername">{{ t('account.save') }}</button>
                </div>
                <div class="admin-field-row">
                  <select class="text-input admin-select" v-model="state.account.adminFieldKey">
                    <option value="" disabled>{{ t('admin.profileField') }}: {{ t('admin.choose') }}</option>
                    <option v-for="k in adminFieldOptions()" :key="k" :value="k">{{ adminProfileFieldLabel(k) }}</option>
                  </select>
                  <input class="text-input" v-model="state.account.adminFieldVal" :placeholder="t('admin.fieldValue')" />
                  <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy || !state.account.adminFieldKey" @click="adminSetField">{{ t('account.save') }}</button>
                </div>
              </div>
            </div>

            <!-- 🎒 Inventar (autoritativer Union-Knoten, nicht der Snapshot) -->
            <div class="admin-acc">
              <button class="admin-acc-head" @click="toggleAdminSection('_inventory')">
                <span><span class="ei" v-html="ic('backpack')"></span> {{ t('admin.inventory') }} <small class="admin-acc-count">{{ adminOwnedOfTotal(state.account.adminEditUser) }} / {{ adminGiftTotal() }}</small></span>
                <span class="admin-acc-chev" :class="{ open: state.account.adminDataSection==='_inventory' }">▾</span>
              </button>
              <div v-if="state.account.adminDataSection==='_inventory'" class="admin-acc-body">
                <div class="admin-item-chips">
                  <span v-for="it in adminInventoryDisplay()" :key="it.id" class="admin-item-chip" :class="{ 'chip-pending-add': it.pending==='grant', 'chip-pending-remove': it.pending==='revoke' }">
                    {{ it.label }}
                    <button class="admin-item-x" :disabled="state.account.adminBusy" @click="adminRevokeItemId(it.id)" :aria-label="t('admin.revokeSkin')"><span class="ico-wrap" v-html="ic('close')"></span></button>
                  </span>
                  <span v-if="!adminInventoryDisplay().length" class="set-hint">—</span>
                </div>
                <button class="btn btn-gift btn-sm admin-gift-open" :disabled="state.account.adminBusy" @click="openAdminGiftPicker"><span class="ei" v-html="ic('gift')"></span> {{ t('admin.giftPick') }}</button>
                <button class="btn btn-gift btn-sm admin-grant-all" :disabled="state.account.adminBusy" @click="adminGrantAllItems"><span class="ei" v-html="ic('gift')"></span> {{ t('admin.grantAll') }}</button>
                <p v-if="adminPendingSummary()" class="set-hint admin-pending-hint">{{ adminPendingSummary() }}</p>
              </div>
            </div>

            <!-- Daten-Sektionen: JEDES Feld des Snapshots typisiert editierbar -->
            <div v-if="state.account.adminDataLoading" class="admin-console-empty"><span class="spinner-inline"></span> {{ t('account.working') }}</div>
            <template v-else>
              <div v-for="sec in adminDataSections()" :key="sec.key" class="admin-acc">
                <button class="admin-acc-head" @click="toggleAdminSection(sec.key)">
                  <span><span class="ei" v-html="ic(sec.ic)"></span> {{ adminSectionLabel(sec.key) }}</span>
                  <span class="admin-acc-chev" :class="{ open: state.account.adminDataSection===sec.key }">▾</span>
                </button>
                <div v-if="state.account.adminDataSection===sec.key" class="admin-acc-body">
                  <!-- Guthaben: spenden (+) / abziehen (−) / Zielwert (=) statt Fix-Setzen.
                       Der berechnete Zielwert wird als wallet/balance gestaged (Speichern
                       sendet); der Empfänger sieht die Differenz im Geldverlauf. -->
                  <div v-if="sec.key==='wallet'" class="admin-balance-ctl">
                    <div class="admin-balance-modes">
                      <button v-for="m in ['donate','subtract','target']" :key="m" class="admin-bmode" :class="{ active: state.account.adminBalanceMode===m }" @click="adminSetBalanceMode(m)">{{ t('admin.balMode.'+m) }}</button>
                    </div>
                    <div class="admin-field-row">
                      <input class="text-input" type="number" inputmode="numeric" min="0" v-model="state.account.adminBalanceAmount" :placeholder="t('admin.balAmount')" />
                      <button class="btn btn-gift btn-sm" :disabled="!state.account.adminBalanceAmount" @click="adminApplyBalanceChange"><span class="ei" v-html="ic('coin')"></span> {{ t('admin.balApply') }}</button>
                    </div>
                    <p v-if="state.account.adminBalanceAmount" class="set-hint admin-bal-preview">{{ t('admin.balPreview', { cur: adminBalanceCurrent(), next: adminBalanceTarget(), delta: (adminBalanceDelta()>=0?'+':'') + adminBalanceDelta() }) }}</p>
                  </div>
                  <div v-for="row in adminFieldRows(sec.key)" :key="row.path" class="admin-field-block" :class="{ dirty: row.path in state.account.adminDataDirty }">
                    <div class="admin-row">
                      <span class="admin-row-label">{{ adminRowLabel(row) }}</span>
                      <span v-if="row.type==='boolean'" class="switch" :class="{ on: adminFieldValue(row) }" @click="adminToggleField(row)"><i></i></span>
                      <select v-else-if="adminEnumOptions(row)" class="text-input admin-row-input admin-select" :value="adminFieldValue(row)" @change="adminMarkDirty(row.path, $event.target.value)">
                        <option v-for="o in adminEnumOptions(row)" :key="o.v" :value="o.v">{{ o.label }}</option>
                      </select>
                      <input v-else-if="adminIsDateField(row)" class="text-input admin-row-input" type="date" :value="adminFieldValue(row)" @change="adminInputField(row, $event)" />
                      <input v-else-if="row.type==='number'" class="text-input admin-row-input" type="number" inputmode="numeric" step="any" :value="adminFieldValue(row)" @change="adminInputField(row, $event)" />
                      <input v-else-if="row.type==='string'" class="text-input admin-row-input" :value="adminFieldValue(row)" @change="adminInputField(row, $event)" autocapitalize="none" />
                      <button v-else class="btn btn-ghost btn-sm" @click="openAdminJson(row)">{ } JSON</button>
                    </div>
                    <small v-if="adminRowTimestamp(row)" class="admin-row-desc"><span class="ei" v-html="ic('clock')"></span> {{ adminRowTimestamp(row) }}</small>
                    <small v-if="adminRowDesc(row)" class="admin-row-desc">{{ adminRowDesc(row) }}</small>
                  </div>
                  <p v-if="!adminFieldRows(sec.key).length" class="set-hint">—</p>
                </div>
              </div>
            </template>
            <small class="set-hint">{{ t('admin.dataHint') }}</small>
          </div>

          <p v-if="state.account.adminError" class="coop-error">{{ state.account.adminError }}</p>
          <!-- Sammel-Speichern: erscheint nur bei ungespeicherten Änderungen -->
          <div v-if="adminDirtyCount()" class="admin-save-bar">
            <button class="btn btn-ghost btn-sm" :disabled="state.account.adminBusy" @click="adminDiscardData">{{ t('admin.discard') }}</button>
            <button class="btn btn-primary admin-save-btn" :disabled="state.account.adminBusy" @click="adminSaveData">
              <span v-if="state.account.adminBusy"><span class="spinner-inline"></span></span>
              <span v-else><span class="ei" v-html="ic('save')"></span> {{ t('admin.saveN', { n: adminDirtyCount() }) }}</span>
            </button>
          </div>
          <button v-else class="btn btn-primary" @click="closeAdminEdit">{{ t('admin.done') }}</button>
        </template>
      </div>
    </div>

    <!-- Geschenk-Auswahl: kategorisierter Popup-Screen (wie der Shop) statt roher
         Dropdown-Liste. Antippen wählt einen Artikel zum Verschenken vor (grüner
         Haken); besessene Artikel sind markiert/deaktiviert. „Fertig" schließt,
         die Vorauswahl landet als Chip im Editor und wird per „Speichern" gesendet. -->
    <div v-if="state.account.adminGiftPickerOpen" class="modal-bg admin-gift-bg" @click.self="closeAdminGiftPicker">
      <div class="modal admin-gift-modal">
        <header class="admin-gift-head">
          <h3><span class="ei" v-html="ic('gift')"></span> {{ t('admin.giftTitle') }}</h3>
          <button class="icon-btn" @click="closeAdminGiftPicker" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
        </header>
        <div class="admin-gift-scroll">
          <button class="btn btn-gift btn-sm admin-grant-all" :disabled="state.account.adminBusy" @click="adminGrantAllItems"><span class="ei" v-html="ic('gift')"></span> {{ t('admin.grantAll') }}</button>
          <div v-for="cat in adminGiftCategories()" :key="cat.key" class="admin-gift-cat">
            <div class="admin-gift-cat-head"><span class="ei" v-html="ic(cat.icon)"></span> {{ cat.title }}</div>
            <div class="admin-gift-grid">
              <button v-for="it in cat.items" :key="it.id" type="button" class="admin-gift-item"
                      :class="{ owned: adminGiftItemState(it.id)==='owned', staged: adminGiftItemState(it.id)==='grant' }"
                      :disabled="adminGiftItemState(it.id)==='owned'" @click="adminToggleGiftItem(it.id)">
                <span class="agi-ic" v-html="ic(it.icon)"></span>
                <span class="agi-label">{{ it.label }}</span>
                <span v-if="adminGiftItemState(it.id)==='owned'" class="agi-state">{{ t('admin.giftOwned') }}</span>
                <span v-else-if="adminGiftItemState(it.id)==='grant'" class="agi-check" v-html="ic('check')"></span>
              </button>
            </div>
          </div>
        </div>
        <footer class="admin-gift-foot">
          <button class="btn btn-primary" @click="closeAdminGiftPicker">{{ t('admin.giftDone') }}<template v-if="adminGiftPendingCount()"> ({{ adminGiftPendingCount() }})</template></button>
        </footer>
      </div>
    </div>

    <!-- Freund hinzufügen: kleines Popup über dem Freunde-Dialog (➕ im Kopf) -->
    <div v-if="state.friends.addOpen" class="modal-bg friends-add-bg" @click.self="closeAddFriend">
      <div class="modal modal-sm friends-add-modal">
        <h3><span class="ei" v-html="ic('plus')"></span> {{ t('friends.addTitle') }}</h3>
        <input class="text-input" v-model="state.friends.addName" maxlength="20" autocapitalize="none" autocomplete="off" :placeholder="t('friends.addPlaceholder')" @keydown.enter="addFriend" />
        <p v-if="state.friends.addError" class="coop-error">{{ state.friends.addError }}</p>
        <button class="btn btn-primary" :disabled="state.friends.addBusy || !state.friends.addName.trim()" @click="addFriend">
          <span v-if="state.friends.addBusy"><span class="spinner-inline"></span></span>
          <span v-else>{{ t('friends.add') }}</span>
        </button>
        <button class="btn-link" @click="closeAddFriend">{{ t('common.cancel') }}</button>
      </div>
    </div>

    <!-- ══ FREUNDE ══ -->
    <div v-if="state.friends.open" class="modal-bg" @click.self="closeFriends">
      <div class="modal friends-modal">
        <header class="friends-head">
          <h3><span class="ico-wrap" v-html="ic('users')"></span> {{ t('friends.title') }}</h3>
          <span class="friends-head-actions">
            <button class="icon-btn" @click="openAddFriend" :aria-label="t('friends.addTitle')" :title="t('friends.addTitle')">＋</button>
            <button class="icon-btn" @click="closeFriends" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
          </span>
        </header>
        <div class="friends-tabs">
          <button class="friends-tab" :class="{ active: state.friends.tab==='friends' }" @click="setFriendsTab('friends')">{{ t('friends.tabFriends') }}<span v-if="state.friends.requests.length" class="friends-req-badge">{{ state.friends.requests.length }}</span></button>
          <button class="friends-tab" :class="{ active: state.friends.tab==='leaderboard' }" @click="setFriendsTab('leaderboard')">{{ t('friends.tabLeaderboard') }}</button>
        </div>

        <!-- Tab: Freunde -->
        <div v-if="state.friends.tab==='friends'" class="friends-body">
          <!-- Eingehende Anfragen -->
          <template v-if="state.friends.requests.length">
            <div class="friends-section-title">{{ t('friends.requestsTitle') }}</div>
            <div v-for="req in state.friends.requests" :key="req.uid" class="friends-req-row">
              <span class="friends-name">{{ req.username || req.uid }}</span>
              <span class="friends-req-actions">
                <button class="btn btn-primary btn-sm" @click="acceptFriend(req)">{{ t('friends.accept') }}</button>
                <button class="btn-link" @click="declineFriend(req)">{{ t('friends.decline') }}</button>
              </span>
            </div>
          </template>

          <!-- Freundesliste -->
          <div class="friends-section-title">{{ t('friends.listTitle') }} ({{ state.friends.list.length }})</div>
          <p v-if="!state.friends.list.length" class="set-hint">{{ t('friends.empty') }}</p>
          <div v-for="fr in friendsSorted()" :key="fr.uid" class="friends-row">
            <span class="friends-dot" :class="{ online: friendOnline(fr.uid), ingame: friendInGame(fr.uid) }"></span>
            <span class="friends-info">
              <span class="friends-name"><span v-if="badgeShown(friendPresence(fr.uid)?.badge)" class="badge-medal-inline" v-html="badgeSvg(friendPresence(fr.uid)?.badge)"></span>{{ fr.username || fr.uid }}</span>
              <small class="friends-activity">{{ friendActivityText(fr.uid) }}</small>
              <span v-if="friendInGame(fr.uid)" class="friends-progress"><span class="friends-progress-fill" :style="{ width: (friendPresence(fr.uid).game.pct||0) + '%' }"></span></span>
            </span>
            <button class="icon-btn friends-remove" @click="removeFriendAsk(fr)" :aria-label="t('friends.remove')" :title="t('friends.remove')"><span class="ei" v-html="ic('trash')"></span></button>
          </div>
        </div>

        <!-- Tab: Bestenliste — schnellste (perfekte) Solo-Zeiten je Schwierigkeit -->
        <div v-else class="friends-body friends-leaderboard">
          <div class="lb-diff-chips">
            <button v-for="d in DIFFICULTIES" :key="d.id" class="lb-diff-chip" :class="{ active: state.leaderboard.diff===d.id }" @click="selectLeaderboardDiff(d.id)"><span class="ei" v-html="ic(d.emoji)"></span></button>
          </div>
          <div class="lb-scroll">
            <p v-if="state.leaderboard.loading" class="set-hint lb-state">{{ t('friends.lbLoading') }}</p>
            <p v-else-if="!state.leaderboard.entries.length" class="set-hint lb-state">{{ t('friends.lbEmpty') }}</p>
            <div v-else class="lb-list">
              <div v-for="(e,i) in state.leaderboard.entries" :key="e.uid" class="lb-row" :class="{ me: e.uid===state.account.uid }">
                <span class="lb-rank">{{ i+1 }}</span>
                <span class="lb-name"><span v-if="badgeShown(e.badge)" class="badge-medal-inline" v-html="badgeSvg(e.badge)"></span>{{ e.username || e.uid }}</span>
                <span class="lb-time">{{ fmtTime(e.timeMs) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Eingehende Lobby-Einladung eines Freundes: annehmen (beitreten) oder ablehnen -->
    <!-- Admin-Benachrichtigung: „X hat dir Y geschenkt/entzogen" -->
    <div v-if="state.adminNotice" class="modal-bg">
      <div class="modal modal-sm">
        <div class="whatsnew-badge"><span class="ei" v-html="ic(state.adminNotice.kind === 'gift' ? 'gift' : state.adminNotice.kind === 'currency' ? 'coin' : 'crown')"></span> Admin</div>
        <p class="result-msg">{{ adminNoticeText(state.adminNotice) }}</p>
        <button class="btn btn-primary" @click="dismissAdminNotice">{{ t('common.ok') }}</button>
      </div>
    </div>

    <div v-if="state.pendingLobbyInvite" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge"><span class="ei" v-html="ic('users')"></span> {{ t('coop.inviteTitle') }}</div>
        <p class="result-msg">{{ t('coop.inviteBody', { name: state.pendingLobbyInvite.username || state.pendingLobbyInvite.fromUid, mode: lobbyModeLabel(state.pendingLobbyInvite.mode) }) }}</p>
        <button class="btn btn-primary" @click="acceptLobbyInvite(state.pendingLobbyInvite)">{{ t('coop.inviteAccept') }}</button>
        <button class="btn btn-ghost btn-sm" @click="declineLobbyInviteUI(state.pendingLobbyInvite)">{{ t('coop.inviteDecline') }}</button>
      </div>
    </div>

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
          <li v-html="t('howto.rule9')"></li>
        </ol>
        <button class="btn btn-ghost training-btn" @click="state.modal=null; startTrainingGame()">
          <span class="btn-ic"><span class="ei" v-html="ic('graduation')"></span></span>
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
          <span class="btn-ic"><span class="ei" v-html="ic('versus')"></span></span><span class="btn-tx"><b>{{ t('race.choice1v1') }}</b><small>{{ t('home.raceHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" @click="goRace('ffa')">
          <span class="btn-ic"><span class="ei" v-html="ic('swords')"></span></span><span class="btn-tx"><b>{{ t('race.choiceFfa') }}</b><small>{{ t('race.choiceFfaHint') }}</small></span>
        </button>
        <button class="btn btn-ghost" @click="goRace('2v2')">
          <span class="btn-ic"><span class="ei" v-html="ic('users')"></span></span><span class="btn-tx"><b>{{ t('race.choice2v2') }}</b><small>{{ t('team.assignHint') }}</small></span>
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
            <ul><li v-for="(it,i) in e.changes" :key="i">{{ it }}</li></ul>
          </div>
        </div>
        <button class="btn btn-primary" @click="state.modal=null">{{ t('common.close') }}</button>
      </div>
    </div>

    <!-- Geldverlauf: Transaktionshistorie (Einnahmen/Ausgaben/Geschenke). -->
    <div v-if="state.walletLogOpen" class="modal-bg" @click.self="closeWalletLog">
      <div class="modal modal-wallet-log">
        <h3><span class="ei" v-html="ic('coin')"></span> {{ t('wallet.historyTitle') }}</h3>
        <div class="wallet-log-balance">{{ t('wallet.total', { n: state.wallet.balance || 0 }) }}</div>
        <p v-if="!state.walletLog.length" class="set-hint wallet-log-empty">{{ t('wallet.historyEmpty') }}</p>
        <div v-else class="wallet-log">
          <div v-for="(e,i) in state.walletLog" :key="i" class="wl-row" :class="e.amount >= 0 ? 'plus' : 'minus'">
            <div class="wl-main">
              <span class="wl-reason">{{ walletReasonLabel(e.reason) }}</span>
              <span class="wl-date">{{ adminFmtDate(e.ts) }}</span>
            </div>
            <span class="wl-amount"><span class="ei" v-html="ic('coin')"></span> {{ e.amount >= 0 ? '+' : '' }}{{ e.amount }}</span>
          </div>
        </div>
        <button class="btn btn-primary" @click="closeWalletLog">{{ t('common.close') }}</button>
      </div>
    </div>

    <div v-if="state.historyDetail" class="modal-bg" @click.self="closeHistoryDetail">
      <div class="modal modal-history">
        <h3><span class="ei" v-html="ic(DIFF_BY_ID[state.historyDetail.entry.difficulty]?.emoji)"></span> {{ t('difficulty.'+state.historyDetail.entry.difficulty) }} · {{ state.historyDetail.entry.dim.r }}×{{ state.historyDetail.entry.dim.c }}</h3>
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
        <ul v-if="whatsNewEntries.length <= 1" class="whatsnew"><li v-for="(it,i) in (whatsNewEntries[0]?.changes || [])" :key="i">{{ it }}</li></ul>
        <div v-else class="changelog whatsnew-multi">
          <div v-for="e in whatsNewEntries" :key="e.version" class="cl-entry">
            <div class="cl-head"><b>v{{ e.version }}</b><span>{{ e.date }}</span></div>
            <ul><li v-for="(it,i) in e.changes" :key="i">{{ it }}</li></ul>
          </div>
        </div>
        <button class="btn btn-primary" @click="dismissWhatsNew">{{ t('whatsnew.start') }}</button>
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

    <!-- ══ PRESTIGE: verdiente Abzeichen (nicht kaufbar) ══ -->
    <div v-if="state.prestigeOpen" class="modal-bg" @click.self="closePrestige">
      <div class="modal prestige-modal">
        <header class="friends-head">
          <h3><span class="ico-wrap" v-html="ic('medal')"></span> {{ t('prestige.title') }}</h3>
          <button class="icon-btn" @click="closePrestige" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
        </header>
        <p class="set-hint prestige-intro">{{ t('prestige.intro') }}</p>
        <div class="prestige-list">
          <!-- Krönung: „Großmeister" — freigeschaltet, wenn ALLE 12 Kategorien Legendär sind.
               Liegt IM Scrollbereich (erstes Element), damit es die Liste nicht verkürzt. -->
          <div class="prestige-master" :class="{ unlocked: masterInfo().unlocked }">
            <div class="prestige-master-medal" v-html="badgeSvg(MASTER_BADGE, true)"></div>
            <div class="prestige-master-info">
              <div class="prestige-master-nm"><b class="pm-title">{{ t('prestige.master.title') }}</b><span class="prestige-master-tag">{{ t('prestige.master.tag') }}</span></div>
              <div class="prestige-bar" :class="{ done: masterInfo().unlocked }"><i :style="{ width: Math.round(masterInfo().maxed/masterInfo().total*100)+'%' }"></i></div>
              <div class="prestige-master-prog">{{ t('prestige.master.progress', { n: masterInfo().maxed, total: masterInfo().total }) }}</div>
              <button v-if="masterInfo().unlocked" class="btn btn-sm prestige-master-btn" :class="{ 'btn-ghost': isMasterEquipped(), 'btn-primary': !isMasterEquipped() }" @click="isMasterEquipped() ? unequipBadge() : equipMaster()">
                {{ isMasterEquipped() ? t('prestige.unequip') : t('prestige.master.equip') }}
              </button>
            </div>
          </div>
          <div v-for="p in prestigeList()" :key="p.sym" class="prestige-cat" :class="{ locked: p.tier===0 }">
            <div class="prestige-lead">
              <div class="badge-medal-card prestige-cat-medal" :class="{ dim: p.tier===0 }" v-html="badgeSvg(p.sym + '-' + Math.max(1,p.tier))"></div>
              <div class="prestige-cat-info">
                <div class="prestige-cat-nm"><b>{{ p.name }}</b><span class="prestige-tier-pill" :class="'t'+p.tier">{{ prestigeTierName(p.tier) }}</span></div>
                <div class="prestige-metric">{{ p.metricLabel }}: <b>{{ p.value }}</b></div>
                <div class="prestige-bar" :class="{ done: p.next==null }"><i :style="{ width: Math.round(p.frac*100)+'%' }"></i></div>
                <div class="prestige-next">{{ p.next==null ? t('prestige.maxed') : t('prestige.toNext', { n: p.next - p.value, tier: prestigeTierName(p.tier+1) }) }}</div>
              </div>
            </div>
            <!-- Vier Stufen: freigeschaltete anklickbar zum Ausrüsten, gesperrte ausgegraut -->
            <div class="prestige-tiers">
              <button v-for="ti in 4" :key="ti" class="prestige-tier-btn"
                :class="{ unlocked: ti<=p.tier, equipped: isBadgeEquipped(p.sym, ti) }"
                :disabled="ti>p.tier"
                @click="equipBadge(p.sym, ti)"
                :aria-label="prestigeTierName(ti)" :title="prestigeTierName(ti)">
                <span class="prestige-tier-medal" v-html="badgeSvg(p.sym + '-' + ti)"></span>
                <span v-if="isBadgeEquipped(p.sym, ti)" class="prestige-eq-dot"><span class="ico-wrap" v-html="ic('check')"></span></span>
              </button>
            </div>
          </div>
        </div>
        <button v-if="myBadge()" class="btn btn-ghost prestige-unequip" @click="unequipBadge">{{ t('prestige.unequip') }}</button>
      </div>
    </div>

    <!-- „Großmeister" freigeschaltet — einmalige Krönungs-Feier (alle 12 Kategorien Legendär) -->
    <div v-if="state.masterUnlock" class="modal-bg master-unlock-bg">
      <div class="modal master-unlock-modal">
        <div class="master-unlock-medal" v-html="badgeSvg(MASTER_BADGE, true)"></div>
        <div class="master-unlock-title">{{ t('prestige.master.unlockTitle') }}</div>
        <div class="master-unlock-name">{{ t('prestige.master.title') }}</div>
        <p class="master-unlock-msg">{{ t('prestige.master.unlockMsg') }}</p>
        <button class="btn btn-primary" @click="dismissMasterUnlock">{{ t('prestige.master.equipWear') }}</button>
      </div>
    </div>

    <!-- ══ Multiplayer-Chat (Coop / Race / FFA / Team) ══ -->
    <div v-if="state.chat.open" class="modal-bg chat-bg" @click.self="closeChat">
      <div class="modal chat-modal">
        <header class="chat-head">
          <h3><span class="ico-wrap" v-html="ic('chat')"></span> {{ t('chat.title') }}</h3>
          <button class="icon-btn" @click="closeChat" :aria-label="t('common.close')"><span class="ico-wrap" v-html="ic('close')"></span></button>
        </header>
        <div class="chat-msgs">
          <p v-if="!state.chat.messages.length" class="set-hint chat-empty">{{ t('chat.empty') }}</p>
          <div v-for="(m,i) in state.chat.messages" :key="i" class="chat-msg" :class="{ mine: m.self }">
            <div v-if="!m.self" class="chat-sender">
              <span v-if="badgeShown(m.badge)" class="badge-medal-inline chat-badge" v-html="badgeSvg(m.badge)"></span>
              <span class="chat-name" :style="m.color ? { color: m.color } : null">{{ m.name }}</span>
            </div>
            <div class="chat-bubble">{{ m.text }}</div>
          </div>
        </div>
        <form class="chat-input-row" @submit.prevent="sendChat">
          <input class="text-input chat-input" v-model="state.chat.draft" :maxlength="300" :placeholder="t('chat.placeholder')" autocomplete="off" />
          <button type="submit" class="btn btn-primary chat-send" :disabled="!state.chat.draft.trim()" :aria-label="t('chat.send')" :title="t('chat.send')"><span class="ico-wrap" v-html="ic('send')"></span></button>
        </form>
      </div>
    </div>

    <!-- Streak verlängert/gestartet — feuriger Feier-Screen nach dem ersten
         abgeschlossenen Spiel des Tages (analog zum "Gewonnen"-Screen). -->
    <div v-if="state.streakExtended" class="modal-bg">
      <div class="modal streak-modal extended">
        <div class="streak-emoji"><span class="ei" v-html="ic('flame')"></span></div>
        <h3 class="streak-title">{{ t(state.streakExtended.continued ? 'streak.extendedTitle' : 'streak.startedTitle') }}</h3>
        <div class="streak-count"><b>{{ state.streakExtended.current }}</b><small>{{ t(state.streakExtended.current === 1 ? 'streak.dayLabel' : 'streak.daysLabel') }}</small></div>
        <div v-if="state.streakExtended.current > 0" class="streak-coin-bonus"><span class="ei" v-html="ic('coin')"></span> {{ t('streak.coinBonus', { pct: streakBonusPct(state.streakExtended.current) }) }}</div>
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
        <div class="streak-emoji"><span class="ei" v-html="ic('heart-broken')"></span></div>
        <h3 class="streak-title">{{ t('streak.lostTitle') }}</h3>
        <p class="streak-msg">{{ t('streak.lostBody', { best: state.streak.bestStreak }) }}</p>
        <button class="btn btn-primary" @click="dismissStreakLostNotice">{{ t('common.ok') }}</button>
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

// ─── Desktop-Tastenkürzel (Werkzeug wechseln) ─────────────────────────────────
// Eine frei belegbare Taste (Standard „Tab") schaltet WÄHREND einer Partie
// zwischen Einkreisen und Radiergummi um — praktisch am Desktop, ohne die Maus
// zum Werkzeug-Button zu bewegen. WICHTIG: keydown wird preventDefault()et, damit
// z.B. Tab nicht den Browser-Fokus verschiebt, sondern im Spiel greift.
function normKey(k) { return typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k; }
// Menschenlesbares Label einer Taste (für die Anzeige in den Einstellungen).
function desktopKeyLabel(k) {
  if (!k) return t('settings.desktop.off');
  if (k === ' ' || k === 'Spacebar') return t('settings.desktop.keySpace');
  if (k.length === 1) return k.toUpperCase();
  return k; // Tab, Enter, ArrowLeft, …
}
function startDesktopKeyCapture() { state.desktopKeyCapture = true; }
function cancelDesktopKeyCapture() { state.desktopKeyCapture = false; }
function clearDesktopToolKey() { setSetting('desktopToolKey', ''); state.desktopKeyCapture = false; }
// Ist gerade eine „echte" laufende Partie (nicht Pause/Ende/Lobby)?
function inActiveRound() {
  return state.screen === 'game' && state.status === 'playing' && !state.paused && !state.coop.awaitingStart;
}
// Globaler keydown: erst Belegungs-Modus, sonst Werkzeug-Umschalt-Taste.
function onDesktopKeydown(e) {
  // Belegen: nächster Tastendruck wird die neue Taste (Escape bricht ab).
  if (state.desktopKeyCapture) {
    e.preventDefault();
    if (e.key !== 'Escape') { setSetting('desktopToolKey', normKey(e.key)); log('app', 'Desktop-Werkzeugtaste belegt', { key: e.key }); }
    state.desktopKeyCapture = false;
    return;
  }
  const bind = state.settings.desktopToolKey;
  if (!bind || !inActiveRound()) return;
  // Nicht in Textfeldern (Chat/Username/Code) kapern.
  const el = e.target;
  const tag = (el && el.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable)) return;
  if (normKey(e.key) !== bind) return;
  e.preventDefault();
  toggleTool();
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
  if (m.color) {
    // Ausgerüstete Brett-Palette (Shop) auch hier — s. shopitems.js/applyPaletteFx.
    const col = applyPaletteFx(m.color, activePaletteFx());
    st['--rc-h'] = col.h; st['--rc-s'] = col.s + '%'; st['--rc-l'] = col.l + '%'; st['--rc-ink'] = regionChipInk(col);
  }
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
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.__cns = { state, onCellTap, isSolved, handleCoopMsg, handleCoopConnection, coopSend, upsertPlayer, removePlayer, cellStyle, cellClasses, Music, launchWinFx, getProgressThrottle: () => ({ team: teamProgressThrottle, race: raceProgressThrottle }) };

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
    // Beim Zurückkehren ZUERST die Aktivspiel-Session abgleichen (statt blind
    // hochzuladen — das überschrieb sonst einen neueren Fremdstand). Erst danach
    // die übrigen Nutzdaten sichern (doSyncNow hat einen eigenen Fremd-Schutz).
    if (state.account.status === 'in') reconcileSession().then(() => doSyncNow());
  }
});

// Der Service Worker dient ausschließlich dem Offline-Caching — innerhalb einer
// nativen Capacitor-App gibt es dieses Konzept nicht (Updates laufen über
// Store-Binaries), daher dort gar nicht erst registrieren.
//
// BEWUSST KEIN Laufzeit-Update-Flow: kein zyklisches reg.update(), keine
// „Update verfügbar"-Erkennung, kein Neustart-/Backup-Dialog. Ein neu
// deploytes Deployment installiert der Browser im Hintergrund; da sw.js beim
// install NICHT skipWaiting() ruft, übernimmt der neue Worker erst beim
// nächsten Kaltstart der App. So wird „nur beim Start wird geladen, was da
// ist" garantiert — der Nutzer wird nie mitten im Spiel neu geladen, und neue
// Inhalte zeigen sich beim nächsten Start allein über den „Was ist neu"-Dialog.
if ('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => log('sw', `Service Worker registriert`))
      .catch(e => log('sw', `Service-Worker-Registrierung fehlgeschlagen`, e));
  });
}
