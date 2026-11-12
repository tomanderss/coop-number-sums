// games/pipes/board.js — das BRETT von „Pipes": Darstellung, Drehen, Wasserlauf,
// und am Dateiende dieselbe Brett-Schnittstelle wie die anderen Spiele.
//
// Bedienung:
//   • Antippen dreht ein Rohrstück um 90° im Uhrzeigersinn (Rechtsklick: zurück).
//   • Langes Drücken sperrt ein Stück („liegt richtig") — gesperrte Stücke drehen
//     sich nicht versehentlich mit. Nochmal lange drücken entsperrt.
//   • Zwei Finger verschieben ein gezoomtes Brett.
//   • iOS: das Brett ruft auf `touchstart` preventDefault (`@touchstart.prevent`,
//     nicht passiv). Sonst zeigte iOS beim langen Drücken (Sperren) die Lupe /
//     Textauswahl-Vergrößerung (gemeldet). Die Gesten laufen über Pointer-Events,
//     die davon unberührt bleiben. Dasselbe gilt für alle Zieh-/Tipp-Bretter.
// Fehler gibt es keine (Drehen ist frei, wie bei Number Path): gelöst ist das
// Brett, sobald das Wasser von der Quelle JEDE Zelle erreicht und nirgends ein
// Rohr ins Leere zeigt.
//
// OPTIK (zweiter Rework, Nutzerwunsch „klare Zellen, aber der Fluss von jetzt"):
// jede Zelle ist eine eigene Platte mit feiner Fuge (man sieht, wo welche Zelle
// endet), darauf liegt das Rohr in einer drehenden Ebene: Kante, Körper, helle
// Fase und dunkler Kanal, Endstücke mit Kappe und Niete, die Quelle als Pumpe mit
// vier Schrauben. Das Rohr läuft ohne Absatz über die Zellkante, Nachbarn
// schließen also nahtlos an (s. pipeSvg).
//
// FLUSS-SCHALTER (`PipeTools` unter dem Brett, settings.pipesFlow): aus = das
// Wasser wird NICHT gezeigt (kein Füllen, keine Lecks, kein Fortschritt, kein
// Ton) und das Brett gilt nicht automatisch als gelöst — erst das Einschalten
// prüft es (`setFlow` ruft afterMove): man sieht einmalig, ob es klappt, und kann
// wieder ausschalten.
//
// DER WASSERLAUF: jede erreichte Zelle füllt sich, verzögert um ihre Entfernung
// von der Quelle (`--dl`) — das Wasser „läuft" sichtbar durch die Rohre. Im
// gefüllten Kanal treiben weiche Lichtpunkte in Flussrichtung (zur Mitte im Arm,
// aus dem das Wasser kommt, nach außen in allen anderen) — EIN animiertes
// Element je Arm mit einem Punktmuster, das nahtlos um genau eine Periode
// gleitet. Animiert werden AUSSCHLIESSLICH transform und opacity (Compositor;
// Lehre aus dem iOS-Skin-Absturz, s. CLAUDE.md), und nur, solange das Spiel
// läuft (Pause/Verstecken hält sie an).
//
// FINALE: ist das Netz geschlossen, läuft erst eine Welle von der Quelle (Mitte)
// nach außen durch jedes Stück (`--fd` nach Entfernung), DANN kommt der Sieg-
// bildschirm (`winFinaleMs`, die Schale wartet so lange) — damit man merkt, dass
// man fertig ist, auch wenn der letzte Zug auf einmal ein Viertel des Netzes
// füllt (gemeldet).

import { computed, ref, watch, onMounted, onBeforeUnmount } from '../../vue.esm-browser.prod.js';
import { shopItemById } from '../../shopitems.js';
import { t } from '../../i18n/index.js';
import * as Music from '../../music.js';
import { haptic } from '../feedback.js';
import * as Coop from '../../coop.js';
import { log } from '../../debuglog.js';
import { LiveLayer } from '../livelayer.js';
import {
  flow, isSolved, progressPct, normalizePuzzle as healPuzzle, normalizeRot,
  rotMask, mod4, has, degree, neighbor, opp,
} from './model.js';
import { solveLogic, nextDeduction } from './solver.js';

// ── Von der Schale injizierte Verweise (s. numbersums/board.js) ──────────────
let state = null;
let LOCAL_PLAYER_ID = 'local';
let playerColor = () => null;
let shopEquippedId = () => '';
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

