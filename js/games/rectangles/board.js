// games/rectangles/board.js — das BRETT von „Rectangles" (Shikaku):
// Darstellung, Ziehen der Rechtecke, Züge, und am Dateiende dieselbe
// Brett-Schnittstelle wie Number Sums und Math Cross.
//
// Bedienung:
//   • Auf einer Zelle aufsetzen und ziehen spannt ein Rechteck auf. Während des
//     Ziehens folgt es dem Finger FREI (auch über Zellgrenzen und leicht über
//     den Rand hinaus), erst beim Loslassen rastet es auf die Zellen ein.
//   • Kurz auf ein Rechteck tippen entfernt es. Ein neues Rechteck über
//     bestehende ersetzt die überdeckten. (Bewusst KEIN Rückgängig-Knopf, keine
//     Erklärleiste und keine Tipps — Nutzerwunsch: unnötig.)
//   • Zieht man ein neues Rechteck in ein bestehendes hinein, spürt man eine
//     sanfte BARRIERE: die Vorschau bleibt an dessen Kante hängen und gibt nur
//     gummiartig nach, das Rechteck leuchtet kurz auf. Erst wer deutlich weiter
//     drückt (BREAK), bricht mit einem kleinen Federn und kurzem Vibrieren
//     durch — dann wird es beim Loslassen ersetzt (es wird dafür blass).
//     Loslassen vorher legt nur das Rechteck bis zur Kante. Ein Merker, kein
//     Verbot: Überschreiben bleibt möglich, nur mit einem Ruck mehr. Das
//     Rechteck, in dem man das Ziehen beginnt, ist ausgenommen.
//   • Zwei Finger verschieben ein gezoomtes Brett.
// Fehler: beim Zeichnen nie. Erst wenn jede Zelle bedeckt ist und es nicht
// aufgeht, kostet das ein Leben (rote Kontur + Wackeln).
//
// RENDER-PERFORMANCE: Das Brett hat KEINE Zell-Elemente. Gitterlinien sind ein
// Hintergrund, Zahlen und Rechtecke liegen als zwei Ebenen darüber, prozentual
// positioniert (unabhängig von der Zellgröße). Ein Zug zeichnet nur die
// Rechteck-Ebene neu. Die Zieh-Vorschau wird DIREKT am DOM bewegt (kein
// reaktiver Zustand pro Pointer-Bewegung) — so bleibt sie bei 60 fps flüssig.

import { computed, ref, onMounted, onBeforeUnmount } from '../../vue.esm-browser.prod.js';
import { shopItemById, applyPaletteFx } from '../../shopitems.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import * as Coop from '../../coop.js';
import { log } from '../../debuglog.js';
import { LiveLayer } from '../livelayer.js';
import {
  rectFromCorners, rectsOverlap, sameRect, addRect, rectAt, isFull, isSolved,
  progressPct, coveredCount, normalizePuzzle as healPuzzle, normalizeRects, rectArea, clampToFree,
} from './model.js';
import { solveLogic } from './solver.js';

// ── Von der Schale injizierte Verweise (s. numbersums/board.js) ──────────────
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
let registerMistake = () => {};
let afterMove = () => {};
let coopSend = () => null;
let desktopBoard = () => false;

// Bearbeiten-Sperre (Schale, s. app.js editAllowed): im Coop zeichnet nur, wer die
// Sperre hält; sendLive schickt den laufenden Entwurf an die anderen.
let editAllowed = () => true;
let sendLive = () => {};

export function initBoard(ctx) {
  state = ctx.state;
  LOCAL_PLAYER_ID = ctx.LOCAL_PLAYER_ID;
  playerColor = ctx.playerColor;
  shopEquippedId = ctx.shopEquippedId;
  registerMistake = ctx.registerMistake;
  afterMove = ctx.afterMove;
  coopSend = ctx.coopSend;
  if (ctx.desktopBoard) desktopBoard = ctx.desktopBoard;
  if (ctx.editAllowed) editAllowed = ctx.editAllowed;
  if (ctx.sendLive) sendLive = ctx.sendLive;
}

