// games/gems/board.js — das BRETT von „Gem Hunt": Darstellung, Tippen und
// Wischen, Züge, und am Dateiende dieselbe Brett-Schnittstelle wie die anderen
// Spiele.
//
// Bedienung:
//   • WERKZEUG unter dem Brett (`GemTools`, state.gemTool), wie Einkreisen/Löschen
//     in Number Sums (Nutzerwunsch statt des früheren Tipp-Zyklus leer → Kreuz →
//     Stein): „Stein" setzt/entfernt per Tippen einen Edelstein, „Kreuz" eine
//     Notiz „hier nicht" (s. tapResult in model.js). Rechtsklick = immer Kreuz.
//   • Mit „Kreuz" setzt WISCHEN Kreuze auf alle leeren Felder unterwegs; beginnt
//     es auf einem Kreuz, radiert es stattdessen. Mit „Stein" zählt nur das Tippen.
//   • Zwei Finger verschieben ein gezoomtes Brett.
//   • Einstellung „Kreuze automatisch" (settings.gemAutoCross): ein gesetzter Stein
//     kreuzt seine ganze Zone (Nachbarn, Zeile, Spalte, Käfig), ein entfernter
//     nimmt NUR die automatisch gesetzten Kreuze zurück (state.gemAuto merkt sich,
//     welche das sind; s. autoCrossChanges in model.js).
// Fehler: beim Setzen nie (Konflikte werden nur rot gezeigt). Erst wenn so viele
// Edelsteine liegen, wie es Zeilen gibt, und es nicht aufgeht, kostet das ein
// Leben (rote Kontur + Wackeln) — wie bei Rectangles.
//
// RENDER-PERFORMANCE: Die Käfige (Farben + dicke Grenzen) sind eine eigene
// Komponente, die nur am Rätsel hängt; ein Zug zeichnet nur die Markierungen
// neu. Beim Wischen wird je Zelle EINMAL geschrieben, gesendet wird erst beim
// Loslassen.

import { computed, onMounted, onBeforeUnmount } from '../../vue.esm-browser.prod.js';
import { shopItemById, applyPaletteFx } from '../../shopitems.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import * as Coop from '../../coop.js';
import { log } from '../../debuglog.js';
import { LiveLayer } from '../livelayer.js';
import {
  EMPTY, CROSS, GEM, gemsOf, conflicts, isFull, isSolved, progressPct, tapResult, autoCrossChanges,
  normalizePuzzle as healPuzzle, normalizeCells, rcOf,
} from './model.js';
import { solveLogic, nextDeduction } from './solver.js';
import { GEM_PALETTE, regionColors } from './colors.js';
export { GEM_PALETTE, regionColors };

// ── Von der Schale injizierte Verweise (s. numbersums/board.js) ──────────────
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
let registerMistake = () => {};
let afterMove = () => {};
let coopSend = () => null;
let desktopBoard = () => false;

// Live-Entwurf (Schale, s. app.js sendLive): im Coop sehen die anderen, was
// man gerade zieht.
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
// Palette + Vergabe je Käfig: colors.js (rein). Eine Shop-Palette dreht die Töne mit.
const regionHsl = computed(() => {
  const p = state.puzzle;
  if (!p) return [];
  const fx = activePaletteFx();
  return regionColors(p).map((ci) => applyPaletteFx(GEM_PALETTE[ci], fx));
});
// CSS-Variablen eines Käfigs: Farbton/Sättigung/Helligkeit getrennt (Stein und
// Kreuz leiten ihre Töne daraus ab).
const hslVars = (c) => (c ? { '--gh': c.h, '--gs': c.s + '%', '--gl': c.l + '%' } : {});

