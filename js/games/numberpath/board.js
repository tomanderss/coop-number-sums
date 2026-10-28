// games/numberpath/board.js — das BRETT von „Number Path": Darstellung, Ziehen
// der Linie, Züge, und am Dateiende dieselbe Brett-Schnittstelle wie die
// anderen Spiele.
//
// Bedienung:
//   • Auf der 1 aufsetzen und ziehen: die Linie folgt dem Finger von Zelle zu
//     Zelle (waagerecht/senkrecht). Bei einer schnellen Bewegung füllt sie die
//     übersprungenen Zellen selbst auf, solange das erlaubt ist.
//   • Irgendwo auf der eigenen Linie aufsetzen (oder zurückziehen) kürzt sie
//     dort — so korrigiert man, ohne Rückgängig-Knopf.
//   • Gesperrt (ohne Fehler, ohne Leben): Wände, belegte Zellen, eine Zahl
//     außer der Reihe und die letzte Zahl, solange noch Zellen frei sind.
//   • Zwei Finger verschieben ein gezoomtes Brett.
// Weil die Reihenfolge so immer stimmt, ist ein volles Brett gelöst.
//
// RENDER-PERFORMANCE: Gitter = Hintergrund; Wände und Zahlen sind eigene
// Komponenten, die nur am Rätsel hängen; ein Zug zeichnet nur die Linie neu.

import { computed, ref, onMounted, onBeforeUnmount } from '../../vue.esm-browser.prod.js';
import { shopItemById, applyPaletteFx } from '../../shopitems.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import * as Coop from '../../coop.js';
import { log } from '../../debuglog.js';
import {
  canStep, isSolved, progressPct, clueMap, wallSet, lastClue, reachedClue,
  normalizePuzzle as healPuzzle, normalizePath, rcOf,
} from './model.js';
import { solveEdges, nextEdgeStep } from './solver.js';

// ── Von der Schale injizierte Verweise (s. numbersums/board.js) ──────────────
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
let afterMove = () => {};
let coopSend = () => null;
let desktopBoard = () => false;

export function initBoard(ctx) {
  state = ctx.state;
  LOCAL_PLAYER_ID = ctx.LOCAL_PLAYER_ID;
  playerColor = ctx.playerColor;
  shopEquippedId = ctx.shopEquippedId;
  afterMove = ctx.afterMove;
  coopSend = ctx.coopSend;
  if (ctx.desktopBoard) desktopBoard = ctx.desktopBoard;
}

// Shop-Optik, die es hier (noch) nicht gibt (s. rectangles/board.js).
export function boardFontClass() { const id = shopEquippedId('font'); return id && id !== 'classic' ? 'font-' + id : ''; }
export function boardFrameClass() { return ''; }
export const skinUnlocked = computed(() => false);
export const skinPresetOwned = computed(() => false);
export const skinActive = computed(() => false);
export const skinVars = computed(() => ({}));
export const skinBoardClasses = computed(() => []);
export function activePaletteFx() { const it = shopItemById(shopEquippedId('palette')); return it ? it.fx : null; }

// Linienfarbe: Leitfarbe, folgt einer ausgerüsteten Shop-Palette.
const lineHue = computed(() => applyPaletteFx({ h: 222, s: 80, l: 60 }, activePaletteFx()).h);

// ── Größe ────────────────────────────────────────────────────────────────────
export const gridStyle = computed(() => {
  const p = state.puzzle;
  const cols = p ? p.cols : 1, rows = p ? p.rows : 1;
  return {
    width: cols * state.cellPx + 'px', height: rows * state.cellPx + 'px',
    '--cell': state.cellPx + 'px', '--cols': cols, '--rows': rows,
    '--fs': Math.max(11, Math.round(state.cellPx * 0.42)) + 'px',
    '--lh': lineHue.value,
  };
});
export function fitBoard() {
  if (!state.puzzle) return;
  const { rows, cols } = state.puzzle;
  const wrap = document.querySelector('.board-wrap');
  let availW, availH;
  if (wrap && wrap.clientWidth && wrap.clientHeight) { availW = wrap.clientWidth - 12; availH = wrap.clientHeight - 12; }
  else { availW = Math.min(window.innerWidth - 44, 496); availH = window.innerHeight - 220; }
  const ideal = Math.min(Math.floor(availW / cols), Math.floor(availH / rows));
  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const cap = desktopBoard() ? 112 : (shortSide >= 600 ? Math.min(110, Math.round(shortSide * 0.13)) : 72);
  state.cellPx = Math.round(Math.max(14, Math.min(cap, ideal)) * state.zoom);
}