// Shop-Optik, die es in diesem Spiel (noch) nicht gibt: Skins betreffen
// Markierungs-Ringe, Rahmen würden die prozentual positionierten Ebenen
// verschieben. Leere Werte halten die Schale gesund.
export function boardFontClass() { const id = shopEquippedId('font'); return id && id !== 'classic' ? 'font-' + id : ''; }
export function boardFrameClass() { return ''; }
export const skinUnlocked = computed(() => false);
export const skinPresetOwned = computed(() => false);
export const skinActive = computed(() => false);
export const skinVars = computed(() => ({}));
export const skinBoardClasses = computed(() => []);
export function activePaletteFx() { const it = shopItemById(shopEquippedId('palette')); return it ? it.fx : null; }

// ── Farben ───────────────────────────────────────────────────────────────────
// Zwölf gut unterscheidbare Pastell-Töne; die Helligkeit regelt das CSS je
// Hell-/Dunkelmodus. Eine ausgerüstete Shop-Palette dreht die Töne mit.
const HUES = [4, 28, 48, 88, 140, 168, 192, 212, 236, 266, 296, 330];
export const RECT_COLORS = HUES.length;
const hueOf = computed(() => {
  const fx = activePaletteFx();
  return HUES.map((h) => applyPaletteFx({ h, s: 70, l: 60 }, fx).h);
});
// Neue Rechtecke bekommen eine Farbe, die KEIN angrenzendes Rechteck trägt —
// beim Anlegen festgelegt (und im Coop mitgeschickt), damit sich Farben nie
// nachträglich ändern.
function touches(a, b) {
  const rowsMeet = a.r < b.r + b.h && b.r < a.r + a.h;
  const colsMeet = a.c < b.c + b.w && b.c < a.c + a.w;
  return (rowsMeet && (a.c + a.w === b.c || b.c + b.w === a.c)) || (colsMeet && (a.r + a.h === b.r || b.r + b.h === a.r));
}
function pickColor(q, rects) {
  const near = new Set(rects.filter((x) => touches(x, q)).map((x) => x.col));
  const start = (q.r * 7 + q.c * 3 + q.h * 5 + q.w) % RECT_COLORS;
  for (let i = 0; i < RECT_COLORS; i++) {
    const c = (start + i * 5) % RECT_COLORS;
    if (!near.has(c)) return c;
  }
  return start;
}

