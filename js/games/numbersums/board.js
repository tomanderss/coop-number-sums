// games/numbersums/board.js — die BRETT-DARSTELLUNG von „Number Sums".
//
// Hier steckt alles, was das Brett AUSSEHEN laesst: die Vue-Komponente
// `BoardGrid`, die Klassen und Styles je Zelle, die Kaefig-Farben, die
// Render-Caches und die Skin-/Shop-Optik. Die Spielregeln liegen daneben in
// `model.js`, die Interaktion (Zuege, langes Druecken) noch in `app.js`.
//
// Warum ein eigenes Modul: zwischen den beiden Spielen, die zu EINER App
// zusammengelegt werden, ist genau das Brett unterschiedlich — Coop Math Cross
// hat ein Ablagefach, Divisionszeichen und andere Zellgesten. Alles drumherum
// (Menue, Coop, Shop, Erfolge, Kopfleiste) ist identisch. Die Schale bindet
// deshalb `activeGame().BoardGrid` ein und muss nichts ueber das Brett wissen.
//
// RENDER-PERFORMANCE (Kernregeln in CLAUDE.md) bleibt unveraendert gueltig:
// alle Helfer liegen auf Modulebene (kein Props-Threading), die aufgeloesten
// Zeilen/Spalten/Kaefige und die Zellen-Styles sind gecacht, und in das
// Brett-Template darf KEINE app-fremde Abhaengigkeit (z.B. `state.tool`)
// einfliessen — sonst rendert jeder Werkzeug-Wechsel wieder alle ~200 Zellen.

import { computed, onMounted } from '../../vue.esm-browser.prod.js';
import { REGION_COLORS, regionChipInk, hexToRgb } from '../../config.js';
import { SKINPRESET_ITEMS, shopItemById, ownsShopItem, applyPaletteFx } from '../../shopitems.js';
import { SKIN_ID, skinVars as buildSkinVars, skinClasses as buildSkinClasses } from '../../skins.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import * as Coop from '../../coop.js';
import * as Model from './model.js';
import { remapColorsForMarkVisibility } from './generator.js';
import { findTrainingStep } from './training.js';
import { buildHintTutorial } from './hinttutor.js';
import { log } from '../../debuglog.js';

// ── Von der Schale injizierte Verweise ───────────────────────────────────────
// Als Modul-Variablen (nicht als Props), damit die Funktionskoerper beim Umzug
// aus app.js unveraendert bleiben konnten und im Render-Pfad kein zusaetzlicher
// Objektzugriff entsteht. `initBoard` laeuft in app.js direkt nach dem Anlegen
// von `state` — die computeds hier sind lazy, greifen also nie vorher zu.
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
// Rueckrufe in die Schale: Leben/Fehlerzaehler, Zug-Log, Persistenz+Sieg-Pruefung
// und der Coop-Versand bleiben dort, weil sie in jedem Spiel gleich sind.
let registerMistake = () => {};
let afterMove = () => {};
let coopSend = () => {};
let desktopBoard = () => false;

export function initBoard(ctx) {
  state = ctx.state;
  LOCAL_PLAYER_ID = ctx.LOCAL_PLAYER_ID;
  playerColor = ctx.playerColor;
  shopEquippedId = ctx.shopEquippedId;
  registerMistake = ctx.registerMistake;
  afterMove = ctx.afterMove;
  coopSend = ctx.coopSend;
  if (ctx.desktopBoard) desktopBoard = ctx.desktopBoard;
}

// ── Brett-Optik (Shop/Skin) ──────────────────────────────────────────────────
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
// Dynamischer Skin (Cosmetic 'dynamicColor'): mindestens eine gekaufte Skin-
// Vorlage aktiviert das Skin-Rendering auch OHNE den exklusiven Skin (der
// schaltet nur den freien Editor frei).
export const skinUnlocked = computed(() => !!state.inventory[SKIN_ID]);
export const skinPresetOwned = computed(() => SKINPRESET_ITEMS.some((p) => ownsShopItem(state.inventory, p)));
export const skinActive = computed(() => (skinUnlocked.value || skinPresetOwned.value) && state.settings.skinEnabled);
export const skinVars = computed(() => skinActive.value ? buildSkinVars(state.settings) : {});
export const skinBoardClasses = computed(() => buildSkinClasses(state.settings, skinActive.value));
export const gridStyle = computed(() => ({
  gridTemplateColumns: `var(--hdr) repeat(${state.puzzle?.cols || 1}, var(--cell))`,
  gridTemplateRows: `var(--hdr) repeat(${state.puzzle?.rows || 1}, var(--cell))`,
  '--cell': state.cellPx + 'px',
  '--hdr': state.cellPx + 'px',
  '--fs': Math.max(11, Math.round(state.cellPx * 0.4)) + 'px',
}));
// Aktive Paletten-Transformation für cellStyle (null = Klassisch/unverändert).
export function activePaletteFx() {
  const it = shopItemById(shopEquippedId('palette'));
  return it ? it.fx : null;
}

