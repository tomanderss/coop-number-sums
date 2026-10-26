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

import { computed } from '../../vue.esm-browser.prod.js';
import { REGION_COLORS, regionChipInk } from '../../config.js';
import { SKINPRESET_ITEMS, shopItemById, ownsShopItem, applyPaletteFx } from '../../shopitems.js';
import { SKIN_ID, skinVars as buildSkinVars, skinClasses as buildSkinClasses } from '../../skins.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import * as Coop from '../../coop.js';
import * as Model from './model.js';

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
let pushMove = () => {};
let afterMove = () => {};
let coopSend = () => {};

export function initBoard(ctx) {
  state = ctx.state;
  LOCAL_PLAYER_ID = ctx.LOCAL_PLAYER_ID;
  playerColor = ctx.playerColor;
  shopEquippedId = ctx.shopEquippedId;
  registerMistake = ctx.registerMistake;
  pushMove = ctx.pushMove;
  afterMove = ctx.afterMove;
  coopSend = ctx.coopSend;
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
const resolvedRowSet = computed(() => { const p = state.puzzle; const s = new Set(); if (p) for (let r = 0; r < p.rows; r++) if (Model.rowResolved(p, state.marks, r)) s.add(r); return s; });
const resolvedColSet = computed(() => { const p = state.puzzle; const s = new Set(); if (p) for (let c = 0; c < p.cols; c++) if (Model.colResolved(p, state.marks, c)) s.add(c); return s; });
const resolvedRegionSet = computed(() => { const p = state.puzzle; const s = new Set(); if (p) for (let i = 0; i < p.regions.length; i++) if (Model.regionResolved(p, state.marks, i)) s.add(i); return s; });
// Render-Helfer (O(1)) — NUR im Template/cellClasses verwenden. Die Spiellogik
// nutzt weiter die rohen Modell-Funktionen für die punktuelle Vorher/Nachher-Prüfung.
export function rowResolvedR(r) { return resolvedRowSet.value.has(r); }
export function colResolvedR(c) { return resolvedColSet.value.has(c); }
export function regionResolvedR(i) { return resolvedRegionSet.value.has(i); }

// Zeilen-/Spaltensummen ebenfalls EINMAL pro Zug cachen statt in jedem Header-
// Render (mehrfach: Wert + Match-Klasse) die ganze Zeile/Spalte neu aufzusummieren.
const rowSumsC = computed(() => (state.puzzle ? Model.rowSums(state.puzzle, state.marks) : []));
const colSumsC = computed(() => (state.puzzle ? Model.colSums(state.puzzle, state.marks) : []));
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
// EINMAL pro Zug/Sprachwechsel berechnen statt ×169 bei JEDEM Render (die
// t()-Interpolation war ein messbarer Teil des Tick-Renders auf großen Brettern).
// Computed trackt state.marks + i18n-Locale.
const cellAriaLabels = computed(() => {
  const p = state.puzzle; if (!p) return [];
  const out = new Array(p.rows);
  for (let r = 0; r < p.rows; r++) {
    out[r] = new Array(p.cols);
    for (let c = 0; c < p.cols; c++) {
      const mk = state.marks[r][c];
      const status = mk === 'kept' ? t('a11y.cellKept') : mk === 'removed' ? t('a11y.cellRemoved') : t('a11y.cellUnmarked');
      out[r][c] = t('a11y.cellLabel', { row: r + 1, col: c + 1, value: p.values[r][c], status });
    }
  }
  return out;
});
export function cellAriaLabel(r, c) { return (cellAriaLabels.value[r] && cellAriaLabels.value[r][c]) || ''; }

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

export const BoardGrid = {
  setup() {
    return {
      state, cellClasses, cellStyle, cellAriaLabel, onCellTap,
      onCellPointerDown, onCellPointerMove, onCellPointerCancel,
      rowResolvedR, colResolvedR, regionResolvedR, rowSumR, colSumR, rowSumMatch, colSumMatch,
      skinBoardClasses, skinVars, gridStyle, boardFontClass, boardFrameClass,
      countRender: () => { boardRenderCount++; return ''; },
    };
  },
  template: `
          <div class="board" :class="[skinBoardClasses, boardFontClass(), boardFrameClass(), { 'skin-freeze': state.paused || state.joinFreeze, 'mp-colors': state.coop.active || state.team.active, 'big-num': state.puzzle.bigNumbers, 'tutor-dim': !!state.hintTutor }]" :style="[gridStyle, skinVars]" :data-rc="countRender()">
            <div class="corner"></div>
            <div v-for="c in state.puzzle.cols" :key="'ch'+c" class="hdr col-hdr" :class="{resolved: colResolvedR(c-1), pulse: state.justResolved['col-'+(c-1)]}">
              <template v-if="!colResolvedR(c-1)">
                <span class="cur" :class="{match: colSumMatch(c-1)}">{{ colSumR(c-1) }}</span>
                <span class="tgt">{{ state.puzzle.colTargets[c-1] }}</span>
              </template>
            </div>
            <template v-for="r in state.puzzle.rows" :key="'r'+r">
              <div class="hdr row-hdr" :class="{resolved: rowResolvedR(r-1), pulse: state.justResolved['row-'+(r-1)]}">
                <template v-if="!rowResolvedR(r-1)">
                  <span class="cur" :class="{match: rowSumMatch(r-1)}">{{ rowSumR(r-1) }}</span>
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
                <span v-if="state.cellMeta[r-1][c-1].chip!=null && !regionResolvedR(state.cellMeta[r-1][c-1].region)" class="rchip">{{ state.cellMeta[r-1][c-1].chip }}</span>
                <span class="cnum">{{ state.puzzle.values[r-1][c-1] }}</span>
                <i v-if="state.marks[r-1][c-1]==='removed' && state.cellMeta[r-1][c-1].hintMark" class="hint-dot"></i>
              </div>
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

export function onCellPointerDown(e, r, c) {
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

export function onCellPointerMove(e) {
  if (!pressState) return;
  const dx = e.clientX - pressState.x, dy = e.clientY - pressState.y;
  if (Math.hypot(dx, dy) > LONGPRESS_TOLERANCE_PX) {
    clearTimeout(pressState.timer);
    pressState = null;
  }
}

export function onCellPointerCancel() {
  if (pressState) { clearTimeout(pressState.timer); pressState = null; }
}

export function onCellTap(r, c) {
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
      // Der Fehlgriff gehört MIT ins Zug-Log (nur ein Array-Push): erst dadurch
      // lässt sich später sagen, WO jemand danebengreift — in welcher Spielphase
      // und bei welcher Art von Deduktion — statt bloß WIE OFT.
      pushMove({ r, c, want: next, t: state.elapsed, err: 1 });
      flashError(r, c); registerMistake(); return;
    }
  }

  const region = state.cellMeta[r][c].region;
  const wasRow = rowResolved(r), wasCol = colResolved(c);
  const wasRegion = region >= 0 ? regionResolved(region) : false;

  // Spielstil-Aufzeichnung: NUR ein Array-Push (kein localStorage, keine Analyse)
  // — der Tap-Pfad muss billig bleiben (Board-Render-Regeln in CLAUDE.md). Die
  // Auswertung läuft einmal am Spielende, s. recordPlaySample().
  // FREMDE Züge (Coop/Team, geteiltes Brett) wandern MIT ins Log, markiert als
  // `other`: die Auswertung stellt das Brett Zug für Zug nach, und ohne die Züge
  // des Partners wäre dieser Nachbau ab dem ersten fremden Zug falsch — die
  // Deduktions-Einordnung MEINER Züge damit auch. Gemessen werden sie nicht.
  if (next !== 'none' && (user || state.coop.active || state.team.active)) {
    pushMove(user ? { r, c, want: next, t: state.elapsed } : { r, c, want: next, t: state.elapsed, other: 1 });
  }

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