// ── Größe ────────────────────────────────────────────────────────────────────
export const gridStyle = computed(() => {
  const p = state.puzzle;
  const n = p ? p.rows : 1;
  return {
    width: n * state.cellPx + 'px', height: n * state.cellPx + 'px',
    '--cell': state.cellPx + 'px', '--cols': n, '--rows': n,
  };
});
export function fitBoard() {
  if (!state.puzzle) return;
  const n = state.puzzle.rows;
  const wrap = document.querySelector('.board-wrap');
  let availW, availH;
  if (wrap && wrap.clientWidth && wrap.clientHeight) { availW = wrap.clientWidth - 12; availH = wrap.clientHeight - 12; }
  else { availW = Math.min(window.innerWidth - 44, 496); availH = window.innerHeight - 220; }
  const ideal = Math.min(Math.floor(availW / n), Math.floor(availH / n));
  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const cap = desktopBoard() ? 112 : (shortSide >= 600 ? Math.min(110, Math.round(shortSide * 0.13)) : 72);
  state.cellPx = Math.round(Math.max(18, Math.min(cap, ideal)) * state.zoom);
}

// ── Züge ─────────────────────────────────────────────────────────────────────
const me = () => state.coop.myId || LOCAL_PLAYER_ID;
const isMultiplayer = () => state.coop.active || state.team.active;
function playable() {
  return state.puzzle && state.status === 'playing' && !state.generating && !state.paused && !state.sessionReadonly
    && !(state.isTrainingGame && !state.trainingDone);
}

// Erst ein VOLLES Brett (so viele Steine wie Zeilen), das nicht aufgeht, kostet
// ein Leben — einzelne Konflikte zeigt nur die rote Markierung.
function checkFull() {
  const p = state.puzzle;
  state.gemsFullWrong = isFull(p, state.gemCells) && !isSolved(p, state.gemCells);
  if (state.gemsFullWrong) {
    state.gemsShake = true;
    setTimeout(() => { state.gemsShake = false; }, 650);
    log('game', 'Gem Hunt: volles Brett geht nicht auf');
    registerMistake();
  }
}

/**
 * Felder setzen (eigener Zug). `changes` = [[zelle, wert], …]. Sendet im Coop
 * EINE Nachricht für alle Felder. Gibt die Zahl der geänderten Felder zurück.
 */
export function setCells(changes, { force = false, send = true, auto = null } = {}) {
  if (!force && !playable()) return 0;
  const cells = state.gemCells.slice(), by = state.gemBy.slice(), autoArr = state.gemAuto.slice();
  const done = [];
  let gemAdded = false, gemRemoved = false;
  for (const [i, v] of changes) {
    if (!(i >= 0 && i < cells.length) || cells[i] === v) continue;
    if (cells[i] === GEM) gemRemoved = true;
    if (v === GEM) gemAdded = true;
    cells[i] = v;
    by[i] = v === GEM ? me() : '';
    autoArr[i] = !!(auto && v === CROSS && auto.has(i));
    done.push([i, v]);
  }
  if (!done.length) return 0;
  state.gemCells = cells;
  state.gemBy = by;
  state.gemAuto = autoArr;
  if (gemRemoved) state.gemsFullWrong = false;
  if (send) sendCells(done);
  if (gemAdded && state.settings.sfxKeep) Music.sfxKeep();
  else if (gemRemoved && state.settings.sfxRemove) Music.sfxRemove();
  if (gemAdded) checkFull();
  afterMove();
  return done.length;
}
function sendCells(list) {
  if (!isMultiplayer() || !list.length) return;
  const key = coopSend({ type: Coop.MSG.MOVE, op: 'cells', list: list.map(([i, v]) => [i, v]), from: state.coop.myId });
  if (key) { const keys = { ...state.gemKeys }; for (const [i] of list) keys[i] = key; state.gemKeys = keys; }
}
const tool = () => (state.gemTool === 'cross' ? 'cross' : 'gem');
// Ein Tipp auf Feld i mit Werkzeug `tl` — inklusive Auto-Kreuze, wenn eingestellt.
function tapCell(i, tl) {
  const old = state.gemCells[i], v = tapResult(old, tl);
  const changes = [[i, v]];
  let auto = null;
  if (state.settings.gemAutoCross && (v === GEM || old === GEM)) {
    const after = state.gemCells.slice(); after[i] = v;
    const extra = autoCrossChanges(state.puzzle, after, state.gemAuto, i, v === GEM);
    changes.push(...extra);
    if (v === GEM) auto = new Set(extra.map(([j]) => j));
  }
  return setCells(changes, { auto });
}
export function setGemTool(v) {
  if (v !== 'gem' && v !== 'cross') return;
  if (state.gemTool === v) return;
  state.gemTool = v;
  if (state.settings.sfxToolSwitch) Music.sfxToolSwitch();
}