// ── Render-Caches: aufgelöste Zeilen/Spalten/Käfige EINMAL vorberechnen ──────
// Vorher scannte jede der bis zu 196 Zellen (14×14 „R.I.P.") bei JEDEM Render ihren
// Käfig/ihre Zeile/Spalte neu. Das lief nicht nur pro Zug, sondern bei JEDEM
// Re-Render (z.B. den vielen Puls-Animationen gegen Spielende) → CPU-Dauerlast,
// Hitze, zunehmendes Ruckeln. Diese Sets rechnen nur neu, wenn sich state.marks
// ändert (ein Zug); die Render-Nutzung ist dann ein O(1)-Set-Lookup.
//
// STABIL: ein Computed, das bei jedem Zug ein NEUES Set liefert, löst bei JEDEM
// Zug alle Abhängigen aus — also jede Zelle. Deshalb geben die Caches das alte
// Objekt zurück, solange sich der Inhalt nicht geändert hat (Vue 3.4+ reicht den
// alten Wert an den Getter durch). So zeichnet ein Zug nur die getroffene Zelle neu.
const sameSet = (a, b) => !!a && a.size === b.size && [...b].every((x) => a.has(x));
const sameArr = (a, b) => !!a && a.length === b.length && a.every((x, i) => x === b[i]);
const stableSet = (s, old) => (sameSet(old, s) ? old : s);
const resolvedRowSet = computed((old) => { const p = state.puzzle; const s = new Set(); if (p) for (let r = 0; r < p.rows; r++) if (Model.rowResolved(p, state.marks, r)) s.add(r); return stableSet(s, old); });
const resolvedColSet = computed((old) => { const p = state.puzzle; const s = new Set(); if (p) for (let c = 0; c < p.cols; c++) if (Model.colResolved(p, state.marks, c)) s.add(c); return stableSet(s, old); });
const resolvedRegionSet = computed((old) => { const p = state.puzzle; const s = new Set(); if (p) for (let i = 0; i < p.regions.length; i++) if (Model.regionResolved(p, state.marks, i)) s.add(i); return stableSet(s, old); });
// Render-Helfer (O(1)) — NUR im Template/cellClasses verwenden. Die Spiellogik
// nutzt weiter die rohen Modell-Funktionen für die punktuelle Vorher/Nachher-Prüfung.
export function rowResolvedR(r) { return resolvedRowSet.value.has(r); }
export function colResolvedR(c) { return resolvedColSet.value.has(c); }
export function regionResolvedR(i) { return resolvedRegionSet.value.has(i); }

// Zeilen-/Spaltensummen ebenfalls EINMAL pro Zug cachen statt in jedem Header-
// Render (mehrfach: Wert + Match-Klasse) die ganze Zeile/Spalte neu aufzusummieren.
const rowSumsC = computed((old) => { const a = state.puzzle ? Model.rowSums(state.puzzle, state.marks) : []; return sameArr(old, a) ? old : a; });
const colSumsC = computed((old) => { const a = state.puzzle ? Model.colSums(state.puzzle, state.marks) : []; return sameArr(old, a) ? old : a; });
export function rowSumR(r) { return rowSumsC.value[r] || 0; }
export function colSumR(c) { return colSumsC.value[c] || 0; }
// aktuelle Summen stimmen (Hilfsanzeige): Summe der eingekreisten == Ziel — aus dem Cache.
export const rowSumMatch = (r) => rowSumsC.value[r] === state.puzzle.rowTargets[r];
export const colSumMatch = (c) => colSumsC.value[c] === state.puzzle.colTargets[c];

// Regionfarben-Cache: die (statische) Käfig-Basisfarbe × ausgerüstete Palette EINMAL
// je distinkter Farbe transformieren — vorher lief applyPaletteFx (HSL-Mathe + 2 Shop-
// Lookups) in cellStyle PRO ZELLE PRO RENDER (×196 auf dem 14×14). m.color ist eine
// Referenz in REGION_COLORS, daher als Map-Key nutzbar. Neu nur bei Paletten-Wechsel.
export const colorKey = (c) => c.h + '-' + c.s + '-' + c.l;  // stabiler Key (unabhängig von Objekt-Referenz)
const regionColorVars = computed(() => {
  const fx = activePaletteFx();
  const map = new Map();
  for (const color of REGION_COLORS) {
    const col = applyPaletteFx(color, fx);
    map.set(colorKey(color), { '--rc-h': col.h, '--rc-s': col.s + '%', '--rc-l': col.l + '%', '--rc-ink': regionChipInk(col) });
  }
  return map;
});

