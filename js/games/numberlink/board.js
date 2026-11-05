// games/numberlink/board.js — das BRETT von „Number Link": Darstellung, Ziehen
// der Linien, Züge, und am Dateiende dieselbe Brett-Schnittstelle wie die
// anderen Spiele.
//
// Bedienung (wie man es von „Flow" kennt):
//   • Auf einer Zahl aufsetzen und ziehen: eine Linie in deren Farbe folgt dem
//     Finger Zelle für Zelle (bei schnellen Bewegungen werden übersprungene
//     Zellen aufgefüllt). Aufsetzen auf einer Zahl beginnt ihre Linie neu.
//   • Irgendwo auf einer Linie aufsetzen zieht sie von dort weiter; Zurückziehen
//     kürzt sie.
//   • Über eine fremde Linie ziehen schneidet sie ab — zieht man zurück, ist sie
//     wieder da (bis zum Loslassen). Fremde Zahlen sperren.
//   • Erreicht die Linie die zweite gleiche Zahl, ist das Paar verbunden.
//   • Zwei Finger verschieben ein gezoomtes Brett.
// Fehler gibt es keine (kein Leben wird verbraucht): gelöst ist, wenn alle
// Paare verbunden sind und jede Zelle bedeckt ist. Sind alle verbunden, aber
// Zellen frei, leuchten die freien Zellen auf.
//
// RENDER-PERFORMANCE: Gitter = Hintergrund; die Linien sind EINE SVG-Ebene,
// die Zahlen eine eigene Ebene, die nur an „verbunden ja/nein" hängt. Während
// des Ziehens ändert sich nur, was sich wirklich ändert (Array je Linie).

import { computed, onMounted, onBeforeUnmount } from '../../vue.esm-browser.prod.js';
import { shopItemById, applyPaletteFx } from '../../shopitems.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import { haptic } from '../feedback.js';
import * as Coop from '../../coop.js';
import { log } from '../../debuglog.js';
import { LiveLayer } from '../livelayer.js';
import {
  endMap, endsOf, pairCount, isSolved, progressPct, pathComplete, sanitizeLinks, ownerGrid,
  normalizePuzzle as healPuzzle, normalizeLinks, rcOf, adjacent,
} from './model.js';
import { solveLogic, nextDeduction, pathsFromState } from './solver.js';

// ── Von der Schale injizierte Verweise (s. numbersums/board.js) ──────────────
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
let afterMove = () => {};
let coopSend = () => null;
let desktopBoard = () => false;
let sendLive = () => {};

