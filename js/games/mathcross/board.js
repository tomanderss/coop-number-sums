// games/mathcross/board.js — das BRETT von „Math Cross": Darstellung,
// Ablagefach (Vorrat), Züge und Gesten.
//
// Gegenstück zu games/numbersums/board.js mit DERSELBEN Brett-Schnittstelle am
// Dateiende (laden, speichern, gelöst?, Fortschritt, Partnerzüge, Rückgängig,
// Training, Zellgröße) — die Schale spricht beide Spiele gleich an.
//
// Die Funktionskörper stammen unverändert aus Coop Math Cross (js/app.js), dort
// lagen sie auf dem einen großen `state` der App. Geändert wurden nur die
// Anbindungen: was die Schale beisteuert (Zustand, Spielerfarben, Shop-Auswahl,
// Leben/Fehler, Persistenz, Coop-Versand, Rückfrage-Dialog) kommt einmalig über
// `initBoard(ctx)`.
//
// RENDER-PERFORMANCE (Kernregeln in CLAUDE.md) gilt hier genauso: Brett und
// Vorrat sind EIGENE Child-Komponenten, alle Ableitungen cachende computeds,
// der Ziehschatten ein direkt manipuliertes DOM-Element.

import { computed, markRaw } from '../../vue.esm-browser.prod.js';
import { SKINPRESET_ITEMS, shopItemById, ownsShopItem } from '../../shopitems.js';
import { SKIN_ID, skinVars as buildSkinVars, skinClasses as buildSkinClasses } from '../../skins.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import * as Coop from '../../coop.js';
import { log } from '../../debuglog.js';
import {
  buildDisplay, buildTray, takeFromTray, returnToTray,
  currentValues, placementBreaksEquation, solvedEquationSet,
  isBoardSolved, progressOf, solutionAt, normalizePuzzle as healPuzzle, reconcileTray, trayMatchesBoard,
  DIV_STYLE_DEFAULT, divSymbolFor,
} from './model.js';
import { nextTrainingStep, isFullyTier1Solvable } from './training.js';

// ── Von der Schale injizierte Verweise (s. numbersums/board.js) ──────────────
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
let registerMistake = () => {};
let afterMove = () => {};
let coopSend = () => null;
let persistGame = () => {};
let ask = (title, msg, yes) => yes();
let desktopBoard = () => false;

export function initBoard(ctx) {
  state = ctx.state;
  LOCAL_PLAYER_ID = ctx.LOCAL_PLAYER_ID;
  playerColor = ctx.playerColor;
  shopEquippedId = ctx.shopEquippedId;
  registerMistake = ctx.registerMistake;
  afterMove = ctx.afterMove;
  coopSend = ctx.coopSend;
  if (ctx.persistGame) persistGame = ctx.persistGame;
  if (ctx.ask) ask = ctx.ask;
  if (ctx.desktopBoard) desktopBoard = ctx.desktopBoard;
}

// Geteilt-Zeichen der Nutzer-Einstellung (rein kosmetisch, s. DIV_STYLES).
export function activeDivSym() { return divSymbolFor(state.settings.divStyle || DIV_STYLE_DEFAULT); }

// ── Brett-Optik (Shop/Skin, Spurbreiten, Vorrat) ─────────────────────────────

// Brett-Klasse des ausgerüsteten Zahlen-Stils ('' = Klassisch).
export function boardFontClass() {
  const id = shopEquippedId('font');
  return id && id !== 'classic' ? 'font-' + id : '';
}
// Brett-Klasse des ausgerüsteten Rahmens ('' = keiner).
export function boardFrameClass() {
  const id = shopEquippedId('frame');
  return id && id !== 'none' ? 'frame-' + id : '';
}
// ── Brett-Optik (Modulebene, damit die BoardGrid-Child-Komponente sie nutzt) ──
// Dynamischer Skin (Cosmetic 'dynamicColor'): mindestens eine gekaufte Skin-
// Vorlage aktiviert das Skin-Rendering auch OHNE den exklusiven Skin (der
// schaltet nur den freien Editor frei).
export const skinUnlocked = computed(() => !!state.inventory[SKIN_ID]);
export const skinPresetOwned = computed(() => SKINPRESET_ITEMS.some((p) => ownsShopItem(state.inventory, p)));
export const skinActive = computed(() => (skinUnlocked.value || skinPresetOwned.value) && state.settings.skinEnabled);
export const skinVars = computed(() => skinActive.value ? buildSkinVars(state.settings) : {});
export const skinBoardClasses = computed(() => buildSkinClasses(state.settings, skinActive.value));
// Das Anzeige-Raster wechselt Zahl- und Operator-Spalten ab. Operator-Felder
// sind schmaler (OP_RATIO) — sonst passen breite Bretter (bis 7 Zahl-Spalten =
// 13 Anzeige-Spalten) auf einem Telefon nicht mehr nebeneinander. Seit das
// Brett OHNE Fugen zusammenhängt (ein echtes Raster wie beim Sudoku statt loser
// Kästchen), sind je Achse bis zu 16 Fugen à 2 px frei geworden — die stecken
// jetzt in einem großzügigeren OP_RATIO, die Operator-Felder sind also echte
// Rasterzellen und keine schmalen Striche mehr.
const OP_RATIO = 0.66;      // größte Operator-Spur (Anteil am Zahl-Feld)
const OP_RATIO_MIN = 0.36;  // schmalste — nur, wenn das die Zahl-Felder größer macht
const EMPTY_TRACK = 3;   // px — Breite einer KOMPLETT leeren Spur (nur Luft)

// Ein ausgefranstes Kreuzwort hat Spuren, in denen gar nichts liegt — bei einem
// Operator-Streifen zwischen zwei Zeilen ohne einzige senkrechte Rechnung etwa.
// Bekämen die volle Breite, fräße das Nichts den Platz auf und die Zellen
// blieben unnötig klein (gemeldet: „Standard-Zoom ist verkackt"). Leere Spuren
// schrumpfen deshalb auf EMPTY_TRACK.
function trackUsage(display) {
  const rows = new Array(display ? display.rows : 0).fill(false);
  const cols = new Array(display ? display.cols : 0).fill(false);
  if (display) {
    for (let r = 0; r < display.rows; r++) {
      for (let c = 0; c < display.cols; c++) {
        if (!display.cells[r][c]) continue;
        rows[r] = true; cols[c] = true;
      }
    }
  }
  return { rows, cols };
}
const boardTracks = computed(() => trackUsage(state.display));
function gridTracks(used) {
  return used.map((on, i) => (on ? (i % 2 ? 'var(--opcell)' : 'var(--cell)') : 'var(--emptycell)')).join(' ');
}
// Wie viele Zell-/Operator-/Leerspuren hat eine Achse? (Basis der Zellgröße)
function trackCounts(used) {
  let cells = 0, ops = 0, empty = 0;
  used.forEach((on, i) => { if (!on) empty++; else if (i % 2) ops++; else cells++; });
  return { cells, ops, empty };
}
export const gridStyle = computed(() => {
  const t = boardTracks.value;
  return {
    gridTemplateColumns: gridTracks(t.cols),
    gridTemplateRows: gridTracks(t.rows),
    '--cell': state.cellPx + 'px',
    '--opcell': Math.round(state.cellPx * (state.opRatio || OP_RATIO)) + 'px',
    '--emptycell': EMPTY_TRACK + 'px',
    '--fs': Math.max(9, Math.round(state.cellPx * 0.46)) + 'px',
    // Farbe der persönlichen Feld-Markierung (Einstellungen ▸ Farbe).
    '--markhl': state.settings.markColor || '#f2c024',
  };
});