// Rohe Fertig-Pruefung (NICHT die gecachten R-Helfer): setMark/applyHintEffect
// brauchen den Stand VOR und NACH dem Zug, und ein Computed-Cache ist zwischen
// beiden Abfragen noch nicht neu berechnet.
const rowResolved = (r) => Model.rowResolved(state.puzzle, state.marks, r);
const colResolved = (c) => Model.colResolved(state.puzzle, state.marks, c);
const regionResolved = (i) => Model.regionResolved(state.puzzle, state.marks, i);

// ── Fertig-Puls: welche Seiten einer Zelle leuchten ──────────────────────────
// Liefert, welche Seiten dieser Zelle zum ÄUSSEREN Rand einer gerade fertig
// gewordenen Reihe/Spalte/Cage gehören (nur die äußersten Ränder der ganzen
// Struktur leuchten, keine Querstriche dazwischen).
const NO_PULSE_EDGES = { t: false, b: false, l: false, r: false };
const anyPulseActive = computed(() => Object.keys(state.justResolved).length > 0);
function pulseEdges(r, c) {
  if (!anyPulseActive.value) return NO_PULSE_EDGES;   // Normalfall: kein Puls → 0 Lookups
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

// ── Aria-Labels ──────────────────────────────────────────────────────────────
// Je Zelle beim Rendern DIESER Zelle: seit jede Zelle eine eigene Komponente ist,
// rendert eine Zelle nur noch, wenn sich an ihr etwas ändert. Das frühere
// Sammel-Computed über ALLE Zellen lief bei jedem Zug komplett neu und zog als
// gemeinsame Abhängigkeit jede Zelle mit.
export function cellAriaLabel(r, c) {
  const p = state.puzzle; if (!p || !state.marks[r]) return '';
  const mk = state.marks[r][c];
  const status = mk === 'kept' ? t('a11y.cellKept') : mk === 'removed' ? t('a11y.cellRemoved') : t('a11y.cellUnmarked');
  return t('a11y.cellLabel', { row: r + 1, col: c + 1, value: p.values[r][c], status });
}

// ── Klassen je Zelle ─────────────────────────────────────────────────────────
export function cellClasses(r, c) {
  const m = state.cellMeta[r][c];
  const mk = state.marks[r][c];
  // Cage-Färbung nur solange die Cage NICHT aufgelöst ist (dann verschwindet sie).
  const colored = m.region >= 0 && !regionResolvedR(m.region);
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
    // EIGENE Markierung: im Multiplayer behaelt sie den eigenen Skin (Regenbogen,
    // Preset, Verlauf) — nur die Zellen der MITSPIELER fallen auf deren zugewiesene
    // Farbe zurueck, damit erkennbar bleibt, wer was gesetzt hat (s. .mp-colors).
    mine: !!state.markedBy[r][c] && state.markedBy[r][c] === (state.coop.myId || LOCAL_PLAYER_ID),
    'coop-mark-removed': state.coop.active && !!state.markedBy[r][c] && mk === 'removed' && state.settings.coopRemovedOutline,
    'training-highlight': state.isTrainingGame && state.trainingStep?.r === r && state.trainingStep?.c === c,
    'hint-group': inHintGroup(r, c),
  };
}
// Fokus-Zellen des aktuellen Tutor-Schritts als Set (r*1000+c) — cached
// computed, damit inHintGroup pro Zelle O(1) bleibt (Brett-Render-Kernregel).
const tutorFocusSet = computed(() => {
  const tt = state.hintTutor;
  if (!tt) return null;
  const s = tt.steps[tt.i];
  return new Set(s.cells.map(([r, c]) => r * 1000 + c));
});
function inHintGroup(r, c) {
  const set = tutorFocusSet.value;
  return !!set && set.has(r * 1000 + c);
}