// ── Größe ────────────────────────────────────────────────────────────────────
export const gridStyle = computed(() => {
  const p = state.puzzle;
  const r = p ? p.rows : 1, c = p ? p.cols : 1;
  return { width: c * state.cellPx + 'px', height: r * state.cellPx + 'px', '--cell': state.cellPx + 'px', '--cols': c, '--rows': r };
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
  const cap = desktopBoard() ? 112 : (shortSide >= 600 ? Math.min(110, Math.round(shortSide * 0.13)) : 76);
  state.cellPx = Math.round(Math.max(22, Math.min(cap, ideal)) * state.zoom);
}

// Wird das Wasser gezeigt? Ausgeschaltet nur WÄHREND des Spiels — ist es gelöst
// (auch durch einen Mitspieler), läuft das Finale immer.
const flowShown = computed(() => state.settings.pipesFlow !== false || state.status !== 'playing');

// ── Wasserlauf (eine Rechnung je Zug) ────────────────────────────────────────
const flowInfo = computed(() => {
  if (!state.puzzle) return null;
  const f = flow(state.puzzle, state.pipeRot);
  f.maxDepth = f.depth.reduce((a, b) => (b > a ? b : a), 0);
  return f;
});
// Finale-Dauer: die Welle braucht ~50 ms je Schritt von der Quelle, höchstens
// 1,2 s, danach klingt der letzte Puls ~0,7 s aus.
const finaleSpread = (maxDepth) => Math.min(1200, maxDepth * 50);
const FINALE_TAIL = 700;
/** So lange soll die Schale nach dem Lösen mit dem Sieg-Dialog warten (0 = gar nicht). */
export function winFinaleMs() {
  const f = flowInfo.value;
  if (!state.puzzle || !f || !isSolved(state.puzzle, state.pipeRot)) return 0;
  return finaleSpread(f.maxDepth) + FINALE_TAIL;
}

// ── Züge ─────────────────────────────────────────────────────────────────────
const me = () => state.coop.myId || LOCAL_PLAYER_ID;
const isMultiplayer = () => state.coop.active || state.team.active;
function playable() {
  return state.puzzle && state.status === 'playing' && !state.generating && !state.paused && !state.sessionReadonly
    && !(state.isTrainingGame && !state.trainingDone);
}
const endpoints = (p, f) => p.tiles.reduce((n, m, i) => n + (i !== p.source && degree(m) === 1 && f.depth[i] >= 0 ? 1 : 0), 0);

/** Ein Stück auf eine absolute Drehzahl setzen (eigener Zug). */
export function setRot(i, r, { force = false, send = true } = {}) {
  if (!force && !playable()) return false;
  if (!(i >= 0 && i < state.pipeRot.length) || state.pipeRot[i] === r) return false;
  const p = state.puzzle;
  const before = flowInfo.value;
  const supBefore = before ? endpoints(p, before) : 0;
  const rot = state.pipeRot.slice(); rot[i] = r;
  const by = state.pipeBy.slice(); by[i] = me();
  state.pipeRot = rot; state.pipeBy = by;
  if (send && isMultiplayer()) {
    const key = coopSend({ type: Coop.MSG.MOVE, op: 'rot', i, r, from: state.coop.myId });
    if (key) state.pipeKeys = { ...state.pipeKeys, [i]: key };
  }
  const after = flowInfo.value;
  // Ohne gezeigtes Wasser darf auch der Ton nichts verraten.
  const joined = flowShown.value && after && endpoints(p, after) > supBefore;
  haptic(joined ? 'done' : 'tap');
  if (joined && state.settings.sfxComplete) Music.sfxComplete(1);
  else if (state.settings.sfxKeep) Music.sfxKeep();
  afterMove();
  return true;
}
/** Fluss-Schalter: an = Wasser zeigen und das Brett prüfen (löst es, gewinnt es). */
export function setFlow(v) {
  v = !!v;
  if (state.settings.pipesFlow === v) return;
  state.settings.pipesFlow = v;
  log('game', 'Pipes: Fluss ' + (v ? 'an' : 'aus'));
  if (state.settings.sfxToolSwitch) Music.sfxToolSwitch();
  if (v && state.puzzle && state.status === 'playing') afterMove();
}
export function rotate(i, dir = 1) {
  if (!state.puzzle || state.pipeLock[i]) return false;
  return setRot(i, (state.pipeRot[i] || 0) + dir);
}
export function setLock(i, v, { send = true } = {}) {
  if (!playable() || !(i >= 0 && i < state.pipeLock.length)) return false;
  const lock = state.pipeLock.slice(); lock[i] = !!v;
  state.pipeLock = lock;
  if (send && isMultiplayer()) coopSend({ type: Coop.MSG.MOVE, op: 'lock', i, v: !!v, from: state.coop.myId });
  haptic('lock');
  return true;
}

// ── Gesten ───────────────────────────────────────────────────────────────────
const LONG_MS = 300, SLOP = 10;
let press = null;            // { id, i, x, y, timer, long }
let pan = null;
const pointers = new Map();
function cellAt(box, x, y) {
  const { rows, cols } = state.puzzle;
  const r = Math.floor((y - box.top) / (box.height / rows)), c = Math.floor((x - box.left) / (box.width / cols));
  return r < 0 || c < 0 || r >= rows || c >= cols ? -1 : r * cols + c;
}
function endPress() { if (press) { clearTimeout(press.timer); sendLive(null); } press = null; }
function onDown(e) {
  if (e.button != null && e.button > 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size >= 2) {
    endPress();
    const pts = [...pointers.values()];
    pan = { mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
    return;
  }
  if (!playable()) return;
  const i = cellAt(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  if (i < 0) return;
  press = { id: e.pointerId, i, x: e.clientX, y: e.clientY, long: false, timer: null };
  sendLive({ cur: i });
  // Sperr-Modus: ein kurzer Tipp sperrt/entsperrt (beim Loslassen), kein Langes Drücken nötig.
  if (state.pipeLockMode) return;
  press.timer = setTimeout(() => {
    if (!press) return;
    press.long = true;
    setLock(press.i, !state.pipeLock[press.i]);
  }, LONG_MS);
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
  if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) endPress();
}
function onUp(e) {
  pointers.delete(e.pointerId);
  if (pan) { if (pointers.size < 2) pan = null; return; }
  if (!press || e.pointerId !== press.id) return;
  const p = press; endPress();
  if (p.long) return;
  if (state.pipeLockMode) setLock(p.i, !state.pipeLock[p.i]);
  else rotate(p.i, 1);
}
function onCancel(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pan = null;
  if (press && e.pointerId === press.id) endPress();
}
// Rechtsklick (Desktop) dreht zurück.
function onContext(e) {
  if (!state.puzzle || !playable()) return;
  const i = cellAt(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  if (i < 0) return;
  // Im Sperr-Modus wird nie gedreht — Rechtsklick sperrt wie ein Tipp.
  if (state.pipeLockMode) setLock(i, !state.pipeLock[i]);
  else rotate(i, -1);
}

// ── Darstellung ──────────────────────────────────────────────────────────────
const pct = (v, n) => `${(v / n) * 100}%`;
let boardRenderCount = 0;
export function boardRenders() { return boardRenderCount; }
const countRender = () => { boardRenderCount++; return ''; };
// Zählt Neuzeichnungen einzelner Stücke (Test: eine Drehung zeichnet nicht das ganze Brett neu).
let tileRenderCount = 0;
export function cellRenders() { return tileRenderCount; }
const countTile = () => { tileRenderCount++; return ''; };

// Das ROHR eines Stücks in seiner Grundlage (Maske `m`, ungedreht), als SVG in
// einem 100er-Raster. Gezeichnet in SCHICHTEN über Arme und Nabe zugleich —
// erst alle Kanten, dann alle Körper, dann die helle Fase, zuletzt die Bohrung —
// so gibt es an Biegungen und T-Stücken keine durchscheinenden Kreise, und das
// Rohr läuft ohne Absatz bis zur Zellkante: Nachbarn schließen nahtlos an (ein
// erster Entwurf mit Muffen an der Kante ließ das Netz wie nebeneinander gelegte
// Einzelteile wirken — gemeldet). Endstück: Kappe mit Fassung und Niete,
// Quelle: Pumpe mit vier Schrauben. Hängt nur am Rätsel → einmal je Stück gebaut.
// Arme laufen ÜBER die Zellkante, und zwar jede höhere Schicht ein Stück
// weiter (Kante 0,5 · Körper 1 · Fase 1,5 · Kanal 2 Einheiten). Grund (gemeldet:
// „Lücken und Stufen an den Zellgrenzen"): endeten alle Schichten des Nachbarn
// auf DERSELBEN Pixelspalte, stapelte sich dort ihre Kantenglättung — Kante
// halb, darüber Körper halb … — und ergab eine feine dunkle Naht, bei krummer
// Pixeldichte eine Stufe. Gestaffelt liegt jedes Schichtende entweder auf
// derselben Farbe des Nachbarn oder unter einer deckenden höheren Schicht —
// unsichtbar.
const OVER = { edge: 0.5, body: 1, rim: 1.5, bore: 2 };
const armTo = (k, o) => (k === 0 ? `V${-o}` : k === 1 ? `H${100 + o}` : k === 2 ? `V${100 + o}` : `H${-o}`);
// Breiten (Durchmesser) je Schicht: Kante, Körper, Fase, Bohrung.
const W = { edge: 40, body: 36, rim: 24, bore: 20 };
const ring = (cls, r) => `<circle class="${cls}" cx="50" cy="50" r="${r}"/>`;
function pipeSvg(m, kind) {
  const arms = [];
  for (let k = 0; k < 4; k++) if (m & (1 << k)) arms.push(k);
  const d = (cls) => arms.map((k) => `M50 50${armTo(k, OVER[cls])}`).join('');
  // Nabe je Schicht (Radius): Endstück = Kappe, Quelle = Pumpengehäuse.
  const hub = kind === 'src' ? { edge: 33, body: 31, rim: 23, bore: 19 }
    : kind === 'end' ? { edge: 24, body: 22, rim: 12, bore: 10 }
      : { edge: W.edge / 2, body: W.body / 2, rim: W.rim / 2, bore: W.bore / 2 };
  const layer = (cls) => `<path class="pp-${cls}" d="${d(cls)}" stroke-width="${W[cls]}"/>${ring('pp-' + cls + ' pp-hubc', hub[cls])}`;
  let extra = '';
  if (kind === 'src') extra = ring('pp-src-ring', 26) + [[27, 27], [73, 27], [27, 73], [73, 73]].map(([x, y]) => `<circle class="pp-bolt" cx="${x}" cy="${y}" r="2.8"/>`).join('');
  else if (kind === 'end') extra = ring('pp-rivet', 3.2);
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${layer('edge')}${layer('body')}${layer('rim')}${layer('bore')}${extra}</svg>`;
}
// Art des Stücks (hängt nur am Rätsel) und das Rohr-SVG je Maske — gezeichnet
// wird immer die AKTUELLE Lage (Maske nach Drehung), zwischengespeichert je
// Maske+Art (höchstens 16 · 3 Varianten).
const tileKind = computed(() => {
  const p = state.puzzle;
  if (!p) return [];
  return p.tiles.map((m, i) => (i === p.source ? 'src' : degree(m) === 1 ? 'end' : 'pipe'));
});
const svgCache = new Map();
function svgFor(mask, kind) {
  const key = mask + kind;
  let s = svgCache.get(key);
  if (!s) { s = pipeSvg(mask, kind); svgCache.set(key, s); }
  return s;
}
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// Aussehen eines Stücks samt Kennung `sig` (alles, was das Bild bestimmt).
function tileLook(i) {
  const p = state.puzzle, f = flowInfo.value;
  const r = state.pipeRot[i] || 0, n = p.cols;
  const show = flowShown.value;
  const wet = show && !!f && f.depth[i] >= 0;
  const kind = tileKind.value[i];
  const mask = rotMask(p.tiles[i], r);
  // Je Arm (Richtung auf dem Brett): Fluss nach innen (woher das Wasser
  // kommt) oder nach außen; ein Arm, der ins Leere führt, leckt.
  const arms = [];
  for (let k = 0; k < 4; k++) {
    if (!(mask & (1 << k))) continue;
    const j = neighbor(p, i, k);
    const leak = j < 0 || !has(f.masks[j], opp(k));
    arms.push({ k, inn: wet && f.from[i] === k, leak: wet && leak });
  }
  const by = state.pipeBy[i];
  const col = isMultiplayer() && by && by !== me() && by !== LOCAL_PLAYER_ID ? playerColor(by) : null;
  const locked = !!state.pipeLock[i];
  // Verzögerung der Füllung nach Entfernung zur Quelle — zählt nur im Moment,
  // in dem das Stück nass wird (s. tileLookFrom).
  const dl = wet ? Math.min(1400, f.depth[i] * 45) + 'ms' : '0ms';
  // Finale: Welle von der Quelle nach außen, über höchstens FINALE_SPREAD
  // verteilt. Nur im Finale gebraucht — sonst änderte jeder Zug (neue größte
  // Tiefe) die Werte ALLER nassen Stücke.
  const fd = wet && f.maxDepth && state.status === 'won' ? Math.round((f.depth[i] / f.maxDepth) * finaleSpread(f.maxDepth)) + 'ms' : '0ms';
  const sig = [mod4(r), mask, kind, wet, locked, col, fd, arms.map((a) => a.k + (a.inn ? 'i' : '') + (a.leak ? 'l' : '')).join('')].join('|');
  return {
    cls: [kind, { wet, locked }],
    style: {
      left: pct(i % n, n), top: pct(Math.floor(i / n), p.rows), width: pct(1, n), height: pct(1, p.rows),
      '--dl': dl, '--fd': fd,
      ...(col ? { '--pb': col } : {}),
    },
    rot: mod4(r),
    wet, dl, sig, locked,
    svg: svgFor(mask, kind), arms,
  };
}
// Bleibt ein Stück nass, behält es seine Verzögerung (sie wirkt nur beim
// Nasswerden) — sonst zöge eine Änderung weit oben im Netz alle Stücke
// dahinter mit. Gleiches Aussehen → dasselbe Objekt, kein Neuzeichnen.
function tileLookFrom(prev, i) {
  const next = tileLook(i);
  if (prev && prev.wet && next.wet && prev.dl !== next.dl) { next.dl = prev.dl; next.style['--dl'] = prev.dl; }
  return prev && prev.sig === next.sig && prev.dl === next.dl ? prev : next;
}

// Ein Stück. Eigene Komponente: rendert neu, wenn sich SEIN Zustand ändert.
//
// AUSRICHTUNG (gemeldet: „Rohre nicht exakt aneinandergereiht, Stufen"): im
// Ruhezustand ist NICHTS gedreht — das SVG zeigt das Rohr direkt in seiner
// aktuellen Lage. Vorher lag jedes Stück in einer per CSS gedrehten Ebene; der
// Browser rastert die je Zelle anders auf das Gerätepixel-Raster (krumme
// Pixeldichte), und Nachbarn mit unterschiedlicher Drehung landeten um
// Bruchteile eines Pixels versetzt. Die Dreh-Animation läuft trotzdem: nach
// einer Drehung wird die neue Lage sofort um die Differenz ZURÜCKgedreht
// gezeigt und gleitet dann auf 0 (FLIP) — gedreht ist nur während der Bewegung.
const PipeTile = {
  props: ['i'],
  setup(props) {
    const rotEl = ref(null);
    watch(() => state.pipeRot[props.i], (r, old) => {
      const el = rotEl.value;
      const d = (r || 0) - (old || 0);
      if (!el || old == null || !d || reducedMotion()) return;
      // Web Animations statt „Transition aus, Lage setzen, offsetWidth lesen":
      // das Lesen erzwang je Drehung eine Stil-Neuberechnung des GANZEN
      // Bretts — samt aller laufenden Wasser-Animationen (12×12 hakelig).
      if (el.getAnimations) el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ transform: `rotate(${-d * 90}deg)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.3, 1.35, .55, 1)' });
    }, { flush: 'post' });
    // Bleibt das Aussehen gleich, liefert `look` DASSELBE Objekt zurück — dann
    // zeichnet sich das Stück nicht neu. Jeder Zug ändert den Wasserlauf und
    // damit die Abhängigkeit ALLER Stücke; ohne diesen Schritt rechnete und
    // verglich Vue bei jeder Drehung alle 144 Stücke eines 12×12-Bretts neu.
    const look = computed((prev) => tileLookFrom(prev, props.i));
    return { look, rotEl, countTile };
  },
  template: `
              <div class="pp-tile" :class="look.cls" :style="look.style" :data-rot="look.rot" :data-rc="countTile()">
                <div class="pp-plate"></div>
                <div class="pp-wave"></div>
                <span v-if="look.locked" class="pp-lockmark"></span>
                <div class="pp-rot" ref="rotEl">
                  <div class="pp-pipe" v-html="look.svg"></div>
                  <div v-for="a in look.arms" :key="a.k" class="pp-arm" :class="['d' + a.k, { inn: a.inn, leak: a.leak }]"><i></i></div>
                  <div class="pp-hub"></div>
                </div>
              </div>`,
};

