// gamewheel.js — Spielauswahl als horizontale „rotierende Scheibe".
//
// Das laufende Spiel steht groß in der Mitte, die anderen sitzen links/rechts
// kleiner, nach hinten gekippt und blasser auf derselben Scheibe. Man zieht
// (Finger/Maus) oder tippt ein Seiten-Logo an; beim Loslassen rastet die Scheibe
// weich auf das nächste Spiel ein, ERST danach wird gewechselt (`select`) —
// so stockt die Animation nie an der Arbeit des Wechsels.
//
// ENDLOS (Nutzerwunsch): die Scheibe ist ein RING — rechts nach dem letzten
// Eintrag kommt wieder der erste. `st.pos` ist dafür eine fortlaufende
// „virtuelle" Position; gerendert werden Plätze rund um sie (`wheelSlots`), jeder
// Platz zeigt `items[mod(j, n)]`. Ein Spiel kann so links UND rechts auftauchen;
// das nächstgelegene Exemplar trägt `data-game` (Tests/Antippen), die anderen
// `data-copy`.
//
// Eigene Komponente mit eigenem Zustand: während des Ziehens zeichnet sich NUR
// die Scheibe neu (ein paar Logos), nicht das Menü darunter. Bewegt werden
// ausschließlich transform/opacity (Compositor; Lehre aus dem iOS-Skin-Absturz).
import { reactive, computed, watch, onMounted, onBeforeUnmount, ref, nextTick } from './vue.esm-browser.prod.js';