// ── Tippen & Wischen ─────────────────────────────────────────────────────────
let drag = null;            // { id, box, start, v0, mode, last, changes:Map }
let pan = null;
const pointers = new Map();
function cellAt(box, x, y) {
  const n = state.puzzle.rows;
  const r = Math.min(n - 1, Math.max(0, Math.floor((y - box.top) / (box.height / n))));
  const c = Math.min(n - 1, Math.max(0, Math.floor((x - box.left) / (box.width / n))));
  return r * n + c;
}
// Während des Wischens lokal schreiben (ohne Senden), damit jedes Kreuz sofort erscheint.
function paint(i) {
  const v = state.gemCells[i];
  let to = null;
  if (drag.mode === 'cross' && v === EMPTY) to = CROSS;
  if (drag.mode === 'erase' && v === CROSS) to = EMPTY;
  if (to == null) return;
  drag.changes.set(i, to);
  setCells([[i, to]], { send: false });
  sendLive({ cells: [...drag.changes], cur: i });
}
function onDown(e) {
  // Rechtsklick (Maus): immer Kreuz, egal welches Werkzeug gewählt ist.
  if (e.button === 2) {
    if (!playable()) return;
    const i = cellAt(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
    tapCell(i, 'cross');
    return;
  }
  if (e.button != null && e.button > 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size >= 2) {
    // Zweiter Finger: ein angefangenes Wischen bleibt, wie es ist (gesendet), dann verschieben.
    if (drag) { sendCells([...drag.changes]); drag = null; }
    const pts = [...pointers.values()];
    pan = { mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
    return;
  }
  if (!playable()) return;
  const box = e.currentTarget.getBoundingClientRect();
  const i = cellAt(box, e.clientX, e.clientY);
  drag = { id: e.pointerId, box, start: i, v0: state.gemCells[i], tool: tool(), mode: null, moved: false, last: i, changes: new Map() };
  sendLive({ cur: i });
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
  const i = cellAt(drag.box, e.clientX, e.clientY);
  if (i === drag.last) return;
  drag.last = i;
  drag.moved = true;
  // Mit dem Stein-Werkzeug ist Wischen kein Zug (versehentliches Verrutschen setzt nichts).
  if (drag.tool !== 'cross') return;
  if (!drag.mode) {
    // Erstes Verlassen der Startzelle: aus dem Tipp wird ein Wischen.
    drag.mode = drag.v0 === CROSS ? 'erase' : 'cross';
    paint(drag.start);
  }
  paint(i);
}
function onUp(e) {
  pointers.delete(e.pointerId);
  if (pan) { if (pointers.size < 2) pan = null; return; }
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  sendLive(null);
  if (!d.mode) {
    // Ein Tipp: nur, wenn der Finger auf seinem Feld blieb (sonst war es ein Verrutschen).
    if (!d.moved || d.last === d.start) tapCell(d.start, d.tool);
    return;
  }
  sendCells([...d.changes]);
}
function onCancel(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pan = null;
  if (drag && e.pointerId === drag.id) { sendCells([...drag.changes]); drag = null; sendLive(null); }
}

// ── Darstellung ──────────────────────────────────────────────────────────────
const pct = (v, n) => `${(v / n) * 100}%`;
let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }
const countRender = () => { boardRenderCount++; return ''; };

// Käfige als INSELN (Nutzerwunsch „Rahmen überlappen sich, clunky"): statt
// heller Grenzlinien je Zellkante liegt zwischen zwei Käfigen eine Fuge in der
// Brettfarbe, und jede AUSSENecke eines Käfigs ist gerundet. Innerhalb eines
// Käfigs stoßen die Zellen nahtlos aneinander (feines Raster). Die Geometrie
// (Fugen-Einzug + Rundungen) gilt für Käfigfläche, Kreuz, Konflikt und Training
// gleich — alles sitzt deckungsgleich auf der Insel. Hängt nur am Rätsel.
function regionCells(p) {
  const n = p.rows, reg = p.regions, out = [];
  for (let i = 0; i < n * n; i++) {
    const [r, c] = rcOf(n, i);
    out.push({
      i, r, c, k: reg[i],
      bt: r === 0 || reg[i - n] !== reg[i], bb: r === n - 1 || reg[i + n] !== reg[i],
      bl: c === 0 || reg[i - 1] !== reg[i], br: c === n - 1 || reg[i + 1] !== reg[i],
    });
  }
  return out;
}
let geomCache = null;   // { p, cells } — je Rätsel einmal
function geomOf(i) {
  const p = state.puzzle;
  if (!geomCache || geomCache.p !== p) geomCache = { p, cells: regionCells(p) };
  return geomCache.cells[i];
}
/** Stil einer Zelle als Teil ihrer Insel: Einzug an Käfiggrenzen, runde Außenecken. */
function islandStyle(x, n) {
  const g = 'var(--gm-gi)', R = 'var(--gm-r)';
  const inl = (b) => (b ? g : '0px');
  return {
    left: `calc(${pct(x.c, n)} + ${inl(x.bl)})`, top: `calc(${pct(x.r, n)} + ${inl(x.bt)})`,
    width: `calc(${pct(1, n)} - ${inl(x.bl)} - ${inl(x.br)})`, height: `calc(${pct(1, n)} - ${inl(x.bt)} - ${inl(x.bb)})`,
    borderRadius: `${x.bt && x.bl ? R : '0'} ${x.bt && x.br ? R : '0'} ${x.bb && x.br ? R : '0'} ${x.bb && x.bl ? R : '0'}`,
    // Verschiebung der Kästchenmitte durch den Einzug — Kreuz und Stein rücken
    // damit zurück auf die Zellmitte (sonst saßen sie an Grenzen schief).
    '--mx': (x.bl ? 1 : 0) - (x.br ? 1 : 0), '--my': (x.bt ? 1 : 0) - (x.bb ? 1 : 0),
  };
}
const RegionLayer = {
  setup() {
    const cells = computed(() => (state.puzzle ? regionCells(state.puzzle) : []));
    const style = (x) => ({ ...islandStyle(x, state.puzzle.rows), ...hslVars(regionHsl.value[x.k]) });
    return { cells, style };
  },
  template: `
            <div class="gm-regions" aria-hidden="true">
              <div v-for="x in cells" :key="x.i" class="gm-cell" :class="{ gbt: !x.bt, gbl: !x.bl }" :style="style(x)"></div>
            </div>`,
};
// Der Edelstein: Brillant-Raute in der Farbe seines Käfigs — Krone heller,
// Pavillon dunkler, zwei Facettenkanten, ein Glanzpunkt, darunter ein weicher
// Lichthof. Ruhig genug für kleine Felder.
const GEM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path class="g-pav" d="M12 21.6 2.4 10.4 6.6 4.2h10.8l4.2 6.2z"/>'
  + '<path class="g-crown" d="M2.4 10.4 6.6 4.2h10.8l4.2 6.2z"/>'
  + '<path class="g-table" d="M8.6 4.2h6.8l2 6.2H6.6z"/>'
  + '<path class="g-facet" d="M6.6 10.4 12 21.6 17.4 10.4M12 10.4v11.2"/>'
  + '<path class="g-glint" d="M8.4 6.6 9.6 5.4"/>'
  + '</svg>';
const CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>';
const MarkLayer = {
  setup() {
    const bad = computed(() => (state.puzzle ? conflicts(state.puzzle, state.gemCells) : new Set()));
    const marks = computed(() => {
      const p = state.puzzle;
      if (!p) return [];
      const out = [];
      state.gemCells.forEach((v, i) => { if (v) out.push({ i, v, k: p.regions[i] }); });
      return out;
    });
    const style = (m) => {
      const n = state.puzzle.rows;
      const st = { ...islandStyle(geomOf(m.i), n), ...hslVars(regionHsl.value[m.k]) };
      // Im Coop: Ring in der Farbe dessen, der den Stein gesetzt hat (eigene ohne Ring).
      const by = state.gemBy[m.i];
      if (m.v === GEM && isMultiplayer() && by && by !== me() && by !== LOCAL_PLAYER_ID) { const col = playerColor(by); if (col) st['--gb'] = col; }
      return st;
    };
    return { marks, style, bad, GEM, GEM_SVG, CROSS_SVG, countRender };
  },
  template: `
            <div class="gm-marks" aria-hidden="true" :data-rc="countRender()">
              <span v-for="m in marks" :key="m.i + '-' + m.v" class="gm-mark" :class="m.v === GEM ? ['gem', { bad: bad.has(m.i) }] : 'cross'" :style="style(m)">
                <i v-if="m.v === GEM" v-html="GEM_SVG"></i>
                <i v-else v-html="CROSS_SVG"></i>
              </span>
            </div>`,
};
// Training: die Zielzelle + die Einheit (Zeile/Spalte/Käfig), in der sie die letzte freie ist.
const FocusLayer = {
  setup() {
    const focus = computed(() => {
      const st = state.isTrainingGame ? state.trainingStep : null;
      if (!st || !state.puzzle) return null;
      const n = state.puzzle.rows;
      const unit = [];
      for (let i = 0; i < n * n; i++) {
        const [r, c] = rcOf(n, i);
        if ((st.unit === 'row' && r === st.r) || (st.unit === 'col' && c === st.c) || (st.unit === 'reg' && state.puzzle.regions[i] === st.k)) unit.push({ r, c, i });
      }
      return { cell: { r: st.r, c: st.c }, unit };
    });
    const style = (x) => islandStyle(geomOf(x.r * state.puzzle.rows + x.c), state.puzzle.rows);
    return { focus, style };
  },
  template: `
            <div class="gm-focus" aria-hidden="true" v-if="focus">
              <div v-for="x in focus.unit" :key="x.i" class="gm-unit" :style="style(x)"></div>
              <div class="gm-train" :style="style(focus.cell)"></div>
            </div>`,
};

// Werkzeug-Umschalter unter dem Brett — GENAU der Umschalter aus Number Sums
// (dieselben Klassen .tool-toggle/.tool-pill/.tool-ic, dieselbe Größe): links
// Kreuz, rechts Stein. Ein Tipp IRGENDWO auf den Schalter wechselt das Werkzeug
// (Nutzerwunsch — vorher zählte nur die jeweilige Hälfte). Feste Höhe, damit
// nichts springt; im Training ausgeblendet (dort setzt der Banner die Steine).
const GEM_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 20.8 12 12 20.8 3.2 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 8.2 15.8 12 12 15.8 8.2 12z" fill="currentColor"/></svg>';
const CROSS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
function toggleGemTool() { setGemTool(tool() === 'gem' ? 'cross' : 'gem'); }
export const GemTools = {
  setup() {
    const show = computed(() => !!state.puzzle && !(state.isTrainingGame && !state.trainingDone));
    return { state, show, toggleGemTool, t, GEM_ICON, CROSS_ICON };
  },
  template: `
          <div class="gm-tools-wrap">
            <div v-if="show" class="tool-toggle gm-toggle" role="switch" tabindex="0"
                 :aria-checked="state.gemTool !== 'cross'" :aria-label="t('gem.tool.aria')"
                 @click="toggleGemTool" @keydown.enter.prevent="toggleGemTool" @keydown.space.prevent="toggleGemTool">
              <div class="tool-pill" :class="{ pen: state.gemTool !== 'cross' }"></div>
              <span class="tool-ic gm-cross" :class="{ active: state.gemTool === 'cross' }" :title="t('gem.tool.cross')" v-html="CROSS_ICON"></span>
              <span class="tool-ic gm-gem" :class="{ active: state.gemTool !== 'cross' }" :title="t('gem.tool.gem')" v-html="GEM_ICON"></span>
            </div>
          </div>
  `,
};

export const BoardGrid = {
  components: { RegionLayer, MarkLayer, FocusLayer, LiveLayer },
  setup() {
    const t0 = performance.now();
    onMounted(() => log('perf', 'Brett aufgebaut', { game: 'gems', cells: state.puzzle ? state.puzzle.rows * state.puzzle.cols : 0, tookMs: Math.round(performance.now() - t0) }));
    onBeforeUnmount(() => { drag = null; pan = null; pointers.clear(); });
    return { state, gridStyle, boardFontClass, onDown, onMove, onUp, onCancel, t };
  },
  template: `
          <div class="board gm-board" :class="[boardFontClass(), { 'full-wrong': state.gemsFullWrong, shake: state.gemsShake, done: state.status === 'won' }]" :style="gridStyle"
               role="application" :aria-label="t('gem.boardLabel')"
               @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture="onCancel"
               @touchstart.prevent
               @contextmenu.prevent>
            <region-layer></region-layer>
            <focus-layer></focus-layer>
            <live-layer></live-layer>
            <mark-layer></mark-layer>
          </div>
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — dieselben Namen wie in games/numbersums/board.js.
// ═════════════════════════════════════════════════════════════════════════════

export function normalizePuzzle(p) { return healPuzzle(p); }

const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
export function loadBoard(puzzle, saved) {
  const n = puzzle.rows;
  state.gemCells = normalizeCells(saved && saved.gemCells, n);
  const by = arr(saved && saved.gemBy);
  state.gemBy = state.gemCells.map((v, i) => (v === GEM ? (by[i] || LOCAL_PLAYER_ID) : ''));
  state.gemKeys = {};
  const au = arr(saved && saved.gemAuto);
  state.gemAuto = state.gemCells.map((v, i) => v === CROSS && !!au[i]);
  state.gemsFullWrong = false;
  state.gemsShake = false;
  drag = null; pan = null; pointers.clear();
}

export function boardFields(purpose) {
  if (purpose === 'history') return { gemCells: state.gemCells.slice() };
  const out = { gemCells: state.gemCells.slice(), gemBy: state.gemBy.map((x) => x || '') };
  // Welche Kreuze automatisch kamen, ist nur für dieses Gerät wichtig (Spielstand, nicht Coop).
  if (purpose === 'save') out.gemAuto = state.gemAuto.map((x) => (x ? 1 : 0));
  return out;
}
export function boardFieldsFrom(src) { return { gemCells: src.gemCells, gemBy: src.gemBy, gemAuto: src.gemAuto }; }

export function boardSolved() { return !!state.puzzle && isSolved(state.puzzle, state.gemCells); }
export function boardProgressPct() { return state.puzzle ? progressPct(state.puzzle, state.gemCells) : 0; }
export function boardFilledCount() { return gemsOf(state.gemCells).length; }
export function boardProgressCounts() {
  const p = state.puzzle;
  return p ? { kept: Math.min(p.rows, gemsOf(state.gemCells).length), total: p.rows } : { kept: 0, total: 0 };
}
// „Richtig" = Steine dieses Spielers auf Feldern der Lösung.
export function playerCorrect(id) {
  const sol = new Set(state.puzzle.solution);
  let n = 0;
  state.gemCells.forEach((v, i) => {
    const by = state.gemBy[i];
    const mine = by === id || (by === LOCAL_PLAYER_ID && id === state.coop.myId);
    if (v === GEM && mine && sol.has(i)) n++;
  });
  return n;
}
export function wrongCells() { return []; }

// Züge eines Mitspielers: je Feld gewinnt der SPÄTERE Zug (Ereignis-Schlüssel).
export function applyRemoteMove(msg, eventKey = null) {
  if (!state.puzzle || msg.op !== 'cells' || !msg.list) return;
  const list = arr(msg.list).map((x) => arr(x));
  const cells = state.gemCells.slice(), by = state.gemBy.slice(), keys = { ...state.gemKeys }, autoArr = state.gemAuto.slice();
  let changed = 0, gemAdded = false;
  for (const [i, v] of list) {
    if (!(i >= 0 && i < cells.length) || ![EMPTY, CROSS, GEM].includes(v)) continue;
    if (eventKey && keys[i] && eventKey < keys[i]) continue;   // dieses Feld hat schon einen späteren Zug
    if (eventKey) keys[i] = eventKey;
    if (cells[i] === v) continue;
    if (v === GEM) gemAdded = true;
    cells[i] = v; by[i] = v === GEM ? (msg.from || '') : ''; autoArr[i] = false; changed++;
  }
  state.gemKeys = keys;
  if (!changed) return;
  state.gemCells = cells; state.gemBy = by; state.gemAuto = autoArr;
  state.gemsFullWrong = gemAdded && isFull(state.puzzle, cells) && !isSolved(state.puzzle, cells);
  afterMove();
}
export function applyRemoteHint() {}
// Kein Rückgängig (wie Rectangles/Number Path).
export function undoLast() { return false; }

// Tipps gibt es nicht (wie bei den anderen neuen Spielen).
export function buildHint() { return null; }
export function applyHintEffect() {}
export function clearStaleTutor() {}

// ── Training: der nächste Stein ab den RICHTIG gesetzten ──
export function isFullyTier1Solvable(p) { return solveLogic(p, { maxTier: 1 }).solved; }
export function trainingStep() {
  const p = state.puzzle;
  if (!p) return null;
  const sol = new Set(p.solution);
  const known = gemsOf(state.gemCells).filter((i) => sol.has(i));
  const st = nextDeduction(p, known, 1);
  if (!st) return null;
  const [r, c] = rcOf(p.rows, st.place);
  return { cell: st.place, r, c, k: p.regions[st.place], unit: st.unit.type };
}
export function applyTrainingStep(step) {
  if (!step) return;
  // Falsche Steine räumen, die den Schritt sonst blockieren würden.
  const sol = new Set(state.puzzle.solution);
  const changes = gemsOf(state.gemCells).filter((i) => !sol.has(i)).map((i) => [i, EMPTY]);
  setCells(changes.concat([[step.cell, GEM]]), { force: true });
}
export function trainingText(step) {
  return { title: t('gem.train.title'), body: t('gem.train.' + step.unit) };
}
export function onPlayerColorsChanged() {}
export function resetCellStyleCache() {}

// ── Verlauf: das gelöste Endbrett ──
export function historyExtras() { return {}; }
function historyStyle(p) {
  const avail = Math.min(window.innerWidth - 80, 380);
  const cell = Math.max(16, Math.min(40, Math.floor(avail / p.rows)));
  return { width: p.rows * cell + 'px', height: p.rows * cell + 'px', '--cell': cell + 'px', '--cols': p.rows, '--rows': p.rows };
}
export const HistoryBoard = {
  props: ['detail'],
  setup() {
    const fx = activePaletteFx();
    const view = (p) => {
      const cols = regionColors(p).map((ci) => applyPaletteFx(GEM_PALETTE[ci], fx));
      const cells = regionCells(p);
      return {
        cells: cells.map((x) => ({ i: x.i, cls: { gbt: !x.bt, gbl: !x.bl }, style: { ...islandStyle(x, p.rows), ...hslVars(cols[x.k]) } })),
        gems: p.solution.map((i) => ({ i, style: { ...islandStyle(cells[i], p.rows), ...hslVars(cols[p.regions[i]]) } })),
      };
    };
    return { historyStyle, view, GEM_SVG };
  },
  template: `
          <div class="board gm-board history-board" :style="historyStyle(detail.puzzle)">
            <div class="gm-regions"><div v-for="x in view(detail.puzzle).cells" :key="x.i" class="gm-cell" :class="x.cls" :style="x.style"></div></div>
            <div class="gm-marks"><span v-for="g in view(detail.puzzle).gems" :key="g.i" class="gm-mark gem" :style="g.style"><i v-html="GEM_SVG"></i></span></div>
          </div>
  `,
};

// ── Test-Haken (nur localhost, s. window.__cns in app.js) ──
export function testHooks() {
  return {
    tapGem: (i, tl) => tapCell(i, tl || tool()),
    setGemTool,
    setGem: (i, v) => setCells([[i, v]]),
    solveGems: () => {
      const sol = new Set(state.puzzle.solution);
      const changes = [];
      state.gemCells.forEach((v, i) => { if (v === GEM && !sol.has(i)) changes.push([i, EMPTY]); });
      for (const i of sol) if (state.gemCells[i] !== GEM) changes.push([i, GEM]);
      return setCells(changes);
    },
  };
}