// ── Styles je Zelle ──────────────────────────────────────────────────────────
// Style-Objekte je Zelle CACHEN und bei unveränderten Eingaben DIESELBE Referenz
// zurückgeben: Vue patcht :style nur, wenn sich die Referenz/Werte ändern — bei
// einem neuen Objekt pro Render setzte es dagegen JEDE CSS-Custom-Property
// (--rc-*/--markcol) für ALLE ~169 Zellen bei JEDEM Render erneut (setProperty
// war im Profil ein Top-Posten des Tick-Renders auf großen Brettern).
let cellStyleCache = [];
/** Cache verwerfen — beim Brettaufbau und bei jeder Umfärbung der Käfige. */
export function resetCellStyleCache() { cellStyleCache = []; }
export function cellStyle(r, c) {
  const m = state.cellMeta[r][c];
  const cv = m.color ? regionColorVars.value.get(colorKey(m.color)) : null;
  const who = state.markedBy[r][c];
  const col = who ? (who === LOCAL_PLAYER_ID ? state.settings.coopMyColor : playerColor(who)) : null;
  const pe = pulseEdges(r, c);
  const key = `${cv ? cv['--rc-h'] + cv['--rc-s'] + cv['--rc-l'] : ''}|${col || ''}|${pe.t ? 1 : 0}${pe.b ? 1 : 0}${pe.l ? 1 : 0}${pe.r ? 1 : 0}`;
  const row = cellStyleCache[r] || (cellStyleCache[r] = []);
  const hit = row[c];
  if (hit && hit.key === key) return hit.style;
  const st = { fontSize: 'var(--fs)' };
  if (cv) { st['--rc-h'] = cv['--rc-h']; st['--rc-s'] = cv['--rc-s']; st['--rc-l'] = cv['--rc-l']; st['--rc-ink'] = cv['--rc-ink']; }
  if (col) st['--markcol'] = col;
  if (pe.t) st['--pt'] = '3px';
  if (pe.b) st['--pb'] = '3px';
  if (pe.l) st['--pl'] = '3px';
  if (pe.r) st['--pr'] = '3px';
  row[c] = { key, style: st };
  return st;
}

// ── Die Brett-Komponente ─────────────────────────────────────────────────────
// KERN-PERFORMANCEFIX: Vue trackt Render-Abhängigkeiten PRO KOMPONENTE. Solange
// das Brett im App-Template lag, renderte JEDE reaktive Änderung der App (Tool-
// Umschalter state.tool, Sekunden-Tick state.elapsed, HUD/Chat/Toasts, …) ALLE
// ~200 Zellen mit (cellClasses/cellStyle/Aria ×196 auf 14×14) — auf älteren
// Geräten im Spätspiel spürbare Tap-Latenz („Button reagiert nicht", Züge im
// falschen Modus). Als Child-Komponente rendert das Brett NUR noch, wenn sich
// ECHTE Brett-Abhängigkeiten ändern (marks/flash/justResolved/cellMeta/Skin/…).
// boardRenderCount zählt Brett-Renders (localhost-Debug/E2E-Regressionstest).
let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }

const countRender = () => { boardRenderCount++; return ''; };
// Nur die ZELL-Renders (E2E: ein Zug darf nur die getroffene Zelle neu zeichnen).
let cellRenderCount = 0;
export function cellRenders() { return cellRenderCount; }
const countCellRender = () => { boardRenderCount++; cellRenderCount++; return ''; };

// Eine Zelle = eine Komponente. Vue verfolgt Abhängigkeiten JE KOMPONENTE: ein
// Zug ändert state.marks[r][c] und damit genau EINE Zelle (plus ihre Zeilen-/
// Spaltenköpfe). Vorher lag das ganze Raster in einer Komponente, und jeder Tipp
// zeichnete alle ~200 Zellen neu (cellClasses/cellStyle/Aria/Patch ×196 auf
// 14×14): auf schwächeren Handys ~100 ms je Tipp (gemessen bei 6-facher CPU-
// Drosselung) — schnelles Tippen stand im Stau („muss warten, bis eingekreist").
const BoardCell = {
  props: { r: Number, c: Number },
  setup() {
    return { state, cellClasses, cellStyle, cellAriaLabel, regionResolvedR, onCellClick, onCellPointerDown, onCellPointerMove, onCellPointerUp, onCellPointerCancel, onCellTap, countRender: countCellRender };
  },
  template: `
              <div class="cell" :class="cellClasses(r,c)" :style="cellStyle(r,c)" :data-rc="countRender()"
                   role="button" tabindex="0" :aria-label="cellAriaLabel(r,c)"
                   @click="onCellClick(r,c)"
                   @keydown.enter.prevent="onCellTap(r,c)"
                   @keydown.space.prevent="onCellTap(r,c)"
                   @pointerdown="onCellPointerDown($event,r,c)"
                   @pointermove="onCellPointerMove($event)"
                   @pointerup="onCellPointerUp($event)"
                   @pointerleave="onCellPointerCancel"
                   @pointercancel="onCellPointerCancel"
                   @contextmenu.prevent>
                <span v-if="state.cellMeta[r][c].chip!=null && !regionResolvedR(state.cellMeta[r][c].region)" class="rchip">{{ state.cellMeta[r][c].chip }}</span>
                <span class="cnum">{{ state.puzzle.values[r][c] }}</span>
                <i v-if="state.marks[r][c]==='removed' && state.cellMeta[r][c].hintMark" class="hint-dot"></i>
              </div>`,
};