const TileLayer = {
  components: { PipeTile },
  setup() {
    const ids = computed(() => (state.puzzle ? state.puzzle.tiles.map((_, i) => i) : []));
    return { ids, countRender };
  },
  template: `
            <div class="pp-tiles" :data-rc="countRender()">
              <pipe-tile v-for="i in ids" :key="i" :i="i"></pipe-tile>
            </div>`,
};

// Training: das Stück, das als Nächstes zwingend feststeht.
const FocusLayer = {
  setup() {
    const focus = computed(() => {
      const st = state.isTrainingGame ? state.trainingStep : null;
      if (!st || !state.puzzle) return null;
      const n = state.puzzle.cols;
      return { left: pct(st.i % n, n), top: pct(Math.floor(st.i / n), state.puzzle.rows), width: pct(1, n), height: pct(1, state.puzzle.rows) };
    });
    return { focus };
  },
  template: `<div class="pp-focus" aria-hidden="true" v-if="focus"><div class="pp-train" :style="focus"></div></div>`,
};

// ── Fluss-Schalter unter dem Brett (BoardBelow) ──
// Ein einzelner Aktivierungs-Knopf in der Mitte, gleich groß wie der Umschalter
// der anderen Spiele: an = Wasser sichtbar (Standard), aus = nur die Rohre.
const DROP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c3.2 3.9 5.6 6.8 5.6 10a5.6 5.6 0 0 1-11.2 0c0-3.2 2.4-6.1 5.6-10z" fill="currentColor"/><path d="M9.6 14.2a2.6 2.6 0 0 0 2.2 2.4" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/></svg>';
function toggleFlow() { setFlow(state.settings.pipesFlow === false); }
// Sperr-Modus (Nutzerwunsch): kurzer Tipp sperrt/entsperrt statt zu drehen.
export function setLockMode(v) {
  v = !!v;
  if (state.pipeLockMode === v) return;
  state.pipeLockMode = v;
  log('game', 'Pipes: Sperr-Modus ' + (v ? 'an' : 'aus'));
  if (state.settings.sfxToolSwitch) Music.sfxToolSwitch();
}
function toggleLockMode() { setLockMode(!state.pipeLockMode); }
const LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
export const PipeTools = {
  setup() {
    const show = computed(() => !!state.puzzle && !(state.isTrainingGame && !state.trainingDone));
    const on = computed(() => state.settings.pipesFlow !== false);
    const lockOn = computed(() => !!state.pipeLockMode);
    return { state, show, on, lockOn, toggleFlow, toggleLockMode, t, DROP_ICON, LOCK_ICON };
  },
  template: `
          <div class="pp-tools-wrap">
            <div v-if="show" class="pp-tools-row">
              <button type="button" class="pp-flow-btn" :class="{ on }" role="switch" :aria-checked="on"
                      :aria-label="t('pipe.flow.aria')" @click="toggleFlow">
                <span class="pp-flow-ic" v-html="DROP_ICON"></span>
                <span class="pp-flow-tx">{{ on ? t('pipe.flow.on') : t('pipe.flow.off') }}</span>
              </button>
              <button type="button" class="pp-flow-btn pp-lock-btn" :class="{ on: lockOn }" role="switch" :aria-checked="lockOn"
                      :aria-label="t('pipe.lock.aria')" @click="toggleLockMode">
                <span class="pp-flow-ic" v-html="LOCK_ICON"></span>
                <span class="pp-flow-tx">{{ t('pipe.lock.label') }}</span>
              </button>
            </div>

          </div>
  `,
};