// ── Züge ─────────────────────────────────────────────────────────────────────
const me = () => state.coop.myId || LOCAL_PLAYER_ID;
const isMultiplayer = () => state.coop.active || state.team.active;
let ctxCache = null;   // { p, clues, walls, K } — je Rätsel einmal
function rules() {
  const p = state.puzzle;
  if (!ctxCache || ctxCache.p !== p) ctxCache = { p, clues: clueMap(p), walls: wallSet(p), K: lastClue(p) };
  return ctxCache;
}
function playable() {
  return state.puzzle && state.status === 'playing' && !state.generating && !state.paused && !state.sessionReadonly
    && !(state.isTrainingGame && !state.trainingDone);
}

/** Neue Linie übernehmen (lokal). Gibt true zurück, wenn sich etwas geändert hat. */
function setPath(path, by) {
  if (path.length === state.path.length && path.every((x, i) => x === state.path[i])) return false;
  const reachedBefore = reachedClue(state.puzzle, state.path, rules().clues);
  state.path = path;
  state.pathBy = by;
  const reachedNow = reachedClue(state.puzzle, path, rules().clues);
  if (reachedNow > reachedBefore && state.settings.sfxComplete) Music.sfxComplete(1);
  afterMove();
  return true;
}
function extend(cell) {
  if (!canStep(state.puzzle, state.path, cell, rules())) return false;
  setPath(state.path.concat(cell), state.pathBy.concat(me()));
  return true;
}
function truncate(idx) {
  setPath(state.path.slice(0, idx + 1), state.pathBy.slice(0, idx + 1));
}
// Die Linie an die Mitspieler senden (beim Loslassen, nicht pro Zelle).
function sendPath() {
  if (!isMultiplayer()) return;
  const key = coopSend({ type: Coop.MSG.MOVE, op: 'path', path: state.path.slice(), by: state.pathBy.map((x) => x || ''), from: state.coop.myId });
  if (key) state.pathKey = key;
}

// Testhaken + Training: Zellen der Reihe nach anhängen (ohne Gesten).
export function drawCells(cells, { force = false } = {}) {
  if (!force && !playable()) return 0;
  let n = 0;
  for (const c of cells) { if (!extend(c)) break; n++; }
  sendPath();
  return n;
}

// ── Ziehen ───────────────────────────────────────────────────────────────────
let drag = null;            // { id, box }
let pan = null;
const pointers = new Map();

function cellAt(box, x, y) {
  const p = state.puzzle;
  return Math.min(p.rows - 1, Math.max(0, Math.floor((y - box.top) / (box.height / p.rows)))) * p.cols
    + Math.min(p.cols - 1, Math.max(0, Math.floor((x - box.left) / (box.width / p.cols))));
}
// Bei einer schnellen Bewegung Zelle für Zelle Richtung Finger gehen.
function stepToward(target) {
  const p = state.puzzle;
  for (let guard = 0; guard < p.rows + p.cols; guard++) {
    const end = state.path[state.path.length - 1];
    if (end === target) return;
    const [er, ec] = rcOf(p, end), [tr, tc] = rcOf(p, target);
    const dr = Math.sign(tr - er), dc = Math.sign(tc - ec);
    const tries = Math.abs(tr - er) >= Math.abs(tc - ec)
      ? [dr ? end + dr * p.cols : -1, dc ? end + dc : -1]
      : [dc ? end + dc : -1, dr ? end + dr * p.cols : -1];
    if (!tries.some((c) => c >= 0 && extend(c))) return;
  }
}