// ── Größe ────────────────────────────────────────────────────────────────────
export const gridStyle = computed(() => {
  const p = state.puzzle;
  const cols = p ? p.cols : 1, rows = p ? p.rows : 1;
  return {
    width: cols * state.cellPx + 'px', height: rows * state.cellPx + 'px',
    '--cell': state.cellPx + 'px', '--cols': cols, '--rows': rows,
    '--fs': Math.max(11, Math.round(state.cellPx * 0.5)) + 'px',
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
  const cap = desktopBoard() ? 112 : (shortSide >= 600 ? Math.min(110, Math.round(shortSide * 0.13)) : 64);
  state.cellPx = Math.round(Math.max(12, Math.min(cap, ideal)) * state.zoom);
}

// ── Züge ─────────────────────────────────────────────────────────────────────
let idSeq = 0;
const newId = () => `${(state.coop.myId || LOCAL_PLAYER_ID).slice(-6)}${Date.now().toString(36)}${(idSeq++).toString(36)}`;
const me = () => state.coop.myId || LOCAL_PLAYER_ID;
const isMultiplayer = () => state.coop.active || state.team.active;
const wire = (q) => ({ id: q.id, r: q.r, c: q.c, h: q.h, w: q.w, by: q.by || '', col: q.col | 0 });

function playable() {
  return state.puzzle && state.status === 'playing' && !state.generating && !state.paused && !state.sessionReadonly
    && !(state.isTrainingGame && !state.trainingDone) && editAllowed();
}

// Nach JEDER eigenen Änderung: ist das Brett voll und geht nicht auf, kostet das
// ein Leben (Fehler werden nicht einzeln aufgedeckt — erst das volle Brett zeigt,
// dass etwas nicht stimmt).
function checkFull() {
  const p = state.puzzle;
  const full = isFull(p, state.rects);
  state.rectsFullWrong = full && !isSolved(p, state.rects);
  if (state.rectsFullWrong) {
    log('game', 'Rectangles: Brett voll, geht nicht auf');
    state.rectsShake = true;
    setTimeout(() => { state.rectsShake = false; }, 650);
    registerMistake();
  }
}

/** Ein Rechteck einfügen (Kern-Zug). Gibt das eingefügte Rechteck zurück. */
export function addUserRect(box, { force = false } = {}) {
  if (!force && !playable()) return null;
  if (!state.puzzle || state.status !== 'playing') return null;
  const p = state.puzzle;
  const q = { r: Math.max(0, box.r), c: Math.max(0, box.c), h: box.h, w: box.w };
  q.h = Math.min(q.h, p.rows - q.r); q.w = Math.min(q.w, p.cols - q.c);
  if (q.h < 1 || q.w < 1) return null;
  if (state.rects.some((x) => sameRect(x, q))) return null;
  const rect = { id: newId(), ...q, by: me(), col: pickColor(q, state.rects.filter((x) => !rectsOverlap(x, q))), k: null };
  const { rects } = addRect(state.rects, rect);
  state.rects = rects;
  if (isMultiplayer()) rect.k = coopSend({ type: Coop.MSG.MOVE, op: 'add', rect: wire(rect), from: state.coop.myId }) || null;
  if (state.settings.sfxKeep) Music.sfxKeep();
  checkFull();
  afterMove();
  return rect;
}

/** Ein Rechteck entfernen (Antippen). */
export function removeUserRect(rect) {
  if (!playable() || !rect) return false;
  if (!state.rects.some((x) => x.id === rect.id)) return false;
  state.rects = state.rects.filter((x) => x.id !== rect.id);
  if (isMultiplayer()) coopSend({ type: Coop.MSG.MOVE, op: 'del', id: rect.id, from: state.coop.myId });
  if (state.settings.sfxRemove) Music.sfxRemove();
  state.rectsFullWrong = false;
  afterMove();
  return true;
}


// ── Ziehen ───────────────────────────────────────────────────────────────────
const DRAG_SLOP = 6;        // ab so vielen Pixeln wird aus einem Tipp ein Ziehen
const OVERSHOOT = 0.35;     // so weit (in Zellen) darf die Vorschau über den Rand gehen
const BREAK = 1;            // eine GANZE fremde Zelle muss überzogen sein, bevor es durchbricht (Nutzerwunsch)
const GIVE = 0.24;          // so weit (in Zellen) gibt die Kante höchstens gummiartig nach
let drag = null;            // { id, ar, ac, x0, y0, box, moved, cell, el, pass, q, touch, marks }
let pan = null;             // { ids:Set, mx, my } — zwei Finger verschieben das gezoomte Brett
const pointers = new Map(); // aktive Pointer (für zwei Finger)
let previewEl = null, ghostEl = null, sizeEl = null;

function cellAt(box, x, y) {
  const p = state.puzzle;
  const cw = box.width / p.cols, ch = box.height / p.rows;
  return {
    r: Math.min(p.rows - 1, Math.max(0, Math.floor((y - box.top) / ch))),
    c: Math.min(p.cols - 1, Math.max(0, Math.floor((x - box.left) / cw))),
  };
}

function hidePreview() {
  for (const el of [previewEl, ghostEl, sizeEl]) if (el) el.style.opacity = '0';
}

// Gummiband: nähert sich GIVE·size, ohne es je zu erreichen.
const rubber = (o, size) => size * GIVE * (1 - Math.exp(-o / (size * GIVE * 1.4)));

function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }

// Markiert bestehende Rechtecke direkt am DOM (kein reaktiver Zustand pro
// Pointer-Bewegung): .blocking = man drückt gerade dagegen, .doomed = wird beim
// Loslassen ersetzt. Schreibt nur, wenn sich etwas ändert.
function markRects(d, blocking, doomed) {
  const key = blocking.map((x) => x.id).join(',') + '|' + doomed.map((x) => x.id).join(',');
  if (key === d.marks || !d.el) return;
  d.marks = key;
  const b = new Set(blocking.map((x) => x.id)), m = new Set(doomed.map((x) => x.id));
  for (const el of d.el.querySelectorAll('.rb-rects .rrect')) {
    el.classList.toggle('blocking', b.has(el.dataset.id));
    el.classList.toggle('doomed', m.has(el.dataset.id));
  }
}
function clearMarks(d) { if (d) markRects(d, [], []); }

function showPreview(e) {
  const p = state.puzzle, b = drag.box, d = drag;
  const cw = b.width / p.cols, ch = b.height / p.rows;
  // Freie Form: von der Ankerzelle bis zum Finger, ohne Einrasten.
  const ax0 = d.ac * cw, ay0 = d.ar * ch;
  let px = Math.min(b.width + cw * OVERSHOOT, Math.max(-cw * OVERSHOOT, e.clientX - b.left));
  let py = Math.min(b.height + ch * OVERSHOOT, Math.max(-ch * OVERSHOOT, e.clientY - b.top));
  const cell = cellAt(b, e.clientX, e.clientY);
  d.cell = cell;
  let q = rectFromCorners(d.ar, d.ac, cell.r, cell.c);
  // Barriere: berührt das Ziel ein (noch nicht durchbrochenes) Rechteck?
  let blocking = state.rects.filter((x) => !d.pass.has(x.id) && rectsOverlap(x, q));
  if (blocking.length) {
    const free = clampToFree(state.rects, d.ar, d.ac, cell.r, cell.c, d.pass) || rectFromCorners(d.ar, d.ac, d.ar, d.ac);
    // Wie weit drückt der Finger über die freie Kante hinaus (je Achse)?
    const right = cell.c >= d.ac, down = cell.r >= d.ar;
    const limX = free.w < q.w ? (right ? (free.c + free.w) * cw : free.c * cw) : null;
    const limY = free.h < q.h ? (down ? (free.r + free.h) * ch : free.r * ch) : null;
    const ox = limX == null ? 0 : Math.max(0, right ? px - limX : limX - px);
    const oy = limY == null ? 0 : Math.max(0, down ? py - limY : limY - py);
    if (Math.max(ox / cw, oy / ch) > BREAK) {
      // Durchgebrochen: diese Rechtecke halten nicht mehr auf.
      for (const x of blocking) d.pass.add(x.id);
      blocking = [];
      d.touch = false;
      vibrate(16);
      previewEl.classList.remove('give');
      previewEl.classList.add('give');
      clearTimeout(d.giveT);
      d.giveT = setTimeout(() => { if (previewEl) previewEl.classList.remove('give'); }, 260);
    } else {
      if (!d.touch) { d.touch = true; vibrate(6); }
      q = free;
      if (limX != null) px = limX + (right ? 1 : -1) * rubber(ox, cw);
      if (limY != null) py = limY + (down ? 1 : -1) * rubber(oy, ch);
    }
  } else d.touch = false;
  d.q = q;
  markRects(d, blocking, state.rects.filter((x) => rectsOverlap(x, q)));
  const x0 = Math.min(ax0, px), x1 = Math.max(ax0 + cw, px);
  const y0 = Math.min(ay0, py), y1 = Math.max(ay0 + ch, py);
  previewEl.style.transform = `translate(${x0}px, ${y0}px)`;
  previewEl.style.width = (x1 - x0) + 'px';
  previewEl.style.height = (y1 - y0) + 'px';
  previewEl.style.opacity = '1';
  previewEl.classList.toggle('held', d.touch);
  sendLive({ box: { r: q.r, c: q.c, h: q.h, w: q.w } });
  // Eingerastetes Ziel als zarter Schatten + Größen-Blase am Finger.
  ghostEl.style.transform = `translate(${q.c * cw}px, ${q.r * ch}px)`;
  ghostEl.style.width = q.w * cw + 'px';
  ghostEl.style.height = q.h * ch + 'px';
  ghostEl.style.opacity = '1';
  sizeEl.textContent = String(rectArea(q));
  sizeEl.style.transform = `translate(${Math.min(b.width - 10, Math.max(10, px))}px, ${Math.max(0, py) }px)`;
  sizeEl.style.opacity = '1';
}

function onDown(e) {
  if (e.button != null && e.button > 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size >= 2) {
    // Zweiter Finger: Ziehen abbrechen, stattdessen das Brett verschieben.
    clearMarks(drag); drag = null; hidePreview();
    const pts = [...pointers.values()];
    pan = { mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
    return;
  }
  if (!playable()) return;
  const box = e.currentTarget.getBoundingClientRect();
  const cell = cellAt(box, e.clientX, e.clientY);
  // Das Rechteck, in dem man aufsetzt, will man neu ziehen — es hält nicht auf.
  const own = rectAt(state.rects, cell.r, cell.c);
  drag = {
    id: e.pointerId, ar: cell.r, ac: cell.c, x0: e.clientX, y0: e.clientY, box, moved: false, cell,
    el: e.currentTarget, pass: new Set(own ? [own.id] : []), q: null, touch: false, marks: '',
  };
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
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_SLOP) return;
  drag.moved = true;
  showPreview(e);
}

function onUp(e) {
  pointers.delete(e.pointerId);
  if (pan) { if (pointers.size < 2) pan = null; return; }
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  // Letzte Position auswerten (Barriere/Durchbruch), dann loslassen.
  if (d.moved) showPreview(e);
  drag = null;
  sendLive(null);
  clearMarks(d);
  previewEl.classList.remove('held');
  if (!d.moved) {
    // Tipp: ein Rechteck darunter entfernen.
    hidePreview();
    const hit = rectAt(state.rects, d.ar, d.ac);
    if (hit) removeUserRect(hit);
    return;
  }
  const q = d.q;
  if (d.pass.size > (rectAt(state.rects, d.ar, d.ac) ? 1 : 0)) log('game', 'Rechteck-Barriere durchbrochen', { n: d.pass.size });
  // Die Vorschau rastet sichtbar auf ihr Ziel ein und blendet dann aus.
  const p = state.puzzle, cw = d.box.width / p.cols, ch = d.box.height / p.rows;
  previewEl.classList.add('snap');
  previewEl.style.transform = `translate(${q.c * cw}px, ${q.r * ch}px)`;
  previewEl.style.width = q.w * cw + 'px';
  previewEl.style.height = q.h * ch + 'px';
  ghostEl.style.opacity = '0'; sizeEl.style.opacity = '0';
  setTimeout(() => { if (previewEl && !drag) { previewEl.style.opacity = '0'; previewEl.classList.remove('snap'); } }, 140);
  // Zurück auf die Ankerzelle gezogen = abgebrochen (eine „1" gibt es nicht).
  if (q.h * q.w < 2) return;
  addUserRect(q);
}

function onCancel(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pan = null;
  if (drag && e.pointerId === drag.id) { clearMarks(drag); drag = null; hidePreview(); sendLive(null); }
}
/** Die Sperre wechselt mitten im Ziehen (abgegeben): Entwurf verwerfen. */
export function cancelLiveGesture() { if (drag) { clearMarks(drag); drag = null; hidePreview(); } }

// ── Darstellung ──────────────────────────────────────────────────────────────
const pct = (v, n) => `${(v / n) * 100}%`;
export function rectStyle(q) {
  const p = state.puzzle;
  const st = {
    left: pct(q.c, p.cols), top: pct(q.r, p.rows), width: pct(q.w, p.cols), height: pct(q.h, p.rows),
    '--rh': hueOf.value[(q.col | 0) % RECT_COLORS],
  };
  // Im Coop: Rand in der Farbe des Spielers, der es gezogen hat (eigene behalten
  // ihren normalen Rand — man weiß selbst, was man gezogen hat).
  if (isMultiplayer() && q.by && q.by !== me() && q.by !== LOCAL_PLAYER_ID) {
    const col = playerColor(q.by);
    if (col) st['--rb'] = col;
  }
  return st;
}
export function clueStyle(k) {
  const p = state.puzzle;
  return { left: pct(k.c, p.cols), top: pct(k.r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows) };
}

let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }
const countRender = () => { boardRenderCount++; return ''; };