// ── VORRAT: Steingröße richtet sich nach der ANZAHL ──────────────────────────
// Ein R.I.P.-Brett hat über 30 Steine — bei fester Größe fraß der Vorrat das
// halbe Display. Die Steine schrumpfen deshalb, bis alle in wenige Zeilen
// passen (gemeldet: „die Zahlen unten deutlich kompakter").
const TRAY_GAP = 3;
const TRAY_MIN_TILE = 24, TRAY_MAX_TILE = 42, TRAY_MAX_ROWS = 6;
// Der Vorrat zeigt IMMER alle Steine auf einmal — kein Scrollen (das war
// „clunky") und keine seitlich versteckten Zahlen. Dafür bricht er um, nimmt
// aber so wenig Höhe wie möglich: für 1..TRAY_MAX_ROWS Reihen wird ausgerechnet,
// wie groß die Steine höchstens sein dürfen, und die Aufteilung mit der
// GERINGSTEN Gesamthöhe gewinnt.
//
// Die Größe hängt an der GESAMTZAHL der Steine des Rätsels, nicht an den noch
// offenen: sie steht damit für die ganze Partie fest (ein mitten im Spiel
// wachsender Stein wandert sonst unter dem Finger), während die Reihenzahl mit
// jedem gelegten Stein sinkt — der Vorrat wird also nur kleiner, nie größer.
function fitTrayTile(count, availWidth) {
  const n = Math.max(1, count);
  const avail = Math.max(120, availWidth - 8);          // 2*4px Innenabstand
  let best = null;
  for (let rows = 1; rows <= TRAY_MAX_ROWS; rows++) {
    const perRow = Math.ceil(n / rows);
    const size = Math.min(TRAY_MAX_TILE, Math.floor((avail - (perRow - 1) * TRAY_GAP) / perRow));
    if (size < TRAY_MIN_TILE) continue;
    const height = rows * size + (rows - 1) * TRAY_GAP;
    if (!best || height < best.height) best = { size, height };
  }
  if (best) return best.size;
  // Selbst in TRAY_MAX_ROWS Reihen zu eng: so klein wie nötig, aber alles bleibt
  // sichtbar — lieber winzige Zahlen als versteckte.
  const perRow = Math.ceil(n / TRAY_MAX_ROWS);
  return Math.max(14, Math.floor((avail - (perRow - 1) * TRAY_GAP) / perRow));
}
const trayTilePx = computed(() => state.trayTile || TRAY_MAX_TILE);
export const trayStyle = computed(() => ({
  '--tile': trayTilePx.value + 'px',
  '--tgap': TRAY_GAP + 'px',
  '--tfs': Math.round(trayTilePx.value * 0.46) + 'px',
}));
// Aktive Paletten-Transformation für cellStyle (null = Klassisch/unverändert).
export function activePaletteFx() {
  const it = shopItemById(shopEquippedId('palette'));
  return it ? it.fx : null;
}

// ── Brett-Aufbau ──
// Das Anzeige-Raster (Zahlen auf geraden, Operatoren auf ungeraden Koordinaten)
// wird EINMAL je Partie gebaut — es ändert sich während des Spiels nie, nur die
// gelegten Zahlen tun das.
function buildBoardState(puzzle, saved) {
  state.display = markRaw(buildDisplay(puzzle, activeDivSym()));
  state.placed = Coop.normalizeGrid(saved?.placed, puzzle.rows, puzzle.cols, null);
  // Vorrat aus dem Rätsel aufbauen und alles abziehen, was schon auf dem Brett liegt.
  const tray = saved?.tray && Array.isArray(saved.tray) && saved.tray.length
    ? saved.tray.map((t, i) => ({ id: i, v: t.v, used: !!t.used }))
    : buildTray(puzzle);
  if (!saved?.tray) {
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) if (state.placed[r][c] != null) takeFromTray(tray, state.placed[r][c]);
    }
  }
  // Letzte Instanz: die OFFENEN Steine müssen exakt die noch fehlenden Zahlen
  // sein. Heilt auch Spielstände, die vor dem Tausch-Fix entstanden sind.
  const placedValues = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) if (state.placed[r][c] != null) placedValues.push(state.placed[r][c]);
  }
  const fixed = reconcileTray(tray, placedValues, puzzle.tray);
  if (fixed.length !== tray.length) log('game', 'Vorrat mit dem Brett abgeglichen', { vorher: tray.length, nachher: fixed.length });
  state.tray = fixed;
  sortTrayAsc();
  // Markierungen des geladenen Stands übernehmen (nur Strings; ein über die RTDB
  // gereistes Array kann Löcher haben — die fliegen hier raus).
  state.hl = Array.isArray(saved?.hl) ? saved.hl.filter((k) => typeof k === 'string') : [];
  state.markMode = false;   // neues Brett = wieder normaler Spielmodus
  resetCellVersions(puzzle.rows, puzzle.cols);
  state.drag = null;
  state.pick = null;
}


// ── Zellgröße (responsiv + Zoom) ──
export function fitBoard() {
  if (!state.puzzle) return;
  const wrap = document.querySelector('.board-wrap');
  let availW, availH;
  if (wrap && wrap.clientWidth && wrap.clientHeight) {
    availW = wrap.clientWidth - 6; // 2*3px Board-Wrap-Padding
    availH = wrap.clientHeight - 6;
    state.boardW = wrap.clientWidth;
  } else {
    availW = Math.min(window.innerWidth - 26, 496); // 2*(8px App-Padding + 3px Board-Wrap-Padding) + Sicherheitspuffer
    availH = window.innerHeight - 200; // grobe Schätzung für Kopf-/Werkzeugleiste vor dem ersten Render
  }
  // Aktiver Brett-Rahmen legt außen einen 10px-Innenabstand um die Spielfläche
  // (2*10 = 20px je Achse, s. .board[class*="frame-"] in styles.css). Dieser
  // Platz muss VOR der Zellgröße abgezogen werden, sonst wird das Brett um 20px
  // breiter/höher als der verfügbare Raum und ragt aus dem Bildschirm.
  const framePad = boardFrameClass() ? 20 : 0;
  availW -= framePad; availH -= framePad;
  // Das Anzeige-Raster wechselt Zahl- und (schmalere) Operator-Spuren ab;
  // komplett leere Spuren zählen nur mit EMPTY_TRACK. Ohne diese Rechnung wird
  // das Brett bei ausgefransten Layouts unnötig klein.
  const t = boardTracks.value;
  const tw = trackCounts(t.cols), th = trackCounts(t.rows);
  // Deckel für die Auto-Einpassung: begrenzt die Zellgröße, damit kleine Bretter
  // auf großen Displays nicht riesig wirken. Skaliert mit der kürzeren Bildschirm-
  // kante (= bindende Achse, da das Brett in BEIDE Richtungen passen muss), damit
  // es auf JEDEM Gerät und in JEDER Ausrichtung so groß wie sinnvoll möglich ist:
  //  • Desktop (Maus + breites Fenster): 128px — .app.app-game ist dort breit.
  //  • Tablet / großes Querformat (kurze Kante ≥ 600px, z.B. iPad in beiden
  //    Ausrichtungen): Deckel wächst mit der kurzen Kante (bis 120px), sonst
  //    begrenzte der alte 56er-Handy-Deckel das Feld auf iPad/Querformat unnötig.
  //  • Handy (kurze Kante < 600px, inkl. Handy-Querformat mit niedriger Höhe): 56px.
  // Die tatsächlich verfügbare Fläche kommt weiterhin aus der .board-wrap-Messung
  // (availW/availH) — der Deckel ist nur die Obergrenze, kein fixer Wert.
  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const cap = desktopBoard() ? 128
    : (shortSide >= 600 ? Math.min(120, Math.round(shortSide * 0.14)) : 72);
  // KEIN hoher Mindestwert mehr: Beim Öffnen MUSS das ganze Brett passen — lieber
  // kleine Zellen als eine abgeschnittene Zeile/Spalte. Der frühere 26px-Boden
  // ließ das größte Brett (14×14 = 15 Einheiten) auf schmalen Handys eine Spalte
  // aus dem Bild ragen. Nur ein winziger Boden gegen 0 in Extremfällen.
  // Das Raster hat KEINE Fugen mehr (gap: 0) — die Zellen stoßen aneinander und
  // teilen sich ihre 1-px-Linie (reiner box-shadow, kein Layout). In die Rechnung
  // gehen daher nur die Zell-/Operator-Einheiten und die geschrumpften Leerspuren.
  //
  // Die BREITE der Operator-Spuren ist nicht fest, sondern wird MITGESUCHT: fast
  // jedes Brett ist nur auf EINER Achse eingeklemmt (meist der Breite) und hat
  // auf der anderen Luft. Schmalere Operator-Spuren machen dann die Zahl-Felder
  // größer, ohne dass etwas verloren geht — und wo die Höhe bindet, bleiben die
  // Operator-Felder groß. Von der größten Rate abwärts suchen und nur bei einem
  // ECHT größeren Zahl-Feld wechseln: so gewinnt immer die größte Operator-Spur,
  // die das größtmögliche Zahl-Feld noch zulässt.
  const fit = (ratio) => Math.floor(Math.min(
    (availW - tw.empty * EMPTY_TRACK) / (tw.cells + tw.ops * ratio || 1),
    (availH - th.empty * EMPTY_TRACK) / (th.cells + th.ops * ratio || 1),
  ));
  let bestCell = 0, bestRatio = OP_RATIO;
  for (let r = OP_RATIO; r >= OP_RATIO_MIN - 1e-9; r -= 0.02) {
    const cw = Math.min(cap, fit(r));
    if (cw > bestCell) { bestCell = cw; bestRatio = r; }
  }
  // KEIN hoher Mindestwert: Beim Öffnen MUSS das ganze Brett passen — lieber
  // kleine Zellen als eine abgeschnittene Zeile/Spalte.
  const base = Math.max(10, bestCell);
  state.cellPx = Math.round(base * state.zoom);
  state.opRatio = Math.round(bestRatio * 100) / 100;
  // Vorrats-Steingroesse an derselben Stelle mitfuehren (gleiche Ausloeser:
  // Start, Rotation, Groessenaenderung). Zaehlt die GESAMTZAHL, damit sie
  // waehrend der Partie konstant bleibt.
  state.trayTile = fitTrayTile(state.tray.length, Math.max(200, (state.boardW || window.innerWidth) - 16));
}