function onDown(e) {
  if (e.button != null && e.button > 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size >= 2) {
    drag = null;
    const pts = [...pointers.values()];
    pan = { mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
    return;
  }
  if (!playable()) return;
  const box = e.currentTarget.getBoundingClientRect();
  const cell = cellAt(box, e.clientX, e.clientY);
  const idx = state.path.indexOf(cell);
  if (idx >= 0) truncate(idx);
  else if (!state.path.length) { if (!extend(cell)) return; }
  else if (!extend(cell)) return;
  drag = { id: e.pointerId, box };
}

function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pan && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
    const wrap = e.currentTarget.closest('.board-wrap');
    if (wrap) { wrap.scrollLeft -= mx - pan.mx; wrap.scrollTop -= my - pan.my; }
    pan.mx = mx; pan.my = my;
    return;
  }
  if (!drag || e.pointerId !== drag.id || !playable()) return;
  const cell = cellAt(drag.box, e.clientX, e.clientY);
  const end = state.path[state.path.length - 1];
  if (cell === end) return;
  const idx = state.path.indexOf(cell);
  if (idx >= 0) { truncate(idx); return; }   // zurückgezogen: Linie kürzen
  stepToward(cell);
}

function onUp(e) {
  pointers.delete(e.pointerId);
  if (pan) { if (pointers.size < 2) pan = null; return; }
  if (!drag || e.pointerId !== drag.id) return;
  drag = null;
  sendPath();
}
function onCancel(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pan = null;
  if (drag && e.pointerId === drag.id) { drag = null; sendPath(); }
}

// ── Darstellung ──────────────────────────────────────────────────────────────
const pct = (v, n) => `${(v / n) * 100}%`;

let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }
const countRender = () => { boardRenderCount++; return ''; };

// Wände — hängen nur am Rätsel.
const WallLayer = {
  setup() {
    const wallStyle = (w) => {
      const p = state.puzzle;
      return w.d === 'r'
        ? { left: pct(w.c + 1, p.cols), top: pct(w.r, p.rows), height: pct(1, p.rows) }
        : { left: pct(w.c, p.cols), top: pct(w.r + 1, p.rows), width: pct(1, p.cols) };
    };
    return { state, wallStyle };
  },
  template: `
            <div class="np-walls" aria-hidden="true">
              <i v-for="(w, i) in (state.puzzle.walls || [])" :key="i" class="np-wall" :class="w.d === 'r' ? 'v' : 'h'" :style="wallStyle(w)"></i>
            </div>`,
};
// Die Linie: belegte Zellen leicht getönt + dicke, runde Linie durch die Mitten.
const PathLayer = {
  setup() {
    const pts = computed(() => {
      const p = state.puzzle;
      return state.path.map((id) => { const [r, c] = rcOf(p, id); return `${c + 0.5},${r + 0.5}`; }).join(' ');
    });
    const cells = computed(() => state.path.map((id) => rcOf(state.puzzle, id)));
    const head = computed(() => (state.path.length ? rcOf(state.puzzle, state.path[state.path.length - 1]) : null));
    return { state, pts, cells, head, countRender };
  },
  template: `
            <svg class="np-path" :viewBox="'0 0 ' + state.puzzle.cols + ' ' + state.puzzle.rows" preserveAspectRatio="none" aria-hidden="true" :data-rc="countRender()">
              <rect v-for="(rc, i) in cells" :key="'v'+rc[0]+'-'+rc[1]" class="np-visited" :x="rc[1]" :y="rc[0]" width="1" height="1"></rect>
              <polyline v-if="state.path.length > 1" class="np-line" :points="pts"></polyline>
              <circle v-if="head" class="np-head" :cx="head[1] + 0.5" :cy="head[0] + 0.5" r="0.27"></circle>
            </svg>`,
};
// Zahlen: erreichte leuchten in der Linienfarbe.
const ClueLayer = {
  setup() {
    const reached = computed(() => reachedClue(state.puzzle, state.path, rules().clues));
    const clueStyle = (k) => { const p = state.puzzle; return { left: pct(k.c, p.cols), top: pct(k.r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows) }; };
    return { state, reached, clueStyle };
  },
  template: `
            <div class="np-clues" aria-hidden="true">
              <span v-for="k in state.puzzle.clues" :key="k.n" class="np-clue" :class="{ on: k.n <= reached, next: k.n === reached + 1 }" :style="clueStyle(k)"><b>{{ k.n }}</b></span>
            </div>`,
};
// Training: die Zelle, in die der nächste Schritt führt.
const FocusLayer = {
  setup() {
    const cell = computed(() => (state.isTrainingGame && state.trainingStep ? rcOf(state.puzzle, state.trainingStep.cell) : null));
    const style = (rc) => { const p = state.puzzle; return { left: pct(rc[1], p.cols), top: pct(rc[0], p.rows), width: pct(1, p.cols), height: pct(1, p.rows) }; };
    return { cell, style };
  },
  template: `<div class="np-focus" aria-hidden="true"><div v-if="cell" class="np-train" :style="style(cell)"></div></div>`,
};