// Reine Geometrie je Logo, unit-getestet: `o` = Abstand zur Mitte in Logo-Schritten
// (0 = Mitte, ±1 = Nachbar, Zwischenwerte während des Ziehens).
// Eng wie ein Kartenfächer: die Nachbarn rücken dicht an die Mitte, weiter
// entfernte werden gestaucht statt ausgeblendet — so sieht man auf JEDER Seite,
// wie viele Spiele dort liegen (Nutzerwunsch: vorher war auf dem ersten Spiel
// nur das rechte Nachbarlogo zu sehen, das übernächste war unsichtbar).
export const WHEEL_VISIBLE = 4.5;   // ab diesem Abstand (in Logos) ausgeblendet
export function wheelItemStyle(o, spacing) {
  const a = Math.min(Math.abs(o), WHEEL_VISIBLE);
  // Erster Schritt voll, jeder weitere stark gestaucht (Fächer). Seit Mix als
  // fünfter Eintrag dazukam, muss vom ersten Spiel aus auch das VIERTnächste
  // Logo noch im Bild liegen.
  // Die ersten beiden Schritte bleiben antippbar weit (wie bisher), erst danach
  // rücken die Logos eng zusammen.
  const dist = a <= 1 ? a : a <= 2 ? 1 + (a - 1) * 0.6 : 1.6 + (a - 2) * 0.33;
  const x = Math.sign(o) * dist * spacing;
  const z = -a * 90;
  const rot = Math.max(-55, Math.min(55, -o * 30));
  const scale = Math.max(0.42, 1 - a * 0.2);
  // Bis zum viertnächsten Logo deutlich sichtbar (mind. 0,34), danach blendet es aus.
  const opacity = a <= 4 ? Math.max(0.34, 1 - a * 0.2) : 0.34 * (WHEEL_VISIBLE - a) / (WHEEL_VISIBLE - 4);
  return {
    transform: `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
    opacity: Math.max(0, opacity).toFixed(3),
    zIndex: String(100 - Math.round(a * 10)),
  };
}
// Auf welches Spiel die Scheibe nach dem Loslassen einrastet. Ein zügiger Wisch
// (`velocity` in Logos/ms) reicht für einen Schritt, auch wenn die Hälfte nicht
// erreicht wurde.
// `count` = null → Ring ohne Enden (keine Begrenzung).
export function snapTarget(pos, velocity, count = null) {
  const fling = Math.max(-0.6, Math.min(0.6, (velocity || 0) * 150));
  const t = Math.round(pos + fling);
  return count == null ? t : Math.max(0, Math.min(count - 1, t));
}
export const mod = (j, n) => ((j % n) + n) % n;
/**
 * Die sichtbaren Plätze des Rings um die virtuelle Position `pos` (rein,
 * unit-getestet): je Platz `{ j, idx, o, primary }` — `j` virtuelle Nummer,
 * `idx` Eintrag, `o` Abstand zur Mitte, `primary` = nächstgelegenes Exemplar
 * dieses Eintrags.
 */
export function wheelSlots(pos, n, visible = WHEEL_VISIBLE) {
  if (!n) return [];
  const out = [];
  const lo = Math.ceil(pos - visible), hi = Math.floor(pos + visible);
  for (let j = lo; j <= hi; j++) out.push({ j, idx: mod(j, n), o: j - pos, primary: false });
  const best = new Map();
  for (const sl of out) { const b = best.get(sl.idx); if (!b || Math.abs(sl.o) < Math.abs(b.o)) best.set(sl.idx, sl); }
  for (const sl of best.values()) sl.primary = true;
  return out;
}
/** Die virtuelle Nummer des Eintrags `idx`, die `pos` am nächsten liegt. */
export function nearestSlot(pos, idx, n) {
  const base = Math.round(pos);
  let d = mod(idx - base, n);
  if (d > n / 2) d -= n;
  return base + d;
}

export const GameWheel = {
  name: 'GameWheel',
  props: {
    items: { type: Array, required: true },     // [{ id, logo, name }]
    current: { type: String, required: true },
    label: { type: String, default: '' },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const root = ref(null);
    const idxOf = (id) => Math.max(0, props.items.findIndex((g) => g.id === id));
    const n = () => props.items.length;
    // Virtuelle Position im Ring (wächst beim Weiterdrehen beliebig).
    const slotOf = (id) => nearestSlot(st.pos, idxOf(id), n());
    const st = reactive({ pos: idxOf(props.current), dragging: false, spacing: 120 });
    let drag = null;          // { x, pos, t, moved, lastX, lastT, v }
    let settleTimer = null;

    const measure = () => {
      const w = root.value ? root.value.clientWidth : 360;
      // Enger als früher (0.36 · Breite): die Nachbarn überlappen die Mitte leicht.
      st.spacing = Math.max(62, Math.min(118, w * 0.24));
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    onMounted(() => { measure(); if (ro && root.value) ro.observe(root.value); });
    onBeforeUnmount(() => { if (ro) ro.disconnect(); clearTimeout(settleTimer); });

    // Von außen gewechselt (oder ein Wechsel wurde abgelehnt): weich dorthin drehen.
    watch(() => props.current, (id) => { if (!drag) st.pos = slotOf(id); });

    const settleTo = (i) => {
      st.pos = i;
      clearTimeout(settleTimer);
      const it = props.items[mod(i, n())];
      const id = it && it.id;
      if (!id || id === props.current) return;
      // Erst nach dem Einrasten wechseln; danach prüfen, ob der Wechsel auch
      // angenommen wurde — sonst zurückdrehen (z.B. während einer Partie gesperrt).
      settleTimer = setTimeout(() => {
        emit('select', id);
        nextTick(() => { if (props.current !== id) st.pos = slotOf(props.current); });
      }, 380);
    };

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      clearTimeout(settleTimer);
      // Das getroffene Logo JETZT merken: nach setPointerCapture landet das
      // Loslassen auf der Scheibe selbst, nicht mehr auf dem Logo.
      const hit = e.target && e.target.closest ? e.target.closest('[data-wheel-index]') : null;
      drag = { x: e.clientX, pos: st.pos, moved: 0, lastX: e.clientX, lastT: e.timeStamp, v: 0, id: e.pointerId, hit: hit ? Number(hit.dataset.wheelIndex) : null };
      st.dragging = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      const dt = Math.max(1, e.timeStamp - drag.lastT);
      drag.v = -(e.clientX - drag.lastX) / st.spacing / dt;
      drag.lastX = e.clientX; drag.lastT = e.timeStamp;
      st.pos = drag.pos - dx / st.spacing;   // Ring: keine Enden, kein Gummiband
    };
    const onUp = (e) => {
      if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      st.dragging = false;
      if (d.moved < 6) {
        // Tipp: ein Seiten-Logo dreht sich in die Mitte.
        if (d.hit != null) { settleTo(d.hit); return; }
        st.pos = slotOf(props.current);
        return;
      }
      // Schwung zählt erst ab gut einem Drittel Logo Weg — ein kurzer Zieher
      // rastet zurück, auch wenn er schnell war (im CI wackelte das je nach Takt).
      settleTo(snapTarget(st.pos, Math.abs(st.pos - d.pos) >= 0.35 ? d.v : 0));
    };
    const onKey = (e) => {
      const cur = Math.round(st.pos);
      if (e.key === 'ArrowLeft') { e.preventDefault(); settleTo(cur - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); settleTo(cur + 1); }
    };
    // Touchpad/Mausrad seitwärts: ein Schritt je deutlicher Bewegung.
    let wheelAcc = 0, wheelT = 0;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (e.timeStamp - wheelT > 400) wheelAcc = 0;
      wheelT = e.timeStamp;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 60) {
        const cur = Math.round(st.pos);
        settleTo(cur + Math.sign(wheelAcc));
        wheelAcc = 0;
      }
    };

    const slots = computed(() => wheelSlots(st.pos, n()).map((sl) => ({ ...sl, g: props.items[sl.idx], style: wheelItemStyle(sl.o, st.spacing) })));
    // Namen nur für die Plätze direkt um die Mitte.
    const names = computed(() => slots.value.filter((sl) => Math.abs(sl.o) < 1).map((sl) => ({
      j: sl.j, name: sl.g.name,
      style: { opacity: Math.max(0, 1 - Math.abs(sl.o) * 1.8).toFixed(3), transform: `translate3d(${(sl.o * 46).toFixed(1)}px,0,0)` },
    })));
    const centerIdx = computed(() => mod(Math.round(st.pos), n()));
    return { root, st, slots, names, centerIdx, onDown, onMove, onUp, onKey, onWheel };
  },
  template: `
    <div class="game-wheel" ref="root" :class="{ dragging: st.dragging }" role="tablist" :aria-label="label" tabindex="0"
         @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @keydown="onKey" @wheel="onWheel">
      <div class="gw-stage">
        <button v-for="sl in slots" :key="sl.j" type="button" class="gw-item" :class="{ on: sl.primary && sl.g.id === current }"
                :data-wheel-index="sl.j" :data-game="sl.primary ? sl.g.id : null" :data-copy="sl.primary ? null : sl.g.id"
                role="tab" :aria-selected="String(sl.primary && sl.g.id === current)" :aria-label="sl.g.name" :aria-hidden="sl.primary ? null : 'true'"
                tabindex="-1" :style="sl.style">
          <span class="gw-glow" :style="{ opacity: Math.max(0, 1 - Math.abs(sl.o) * 1.5) }"></span>
          <img class="gw-logo" :src="sl.g.logo" decoding="sync" alt="" draggable="false" />
        </button>
      </div>
      <div class="gw-names" aria-hidden="true">
        <span v-for="x in names" :key="x.j" class="gw-name" :style="x.style">{{ x.name }}</span>
      </div>
      <div class="gw-dots" aria-hidden="true">
        <i v-for="(g, i) in items" :key="g.id" :class="{ on: i === centerIdx }"></i>
      </div>
    </div>`,
};