// ─── ABGELEITETER BRETT-ZUSTAND ───────────────────────────────────────────────
// Alle Brett-Ableitungen laufen über CACHENDE computeds: sie rechnen nur neu,
// wenn sich state.placed ändert (ein Zug) — nie pro Zelle und pro Render.
// (Kernregel aus CLAUDE.md: das Brett darf im Render nichts durchsuchen.)
const boardValues = computed(() => (state.puzzle ? currentValues(state.puzzle, state.placed) : []));
const solvedEquations = computed(() => (state.puzzle ? solvedEquationSet(state.puzzle, state.placed) : new Set()));
export function eqSolvedR(i) { return solvedEquations.value.has(i); }
// Felder, die zu einer fertig gerechneten Gleichung gehören (grüner Rahmen).
const solvedCellSet = computed(() => {
  const p = state.puzzle;
  const set = new Set();
  if (!p) return set;
  for (const i of solvedEquations.value) {
    for (const [r, c] of eqCellsOf(p.equations[i])) set.add(r * 1000 + c);
  }
  return set;
});
function eqCellsOf(eq) {
  const out = [];
  for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? [eq.r, eq.c + i] : [eq.r + i, eq.c]);
  return out;
}
function cellInSolvedEq(r, c) { return solvedCellSet.value.has(r * 1000 + c); }
// Noch nicht gelegte Steine (Vorrat) — auch als reine Zahlenliste für den Solver.
const trayValues = computed(() => state.tray.filter(t => !t.used).map(t => t.v));
export function trayRemaining() { return trayValues.value.length; }

// Kurzer Leucht-Puls für eine gerade fertig gewordene Rechnung.
export function pulseResolved(kind, idx) {
  const key = `${kind}-${idx}`;
  state.justResolved[key] = true;
  setTimeout(() => { delete state.justResolved[key]; }, 900);
}


// ─── SPIELZÜGE: Steine legen, verschieben, tauschen ───────────────────────────
// Bedienung ist Drag & Drop: ein Stein wird aus dem Vorrat oder von einem Feld
// aufgenommen und auf ein Feld fallen gelassen. Liegt dort schon ein Stein,
// TAUSCHEN beide den Platz. Zieht man einen Stein zurück in den Vorrat, wird das
// Feld wieder frei. Zusätzlich gibt es den Antipp-Weg (Stein wählen → Feld
// antippen): gleiche Wirkung, bedienbar per Tastatur und auf kleinen Geräten.
//
// FEHLER-REGEL (Nutzervorgabe): Ein Fehler ist NUR, wenn ein Zug eine Rechnung
// VOLLSTÄNDIG macht, die dann nicht aufgeht — das ist geraten. Eine Zahl an der
// falschen Stelle, bei der alle vollen Rechnungen weiter stimmen, ist KEIN
// Fehler; sie fällt erst am Ende auf, wenn Steine übrig bleiben.

function boardLocked() {
  // Nur-Lese: ein anderes Gerät hat diese Solo-Partie übernommen — Brett gesperrt,
  // bis der Nutzer im Banner „Hier weiterspielen" wählt.
  if (state.sessionReadonly) return true;
  if (state.status !== 'playing' || state.generating || state.paused) return true;
  // Im Trainingsmodus führt der Tutor, solange er noch Schritte hat.
  if (state.isTrainingGame && !state.trainingDone) return true;
  return false;
}
function isBlankCell(r, c) {
  const sl = state.puzzle && state.puzzle.slots[r] && state.puzzle.slots[r][c];
  return !!sl && !sl.given;
}

// ── Aufnehmen per Antippen ───────────────────────────────────────────────────
export function pickTile(v, from = null, tileId = null) {
  if (boardLocked()) return;
  if (state.pick && state.pick.tileId === tileId && state.pick.v === v && !from) { state.pick = null; return; }
  state.pick = { v, from, tileId };
}
function pickFromCell(r, c) {
  if (boardLocked() || !isBlankCell(r, c) || state.placed[r][c] == null) return;
  state.pick = { v: state.placed[r][c], from: { r, c }, tileId: null };
}
export function cancelPick() { state.pick = null; }

// ── Kern: eine Menge von Feld-Änderungen prüfen und übernehmen ───────────────
// changes = [{ r, c, v }] mit v = Zahl oder null (Feld räumen).
function applyChanges(changes, { user = true, fromId = null, hint = false, eventKey = null } = {}) {
  const p = state.puzzle;
  if (!p) return false;

  // 1. Probelage bauen und prüfen, ob dadurch eine VOLLE Rechnung falsch wird.
  const trial = state.placed.map(row => row.slice());
  for (const ch of changes) trial[ch.r][ch.c] = ch.v;
  if (user && !hint) {
    const bad = [];
    for (const ch of changes) {
      if (ch.v == null) continue;
      const before = trial[ch.r][ch.c];
      trial[ch.r][ch.c] = null;
      const breaks = placementBreaksEquation(p, trial, ch.r, ch.c, ch.v);
      trial[ch.r][ch.c] = before;
      if (breaks) bad.push(ch);
    }
    if (bad.length) {
      for (const ch of bad) flashError(ch.r, ch.c);
      registerMistake();
      return false;
    }
  }

  // 2. Übernehmen — Vorrat mitführen, damit Brett und Vorrat nie auseinanderlaufen.
  const wasSolved = new Set(solvedEquations.value);
  const undoSteps = [];
  // Vorrat in ZWEI Durchgängen führen: erst ALLE freigewordenen Zahlen zurück,
  // dann alle neu gelegten entnehmen. Pro Zelle abwechselnd zurück/entnehmen
  // ging beim TAUSCH zweier gelegter Steine schief: das takeFromTray für den
  // gezogenen Stein fand keinen offenen Stein dieses Werts (er lag ja auf dem
  // Brett) und tat nichts, während das returnToTray der zweiten Änderung den
  // benutzten Stein wieder freigab — der Wert lag danach auf dem Brett UND im
  // Vorrat (gemeldet: „manche Level haben zu viele Steine").
  const freed = [], taken = [];
  for (const ch of changes) {
    const prev = state.placed[ch.r][ch.c];
    if (prev === ch.v) continue;
    undoSteps.push({ r: ch.r, c: ch.c, prev });
    if (prev != null) freed.push(prev);
    if (ch.v != null) taken.push(ch.v);
    state.placed[ch.r][ch.c] = ch.v;
    state.markedBy[ch.r][ch.c] = ch.v == null ? null : (user ? (state.coop.myId || LOCAL_PLAYER_ID) : fromId);
  }
  for (const v of freed) returnToTray(state.tray, v);
  for (const v of taken) takeFromTray(state.tray, v);
  healTrayIfDrifted();
  // Eine FREMDE Änderung kann die eigene Auswahl entwerten (der Partner hat den
  // Stein genommen oder das Herkunftsfeld überschrieben). Dann sichtbar fallen
  // lassen, statt sie beim nächsten Tipp stumm verpuffen zu lassen.
  if (!user && state.pick && srcIsStale(state.pick)) state.pick = null;
  sortTrayAsc();
  if (!undoSteps.length) return true;
  state.history = [undoSteps];    // nur der letzte Zug ist rückgängig machbar

  if (user && (state.coop.active || state.team.active)) {
    const key = coopSend({ type: Coop.MSG.MOVE, cells: changes.map(ch => ({ r: ch.r, c: ch.c, v: ch.v == null ? '' : ch.v })), from: state.coop.myId });
    stampCellVersions(undoSteps, key);
  } else if (!user) {
    stampCellVersions(undoSteps, eventKey);
  }

  // 3. Klang + Puls für jede Rechnung, die dieser Zug fertig gemacht hat.
  if (user) {
    if (changes.some(ch => ch.v != null)) { if (state.settings.sfxKeep) Music.sfxKeep(); }
    else if (state.settings.sfxRemove) Music.sfxRemove();
  }
  let done = 0;
  for (const i of solvedEquations.value) if (!wasSolved.has(i)) { pulseResolved('eq', i); done++; }
  if (done > 0 && state.settings.sfxComplete) Music.sfxComplete(done);

  afterMove();
  return true;
}