export const BoardGrid = {
  components: { WallLayer, PathLayer, ClueLayer, FocusLayer },
  setup() {
    const t0 = performance.now();
    onMounted(() => log('perf', 'Brett aufgebaut', { game: 'numberpath', cells: state.puzzle ? state.puzzle.rows * state.puzzle.cols : 0, tookMs: Math.round(performance.now() - t0) }));
    onBeforeUnmount(() => { drag = null; pan = null; pointers.clear(); });
    return { state, gridStyle, boardFontClass, onDown, onMove, onUp, onCancel, t };
  },
  template: `
          <div class="board np-board" :class="[boardFontClass(), { done: state.status === 'won' }]" :style="gridStyle"
               role="application" :aria-label="t('np.boardLabel')"
               @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture="onCancel"
               @contextmenu.prevent>
            <path-layer></path-layer>
            <wall-layer></wall-layer>
            <focus-layer></focus-layer>
            <clue-layer></clue-layer>
          </div>
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — dieselben Namen wie in games/numbersums/board.js.
// ═════════════════════════════════════════════════════════════════════════════

export function normalizePuzzle(p) { return healPuzzle(p); }

export function loadBoard(puzzle, saved) {
  const path = normalizePath(saved && saved.path);
  // Ein gespeicherter Stand wird Schritt für Schritt nachgeprüft — eine
  // kaputte Linie endet an der ersten ungültigen Stelle, statt das Brett zu sperren.
  const ok = [];
  const ctx = { clues: clueMap(puzzle), walls: wallSet(puzzle), K: lastClue(puzzle) };
  for (const id of path) { if (!canStep(puzzle, ok, id, ctx)) break; ok.push(id); }
  state.path = ok;
  const by = saved && Array.isArray(saved.pathBy) ? saved.pathBy : [];
  state.pathBy = ok.map((_, i) => by[i] || LOCAL_PLAYER_ID);
  state.pathKey = null;
  drag = null; pan = null; pointers.clear();
  ctxCache = null;
}

export function boardFields(purpose) {
  if (purpose === 'history') return { path: state.path.slice() };
  return { path: state.path.slice(), pathBy: state.pathBy.map((x) => x || '') };
}
export function boardFieldsFrom(src) { return { path: src.path, pathBy: src.pathBy }; }

export function boardSolved() { return !!state.puzzle && isSolved(state.puzzle, state.path); }
export function boardProgressPct() { return state.puzzle ? progressPct(state.puzzle, state.path) : 0; }
export function boardFilledCount() { return state.path.length; }
export function boardProgressCounts() {
  const p = state.puzzle;
  return p ? { kept: state.path.length, total: p.rows * p.cols } : { kept: 0, total: 0 };
}
// „Richtig" = Zellen dieses Spielers, die an ihrer Stelle der Lösung liegen.
export function playerCorrect(id) {
  const sol = state.puzzle.solution;
  let n = 0;
  state.path.forEach((cell, i) => {
    const by = state.pathBy[i];
    const mine = by === id || (by === LOCAL_PLAYER_ID && id === state.coop.myId);
    if (mine && sol[i] === cell) n++;
  });
  return n;
}
export function wrongCells() { return []; }

// Mitspieler: die ganze Linie. Gleichzeitig gezogen? Die spätere gewinnt.
export function applyRemoteMove(msg, eventKey = null) {
  if (!state.puzzle || msg.op !== 'path') return;
  if (state.pathKey && eventKey && eventKey < state.pathKey) { log('coop', 'Number Path: ältere Linie verworfen (die spätere gewinnt)'); return; }
  const path = normalizePath(msg.path);
  const by = Array.isArray(msg.by) ? msg.by : [];
  state.pathKey = eventKey || state.pathKey;
  // Nachprüfen wie beim Laden.
  const ok = [];
  for (const id of path) { if (!canStep(state.puzzle, ok, id, rules())) break; ok.push(id); }
  state.path = ok;
  state.pathBy = ok.map((_, i) => by[i] || msg.from || '');
  afterMove();
}
export function applyRemoteHint() {}
export function undoLast() { return false; }

// Tipps gibt es nicht (wie Rectangles).
export function buildHint() { return null; }
export function applyHintEffect() {}
export function clearStaleTutor() {}

// ── Training: der nächste erzwungene Schritt ab der Linie ──
export function isFullyTier1Solvable(p) { return solveEdges(p, { maxTier: 1 }).solved; }
export function trainingStep() {
  if (!state.puzzle) return null;
  const s = nextEdgeStep(state.puzzle, state.path, { maxTier: 2 });
  if (!s) return null;
  const n = rules().clues.get(s.cell) || 0;
  return { cell: s.cell, reason: s.reason, n };
}
export function applyTrainingStep(step) { if (step) drawCells([step.cell], { force: true }); }
export function trainingText(step) {
  return { title: t('np.train.title'), body: t('np.train.' + step.reason, { n: step.n }) };
}
export function onPlayerColorsChanged() {}
export function resetCellStyleCache() {}

// ── Verlauf: das gelöste Endbrett ──
export function historyExtras() { return {}; }
function historyStyle(p) {
  const avail = Math.min(window.innerWidth - 80, 380);
  const cell = Math.max(16, Math.min(40, Math.floor(avail / p.cols)));
  return { width: p.cols * cell + 'px', height: p.rows * cell + 'px', '--cell': cell + 'px', '--cols': p.cols, '--rows': p.rows, '--fs': Math.max(9, Math.round(cell * 0.42)) + 'px', '--lh': 222 };
}
export const HistoryBoard = {
  props: ['detail'],
  setup() {
    const pts = (p) => p.solution.map((id) => `${(id % p.cols) + 0.5},${Math.floor(id / p.cols) + 0.5}`).join(' ');
    const wallStyle = (p, w) => (w.d === 'r'
      ? { left: pct(w.c + 1, p.cols), top: pct(w.r, p.rows), height: pct(1, p.rows) }
      : { left: pct(w.c, p.cols), top: pct(w.r + 1, p.rows), width: pct(1, p.cols) });
    const clueStyle = (p, k) => ({ left: pct(k.c, p.cols), top: pct(k.r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows) });
    return { historyStyle, pts, wallStyle, clueStyle };
  },
  template: `
          <div class="board np-board history-board" :style="historyStyle(detail.puzzle)">
            <svg class="np-path" :viewBox="'0 0 ' + detail.puzzle.cols + ' ' + detail.puzzle.rows" preserveAspectRatio="none"><polyline class="np-line" :points="pts(detail.puzzle)"></polyline></svg>
            <div class="np-walls"><i v-for="(w, i) in (detail.puzzle.walls || [])" :key="i" class="np-wall" :class="w.d === 'r' ? 'v' : 'h'" :style="wallStyle(detail.puzzle, w)"></i></div>
            <div class="np-clues"><span v-for="k in detail.puzzle.clues" :key="k.n" class="np-clue on" :style="clueStyle(detail.puzzle, k)"><b>{{ k.n }}</b></span></div>
          </div>
  `,
};

// ── Test-Haken (nur localhost, s. window.__cns in app.js) ──
export function testHooks() {
  return {
    drawCells: (cells) => drawCells(cells),
    solvePath: () => {
      const sol = state.puzzle.solution;
      const start = state.path.length && state.path.every((x, i) => x === sol[i]) ? state.path.length : 0;
      if (start === 0 && state.path.length) truncate(-1);
      return drawCells(sol.slice(start));
    },
  };
}
