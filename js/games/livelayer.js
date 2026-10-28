// games/livelayer.js — der LIVE-Entwurf eines Mitspielers, gemeinsam für alle
// Spiele mit Bearbeiten-Sperre (features.editLock). Wer gerade zeichnet, schickt
// über die Schale (sendLive → Coop.setLive) seinen Entwurf; die anderen sehen ihn
// hier in seiner Farbe, BEVOR der fertige Zug eintrifft (Nutzerwunsch: „nicht
// nur das Ergebnis").
//
// Entwurf (alle Felder optional, Zellen als Index r·cols+c):
//   cur   die Zelle unter dem Finger           → pulsierender Rahmen
//   box   { r, c, h, w } (Rectangles)          → gestricheltes Rechteck
//   path  [zelle, …] (Number Path)             → Linie durch die Zellmitten
//   cells [[zelle, wert], …] (Gem Hunt)        → Kreuz/Stein-Vorschau
//   c     Farbe des Zeichnenden (setzt die Schale)

import { computed } from '../vue.esm-browser.prod.js';

let state = null;
export function initLiveLayer(s) { state = s; }

const pct = (v, n) => `${(v / n) * 100}%`;
export const LiveLayer = {
  setup() {
    const drafts = computed(() => {
      const p = state && state.puzzle;
      const live = state && state.coop && state.coop.live;
      if (!p || !live) return [];
      const rows = p.rows, cols = p.cols;
      const at = (i) => ({ r: Math.floor(i / cols), c: i % cols });
      const cellBox = (i) => { const { r, c } = at(i); return { left: pct(c, cols), top: pct(r, rows), width: pct(1, cols), height: pct(1, rows) }; };
      const out = [];
      for (const uid of Object.keys(live)) {
        const d = live[uid];
        if (!d || typeof d !== 'object') continue;
        const col = { '--lc': d.c || 'var(--accent)' };
        const item = { uid, col };
        if (Number.isInteger(d.cur) && d.cur >= 0 && d.cur < rows * cols) item.cur = cellBox(d.cur);
        if (d.box && Number.isFinite(d.box.r)) item.box = { left: pct(d.box.c, cols), top: pct(d.box.r, rows), width: pct(d.box.w, cols), height: pct(d.box.h, rows) };
        const path = Array.isArray(d.path) ? d.path : d.path && typeof d.path === 'object' ? Object.values(d.path) : null;
        if (path && path.length > 1) {
          item.points = path.filter((i) => Number.isInteger(i)).map((i) => { const { r, c } = at(i); return `${((c + 0.5) / cols) * 100},${((r + 0.5) / rows) * 100}`; }).join(' ');
          item.stroke = Math.max(3, (state.cellPx || 40) * 0.3);
        }
        const cells = Array.isArray(d.cells) ? d.cells : d.cells && typeof d.cells === 'object' ? Object.values(d.cells) : null;
        if (cells) item.cells = cells.map((x) => (Array.isArray(x) ? x : Object.values(x || {}))).filter((x) => Number.isInteger(x[0])).map(([i, v]) => ({ i, v, style: cellBox(i) }));
        out.push(item);
      }
      return out;
    });
    return { drafts };
  },
  template: `
            <div class="live-layer" aria-hidden="true" v-if="drafts.length">
              <template v-for="d in drafts" :key="d.uid">
                <svg v-if="d.points" class="live-path" viewBox="0 0 100 100" preserveAspectRatio="none" :style="d.col"><polyline :points="d.points" :stroke-width="d.stroke" vector-effect="non-scaling-stroke" /></svg>
                <div v-if="d.box" class="live-box" :style="[d.box, d.col]"></div>
                <div v-for="x in (d.cells || [])" :key="d.uid + '-' + x.i" class="live-cell" :style="[x.style, d.col]">{{ x.v === 2 ? '◆' : x.v === 1 ? '×' : '' }}</div>
                <div v-if="d.cur" class="live-cursor" :style="[d.cur, d.col]"></div>
              </template>
            </div>`,
};