// Der Vorrat ist IMMER aufsteigend sortiert und rückt von selbst auf: gelegte
// Steine werden gar nicht mehr gerendert (s. TrayBar), und diese Sortierung
// hält die verbleibenden in Reihenfolge. Der frühere Sortier-Knopf ist damit
// überflüssig und entfernt. Sortiert wird das ARRAY (die Stein-Objekte bleiben
// dieselben), damit ein aufgenommener Stein seine id — und damit die Auswahl —
// behält.
function sortTrayAsc() {
  state.tray.sort((a, b) => a.v - b.v || a.id - b.id);
}

/** Legt einen Stein auf ein Feld (öffentlicher Einstieg, auch für Tests). */
export function placeAt(r, c, v, opts = {}) {
  if (!isBlankCell(r, c)) return false;
  return applyChanges([{ r, c, v }], opts);
}
/** Räumt ein Feld (Stein zurück in den Vorrat). */
export function clearAt(r, c, opts = {}) {
  if (!isBlankCell(r, c) || state.placed[r][c] == null) return false;
  return applyChanges([{ r, c, v: null }], opts);
}

// ── Konfliktauflösung auf dem geteilten Brett ────────────────────────────────
// Wer welches Feld ZULETZT beschrieben hat, als Ereignis-Schlüssel (coop.js
// `send` liefert ihn synchron, eingehende Ereignisse bringen ihren eigenen mit).
// Bewusst NICHT im reaktiven state: das Raster wird nie gerendert, es entscheidet
// nur, ob ein eingehender Zug ein Feld überschreiben darf.
let cellVersion = null;
function resetCellVersions(rows, cols) {
  cellVersion = Array.from({ length: rows }, () => new Array(cols).fill(''));
}
function cellVersionAt(r, c) { return (cellVersion && cellVersion[r] && cellVersion[r][c]) || ''; }
function stampCellVersions(changes, key) {
  if (!key || !cellVersion) return;
  for (const ch of changes) if (cellVersion[ch.r]) cellVersion[ch.r][ch.c] = key;
}

// Zwischen dem AUFNEHMEN eines Steins und dem ABLEGEN vergeht Zeit — im
// Mehrspieler-Modus genug, dass ein Partner denselben Stein wegnimmt oder das
// Herkunftsfeld überschreibt. Der aufgenommene Stein ist dann VERALTET: legte
// man ihn trotzdem ab, schrieb er einen Wert aufs Brett, der dort gar nicht
// mehr herkam (`takeFromTray` fand nichts, `returnToTray` legte später einen
// NEUEN Stein an) — genau das gemeldete „die Zahl verdoppelt sich", und der
// Tausch zweier gesetzter Steine ging dabei sichtbar daneben. Deshalb VOR jedem
// Ablegen gegen den aktuellen Stand prüfen.
function srcIsStale(src) {
  if (!src) return true;
  if (src.from) {
    const row = state.placed[src.from.r];
    return !row || row[src.from.c] !== src.v;      // Feld hat sich unter uns geändert
  }
  return !state.tray.some(t => !t.used && t.v === src.v);   // Stein ist nicht mehr offen
}
// Alle Werte, die AKTUELL auf dem Brett liegen (Vorgaben stecken im Rätsel, nicht
// in state.placed).
function placedValuesFlat() {
  const out = [];
  for (const row of state.placed) for (const v of row) if (v != null) out.push(v);
  return out;
}
// Letzte Instanz nach JEDEM Zug: laufen Brett und Vorrat auseinander, wird der
// Vorrat aus dem Brett neu abgeleitet. Die billige Prüfung (trayMatchesBoard)
// läuft immer, das teure reconcileTray nur im Schadensfall — es vergibt alle ids
// neu und würde sonst bei jedem Zug die Auswahl und das ganze Vorrats-Rendering
// zurücksetzen. Damit kann sich eine Abweichung nie mehr aufsummieren, egal aus
// welcher Richtung sie kommt (gleichzeitige Züge zweier Spieler, verlorene oder
// doppelte Ereignisse).
function healTrayIfDrifted() {
  const p = state.puzzle;
  if (!p) return;
  const placedValues = placedValuesFlat();
  if (trayMatchesBoard(state.tray, placedValues, p.tray)) return;
  const before = state.tray.length;
  state.tray = reconcileTray(state.tray, placedValues, p.tray);
  state.pick = null;                      // die ids sind neu — die Auswahl zeigt ins Leere
  log('game', 'Vorrat nachgezogen (Brett und Vorrat waren auseinandergelaufen)', {
    vorher: before, nachher: state.tray.length, coop: !!(state.coop.active || state.team.active),
  });
}

/**
 * Ablegen des aufgenommenen Steins auf Feld (r,c).
 * Belegtes Ziel → die beiden Steine TAUSCHEN (vom Brett) bzw. der alte geht
 * zurück in den Vorrat (aus dem Vorrat).
 */
export function dropOn(r, c, src = state.pick) {
  if (boardLocked() || !src) return false;
  if (!isBlankCell(r, c)) { state.pick = null; return false; }
  if (srcIsStale(src)) { state.pick = null; return false; }
  const target = state.placed[r][c];
  const from = src.from;
  if (from && from.r === r && from.c === c) { state.pick = null; return false; }

  let changes;
  if (from) {
    // Brett → Brett: Tausch (bzw. Verschieben, wenn das Ziel leer ist).
    changes = [{ r, c, v: src.v }, { r: from.r, c: from.c, v: target }];
  } else {
    changes = [{ r, c, v: src.v }];
  }
  const ok = applyChanges(changes);
  state.pick = null;
  return ok;
}
/** Ablegen im Vorrat: das Herkunftsfeld wird frei. */
export function dropOnTray(src = state.pick) {
  if (boardLocked() || !src || !src.from) { state.pick = null; return false; }
  if (srcIsStale(src)) { state.pick = null; return false; }
  const ok = clearAt(src.from.r, src.from.c);
  state.pick = null;
  return ok;
}