// Zeilen-/Spaltenkopf ebenfalls als eigene Komponente: die Summen ändern sich mit
// jedem Zug, das darf nur die betroffenen Köpfe neu zeichnen, nicht das Raster.
const BoardHdr = {
  props: { kind: String, i: Number },
  setup(props) {
    const isRow = props.kind === 'row';
    return {
      state, countRender,
      resolved: (i) => (isRow ? rowResolvedR(i) : colResolvedR(i)),
      sum: (i) => (isRow ? rowSumR(i) : colSumR(i)),
      match: (i) => (isRow ? rowSumMatch(i) : colSumMatch(i)),
      target: (i) => (isRow ? state.puzzle.rowTargets[i] : state.puzzle.colTargets[i]),
    };
  },
  template: `
              <div class="hdr" :class="[kind === 'row' ? 'row-hdr' : 'col-hdr', {resolved: resolved(i), pulse: state.justResolved[kind+'-'+i]}]" :data-rc="countRender()">
                <template v-if="!resolved(i)">
                  <span class="cur" :class="{match: match(i)}">{{ sum(i) }}</span>
                  <span class="tgt">{{ target(i) }}</span>
                </template>
              </div>`,
};

export const BoardGrid = {
  components: { BoardCell, BoardHdr },
  setup() {
    // Einmal je Brettaufbau: wie lange der Aufbau der Zell-Komponenten dauert
    // (Diagnoseprotokoll — nie pro Zug).
    const t0 = performance.now();
    onMounted(() => log('perf', 'Brett aufgebaut', { cells: state.puzzle ? state.puzzle.rows * state.puzzle.cols : 0, tookMs: Math.round(performance.now() - t0) }));
    return { state, skinBoardClasses, skinVars, gridStyle, boardFontClass, boardFrameClass, countRender };
  },
  template: `
          <div class="board" :class="[skinBoardClasses, boardFontClass(), boardFrameClass(), { 'skin-freeze': state.paused || state.joinFreeze, 'mp-colors': state.coop.active || state.team.active, 'big-num': state.puzzle.bigNumbers, 'tutor-dim': !!state.hintTutor }]" :style="[gridStyle, skinVars]" :data-rc="countRender()">
            <div class="corner"></div>
            <board-hdr v-for="c in state.puzzle.cols" :key="'ch'+c" kind="col" :i="c-1"></board-hdr>
            <template v-for="r in state.puzzle.rows" :key="'r'+r">
              <board-hdr kind="row" :i="r-1"></board-hdr>
              <board-cell v-for="c in state.puzzle.cols" :key="r+'-'+c" :r="r-1" :c="c-1"></board-cell>
            </template>
          </div>
  `,
};

// ── ZUEGE & GESTEN ───────────────────────────────────────────────────────────
// Alles, was das Brett VERAENDERT, gehoert zum Spiel: welcher Tap welche
// Markierung setzt, was ein Fehlgriff ausloest, wie ein Tipp aufgeloest wird.
// Leben, Fehlerzaehler, Toasts, Persistenz und der Coop-Versand bleiben in der
// Schale — die sind in jedem Spiel gleich und kommen hier als ctx-Rueckrufe an.

// Kurzer, smoother Leucht-Puls für eine gerade fertig gewordene Reihe/Spalte/Cage.
export function pulseResolved(kind, idx) {
  const key = `${kind}-${idx}`;
  state.justResolved[key] = true;
  setTimeout(() => { delete state.justResolved[key]; }, 900);
}

// ─── TIPPEN ──────────────────────────────────────────────────────────────────
// Ein Tipp zählt SOFORT beim Berühren (pointerdown), nicht erst beim `click`.
// Den click erzeugt der Browser erst nach dem Loslassen — und auf Touch-Geräten
// gar nicht, wenn der Finger dabei ein paar Pixel rutscht, wenn ein zweiter
// Finger aufsetzt, bevor der erste losgelassen hat (schnelles Tippen mit beiden
// Daumen), oder wenn der Hauptthread gerade beschäftigt ist. Gemeldet: „muss
// Zahlen teils doppelt antippen" — und ein zweiter Tipp auf eine Zelle, die der
// erste in Wahrheit schon gesetzt hatte, wurde dann ein FEHLER.
//
// Nur wenn das Brett gezoomt ist (der Brett-Bereich scrollt), kann eine
// Berührung auch ein Verschieben sein: dann zählt der Tipp beim Loslassen, sofern
// sich der Finger kaum bewegt hat und der Browser die Geste nicht übernommen hat
// (pointercancel).
const TAP_SLOP_PX = 10;
let pending = null;          // { id, r, c, x, y } — Tipp auf gezoomtem Brett, wartet aufs Loslassen
let lastPointerTapAt = -1e9; // performance.now() des letzten per Pointer verarbeiteten Tipps

function boardScrolls(el) {
  const wrap = el && el.closest ? el.closest('.board-wrap') : null;
  return !!wrap && (wrap.scrollWidth > wrap.clientWidth + 1 || wrap.scrollHeight > wrap.clientHeight + 1);
}