// Die Zahlen hängen nur am Rätsel: eigene Komponente, rendert nie bei einem Zug.
const ClueLayer = {
  setup() { return { state, clueStyle }; },
  template: `
            <div class="rb-clues" aria-hidden="true">
              <span v-for="(k, i) in state.puzzle.clues" :key="i" class="rclue" :style="clueStyle(k)">{{ k.n }}</span>
            </div>`,
};
// Hervorhebung im Training: das Rechteck, das der nächste Schritt legt. Eigene
// Ebene, damit ein Trainingsschritt nicht die Rechtecke neu zeichnet.
const FocusLayer = {
  setup() {
    const trainRect = computed(() => (state.isTrainingGame && state.trainingStep ? state.trainingStep.rect : null));
    return { trainRect, rectStyle };
  },
  template: `
            <div class="rb-focus" aria-hidden="true">
              <div v-if="trainRect" class="rtrain" :style="rectStyle({ ...trainRect, col: 0 })"></div>
            </div>`,
};
// Die gezogenen Rechtecke: rendert bei jedem Zug (wenige Elemente).
const RectLayer = {
  setup() { return { state, rectStyle, countRender }; },
  template: `
            <div class="rb-rects" :data-rc="countRender()">
              <div v-for="q in state.rects" :key="q.id" :data-id="q.id" class="rrect" :class="{ mine: q.by === state.coop.myId || q.by === 'local' }" :style="rectStyle(q)"></div>
            </div>`,
};