export function initBoard(ctx) {
  state = ctx.state;
  LOCAL_PLAYER_ID = ctx.LOCAL_PLAYER_ID;
  playerColor = ctx.playerColor;
  shopEquippedId = ctx.shopEquippedId;
  afterMove = ctx.afterMove;
  coopSend = ctx.coopSend;
  if (ctx.desktopBoard) desktopBoard = ctx.desktopBoard;
  if (ctx.sendLive) sendLive = ctx.sendLive;
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

// ── Farben ───────────────────────────────────────────────────────────────────
// Zwölf gut unterscheidbare Töne (Index = puzzle.colors[k-1]); folgen einer
// ausgerüsteten Shop-Palette (reine Farbton-Drehung, s. applyPaletteFx).
export const LINK_COLORS = [
  { h: 4, s: 78, l: 56 }, { h: 212, s: 82, l: 56 }, { h: 46, s: 92, l: 50 }, { h: 140, s: 58, l: 44 },
  { h: 285, s: 62, l: 60 }, { h: 24, s: 92, l: 55 }, { h: 186, s: 72, l: 44 }, { h: 330, s: 76, l: 62 },
  { h: 92, s: 62, l: 48 }, { h: 250, s: 66, l: 64 }, { h: 14, s: 52, l: 40 }, { h: 168, s: 46, l: 66 },
];
export function linkColor(ci, fx = null, alpha = 1) {
  const c = applyPaletteFx(LINK_COLORS[((ci % LINK_COLORS.length) + LINK_COLORS.length) % LINK_COLORS.length], fx);
  return alpha === 1 ? `hsl(${c.h} ${c.s}% ${c.l}%)` : `hsl(${c.h} ${c.s}% ${c.l}% / ${alpha})`;
}
const colorIdx = (p, k) => (p && Array.isArray(p.colors) && Number.isInteger(p.colors[k - 1]) ? p.colors[k - 1] : k - 1);
const pairColors = computed(() => {
  const p = state.puzzle;
  if (!p) return [];
  const fx = activePaletteFx();
  return Array.from({ length: pairCount(p) }, (_, i) => linkColor(colorIdx(p, i + 1), fx));
});

// ── Größe ────────────────────────────────────────────────────────────────────
export const gridStyle = computed(() => {
  const p = state.puzzle;
  const cols = p ? p.cols : 1, rows = p ? p.rows : 1;
  return {
    width: cols * state.cellPx + 'px', height: rows * state.cellPx + 'px',
    '--cell': state.cellPx + 'px', '--cols': cols, '--rows': rows,
    '--fs': Math.max(10, Math.round(state.cellPx * 0.44)) + 'px',
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
  const cap = desktopBoard() ? 104 : (shortSide >= 600 ? Math.min(100, Math.round(shortSide * 0.12)) : 66);
  state.cellPx = Math.round(Math.max(14, Math.min(cap, ideal)) * state.zoom);
}

// ── Regeln je Rätsel (einmal) ────────────────────────────────────────────────
let ctxCache = null;
function rules() {
  const p = state.puzzle;
  if (!ctxCache || ctxCache.p !== p) ctxCache = { p, ends: endMap(p), endsK: endsOf(p), K: pairCount(p), N: p.rows * p.cols };
  return ctxCache;
}
const me = () => state.coop.myId || LOCAL_PLAYER_ID;
const isMultiplayer = () => state.coop.active || state.team.active;
function playable() {
  return state.puzzle && state.status === 'playing' && !state.generating && !state.paused && !state.sessionReadonly
    && !(state.isTrainingGame && !state.trainingDone);
}
const sameArr = (a, b) => a === b || (a.length === b.length && a.every((x, i) => x === b[i]));
const connected = (k, path) => pathComplete(state.puzzle, k, path, rules());

/** Neue Linien übernehmen — nur geänderte Einträge werden ersetzt. */
function commitLinks(next, by = null) {
  const cur = state.links;
  let changed = false;
  const out = cur.slice();
  const outBy = state.linkBy.slice();
  const before = cur.map((path, i) => connected(i + 1, path));
  for (let i = 0; i < next.length; i++) {
    if (!sameArr(cur[i] || [], next[i])) { out[i] = next[i]; changed = true; if (by && next[i].length) outBy[i] = by; }
  }
  if (!changed) return false;
  state.links = out;
  state.linkBy = outBy;
  const nowDone = out.some((path, i) => !before[i] && connected(i + 1, path));
  if (nowDone) { haptic('done'); if (state.settings.sfxComplete) Music.sfxComplete(1); }
  afterMove();
  return true;
}

// ── Ziehen ───────────────────────────────────────────────────────────────────
// drag = { id, box, k, base (Linien beim Aufsetzen), path (die gezogene Linie) }
let drag = null;
let pan = null;
const pointers = new Map();

function cellAt(box, x, y) {
  const p = state.puzzle;
  return Math.min(p.rows - 1, Math.max(0, Math.floor((y - box.top) / (box.height / p.rows)))) * p.cols
    + Math.min(p.cols - 1, Math.max(0, Math.floor((x - box.left) / (box.width / p.cols))));
}

// Linien während des Ziehens: die gezogene Linie + alle anderen aus dem Stand
// beim Aufsetzen, an der ersten von der gezogenen Linie belegten Zelle gekappt
// (zieht man zurück, ist die fremde Linie wieder da).
function draftLinks(d) {
  const used = new Set(d.path);
  return d.base.map((path, i) => {
    if (i === d.k - 1) return d.path;
    const cut = path.findIndex((id) => used.has(id));
    return cut < 0 ? path : path.slice(0, cut);
  });
}

/** Ein Schritt der gezogenen Linie auf `cell` (Nachbar ihres Endes). */
function stepDrag(d, cell) {
  const { ends } = rules();
  const idx = d.path.indexOf(cell);
  if (idx >= 0) { d.path = d.path.slice(0, idx + 1); return true; }          // zurückgezogen
  const end = d.path[d.path.length - 1];
  if (!adjacent(state.puzzle, end, cell)) return false;
  if (d.path.length > 1 && connected(d.k, d.path)) return false;           // fertig verbunden
  const e = ends.get(cell);
  if (e != null && e !== d.k) return false;                                // fremde Zahl sperrt
  d.path = d.path.concat(cell);
  return true;
}
// Bei einer schnellen Bewegung Zelle für Zelle Richtung Finger.
function stepToward(d, target) {
  const p = state.puzzle;
  for (let guard = 0; guard < p.rows + p.cols; guard++) {
    const end = d.path[d.path.length - 1];
    if (end === target) return;
    const [er, ec] = rcOf(p, end), [tr, tc] = rcOf(p, target);
    const dr = Math.sign(tr - er), dc = Math.sign(tc - ec);
    const tries = Math.abs(tr - er) >= Math.abs(tc - ec)
      ? [dr ? end + dr * p.cols : -1, dc ? end + dc : -1]
      : [dc ? end + dc : -1, dr ? end + dr * p.cols : -1];
    if (!tries.some((c) => c >= 0 && stepDrag(d, c))) return;
  }
}

/** Beginnt eine Linie an `cell`? Gibt den Zieh-Zustand zurück oder null. */
function beginAt(cell) {
  const { ends } = rules();
  const base = state.links.map((x) => x.slice());
  const e = ends.get(cell);
  if (e != null) return { k: e, base, path: [cell] };                       // auf einer Zahl: neu beginnen
  for (let i = 0; i < base.length; i++) {
    const idx = base[i].indexOf(cell);
    if (idx >= 0) return { k: i + 1, base, path: base[i].slice(0, idx + 1) };  // auf einer Linie: dort weiter
  }
  return null;
}

function onDown(e) {
  if (e.button != null && e.button > 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size >= 2) {
    if (drag) finishDrag();
    const pts = [...pointers.values()];
    pan = { mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
    return;
  }
  if (!playable()) return;
  const box = e.currentTarget.getBoundingClientRect();
  const cell = cellAt(box, e.clientX, e.clientY);
  const d = beginAt(cell);
  if (!d) return;
  drag = { ...d, id: e.pointerId, box };
  commitLinks(draftLinks(drag));
  sendLive({ path: drag.path.slice(), cur: cell, pc: pairColors.value[drag.k - 1] || '' });
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
  if (cell === drag.path[drag.path.length - 1]) return;
  const before = drag.path;
  if (drag.path.includes(cell)) stepDrag(drag, cell);
  else stepToward(drag, cell);
  if (drag.path === before) return;
  commitLinks(draftLinks(drag));
  sendLive({ path: drag.path.slice(), cur: cell, pc: pairColors.value[drag.k - 1] || '' });
}

// Loslassen: geänderte Linien an die Mitspieler (eine Nachricht).
function finishDrag() {
  const d = drag;
  drag = null;
  if (!d) return;
  const final = draftLinks(d);
  // Eine einzelne Zahl ohne Linie ist keine Linie.
  if (final[d.k - 1].length < 2) final[d.k - 1] = [];
  commitLinks(final, me());
  const set = {};
  final.forEach((path, i) => { if (!sameArr(path, d.base[i])) set[i + 1] = path.length ? path : ''; });
  if (Object.keys(set).length) {
    // Linie abgelegt: Setz-Ton, außer sie ist gerade fertig geworden (dann kam schon der Fertig-Ton).
    if (!connected(d.k, final[d.k - 1])) { haptic('place'); if (state.settings.sfxKeep) Music.sfxKeep(); }
    sendLinks(set);
  }
  sendLive(null);
}
function sendLinks(set) {
  if (!isMultiplayer()) return;
  const key = coopSend({ type: Coop.MSG.MOVE, op: 'links', set, by: me(), from: state.coop.myId });
  if (key) for (const k of Object.keys(set)) state.linkKeys = { ...state.linkKeys, [k]: key };
}

function onUp(e) {
  pointers.delete(e.pointerId);
  if (pan) { if (pointers.size < 2) pan = null; return; }
  if (!drag || e.pointerId !== drag.id) return;
  finishDrag();
}
function onCancel(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pan = null;
  if (drag && e.pointerId === drag.id) finishDrag();
}

// Testhaken + Training: eine Linie direkt setzen (wie gezogen und losgelassen).
export function setLink(k, path, { force = false } = {}) {
  if (!force && !playable()) return false;
  const d = { k, base: state.links.map((x) => x.slice()), path: [] };
  const { endsK } = rules();
  if (!path.length || !endsK[k] || !endsK[k].includes(path[0])) return false;
  d.path = [path[0]];
  for (const c of path.slice(1)) if (!stepDrag(d, c)) break;
  drag = d;
  finishDrag();
  return true;
}

// ── Darstellung ──────────────────────────────────────────────────────────────
const pct = (v, n) => `${(v / n) * 100}%`;
let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }
const countRender = () => { boardRenderCount++; return ''; };

const ptsOf = (p, path) => path.map((id) => `${(id % p.cols) + 0.5},${Math.floor(id / p.cols) + 0.5}`).join(' ');

// Die Linien: belegte Zellen in der Farbe getönt + runde, dicke Linie durch die Mitten.
const LinkLayer = {
  setup() {
    const items = computed(() => {
      const p = state.puzzle;
      return state.links.map((path, i) => ({
        k: i + 1, col: pairColors.value[i], pts: ptsOf(p, path), cells: path.map((id) => rcOf(p, id)), done: connected(i + 1, path),
      })).filter((x) => x.cells.length);
    });
    return { state, items, countRender };
  },
  template: `
            <svg class="nl-links" :viewBox="'0 0 ' + state.puzzle.cols + ' ' + state.puzzle.rows" preserveAspectRatio="none" aria-hidden="true" :data-rc="countRender()">
              <g v-for="x in items" :key="x.k" :class="{ done: x.done }" :style="{ '--lc': x.col }" :data-k="x.k">
                <rect v-for="rc in x.cells" :key="rc[0] + '-' + rc[1]" class="nl-fill" :x="rc[1]" :y="rc[0]" width="1" height="1"></rect>
                <polyline v-if="x.cells.length > 1" class="nl-line" :points="x.pts"></polyline>
              </g>
            </svg>`,
};
// Freie Zellen, sobald alle Paare verbunden sind (dann fehlt nur noch das Füllen).
const GapLayer = {
  setup() {
    const gaps = computed(() => {
      const p = state.puzzle, { K, N } = rules();
      if (state.status !== 'playing') return [];
      for (let k = 1; k <= K; k++) if (!connected(k, state.links[k - 1] || [])) return [];
      const own = ownerGrid(p, state.links);
      const out = [];
      for (let id = 0; id < N; id++) if (!own[id]) { const [r, c] = rcOf(p, id); out.push({ id, style: { left: pct(c, p.cols), top: pct(r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows) } }); }
      return out;
    });
    return { gaps };
  },
  template: `<div class="nl-gaps" aria-hidden="true"><i v-for="g in gaps" :key="g.id" class="nl-gap" :style="g.style"></i></div>`,
};
// Die Zahlen: Kreise in der Farbe des Paares; verbundene Paare leuchten.
const EndLayer = {
  setup() {
    const doneSet = computed(() => {
      const s = new Set();
      state.links.forEach((path, i) => { if (connected(i + 1, path)) s.add(i + 1); });
      return [...s].join(',');
    });
    const ends = computed(() => {
      const p = state.puzzle, done = new Set(doneSet.value.split(',').filter(Boolean).map(Number));
      return p.ends.map((e) => ({
        key: e.r + '-' + e.c, k: e.k, on: done.has(e.k),
        style: { left: pct(e.c, p.cols), top: pct(e.r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows), '--lc': pairColors.value[e.k - 1] },
      }));
    });
    return { ends };
  },
  template: `
            <div class="nl-ends" aria-hidden="true">
              <span v-for="e in ends" :key="e.key" class="nl-end" :class="{ on: e.on }" :style="e.style" :data-k="e.k"><b>{{ e.k }}</b></span>
            </div>`,
};
// Training: die nächste erzwungene Linie, gestrichelt vorgezeichnet.
const FocusLayer = {
  setup() {
    const hint = computed(() => {
      const s = state.isTrainingGame && state.trainingStep;
      if (!s || !Array.isArray(s.path)) return null;
      return { pts: ptsOf(state.puzzle, s.path), col: pairColors.value[s.k - 1] };
    });
    return { state, hint };
  },
  template: `
            <svg v-if="hint" class="nl-focus" :viewBox="'0 0 ' + state.puzzle.cols + ' ' + state.puzzle.rows" preserveAspectRatio="none" aria-hidden="true">
              <polyline class="nl-train" :points="hint.pts" :style="{ '--lc': hint.col }"></polyline>
            </svg>`,
};

export const BoardGrid = {
  components: { LinkLayer, GapLayer, EndLayer, FocusLayer, LiveLayer },
  setup() {
    const t0 = performance.now();
    onMounted(() => log('perf', 'Brett aufgebaut', { game: 'numberlink', cells: state.puzzle ? state.puzzle.rows * state.puzzle.cols : 0, pairs: state.puzzle ? pairCount(state.puzzle) : 0, tookMs: Math.round(performance.now() - t0) }));
    onBeforeUnmount(() => { drag = null; pan = null; pointers.clear(); });
    return { state, gridStyle, boardFontClass, onDown, onMove, onUp, onCancel, t };
  },
  template: `
          <div class="board nl-board" :class="[boardFontClass(), { done: state.status === 'won' }]" :style="gridStyle"
               role="application" :aria-label="t('nl.boardLabel')"
               @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture="onCancel"
               @touchstart.prevent
               @contextmenu.prevent>
            <link-layer></link-layer>
            <gap-layer></gap-layer>
            <focus-layer></focus-layer>
            <live-layer></live-layer>
            <end-layer></end-layer>
          </div>
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — dieselben Namen wie in games/numbersums/board.js.
// ═════════════════════════════════════════════════════════════════════════════

export function normalizePuzzle(p) { return healPuzzle(p); }

export function loadBoard(puzzle, saved) {
  const K = pairCount(puzzle);
  // Gespeicherte Linien werden nachgeprüft — eine kaputte Linie endet an der
  // ersten ungültigen Stelle, statt das Brett zu sperren.
  state.links = sanitizeLinks(puzzle, normalizeLinks(saved && saved.links, K));
  const rawBy = saved && saved.linkBy;
  const by = Array.isArray(rawBy) ? rawBy : rawBy && typeof rawBy === 'object' ? Object.keys(rawBy).reduce((a, x) => { a[+x] = rawBy[x]; return a; }, []) : [];
  state.linkBy = Array.from({ length: K }, (_, i) => (state.links[i].length ? by[i] || LOCAL_PLAYER_ID : ''));
  state.linkKeys = {};
  drag = null; pan = null; pointers.clear();
  ctxCache = null;
}

// RTDB verwirft leere Arrays — leere Linien gehen als '' über die Leitung.
const wireLinks = () => state.links.map((x) => (x.length ? x.slice() : ''));
export function boardFields(purpose) {
  if (purpose === 'history') return { links: wireLinks() };
  return { links: wireLinks(), linkBy: state.linkBy.map((x) => x || '') };
}
export function boardFieldsFrom(src) { return { links: src.links, linkBy: src.linkBy }; }

export function boardSolved() { return !!state.puzzle && isSolved(state.puzzle, state.links); }
export function boardProgressPct() { return state.puzzle ? progressPct(state.puzzle, state.links) : 0; }
export function boardFilledCount() { return state.links.reduce((n, x) => n + x.length, 0); }
export function boardProgressCounts() {
  const p = state.puzzle;
  return p ? { kept: boardFilledCount(), total: p.rows * p.cols } : { kept: 0, total: 0 };
}
// „Richtig" = Zellen der Linien dieses Spielers, die in der Lösung dieselbe Zahl tragen.
export function playerCorrect(id) {
  const sol = state.puzzle.solution;
  let n = 0;
  state.links.forEach((path, i) => {
    const by = state.linkBy[i];
    const mine = by === id || (by === LOCAL_PLAYER_ID && id === state.coop.myId);
    if (mine) for (const c of path) if (sol[c] === i + 1) n++;
  });
  return n;
}
export function wrongCells() { return []; }

// Mitspieler: geänderte Linien. Je Linie gewinnt der spätere Ereignis-
// Schlüssel; überdeckt eine empfangene Linie Zellen einer anderen, wird die
// andere dort gekappt (beide Seiten kommen so zum selben Stand).
export function applyRemoteMove(msg, eventKey = null) {
  if (!state.puzzle || msg.op !== 'links' || !msg.set) return;
  const { K, N } = rules();
  const next = state.links.map((x) => x.slice());
  const by = state.linkBy.slice();
  const keys = { ...state.linkKeys };
  const taken = new Set();
  for (const [kk, raw] of Object.entries(msg.set)) {
    const k = +kk;
    if (!Number.isInteger(k) || k < 1 || k > K) continue;
    if (keys[k] && eventKey && eventKey < keys[k]) { log('coop', 'Number Link: ältere Linie verworfen (die spätere gewinnt)', { k }); continue; }
    const path = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.keys(raw).sort((a, b) => a - b).map((x) => raw[x]) : [];
    const clean = sanitizeLinks(state.puzzle, Array.from({ length: K }, (_, i) => (i === k - 1 ? path.filter((x) => Number.isInteger(x) && x >= 0 && x < N) : [])))[k - 1];
    next[k - 1] = clean;
    by[k - 1] = clean.length ? (msg.by || msg.from || '') : '';
    if (eventKey) keys[k] = eventKey;
    for (const c of clean) taken.add(c);
  }
  for (let i = 0; i < K; i++) {
    if (msg.set[i + 1] !== undefined) continue;
    const cut = next[i].findIndex((c) => taken.has(c));
    if (cut >= 0) next[i] = next[i].slice(0, cut < 2 ? 0 : cut);
  }
  state.linkKeys = keys;
  state.links = sanitizeLinks(state.puzzle, next);
  state.linkBy = by;
  // Wer gerade selbst zieht, zieht auf dem neuen Stand weiter.
  if (drag) drag.base = state.links.map((x) => x.slice());
  afterMove();
}
export function applyRemoteHint() {}
export function undoLast() { return false; }

// Tipps gibt es nicht (wie Number Path).
export function buildHint() { return null; }
export function applyHintEffect() {}
export function clearStaleTutor() {}

// ── Training: die nächste erzwungene Linie ab den richtig gezogenen ──
function correctKnown() {
  const p = state.puzzle, sol = p.solution;
  const count = [];
  for (const k of sol) count[k] = (count[k] || 0) + 1;
  return state.links.map((path, i) => (connected(i + 1, path) && path.length === count[i + 1] && path.every((c) => sol[c] === i + 1) ? path : []));
}
export function isFullyTier1Solvable(p) { return solveLogic(p, { maxTier: 1 }).solved; }
export function trainingStep() {
  if (!state.puzzle) return null;
  const s = nextDeduction(state.puzzle, correctKnown(), { maxTier: 1 });
  return s ? { k: s.k, path: s.path } : null;
}
export function applyTrainingStep(step) { if (step) setLink(step.k, step.path, { force: true }); }
export function trainingText(step) {
  return { title: t('nl.train.title'), body: t('nl.train.body', { n: step.k }) };
}
export function onPlayerColorsChanged() {}
export function resetCellStyleCache() {}

// ── Verlauf: das gelöste Endbrett (die Linien rechnet der Löser nach) ──
export function historyExtras(p) {
  try {
    const res = solveLogic(p, { maxTier: 2, probeBudget: p.rows * p.cols * 4 });
    return { nlPaths: pathsFromState(p, res) };
  } catch (err) {
    log('error', 'Number Link: Verlauf-Linien nicht berechenbar', { err: String(err && err.message || err) });
    return { nlPaths: [] };
  }
}
function historyStyle(p) {
  const avail = Math.min(window.innerWidth - 80, 380);
  const cell = Math.max(14, Math.min(40, Math.floor(avail / p.cols)));
  return { width: p.cols * cell + 'px', height: p.rows * cell + 'px', '--cell': cell + 'px', '--cols': p.cols, '--rows': p.rows, '--fs': Math.max(8, Math.round(cell * 0.44)) + 'px' };
}
export const HistoryBoard = {
  props: ['detail'],
  setup() {
    const fx = activePaletteFx();
    const col = (p, k) => linkColor(colorIdx(p, k), fx);
    const endStyle = (p, e) => ({ left: pct(e.c, p.cols), top: pct(e.r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows), '--lc': col(p, e.k) });
    return { historyStyle, ptsOf, col, endStyle };
  },
  template: `
          <div class="board nl-board history-board" :style="historyStyle(detail.puzzle)">
            <svg class="nl-links" :viewBox="'0 0 ' + detail.puzzle.cols + ' ' + detail.puzzle.rows" preserveAspectRatio="none">
              <g v-for="(path, i) in (detail.nlPaths || [])" :key="i" class="done" :style="{ '--lc': col(detail.puzzle, i + 1) }">
                <polyline class="nl-line" :points="ptsOf(detail.puzzle, path)"></polyline>
              </g>
            </svg>
            <div class="nl-ends"><span v-for="(e, i) in detail.puzzle.ends" :key="i" class="nl-end on" :style="endStyle(detail.puzzle, e)"><b>{{ e.k }}</b></span></div>
          </div>
  `,
};

// ── Test-Haken (nur localhost, s. window.__cns in app.js) ──
export function testHooks() {
  return {
    setLink: (k, path) => setLink(k, path),
    // Alle Linien der Lösung setzen (die Lösung rechnet der Löser nach).
    solveLinks: () => {
      const p = state.puzzle;
      const paths = pathsFromState(p, solveLogic(p, { maxTier: 2, probeBudget: p.rows * p.cols * 4 }));
      paths.forEach((path, i) => setLink(i + 1, path));
      return paths.length;
    },
    solutionPaths: () => {
      const p = state.puzzle;
      return pathsFromState(p, solveLogic(p, { maxTier: 2, probeBudget: p.rows * p.cols * 4 }));
    },
  };
}