// ── Drag & Drop (Zeiger) ─────────────────────────────────────────────────────
// Der Ziehschatten ist ein DIREKT manipuliertes DOM-Element: eine reaktive
// x/y-Position würde bei jeder Zeigerbewegung das ganze App-Template neu
// rendern (Kernregel „keine hochfrequenten reaktiven Writes", CLAUDE.md).
let dragGhost = null;
let dragSrc = null;
let dragMoved = false;
// Der gezogene Stein sitzt ÜBER dem Finger, sonst verdeckt die Hand genau die
// Zahl, die man gerade schiebt. Abgelegt wird dort, wo der STEIN liegt (nicht
// unter dem Finger) — Anzeige und Trefferpunkt sind damit dasselbe.
const DRAG_LIFT = 52;
// REICHWEITE (settings.dragScale): der Stein folgt der Fingerbewegung um diesen
// Faktor verstärkt. Bei 1 klebt er wie bisher über dem Finger; bei 3 schiebt
// eine kurze Bewegung ihn dreimal so weit — man erreicht den oberen Brettrand,
// ohne den Finger über den ganzen Bildschirm zu ziehen (Nutzerwunsch). Gemessen
// wird ab dem Punkt, an dem der Stein aufgenommen wurde (dragOrigin), damit die
// Verstärkung erst mit der Bewegung einsetzt und der Stein nicht springt.
// Der Trefferpunkt ist IMMER dort, wo der Stein ANGEZEIGT wird — Anzeige und
// Ablageort bleiben also dasselbe, egal wie stark verstärkt wird.
let dragOrigin = null;
export function dragScale() {
  const v = Number(state.settings.dragScale);
  return Number.isFinite(v) ? Math.min(4, Math.max(1, v)) : 1;
}
function dropPoint(e) {
  const f = dragScale();
  let x = e.clientX, y = e.clientY;
  if (dragOrigin && f !== 1) {
    x = dragOrigin.x + (x - dragOrigin.x) * f;
    y = dragOrigin.y + (y - dragOrigin.y) * f;
  }
  // Innerhalb des Fensters halten — sonst zeigt der Stein bei starker
  // Verstärkung ins Nichts und lässt sich nirgends mehr ablegen.
  const m = 4;
  x = Math.min(window.innerWidth - m, Math.max(m, x));
  y = Math.min(window.innerHeight - m, Math.max(m, y - DRAG_LIFT));
  return { x, y };
}

