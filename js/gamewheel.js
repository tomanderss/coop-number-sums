// gamewheel.js — Spielauswahl als horizontale „rotierende Scheibe".
//
// Das laufende Spiel steht groß in der Mitte, die anderen sitzen links/rechts
// kleiner, nach hinten gekippt und blasser auf derselben Scheibe. Man zieht
// (Finger/Maus) oder tippt ein Seiten-Logo an; beim Loslassen rastet die Scheibe
// weich auf das nächste Spiel ein, ERST danach wird gewechselt (`select`) —
// so stockt die Animation nie an der Arbeit des Wechsels.
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
export const WHEEL_VISIBLE = 3.5;   // ab diesem Abstand (in Logos) ausgeblendet
export function wheelItemStyle(o, spacing) {
  const a = Math.min(Math.abs(o), WHEEL_VISIBLE);
  // Erster Schritt voll, jeder weitere gestaucht (Fächer).
  const dist = a <= 1 ? a : 1 + (a - 1) * 0.6;
  const x = Math.sign(o) * dist * spacing;
  const z = -a * 90;
  const rot = Math.max(-55, Math.min(55, -o * 30));
  const scale = Math.max(0.42, 1 - a * 0.2);
  const opacity = a <= 3 ? 1 - a * 0.22 : Math.max(0, 0.34 * (WHEEL_VISIBLE - a) / (WHEEL_VISIBLE - 3));
  return {
    transform: `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
    opacity: Math.max(0, opacity).toFixed(3),
    zIndex: String(100 - Math.round(a * 10)),
  };
}
// Gummiband jenseits der Enden: man spürt den Rand, statt dass die Scheibe hart stoppt.
export function rubberBand(pos, max) {
  if (pos < 0) return -Math.sqrt(-pos) * 0.35;
  if (pos > max) return max + Math.sqrt(pos - max) * 0.35;
  return pos;
}
// Auf welches Spiel die Scheibe nach dem Loslassen einrastet. Ein zügiger Wisch
// (`velocity` in Logos/ms) reicht für einen Schritt, auch wenn die Hälfte nicht
// erreicht wurde.
export function snapTarget(pos, velocity, count) {
  const fling = Math.max(-0.6, Math.min(0.6, (velocity || 0) * 150));
  return Math.max(0, Math.min(count - 1, Math.round(pos + fling)));
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
    watch(() => props.current, (id) => { if (!drag) st.pos = idxOf(id); });

    const settleTo = (i) => {
      st.pos = i;
      clearTimeout(settleTimer);
      const id = props.items[i] && props.items[i].id;
      if (!id || id === props.current) return;
      // Erst nach dem Einrasten wechseln; danach prüfen, ob der Wechsel auch
      // angenommen wurde — sonst zurückdrehen (z.B. während einer Partie gesperrt).
      settleTimer = setTimeout(() => {
        emit('select', id);
        nextTick(() => { if (props.current !== id) st.pos = idxOf(props.current); });
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
      st.pos = rubberBand(drag.pos - dx / st.spacing, props.items.length - 1);
    };
    const onUp = (e) => {
      if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      st.dragging = false;
      if (d.moved < 6) {
        // Tipp: ein Seiten-Logo dreht sich in die Mitte.
        if (d.hit != null) { settleTo(d.hit); return; }
        st.pos = idxOf(props.current);
        return;
      }
      settleTo(snapTarget(st.pos, d.v, props.items.length));
    };
    const onKey = (e) => {
      const cur = Math.round(st.pos);
      if (e.key === 'ArrowLeft') { e.preventDefault(); settleTo(Math.max(0, cur - 1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); settleTo(Math.min(props.items.length - 1, cur + 1)); }
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
        settleTo(Math.max(0, Math.min(props.items.length - 1, cur + Math.sign(wheelAcc))));
        wheelAcc = 0;
      }
    };

    const styles = computed(() => props.items.map((_, i) => wheelItemStyle(i - st.pos, st.spacing)));
    const nameStyle = (i) => {
      const o = i - st.pos;
      return { opacity: Math.max(0, 1 - Math.abs(o) * 1.8).toFixed(3), transform: `translate3d(${(o * 46).toFixed(1)}px,0,0)` };
    };
    const centerIdx = computed(() => Math.max(0, Math.min(props.items.length - 1, Math.round(st.pos))));
    return { root, st, styles, nameStyle, centerIdx, onDown, onMove, onUp, onKey, onWheel };
  },
  template: `
    <div class="game-wheel" ref="root" :class="{ dragging: st.dragging }" role="tablist" :aria-label="label" tabindex="0"
         @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @keydown="onKey" @wheel="onWheel">
      <div class="gw-stage">
        <button v-for="(g, i) in items" :key="g.id" type="button" class="gw-item" :class="{ on: g.id === current }"
                :data-wheel-index="i" :data-game="g.id" role="tab" :aria-selected="String(g.id === current)" :aria-label="g.name"
                tabindex="-1" :style="styles[i]">
          <span class="gw-glow" :style="{ opacity: Math.max(0, 1 - Math.abs(i - st.pos) * 1.5) }"></span>
          <img class="gw-logo" :src="g.logo" decoding="sync" alt="" draggable="false" />
        </button>
      </div>
      <div class="gw-names" aria-hidden="true">
        <span v-for="(g, i) in items" :key="g.id" class="gw-name" :style="nameStyle(i)">{{ g.name }}</span>
      </div>
      <div class="gw-dots" aria-hidden="true">
        <i v-for="(g, i) in items" :key="g.id" :class="{ on: i === centerIdx }"></i>
      </div>
    </div>`,
};