export const BoardGrid = {
  components: { TileLayer, FocusLayer, LiveLayer },
  setup() {
    const t0 = performance.now();
    onMounted(() => log('perf', 'Brett aufgebaut', { game: 'pipes', cells: state.puzzle ? state.puzzle.rows * state.puzzle.cols : 0, tookMs: Math.round(performance.now() - t0) }));
    onBeforeUnmount(() => { endPress(); pan = null; pointers.clear(); });
    const still = computed(() => state.paused || state.status !== 'playing' && state.status !== 'won');
    const dry = computed(() => !flowShown.value);
    return { state, gridStyle, boardFontClass, onDown, onMove, onUp, onCancel, onContext, still, dry, t };
  },
  template: `
          <div class="board pp-board" :class="[boardFontClass(), { done: state.status === 'won', still, dry, wrap: !!state.puzzle.wrap }]" :style="gridStyle"
               role="application" :aria-label="t('pipe.boardLabel')"
               @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture="onCancel"
               @touchstart.prevent
               @contextmenu.prevent="onContext">
            <tile-layer></tile-layer>
            <focus-layer></focus-layer>
            <live-layer></live-layer>
          </div>
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// BRETT-SCHNITTSTELLE — dieselben Namen wie in games/numbersums/board.js.
// ═════════════════════════════════════════════════════════════════════════════

export function normalizePuzzle(p) { return healPuzzle(p); }

const arr = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
export function loadBoard(puzzle, saved) {
  const n = puzzle.rows * puzzle.cols;
  state.pipeRot = normalizeRot(saved && saved.pipeRot, n);
  const by = arr(saved && saved.pipeBy), lock = arr(saved && saved.pipeLock);
  state.pipeBy = Array.from({ length: n }, (_, i) => by[i] || '');
  state.pipeLock = Array.from({ length: n }, (_, i) => !!lock[i]);
  state.pipeKeys = {};
  state.pipeLockMode = false;
  endPress(); pan = null; pointers.clear();
}

export function boardFields(purpose) {
  if (purpose === 'history') return { pipeRot: state.pipeRot.slice() };
  return { pipeRot: state.pipeRot.slice(), pipeBy: state.pipeBy.map((x) => x || ''), pipeLock: state.pipeLock.map((x) => !!x) };
}
export function boardFieldsFrom(src) { return { pipeRot: src.pipeRot, pipeBy: src.pipeBy, pipeLock: src.pipeLock }; }

// Ohne gezeigtes Wasser gilt das Brett nicht automatisch als gelöst — erst das
// Einschalten des Flusses prüft es (setFlow → afterMove).
export function boardSolved() { return !!state.puzzle && flowShown.value && isSolved(state.puzzle, state.pipeRot); }
export function boardProgressPct() { return state.puzzle && flowShown.value ? progressPct(state.puzzle, state.pipeRot) : 0; }
export function boardFilledCount() { return flowInfo.value && flowShown.value ? flowInfo.value.reached : 0; }
export function boardProgressCounts() {
  const p = state.puzzle;
  return p ? { kept: flowInfo.value && flowShown.value ? flowInfo.value.reached : 0, total: p.rows * p.cols } : { kept: 0, total: 0 };
}
const solMask = (p, i) => rotMask(p.tiles[i], p.solRot[i]);
const isRight = (p, i) => rotMask(p.tiles[i], state.pipeRot[i]) === solMask(p, i);
// „Richtig" = Stücke, die dieser Spieler zuletzt gedreht hat und die jetzt richtig liegen.
export function playerCorrect(id) {
  const p = state.puzzle;
  let n = 0;
  for (let i = 0; i < p.tiles.length; i++) {
    const by = state.pipeBy[i];
    const mine = by === id || (by === LOCAL_PLAYER_ID && id === state.coop.myId);
    if (mine && isRight(p, i)) n++;
  }
  return n;
}
export function wrongCells() { return []; }

// Züge eines Mitspielers: je Stück gewinnt der SPÄTERE Zug (Ereignis-Schlüssel).
export function applyRemoteMove(msg, eventKey = null) {
  if (!state.puzzle) return;
  const i = Number(msg.i);
  if (!(i >= 0 && i < state.pipeRot.length)) return;
  if (msg.op === 'lock') { const lock = state.pipeLock.slice(); lock[i] = !!msg.v; state.pipeLock = lock; return; }
  if (msg.op !== 'rot' || !Number.isFinite(Number(msg.r))) return;
  if (eventKey && state.pipeKeys[i] && eventKey < state.pipeKeys[i]) return;
  if (eventKey) state.pipeKeys = { ...state.pipeKeys, [i]: eventKey };
  if (state.pipeRot[i] === Number(msg.r)) return;
  const rot = state.pipeRot.slice(); rot[i] = Number(msg.r);
  const by = state.pipeBy.slice(); by[i] = msg.from || '';
  state.pipeRot = rot; state.pipeBy = by;
  afterMove();
}
export function applyRemoteHint() {}
// Kein Rückgängig (Drehen ist frei), keine Tipps — wie Number Path.
export function undoLast() { return false; }
export function buildHint() { return null; }
export function applyHintEffect() {}
export function clearStaleTutor() {}

// ── Training: das nächste erzwungene Stück ab den RICHTIG liegenden ──
export function isFullyTier1Solvable(p) { return solveLogic(p, { maxTier: 1 }).solved; }
export function trainingStep() {
  const p = state.puzzle;
  if (!p) return null;
  const known = [];
  for (let i = 0; i < p.tiles.length; i++) if (isRight(p, i)) known.push({ i, m: solMask(p, i) });
  let st = nextDeduction(p, known, 1) || nextDeduction(p, known, 2);
  if (!st) {
    // Notausgang: das erste falsch liegende Stück am Wasser.
    const f = flowInfo.value;
    const i = p.tiles.findIndex((_, x) => !isRight(p, x) && (!f || f.depth[x] >= 0)) >= 0
      ? p.tiles.findIndex((_, x) => !isRight(p, x) && (!f || f.depth[x] >= 0))
      : p.tiles.findIndex((_, x) => !isRight(p, x));
    if (i < 0) return null;
    st = { i, m: solMask(p, i), why: 'net' };
  }
  return { i: st.i, m: st.m, why: st.why, r: Math.floor(st.i / p.cols), c: st.i % p.cols };
}
export function applyTrainingStep(step) {
  if (!step) return;
  const p = state.puzzle;
  const cur = state.pipeRot[step.i] || 0;
  let r = cur;
  for (let k = 1; k <= 4 && rotMask(p.tiles[step.i], r) !== step.m; k++) r = cur + k;
  setRot(step.i, r, { force: true });
  const lock = state.pipeLock.slice(); lock[step.i] = true; state.pipeLock = lock;
}
export function trainingText(step) {
  return { title: t('pipe.train.title'), body: t('pipe.train.' + (step.why === 'net' ? 'net' : 'edge')) };
}
export function onPlayerColorsChanged() {}
export function resetCellStyleCache() {}

// ── Verlauf: das gelöste Netz ──
export function historyExtras() { return {}; }
function historyStyle(p) {
  const avail = Math.min(window.innerWidth - 80, 380);
  const cell = Math.max(16, Math.min(40, Math.floor(avail / p.cols)));
  return { width: p.cols * cell + 'px', height: p.rows * cell + 'px', '--cell': cell + 'px', '--cols': p.cols, '--rows': p.rows };
}
export const HistoryBoard = {
  props: ['detail'],
  setup() {
    const tiles = (p) => p.tiles.map((m, i) => ({
      i, svg: pipeSvg(rotMask(m, p.solRot[i]), i === p.source ? 'src' : degree(m) === 1 ? 'end' : 'pipe'),
      style: { left: pct(i % p.cols, p.cols), top: pct(Math.floor(i / p.cols), p.rows), width: pct(1, p.cols), height: pct(1, p.rows) },
    }));
    return { historyStyle, tiles };
  },
  template: `
          <div class="board pp-board history-board done still" :class="{ wrap: !!detail.puzzle.wrap }" :style="historyStyle(detail.puzzle)">
            <div class="pp-tiles"><div v-for="x in tiles(detail.puzzle)" :key="x.i" class="pp-tile wet" :style="x.style"><div class="pp-rot"><div class="pp-pipe" v-html="x.svg"></div></div></div></div>
          </div>
  `,
};

// ── Test-Haken (nur localhost, s. window.__cns in app.js) ──
export function testHooks() {
  return {
    rotatePipe: (i, dir = 1) => rotate(i, dir),
    setPipeRot: (i, r) => setRot(i, r),
    lockPipe: (i, v = true) => setLock(i, v),
    solvePipes: () => {
      const p = state.puzzle;
      let n = 0;
      for (let i = 0; i < p.tiles.length; i++) {
        if (isRight(p, i)) continue;
        const cur = state.pipeRot[i] || 0;
        let r = cur;
        for (let k = 1; k <= 4 && rotMask(p.tiles[i], r) !== solMask(p, i); k++) r = cur + k;
        if (setRot(i, r)) n++;
      }
      return n;
    },
  };
}