function ensureGhost(v) {
  if (!dragGhost) {
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    document.body.appendChild(dragGhost);
  }
  dragGhost.textContent = String(v);
  dragGhost.style.display = 'block';
  return dragGhost;
}
function moveGhost(e) {
  if (!dragGhost) return;
  const p = dropPoint(e);
  dragGhost.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -50%)`;
}
// Feld unter dem gezogenen Stein hervorheben, damit vor dem Loslassen klar ist,
// wo er landet. Läuft ohne Vue (Klasse direkt am Element), s. Render-Kernregeln.
let hoverCell = null;
function highlightUnder(e) {
  const p = dropPoint(e);
  const el = document.elementFromPoint(p.x, p.y);
  const cell = el && el.closest && el.closest('.cell[data-r]');
  if (cell === hoverCell) return;
  if (hoverCell) hoverCell.classList.remove('drop-hot');
  hoverCell = cell && !cell.classList.contains('given') ? cell : null;
  if (hoverCell) hoverCell.classList.add('drop-hot');
}
function clearHighlight() {
  if (hoverCell) hoverCell.classList.remove('drop-hot');
  hoverCell = null;
}
function hideGhost() { if (dragGhost) dragGhost.style.display = 'none'; }

// Der Zug beginnt ERST bei echter Bewegung (DRAG_SLOP), nicht schon beim
// Aufsetzen des Fingers. Zwei Gruende:
//  • Der Vorrat ist eine einzige, waagerecht scrollbare Reihe. Die Steine tragen
//    deshalb touch-action: pan-x — ein waagerechter Wisch gehoert dem BROWSER
//    (Scrollen), erst eine senkrechte Bewegung ist ein Zug. Vorher lag
//    touch-action: none auf den Steinen: jeder Wisch nahm sofort den Stein auf,
//    die Leiste liess sich gar nicht scrollen (gemeldet).
//  • Ohne Schwelle blitzte der Ziehschatten bei jedem Scroll-Wisch kurz auf,
//    bis der Browser die Geste uebernimmt und pointercancel schickt.
const DRAG_SLOP = 5;   // px, bevor aus dem Tippen ein Ziehen wird
let dragArmed = false; // Finger liegt auf einem Stein, Zug aber noch nicht gestartet
export function onDragStart(e, v, from, tileId) {
  if (boardLocked()) return;
  // Im Markierungsmodus lässt sich KEINE Zahl anfassen — weder auf dem Brett
  // noch im Vorrat (beide Wege laufen hier durch).
  if (state.markMode) return;
  dragSrc = { v, from: from || null, tileId: tileId ?? null };
  dragOrigin = { x: e.clientX, y: e.clientY };
  dragMoved = false;
  dragArmed = true;
  state.drag = { v, from: dragSrc.from };
  // Zeiger SOFORT einfangen, nicht erst beim Armieren: sonst gehen die
  // Bewegungen an das Element unter dem Zeiger, und wer den Stein mit einer
  // schnellen Bewegung wegzieht, verlaesst den Stein schon mit dem ERSTEN
  // Ereignis — der Zug begann dann nie. (Der Vorrat scrollt nicht mehr, ein
  // frueher Fang nimmt dem Browser also auch keine Geste weg.)
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
}
export function onDragMove(e) {
  if (!dragSrc) return;
  if (dragArmed) {
    const dx = e.clientX - dragOrigin.x, dy = e.clientY - dragOrigin.y;
    if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;   // noch ein Tipp
    dragArmed = false;
    dragMoved = true;
    ensureGhost(dragSrc.v);
  }
  moveGhost(e);
  highlightUnder(e);
  e.preventDefault();
}
export function onDragEnd(e, cell = null) {
  if (!dragSrc) { if (cell) handleCellTap(cell.r, cell.c); return; }
  const src = dragSrc;
  dragSrc = null;
  state.drag = null;
  hideGhost();
  clearHighlight();
  // dragOrigin wird ERST nach dropPoint(e) geleert — sonst fiele die Reichweite
  // genau beim Loslassen weg und der Stein landete unter dem Finger statt dort,
  // wo er die ganze Zeit zu sehen war.
  const p = dragMoved ? dropPoint(e) : null;
  dragOrigin = null;
  dragArmed = false;
  // Reiner Tipp: auf dem BRETT entscheidet handleCellTap (Auswahl/Tausch/
  // Dreifach-Tipp), im Vorrat bleibt es beim schlichten Aufnehmen.
  if (!dragMoved) { if (cell) handleCellTap(cell.r, cell.c); else pickTile(src.v, src.from, src.tileId); return; }
  const el = document.elementFromPoint(p.x, p.y);
  const ziel = el && el.closest && el.closest('.cell[data-r]');
  if (ziel) { dropOn(parseInt(ziel.dataset.r, 10), parseInt(ziel.dataset.c, 10), src); return; }
  if (el && el.closest && el.closest('.tray')) { dropOnTray(src); return; }
  state.pick = null;
}
export function onDragCancel() {
  if (!dragSrc) return;
  dragSrc = null; dragOrigin = null; dragArmed = false; state.drag = null; hideGhost(); clearHighlight(); state.pick = null;
}

// Klick auf ein Feld: mit aufgenommenem Stein ablegen, sonst den dort liegenden aufnehmen.
// ── Farb-Markierung, Auswahl und Dreifach-Tipp ──────────────────────────────
// Drei Gesten auf einem Zahl-Feld, alle ohne Regel-Bedeutung fürs Rätsel:
//  • LANGES DRÜCKEN  → Farb-Markierung an/aus (persönliche Notiz, Farbe in den
//    Einstellungen wählbar; wird NICHT an Mitspieler gesendet).
//  • EINMAL TIPPEN   → gelegten Stein auswählen; die Auswahl BLEIBT stehen, ein
//    Tipp auf einen anderen gelegten Stein tauscht die beiden. Vorher ging der
//    Tausch nur per Ziehen: der @click-Handler feuerte NACH dem Zeiger-Pfad, sah
//    die dort gerade gesetzte Auswahl und hob sie als „Ablegen auf sich selbst"
//    sofort wieder auf.
//  • DREIMAL TIPPEN  → der Stein wandert zurück in den Vorrat.
const LONG_PRESS_MS = 450;   // ab hier gilt es als „gedrückt halten"
const TRIPLE_TAP_MS = 700;   // max. Pause zwischen zwei Tipps derselben Folge
let longPressTimer = 0, longPressFired = false, pressPt = null;
let tapKey = '', tapCount = 0, tapAt = 0, pointerTapAt = 0;

function hlKey(r, c) { return `${r}-${c}`; }
// Modus an/aus. Beim EINSCHALTEN alles fallen lassen, was gerade in der Hand
// liegt (aufgenommener Stein, laufendes Ziehen) — sonst klebte die Auswahl
// unsichtbar weiter und der erste Tipp nach dem Ausschalten legte sie irgendwo ab.
export function toggleMarkMode() {
  state.markMode = !state.markMode;
  if (state.markMode) { onDragCancel(); state.pick = null; }
  log('game', 'Markierungsmodus', { an: state.markMode });
}
// „Alle Markierungen löschen" — nur mit Rückfrage: die Markierungen sind
// Handarbeit und es gibt kein Rückgängig dafür.
export function askClearMarks() {
  if (!state.hl.length) return;
  ask(t('game.clearMarksTitle'), t('game.clearMarksMsg', { n: state.hl.length }), () => {
    log('game', 'Alle Markierungen gelöscht', { n: state.hl.length });
    state.hl = [];
    persistGame();
  });
}
function toggleHighlight(r, c) {
  const k = hlKey(r, c);
  const i = state.hl.indexOf(k);
  if (i >= 0) state.hl.splice(i, 1); else state.hl.push(k);
  persistGame();
}
// Ein Tipp auf ein Feld — aus dem Zeiger-Pfad ODER von der Tastatur.
function handleCellTap(r, c) {
  if (boardLocked()) return;
  // Markierungsmodus: EIN Tipp genügt, Zahlen bleiben unangetastet.
  if (state.markMode) { toggleHighlight(r, c); return; }
  const key = hlKey(r, c);
  const jetzt = Date.now();
  tapCount = (key === tapKey && jetzt - tapAt < TRIPLE_TAP_MS) ? tapCount + 1 : 1;
  tapKey = key; tapAt = jetzt;

  // Etwas in der Hand? Dann ablegen bzw. tauschen — das hat Vorrang, und die
  // Tipp-Folge beginnt danach von vorn.
  const pick = state.pick;
  if (pick && !(pick.from && pick.from.r === r && pick.from.c === c)) {
    tapCount = 0; tapKey = '';
    dropOn(r, c);
    return;
  }
  if (!isBlankCell(r, c) || state.placed[r][c] == null) { state.pick = null; return; }
  if (tapCount >= 3) { tapCount = 0; tapKey = ''; state.pick = null; clearAt(r, c); return; }
  // 1. Tipp wählt aus, 2. Tipp hebt die Auswahl wieder auf.
  if (state.pick) state.pick = null; else pickFromCell(r, c);
}
// Tastatur/Maus-Fallback: der Zeiger-Pfad hat denselben Tipp ggf. schon erledigt.
export function onCellTap(r, c) {
  if (Date.now() - pointerTapAt < 400) return;
  handleCellTap(r, c);
}
function onCellDown(e, cell) {
  if (boardLocked()) return;
  // Im Markierungsmodus erledigt der TIPP das Markieren — ein zusätzlicher
  // Langdruck-Zeitgeber würde beim Halten zweimal umschalten (Timer an, Tipp
  // wieder aus) und das Feld bliebe scheinbar unverändert.
  if (state.markMode) return;
  longPressFired = false;
  pressPt = { x: e.clientX, y: e.clientY };
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressTimer = 0; longPressFired = true;
    onDragCancel();                       // eine begonnene Zug-Vorbereitung verwerfen
    toggleHighlight(cell.r, cell.c);
    try { navigator.vibrate && navigator.vibrate(15); } catch (_) {}
  }, LONG_PRESS_MS);
  if (!cell.given && cellValue(cell) != null) onDragStart(e, cellValue(cell), { r: cell.r, c: cell.c });
}
function cancelLongPress() { clearTimeout(longPressTimer); longPressTimer = 0; pressPt = null; }
function onCellMove(e) {
  if (longPressTimer && pressPt
      && (Math.abs(e.clientX - pressPt.x) > DRAG_SLOP || Math.abs(e.clientY - pressPt.y) > DRAG_SLOP)) cancelLongPress();
  onDragMove(e);
}
function onCellUp(e, cell) {
  cancelLongPress();
  // Die Geste WAR das Markieren: kein Tipp, keine Auswahl. `pointerTapAt` MUSS
  // trotzdem gestempelt werden — sonst sieht der @click-Fallback (onCellTap)
  // den Zeiger-Pfad als „nicht zustaendig" an, waehlt den Stein aus und die
  // frisch markierte Zahl haengt zum Umsetzen in der Hand (gemeldet). Die
  // Tipp-Folge beginnt danach von vorn, damit ein Markieren nicht als Tipp in
  // eine Dreifach-Folge mitzaehlt.
  if (longPressFired) {
    longPressFired = false;
    pointerTapAt = Date.now();
    tapCount = 0; tapKey = '';
    state.pick = null;
    return;
  }
  pointerTapAt = Date.now();
  onDragEnd(e, cell);
}
function onCellCancel() {
  cancelLongPress();
  if (longPressFired) { pointerTapAt = Date.now(); tapCount = 0; tapKey = ''; }
  longPressFired = false;
  onDragCancel();
}


let lastErrorSfx = 0;
export function flashError(r, c) {
  const key = `${r}-${c}`;
  state.flash[key] = true;
  setTimeout(() => { delete state.flash[key]; }, 650);
  // Fehler-Ton — beim Mehrfach-Check (doCheck markiert viele Zellen auf einmal)
  // nur einmal spielen, nicht pro Zelle.
  if (state.settings.sfxError && Date.now() - lastErrorSfx > 120) { lastErrorSfx = Date.now(); Music.sfxError(); }
}


// ── BoardGrid: das Spielbrett als EIGENE Child-Komponente ─────────────────────
// KERN-PERFORMANCEFIX: Vue trackt Render-Abhängigkeiten PRO KOMPONENTE. Solange
// das Brett im App-Template lag, renderte JEDE reaktive Änderung der App (Tool-
// Umschalter state.tool, Sekunden-Tick state.elapsed, HUD/Chat/Toasts, …) ALLE
// ~200 Zellen mit (cellClasses/cellStyle/Aria ×196 auf 14×14) — auf älteren
// Geräten im Spätspiel spürbare Tap-Latenz („Button reagiert nicht", Züge im
// falschen Modus). Als Child-Komponente rendert das Brett NUR noch, wenn sich
// ECHTE Brett-Abhängigkeiten ändern (marks/flash/justResolved/cellMeta/Skin/…).
// Alle Helfer sind bewusst Modul-Scope — kein Props-Threading nötig.
// boardRenderCount zählt Brett-Renders (localhost-Debug/E2E-Regressionstest).
let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }
export const BoardGrid = {
  setup() {
    return {
      state, cellClasses, cellStyle, cellValue, onCellTap, onDragStart, onDragMove, onDragEnd, onDragCancel,
      // Zell-Gesten: langes Drücken (markieren), Tippen (auswählen/tauschen),
      // dreimal tippen (zurück in den Vorrat). Siehe handleCellTap.
      onCellDown, onCellMove, onCellUp, onCellCancel,
      eqSolvedR, skinBoardClasses, skinVars, gridStyle, boardFontClass, boardFrameClass,
      countRender: () => { boardRenderCount++; return ''; },
    };
  },
  template: `
          <div class="board" :class="[skinBoardClasses, boardFontClass(), boardFrameClass(), { 'skin-freeze': state.paused || state.joinFreeze, 'mp-colors': state.coop.active || state.team.active, 'big-num': state.puzzle.bigNumbers }]" :style="[gridStyle, skinVars]" :data-rc="countRender()">
            <template v-for="(row, dr) in state.display.cells" :key="'dr'+dr">
              <template v-for="(cell, dc) in row" :key="dr+'-'+dc">
                <div v-if="!cell" class="gapcell"></div>
                <div v-else-if="cell.t==='op'" class="opcell" :class="{ done: eqSolvedR(cell.eqIndex), pulse: !!state.justResolved['eq-'+cell.eqIndex] }"><span v-if="cell.sym==='÷'" class="op-obelus" role="img" aria-label="÷"></span><template v-else>{{ cell.sym }}</template></div>
                <div v-else class="cell" :class="cellClasses(cell)" :style="cellStyle(cell)"
                     :data-r="cell.r" :data-c="cell.c"
                     role="button" :tabindex="cell.given ? -1 : 0"
                     @click="onCellTap(cell.r, cell.c)"
                     @keydown.enter.prevent="onCellTap(cell.r, cell.c)"
                     @keydown.space.prevent="onCellTap(cell.r, cell.c)"
                     @pointerdown="onCellDown($event, cell)"
                     @pointermove="onCellMove($event)"
                     @pointerup="onCellUp($event, cell)"
                     @pointercancel="onCellCancel()"
                     @contextmenu.prevent>
                  <span class="cnum">{{ cellValue(cell) }}</span>
                </div>
              </template>
            </template>
          </div>
  `,
};

// Vorrat: die noch zu legenden Zahlen. Ein benutzter Stein hinterlässt seine
// LÜCKE (wie in der Vorlage) — der Sortier-Knopf räumt auf und sortiert.
export const TrayBar = {
  setup() {
    return { state, onDragStart, onDragMove, onDragEnd, onDragCancel, pickTile, dropOnTray, trayStyle };
  },
  template: `
          <div class="tray" :class="{ 'mark-mode': state.markMode }" :style="trayStyle" @click.self="dropOnTray()">
            <!-- v-if MUSS in ein template: auf demselben Element hat v-if in Vue 3
                 Vorrang vor v-for, tile waere dort noch gar nicht definiert. -->
            <template v-for="tile in state.tray" :key="tile.id"><div v-if="!tile.used" class="tray-slot">
              <div class="tile"
                   :class="{ picked: state.pick && !state.pick.from && state.pick.tileId===tile.id, d3: String(tile.v).length===3, d4: String(tile.v).length>=4 }"
                   role="button" tabindex="0"
                   @keydown.enter.prevent="pickTile(tile.v, null, tile.id)"
                   @pointerdown="onDragStart($event, tile.v, null, tile.id)"
                   @pointermove="onDragMove($event)"
                   @pointerup="onDragEnd($event)"
                   @pointercancel="onDragCancel()"
                   @contextmenu.prevent>{{ tile.v }}</div>
            </div></template>
          </div>
  `,
};


// Aria-Labels je Zelle EINMAL pro Zug/Sprachwechsel berechnen statt ×169 bei
// JEDEM Render (die t()-Interpolation war ein messbarer Teil des Tick-Renders
// auf großen Brettern). Computed trackt state.placed + i18n-Locale.
const cellAriaLabels = computed(() => {
  const p = state.puzzle; if (!p) return [];
  const out = new Array(p.rows);
  for (let r = 0; r < p.rows; r++) {
    out[r] = new Array(p.cols);
    for (let c = 0; c < p.cols; c++) {
      const sl = p.slots[r][c];
      if (!sl) { out[r][c] = ''; continue; }
      const v = sl.given ? sl.v : state.placed[r][c];
      const status = sl.given ? t('a11y.cellGiven') : v == null ? t('a11y.cellEmpty') : t('a11y.cellFilled', { value: v });
      out[r][c] = t('a11y.cellLabel', { row: r + 1, col: c + 1, status });
    }
  }
  return out;
});
export function cellAriaLabel(r, c) { return (cellAriaLabels.value[r] && cellAriaLabels.value[r][c]) || ''; }
// Markierungen als Set — cellClasses darf pro Zelle NICHT durchs Array suchen
// (Render-Kernregel). Rechnet nur bei einer Änderung von state.hl neu.
const hlSet = computed(() => new Set(state.hl));
export function cellClasses(cell) {
  const { r, c } = cell;
  const v = cell.given ? state.puzzle.slots[r][c].v : state.placed[r][c];
  const who = state.markedBy[r] && state.markedBy[r][c];
  const picked = state.pick && state.pick.from && state.pick.from.r === r && state.pick.from.c === c;
  const digits = v == null ? 0 : String(v).length;
  return {
    given: cell.given,
    filled: !cell.given && v != null,
    empty: !cell.given && v == null,
    // Drei- und vierstellige Werte müssen enger gesetzt werden, sonst laufen
    // sie auf kleinen Brettern über den Zellrand.
    d3: digits === 3,
    d4: digits >= 4,
    done: cellInSolvedEq(r, c),
    flash: !!state.flash[`${r}-${c}`],
    picked: !!picked,
    marked: hlSet.value.has(`${r}-${c}`),   // persönliche Farb-Markierung (langes Drücken)
    // Beim Ziehen UND beim reinen Antippen eines Steins: solange ein Stein „in der
    // Hand" liegt, zeigen alle freien Felder ihren Ablege-Ring. Vorher hing das nur
    // an state.drag — beim Antippen erlosch die Hervorhebung mit dem Abheben des
    // Fingers, obwohl der Stein weiterhin ausgewählt war (gemeldet).
    droppable: !cell.given && !!(state.drag || state.pick),
    'coop-mark': !cell.given && !!who,
    // EIGENE Steine behalten im Mehrspieler-Modus den eigenen Skin — nur die der
    // MITSPIELER fallen auf deren Farbe zurück (s. .mp-colors in styles.css).
    mine: !!who && who === (state.coop.myId || LOCAL_PLAYER_ID),
    'training-highlight': state.isTrainingGame && state.trainingStep && state.trainingStep.r === r && state.trainingStep.c === c,
  };
}
// Wert, der in einem Zahl-Feld steht (Vorgabe oder gelegter Stein).
export function cellValue(cell) {
  return cell.given ? state.puzzle.slots[cell.r][cell.c].v : state.placed[cell.r][cell.c];
}
// Style-Objekte je Zelle CACHEN und bei unveränderten Eingaben DIESELBE Referenz
// zurückgeben: Vue patcht :style nur, wenn sich die Referenz ändert — bei einem
// neuen Objekt pro Render setzte es sonst JEDE CSS-Custom-Property für ALLE
// Zellen bei JEDEM Render erneut (im Profil ein Top-Posten).
let cellStyleCache = [];
export function resetCellStyleCache() { cellStyleCache = []; }
export function cellStyle(cell) {
  const { r, c } = cell;
  const who = state.markedBy[r] && state.markedBy[r][c];
  const col = who ? (who === LOCAL_PLAYER_ID ? state.settings.coopMyColor : playerColor(who)) : null;
  const key = col || '';
  const row = cellStyleCache[r] || (cellStyleCache[r] = []);
  const hit = row[c];
  if (hit && hit.key === key) return hit.style;
  const st = { fontSize: 'var(--fs)' };
  if (col) st['--markcol'] = col;
  row[c] = { key, style: st };
  return st;
}



// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — dieselben Namen wie in games/numbersums/board.js.
// ═════════════════════════════════════════════════════════════════════════════

// Ein aus Cloud/Coop stammendes Rätsel hat ein löchriges slots-Raster (die RTDB
// speichert keine null-Werte) — buildDisplay griffe sonst ins Leere.
export function normalizePuzzle(p) { return healPuzzle(p); }

// Spieleigener Teil des Brett-Aufbaus: Anzeige-Raster, gelegte Steine, Vorrat,
// persönliche Markierungen. Läuft in loadPuzzleIntoState NACH `state.puzzle = …`.
export function loadBoard(puzzle, saved) { buildBoardState(puzzle, saved); }

// Gelegte Zahlen für die RTDB: leere Felder als '' (s. wireMarkedBy in der Schale)
// — sonst zerfällt das Raster unterwegs zu einem löchrigen Objekt.
function wirePlaced() {
  return (state.placed || []).map(row => (row || []).map(v => (v == null ? '' : v)));
}
// Die spieleigenen Felder eines Spielstands (s. numbersums/board.js). Die
// Farb-Markierungen (`hl`) sind PERSÖNLICH: sie werden gespeichert, aber nie an
// Mitspieler gesendet.
export function boardFields(purpose) {
  if (purpose === 'wire') return { placed: wirePlaced(), tray: state.tray.map(t => ({ v: t.v, used: t.used ? 1 : 0 })) };
  if (purpose === 'history') return { placed: state.placed.map(row => row.slice()), tray: state.tray.map(t => ({ v: t.v, used: t.used })) };
  return { placed: state.placed, tray: state.tray.map(t => ({ v: t.v, used: t.used })), hl: state.hl.slice() };
}
export function boardFieldsFrom(src) { return { placed: src.placed, tray: src.tray, hl: src.hl }; }

// Gelöst, wenn jede Lücke gefüllt ist und jede Rechnung aufgeht.
export function boardSolved() { return !!state.puzzle && isBoardSolved(state.puzzle, state.placed); }
export function boardProgressPct() {
  const p = state.puzzle; if (!p) return 0;
  return Math.round(progressOf(p, state.placed) * 100);
}
/** Wie viele Steine liegen bereits? */
export function boardFilledCount() {
  const p = state.puzzle;
  if (!p) return 0;
  let n = 0;
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) if (state.placed[r][c] != null) n++;
  return n;
}
export function boardProgressCounts() {
  if (!state.puzzle) return { kept: 0, total: 0 };
  return { kept: boardFilledCount(), total: state.puzzle.tray.length };
}
// „Richtig" = ein Stein dieses Spielers, der auf seinem Platz liegt.
export function playerCorrect(id) {
  const p = state.puzzle;
  let n = 0;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      if (state.markedBy[r][c] !== id) continue;
      if (state.placed[r][c] != null && state.placed[r][c] === solutionAt(p, r, c)) n++;
    }
  return n;
}
// „Prüfen" gibt es in Math Cross nicht — ein Fehler zeigt sich sofort beim Legen.
export function wrongCells() { return []; }

// Züge eines Mitspielers. Ein Zug kann mehrere Felder betreffen (Tausch). Haben
// beide Spieler GLEICHZEITIG dasselbe Feld beschrieben, entscheidet der
// Ereignis-Schlüssel — pro Feld gewinnt der spätere (Coop.winsCell). Beide
// Seiten verwerfen damit dieselben Schreibvorgänge und landen auf demselben
// Brett; ohne die Regel sah jeder am Ende den Zug des ANDEREN.
export function applyRemoteMove(msg, eventKey = null) {
  const all = (msg.cells || []).map(ch => ({ r: ch.r, c: ch.c, v: ch.v === '' || ch.v == null ? null : ch.v }));
  const cells = all.filter(ch => Coop.winsCell(eventKey, cellVersionAt(ch.r, ch.c)));
  if (cells.length < all.length) {
    log('coop', 'Gleichzeitiger Zug auf dasselbe Feld — der spätere gewinnt', {
      gesamt: all.length, verworfen: all.length - cells.length,
    });
  }
  if (cells.length) applyChanges(cells, { user: false, fromId: msg.from, eventKey });
}
// Tipps gibt es in Math Cross nicht.
export function applyRemoteHint() {}
export function buildHint() { return null; }
export function clearStaleTutor() {}

// Den letzten Zug zurücknehmen (ein Zug kann mehrere Felder umfassen).
export function undoLast() {
  const last = state.history.pop();
  if (!last) return false;
  for (const stepUndo of last) {
    const cur = state.placed[stepUndo.r][stepUndo.c];
    if (cur != null) returnToTray(state.tray, cur);
    if (stepUndo.prev != null) takeFromTray(state.tray, stepUndo.prev);
    state.placed[stepUndo.r][stepUndo.c] = stepUndo.prev;
    state.markedBy[stepUndo.r][stepUndo.c] = stepUndo.prev == null ? null : state.markedBy[stepUndo.r][stepUndo.c];
  }
  return true;
}

// ── Trainingsmodus ──
// Training generiert ein Rätsel, das die einfachste Logik komplett trägt.
export { isFullyTier1Solvable };
export function trainingStep() { return nextTrainingStep(state.puzzle, state.placed, trayValues.value, activeDivSym()); }
// Der Tutor legt den erklärten Stein selbst (ohne Fehler-Prüfung und Versand —
// Training ist immer Solo). In Coop Math Cross stand hier ein Aufruf aus Number
// Sums (setMark), den es dort nie gab: „Training" stürzte ab.
export function applyTrainingStep(step) { placeAt(step.r, step.c, step.v, { user: false }); }
export function trainingText(step) { return { title: t('training.title'), body: t(step.key, step.params) }; }

// Käfig-Farben gibt es nicht — nichts umzufärben.
export function onPlayerColorsChanged() {}

// Das Anzeige-Raster wird beim Laden EINMAL gebaut (markRaw, bewusst nicht
// reaktiv — Render-Kernregel). Eine Änderung des Geteilt-Zeichens mitten im
// Spiel muss es deshalb aktiv neu bauen; die Neuzuweisung allein löst den Render aus.
export function rebuildDisplay() {
  if (!state.puzzle) return;
  state.display = markRaw(buildDisplay(state.puzzle, activeDivSym()));
}

// ── Verlauf: das Endbrett eines gelösten Rätsels ──
// Per Seed neu erzeugt und VOLLSTÄNDIG gelöst gezeigt (jede Lücke mit ihrer
// Lösungszahl) — dasselbe Raster wie im Spiel, nur kleiner.
export function historyExtras(puzzle) { return { display: markRaw(buildDisplay(puzzle, activeDivSym())) }; }
function historyGridStyle(d) {
  const t = trackUsage(d && d.display);
  const tw = trackCounts(t.cols);
  const avail = Math.min(window.innerWidth - 80, 420) - tw.empty * EMPTY_TRACK;
  const cellPx = Math.max(14, Math.min(34, Math.floor(avail / (tw.cells + tw.ops * OP_RATIO || 1))));
  return {
    gridTemplateColumns: gridTracks(t.cols),
    gridTemplateRows: gridTracks(t.rows),
    '--cell': cellPx + 'px', '--opcell': Math.round(cellPx * OP_RATIO) + 'px',
    '--emptycell': EMPTY_TRACK + 'px',
    '--fs': Math.max(9, Math.round(cellPx * 0.42)) + 'px',
  };
}
export const HistoryBoard = {
  props: ['detail'],
  setup() { return { historyGridStyle }; },
  template: `
          <div class="board history-board" :style="historyGridStyle(detail)">
            <template v-for="(row, dr) in detail.display.cells" :key="'hdr'+dr">
              <template v-for="(cell, dc) in row" :key="'h'+dr+'-'+dc">
                <div v-if="!cell" class="gapcell"></div>
                <div v-else-if="cell.t==='op'" class="opcell"><span v-if="cell.sym==='÷'" class="op-obelus" role="img" aria-label="÷"></span><template v-else>{{ cell.sym }}</template></div>
                <div v-else class="cell" :class="{ given: cell.given, filled: !cell.given, done: true }">
                  <span class="cnum">{{ detail.puzzle.slots[cell.r][cell.c].v }}</span>
                </div>
              </template>
            </template>
          </div>
  `,
};

// ── Test-Haken (nur localhost, s. window.__cns in app.js) ──
// Die Math-Cross-E2E-Tests legen Steine direkt über den Kern-Zug (placeAt), wie
// es ein echtes Ablegen tut, und brauchen das erste offene Feld samt Lösung.
export function testHooks() {
  const firstBlank = () => {
    const p = state.puzzle;
    if (!p) return null;
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      const sl = p.slots[r][c];
      if (sl && !sl.given && state.placed[r][c] == null) return { r, c, v: sl.v };
    }
    return null;
  };
  return {
    placeAt, clearAt, pickTile, dropOn, dragLift: DRAG_LIFT, firstBlank,
    placeOne: () => { const b = firstBlank(); if (b) placeAt(b.r, b.c, b.v); return b; },
  };
}