export function onCellPointerDown(e, r, c) {
  if (e.button != null && e.button > 0) return;   // nur Primärtaste/Finger/Stift
  lastPointerTapAt = performance.now();
  if (boardScrolls(e.currentTarget)) {
    pending = { id: e.pointerId, r, c, x: e.clientX, y: e.clientY };
    return;
  }
  pending = null;
  onCellTap(r, c);
}

export function onCellPointerMove(e) {
  if (!pending || e.pointerId !== pending.id) return;
  if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > TAP_SLOP_PX) pending = null;
}

export function onCellPointerUp(e) {
  if (!pending || e.pointerId !== pending.id) return;
  const { r, c } = pending;
  pending = null;
  lastPointerTapAt = performance.now();
  onCellTap(r, c);
}

export function onCellPointerCancel() { pending = null; }

// Der click NACH einem Pointer-Tipp ist derselbe Tipp — verwerfen. Ein click OHNE
// vorausgehende Berührung (Screenreader, Bedienhilfen) zählt weiter normal.
export function onCellClick(r, c) {
  if (performance.now() - lastPointerTapAt < 1000) return;
  onCellTap(r, c);
}

export function onCellTap(r, c) {
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

export function setMark(r, c, next, user, fromId) {
  if (user) state.hintTutor = null; // eigene Aktion verwirft den offenen Tipp-Tutor (Zahlen wären veraltet)
  const cur = state.marks[r][c];
  if (cur === next) return;

  // Fehler werden IMMER sofort aufgedeckt: eine falsche Markierung wird gar nicht
  // erst gesetzt, sondern rot geblitzt und als Fehler gezählt.
  if (user) {
    const sol = state.puzzle.solution[r][c];
    const wrong = (next === 'kept' && !sol) || (next === 'removed' && sol);
    if (wrong) {
      flashError(r, c); registerMistake(); return;
    }
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

let lastErrorSfx = 0;
export function flashError(r, c) {
  const key = `${r}-${c}`;
  state.flash[key] = true;
  setTimeout(() => { delete state.flash[key]; }, 650);
  // Fehler-Ton — beim Mehrfach-Check (doCheck markiert viele Zellen auf einmal)
  // nur einmal spielen, nicht pro Zelle.
  if (state.settings.sfxError && Date.now() - lastErrorSfx > 120) { lastErrorSfx = Date.now(); Music.sfxError(); }
}

// Wendet einen Hinweis auf eine Zelle an (lokal ausgelöst oder vom Coop-Partner empfangen).
// user kennzeichnet, wer den Hinweis ausgelöst hat (für die Coop-Farbmarkierung).
export function applyHintEffect(r, c, mark, user = true, fromId) {
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

// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — was die Schale über den Brett-ZUSTAND dieses Spiels
// wissen muss. Jedes Spiel exportiert dieselben Namen; die Schale ruft sie über
// `activeGame().board` auf und kennt dadurch weder Markierungen (Number Sums)
// noch gelegte Steine (Math Cross). Leben, Fehler, Zeit, Persistenz, Coop-
// Versand und Sieg/Niederlage bleiben Schale.
// ═════════════════════════════════════════════════════════════════════════════

// Ein empfangenes/gespeichertes Rätsel brauchbar machen. Number Sums übersteht
// die RTDB ohne Löcher im Rätsel selbst, deshalb unverändert.
export function normalizePuzzle(p) { return p; }

// Der spieleigene Teil des Brett-Aufbaus (der Rest — Leben, Zeit, markedBy —
// liegt in der Schale). Läuft in loadPuzzleIntoState NACH `state.puzzle = …`.
export function loadBoard(puzzle, saved) {
  state.cellMeta = Model.buildCellMeta(puzzle);
  onPlayerColorsChanged();   // Cage-Farben meiden die (lokalen) Spielerfarben
  if (saved && saved.hintMarks) for (const [r, c] of saved.hintMarks) state.cellMeta[r][c].hintMark = true;
  // Raster IMMER dicht normalisieren (s. markedBy in der Schale): ein über die
  // RTDB gereistes Raster kann Löcher haben.
  state.marks = Coop.normalizeGrid(saved?.marks, puzzle.rows, puzzle.cols, 'none');
  state.tool = state.settings.confirmTool || 'pen';
  state.hintWarnShown = false;
  state.hintTutor = null;
}

function collectHintMarks() {
  const out = [];
  for (let r = 0; r < state.cellMeta.length; r++)
    for (let c = 0; c < state.cellMeta[r].length; c++)
      if (state.cellMeta[r][c].hintMark) out.push([r, c]);
  return out;
}

// Die spieleigenen Felder eines Spielstands. `purpose`:
//   'wire'    — Coop-INIT (Brett für Mitspieler)
//   'save'    — Aktivspiel-Slot/Bibliothek (zusätzlich die Tipp-Markierungen)
//   'history' — Verlaufseintrag (eine KOPIE: der Endstand darf sich nicht mehr ändern)
export function boardFields(purpose) {
  if (purpose === 'history') return { marks: state.marks.map((row) => row.slice()) };
  if (purpose === 'save') return { marks: state.marks, hintMarks: collectHintMarks() };
  return { marks: state.marks };
}

// Die Brett-Felder aus einem empfangenen Coop-INIT (bzw. einem Spielstand) ziehen.
export function boardFieldsFrom(src) { return { marks: src.marks }; }

export function boardSolved() { return Model.isSolved(state.puzzle, state.marks); }
export function boardProgressPct() { return Model.progressPct(state.puzzle, state.marks); }
// Wie viele Zellen sind schon belegt (Beitritts-Protokoll, Skin-Freeze)?
export function boardFilledCount() {
  let n = 0;
  for (const row of (state.marks || [])) for (const v of (row || [])) if (v && v !== 'none') n++;
  return n;
}
// Fortschritt als Zähler für die Ergebnis-Anzeige: eingekreiste Lösungszellen.
export function boardProgressCounts() {
  const p = state.puzzle;
  if (!p) return { kept: 0, total: 0 };
  let kept = 0, total = 0;
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
    if (p.solution[r][c]) { total++; if (state.marks[r][c] === 'kept') kept++; }
  }
  return { kept, total };
}
// Richtig gesetzte Zellen EINES Spielers (Coop-Verteilung auf der Ergebnis-Karte).
export function playerCorrect(id) {
  const p = state.puzzle;
  let n = 0;
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      if (state.markedBy[r][c] !== id) continue;
      if (state.marks[r][c] === 'kept' && p.solution[r][c]) n++;
      else if (state.marks[r][c] === 'removed' && !p.solution[r][c]) n++;
    }
  return n;
}
// Falsch markierte Zellen (Grundlage des „Prüfen"-Knopfes).
export function wrongCells() { return Model.findWrongCells(state.puzzle, state.marks); }

// Züge eines Mitspielers anwenden. `key` = Ereignis-Schlüssel (in Number Sums
// ungenutzt: eine Zelle wird nur einmal gesetzt, gleichzeitige Züge kollidieren nicht).
export function applyRemoteMove(msg) { setMark(msg.r, msg.c, msg.mark, false, msg.from); }
export function applyRemoteHint(msg) { applyHintEffect(msg.r, msg.c, msg.mark, false, msg.from); }

// Den letzten Zug zurücknehmen (nur der Brett-Teil; Ton/Persistenz/Versand
// macht die Schale). Liefert false, wenn es nichts zurückzunehmen gab.
export function undoLast() {
  const last = state.history.pop();
  if (!last) return false;
  state.marks[last.r][last.c] = last.prev;
  state.markedBy[last.r][last.c] = null; // prev ist immer 'none' (siehe Markier-Sperre)
  return true;
}

// Verwirft den aktiven Tipp-Tutor, sobald seine Zielzelle gelöst ist — egal
// wodurch (Auflösen, Coop-Partner-Zug): die Erklärung wäre dann veraltet.
export function clearStaleTutor() {
  const tt = state.hintTutor;
  if (tt && state.marks[tt.target.r][tt.target.c] !== 'none') state.hintTutor = null;
}

// ── Tipp-Tutor ── (null = gerade kein erklärbarer Zug)
export function buildHint() { return buildHintTutorial(state.puzzle, state.marks); }

// ── Trainingsmodus ──
export function trainingStep() { return findTrainingStep(state.puzzle, state.marks); }
export function applyTrainingStep(step) { setMark(step.r, step.c, step.action, false); }
// Text des Erklär-Banners: Überschrift (Bereich + Zielsumme) und Begründung.
export function trainingText(step) {
  return {
    title: `${t('training.group.' + step.group.kind, { n: step.group.ref + 1 })} (${t('training.target', { n: step.group.target })})`,
    body: t('training.reason.' + step.reason),
  };
}

// Cage-Farben so wählen, dass die eigene(n) Markierungsfarbe(n) darauf sichtbar
// bleiben — eine pinke Cage macht einen pinken Einkreis-Ring unsichtbar. Läuft
// beim Brettaufbau, bei Farb-/Palettenwechsel und wenn im Coop neue Spieler(farben)
// dazukommen. Bewusst clientseitig: jedes Gerät färbt für SEINE Spielerfarbe
// sicher (das Puzzle selbst bleibt identisch).
export function onPlayerColorsChanged() {
  const p = state.puzzle;
  if (!p || !p.regions || !state.cellMeta.length) return;
  const fx = activePaletteFx();
  const effectiveColors = REGION_COLORS.map((c) => applyPaletteFx(c, fx));
  const avoid = [state.settings.coopMyColor, ...(state.coop.active ? state.coop.players.map((pl) => pl.color) : [])]
    .map(hexToRgb).filter(Boolean);
  const idxs = remapColorsForMarkVisibility({ regions: p.regions, rows: p.rows, cols: p.cols, effectiveColors, avoidRgbs: avoid });
  let remapped = 0;
  p.regions.forEach((reg, ri) => {
    const color = REGION_COLORS[idxs[ri]];
    if (idxs[ri] !== ((reg.colorIndex || 0) % REGION_COLORS.length)) remapped++;
    for (const [r, c] of reg.cells) state.cellMeta[r][c].color = color;
  });
  resetCellStyleCache();   // gecachte --rc-*-Styles gehören zur alten Färbung
  if (remapped) log('game', 'Cage-Farben wegen Spielerfarbe umgelenkt', { remapped });
}

// ── Zellgröße (responsiv + Zoom) ──
// Misst die tatsächlich verfügbare Fläche von .board-wrap (Breite UND Höhe),
// damit Zellen im Querformat (wo die Höhe statt der Breite limitiert) nicht zu
// groß werden. Vor dem ersten Render (DOM noch nicht da) greift ein grober
// Fallback über window.innerWidth/-Height, den der nextTick-Aufruf in
// loadPuzzleIntoState() danach durch die echte Messung ersetzt. Gehört zum
// Spiel, weil das Raster es tut: hier Zellen plus EINE Kopfzeile/-spalte.
export function fitBoard() {
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
    : (shortSide >= 600 ? Math.min(120, Math.round(shortSide * 0.14)) : 56);
  // KEIN hoher Mindestwert mehr: Beim Öffnen MUSS das ganze Brett passen — lieber
  // kleine Zellen als eine abgeschnittene Zeile/Spalte. Der frühere 26px-Boden
  // ließ das größte Brett (14×14 = 15 Einheiten) auf schmalen Handys eine Spalte
  // aus dem Bild ragen. Nur ein winziger Boden gegen 0 in Extremfällen.
  const base = Math.max(10, Math.min(cap, ideal));
  state.cellPx = Math.round(base * state.zoom);
}

// ── Verlauf: das Endbrett eines gelösten Rätsels (Einstellungen ▸ Verlauf) ──
// Das Rätsel wird per Seed neu erzeugt; gezeigt werden die gespeicherten
// Markierungen des Endstands. Eigene kleine Komponente, weil das Raster
// spielspezifisch ist (hier: Kopfzeile/-spalte mit Zielsummen + Käfige).
export function historyExtras(puzzle) { return { cellMeta: Model.buildCellMeta(puzzle) }; }
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
function historyCellClasses(d, r, c) {
  const m = d.cellMeta[r][c];
  const mk = d.entry.marks?.[r]?.[c] || 'none';
  return {
    kept: mk === 'kept', removed: mk === 'removed', region: m.region >= 0,
    strike: mk === 'removed' && state.settings.eraseStyle === 'strike',
  };
}
function historyCellStyle(d, r, c) {
  const m = d.cellMeta[r][c];
  const st = { fontSize: 'var(--fs)' };
  if (m.color) {
    // Ausgerüstete Brett-Palette (Shop): reine HSL-Transformation der Cage-Farbe.
    const col = applyPaletteFx(m.color, activePaletteFx());
    st['--rc-h'] = col.h; st['--rc-s'] = col.s + '%'; st['--rc-l'] = col.l + '%'; st['--rc-ink'] = regionChipInk(col);
  }
  return st;
}
export const HistoryBoard = {
  props: ['detail'],
  setup() { return { historyGridStyle, historyCellClasses, historyCellStyle }; },
  template: `
          <div class="board" :style="historyGridStyle(detail.puzzle)">
            <div class="corner"></div>
            <div v-for="c in detail.puzzle.cols" :key="'hch'+c" class="hdr col-hdr">
              <span class="tgt">{{ detail.puzzle.colTargets[c-1] }}</span>
            </div>
            <template v-for="r in detail.puzzle.rows" :key="'hr'+r">
              <div class="hdr row-hdr">
                <span class="tgt">{{ detail.puzzle.rowTargets[r-1] }}</span>
              </div>
              <div v-for="c in detail.puzzle.cols" :key="'h'+r+'-'+c"
                   class="cell" :class="historyCellClasses(detail, r-1, c-1)" :style="historyCellStyle(detail, r-1, c-1)">
                <span v-if="detail.cellMeta[r-1][c-1].chip!=null" class="rchip">{{ detail.cellMeta[r-1][c-1].chip }}</span>
                <span class="cnum">{{ detail.puzzle.values[r-1][c-1] }}</span>
              </div>
            </template>
          </div>
  `,
};