export const BoardGrid = {
  components: { ClueLayer, RectLayer, FocusLayer, LiveLayer },
  setup() {
    const preview = ref(null), ghost = ref(null), size = ref(null);
    const t0 = performance.now();
    onMounted(() => {
      previewEl = preview.value; ghostEl = ghost.value; sizeEl = size.value;
      log('perf', 'Brett aufgebaut', { game: 'rectangles', cells: state.puzzle ? state.puzzle.rows * state.puzzle.cols : 0, tookMs: Math.round(performance.now() - t0) });
    });
    onBeforeUnmount(() => { drag = null; pan = null; pointers.clear(); });
    return { state, gridStyle, boardFontClass, preview, ghost, size, onDown, onMove, onUp, onCancel, t };
  },
  template: `
          <div class="board rect-board" :class="[boardFontClass(), { 'full-wrong': state.rectsFullWrong, shake: state.rectsShake}]" :style="gridStyle"
               role="application" :aria-label="t('rect.boardLabel')"
               @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture="onCancel"
               @contextmenu.prevent>
            <rect-layer></rect-layer>
            <focus-layer></focus-layer>
            <live-layer></live-layer>
            <clue-layer></clue-layer>
            <div ref="ghost" class="rb-ghost"></div>
            <div ref="preview" class="rb-preview"></div>
            <div ref="size" class="rb-size"></div>
          </div>
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — dieselben Namen wie in games/numbersums/board.js.
// ═════════════════════════════════════════════════════════════════════════════

export function normalizePuzzle(p) { return healPuzzle(p); }

export function loadBoard(puzzle, saved) {
  state.rects = normalizeRects(saved && saved.rects).map((q) => ({
    id: q.id || newId(), r: q.r, c: q.c, h: q.h, w: q.w, by: q.by || LOCAL_PLAYER_ID, col: q.col | 0, k: q.k || null,
  }));
  drag = null; pan = null; pointers.clear();
  state.rectsFullWrong = false;
  state.rectsShake = false;
}

export function boardFields(purpose) {
  if (purpose === 'history') return { rects: state.rects.map(wire) };
  return { rects: state.rects.map((q) => ({ ...wire(q), ...(q.k ? { k: q.k } : {}) })) };
}
export function boardFieldsFrom(src) { return { rects: src.rects }; }

export function boardSolved() { return !!state.puzzle && isSolved(state.puzzle, state.rects); }
export function boardProgressPct() { return state.puzzle ? progressPct(state.puzzle, state.rects) : 0; }
export function boardFilledCount() { return state.puzzle ? coveredCount(state.puzzle, state.rects) : 0; }
export function boardProgressCounts() {
  const p = state.puzzle;
  return p ? { kept: coveredCount(p, state.rects), total: p.rows * p.cols } : { kept: 0, total: 0 };
}
// „Richtig" = Zellen in Rechtecken dieses Spielers, die genau einem Lösungs-Rechteck entsprechen.
export function playerCorrect(id) {
  const p = state.puzzle;
  let n = 0;
  for (const q of state.rects) {
    const mine = q.by === id || (q.by === LOCAL_PLAYER_ID && id === state.coop.myId);
    if (mine && p.solution.some((s) => sameRect(s, q))) n += rectArea(q);
  }
  return n;
}
// „Prüfen" gibt es nicht — das volle Brett zeigt, ob es aufgeht.
export function wrongCells() { return []; }

// Züge eines Mitspielers. Gleichzeitige, sich überdeckende Rechtecke: das
// SPÄTERE (Ereignis-Schlüssel) gewinnt — beide Seiten landen so auf demselben
// Brett, egal in welcher Reihenfolge die Züge eintreffen.
export function applyRemoteMove(msg, eventKey = null) {
  if (!state.puzzle) return;
  if (msg.op === 'del') {
    const before = state.rects.length;
    state.rects = state.rects.filter((x) => x.id !== msg.id);
    if (state.rects.length !== before) { state.rectsFullWrong = false; afterMove(); }
    return;
  }
  const src = msg.rect;
  if (!src || !Number.isInteger(src.r) || !Number.isInteger(src.c) || !(src.h >= 1) || !(src.w >= 1)) return;
  const key = eventKey || '';
  const rect = { id: src.id || newId(), r: src.r, c: src.c, h: src.h, w: src.w, by: src.by || msg.from || '', col: src.col | 0, k: eventKey };
  const later = state.rects.some((x) => rectsOverlap(x, rect) && (x.k || '') > key);
  if (later) { log('coop', 'Rectangles: gleichzeitiges Rechteck verworfen (das spätere gewinnt)'); return; }
  state.rects = addRect(state.rects.filter((x) => x.id !== rect.id), rect).rects;
  state.rectsFullWrong = false;
  afterMove();
}
export function applyRemoteHint() {}

// Rückgängig gibt es in diesem Spiel nicht (auch keine alten UNDO-Nachrichten).
export function undoLast() { return false; }

// ── Training ─────────────────────────────────────────────────────────────────
// Fragt den Löser, ausgehend von den RICHTIG gezogenen Rechtecken des
// Spielers (falsche zählen nicht — sie würden den Löser in die Irre führen).
// Der nächste erklärbare Zug ist das erste Rechteck, das der Löser festlegt
// und das noch nicht richtig auf dem Brett liegt.
function correctKnown() {
  const p = state.puzzle;
  const out = [];
  p.solution.forEach((s, k) => { if (state.rects.some((q) => sameRect(q, s))) out.push({ k, ...s }); });
  return out;
}
const cellRC = (id) => [Math.floor(id / state.puzzle.cols), id % state.puzzle.cols];
function nextDeduction(maxTier) {
  const p = state.puzzle;
  if (!p) return null;
  const known = correctKnown();
  const placed = new Set(known.map((x) => x.k));
  const res = solveLogic(p, { maxTier, known });
  const idx = res.steps.findIndex((st) => st.kind === 'single' && !placed.has(st.k));
  if (idx < 0) return null;
  const fin = res.steps[idx];
  // Die Schritte DAVOR, die genau diese Zahl betrafen, erklären den Weg dorthin.
  const lead = res.steps.slice(0, idx).filter((st) => st.k === fin.k && st.kind !== 'single').slice(-2);
  return { k: fin.k, rect: p.solution[fin.k], lead, fin };
}

// Tipps gibt es in diesem Spiel nicht (Nutzerwunsch).
export function buildHint() { return null; }
export function applyHintEffect() {}
export function clearStaleTutor() {}

// Training: nur die einfachsten Schlüsse (Tier 1).
export function isFullyTier1Solvable(p) { return solveLogic(p, { maxTier: 1 }).solved; }
export function trainingStep() {
  const d = nextDeduction(1);
  if (!d) return null;
  const k = state.puzzle.clues[d.k];
  return { r: k.r, c: k.c, n: k.n, rect: { ...d.rect }, reason: d.lead.some((st) => st.kind === 'onlyclue') ? 'onlyclue' : 'single' };
}
export function applyTrainingStep(step) { if (step && step.rect) addUserRect(step.rect, { force: true }); }
export function trainingText(step) {
  return { title: t('rect.train.title', { n: step.n }), body: t('rect.train.' + step.reason, { n: step.n }) };
}
export function onPlayerColorsChanged() {}
// Kein Zell-Style-Cache (keine Zell-Elemente).
export function resetCellStyleCache() {}

// ── Verlauf: das gelöste Endbrett ──
export function historyExtras() { return {}; }
function historyStyle(p) {
  const avail = Math.min(window.innerWidth - 80, 380);
  const cell = Math.max(14, Math.min(36, Math.floor(avail / p.cols)));
  return { width: p.cols * cell + 'px', height: p.rows * cell + 'px', '--cell': cell + 'px', '--cols': p.cols, '--rows': p.rows, '--fs': Math.max(9, Math.round(cell * 0.5)) + 'px' };
}
export const HistoryBoard = {
  props: ['detail'],
  setup() {
    const hue = (i) => HUES[(i * 5) % RECT_COLORS];
    return { historyStyle, clueStyle: (p, k) => ({ left: pct(k.c, p.cols), top: pct(k.r, p.rows), width: pct(1, p.cols), height: pct(1, p.rows) }), pct, hue };
  },
  template: `
          <div class="board rect-board history-board" :style="historyStyle(detail.puzzle)">
            <div class="rb-rects">
              <div v-for="(q, i) in detail.puzzle.solution" :key="i" class="rrect"
                   :style="{ left: pct(q.c, detail.puzzle.cols), top: pct(q.r, detail.puzzle.rows), width: pct(q.w, detail.puzzle.cols), height: pct(q.h, detail.puzzle.rows), '--rh': hue(i) }"></div>
            </div>
            <div class="rb-clues"><span v-for="(k, i) in detail.puzzle.clues" :key="i" class="rclue" :style="clueStyle(detail.puzzle, k)">{{ k.n }}</span></div>
          </div>
  `,
};

// ── Test-Haken (nur localhost, s. window.__cns in app.js) ──
export function testHooks() {
  return {
    drawRect: (r0, c0, r1, c1) => addUserRect(rectFromCorners(r0, c0, r1, c1)),
    tapRect: (r, c) => removeUserRect(rectAt(state.rects, r, c)),
    // Erst leeren: auf einem vollen, falschen Brett könnte ein Zwischenstand
    // (Lösungs-Rechteck ersetzt genau die überdeckten) wieder voll und falsch
    // sein und ein weiteres Leben kosten — im CI je nach Rätsel wackelig.
    solveRects: () => { for (const q of state.rects.slice()) removeUserRect(q); for (const q of state.puzzle.solution) addUserRect(q); },
  };
}
