// winshapes.js — Detaillierte, selbst gezeichnete SVG-Kreaturen & Partikel für
// die Sieganimationen (Emoji-Ersatz). Reine String-Erzeugung, kein DOM/Zufall.
//
// Anspruch: RICHTIG gezeichnet — geschichtete Pfade, Verläufe, Membranen,
// Schuppen — nicht die alten Canvas-Kritzeleien. Die Bewegung (Flug, Flügel-
// schlag, Feuer, Funken) kommt aus app.js/CSS (nur transform/opacity animiert).
//
// Jede Kreatur ist ein in sich stimmiges <g> im lokalen Koordinatenraum; die
// beweglichen Teile tragen eine Klasse (z.B. .wf-wing) und werden extern
// animiert. Blickrichtung: nach rechts.

// Gemeinsame Verläufe/Filter — EINMAL ins Dokument (winShapeDefs()).
export function winShapeDefs() {
  return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    // Drache: tiefes Rot → Glut
    '<linearGradient id="wf-drag-body" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#c2402f"/><stop offset=".5" stop-color="#8f1f2e"/><stop offset="1" stop-color="#4c0f22"/></linearGradient>' +
    '<linearGradient id="wf-drag-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0662f"/><stop offset=".55" stop-color="#8f1f2e"/><stop offset="1" stop-color="#3c0d20"/></linearGradient>' +
    '<linearGradient id="wf-drag-belly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf8a"/><stop offset="1" stop-color="#d98a3a"/></linearGradient>' +
    // Einhorn: perlweiß + iris
    '<linearGradient id="wf-uni-body" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6ddff"/></linearGradient>' +
    '<linearGradient id="wf-uni-horn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd24a"/><stop offset="1" stop-color="#fff2b0"/></linearGradient>' +
    // Phönix: gold → purpur
    '<linearGradient id="wf-phx-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset=".5" stop-color="#ff9a2e"/><stop offset="1" stop-color="#e5341e"/></linearGradient>' +
    '<linearGradient id="wf-phx-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#ffab2e"/><stop offset="1" stop-color="#d62828"/></linearGradient>' +
    '<radialGradient id="wf-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd98a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>' +
    '<filter id="wf-soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#000" flood-opacity="0.35"/></filter>' +
    '</defs></svg>';
}

// ── Partikel-Formen (Emoji-Ersatz in den Effekten) ──────────────────────────
// Kleine, in sich zentrierte SVGs (viewBox -12..12). Größe/Position setzt die
// Animation über das umgebende Element. `hue` färbt (falls angegeben) manche
// Formen individuell (Ballons/Konfetti).
const SHAPES = {
  balloon: h => `<svg viewBox="-12 -12 24 24"><path d="M0 -11 C7 -11 8 -2 5 4 C3 8 -3 8 -5 4 C-8 -2 -7 -11 0 -11 Z" fill="hsl(${h||0} 80% 60%)"/><path d="M-3 -7 C-4 -4 -4 0 -2 3" stroke="#fff" stroke-width="1.3" fill="none" opacity=".5" stroke-linecap="round"/><path d="M0 8 L-1.6 11 L1.6 11 Z" fill="hsl(${h||0} 70% 45%)"/></svg>`,
  petal: h => `<svg viewBox="-12 -12 24 24"><g fill="hsl(${h??330} 75% 72%)"><path d="M0 -10 C6 -6 6 4 0 10 C-6 4 -6 -6 0 -10 Z"/></g><path d="M0 -6 C2 -3 2 4 0 8" stroke="hsl(${h??330} 60% 55%)" stroke-width="1" fill="none" opacity=".6"/></svg>`,
  coin: () => `<svg viewBox="-12 -12 24 24"><circle r="10" fill="#f2b529"/><circle r="10" fill="none" stroke="#b9821a" stroke-width="1.6"/><circle r="6.6" fill="none" stroke="#ffe08a" stroke-width="1.4"/><path d="M0 -5 l1.1 2.7 3-.1 -2.3 2 .9 2.8 -2.6-1.6 -2.6 1.6 .9-2.8 -2.3-2 3 .1 z" fill="#fff4cf"/></svg>`,
  sparkle: () => `<svg viewBox="-12 -12 24 24"><path d="M0 -11 L2 -2 L11 0 L2 2 L0 11 L-2 2 L-11 0 L-2 -2 Z" fill="#fff6cf"/></svg>`,
  star: () => `<svg viewBox="-12 -12 24 24"><path d="M0 -11 L2.6 -3.4 L10.5 -3.4 L4 1.3 L6.5 9 L0 4.3 L-6.5 9 L-4 1.3 L-10.5 -3.4 L-2.6 -3.4 Z" fill="#ffd24a" stroke="#e0a828" stroke-width=".8"/></svg>`,
  droplet: () => `<svg viewBox="-12 -12 24 24"><path d="M0 -10 C5 -3 7 2 4 7 A5.5 5.5 0 0 1 -4 7 C-7 2 -5 -3 0 -10 Z" fill="#5ec8f0"/><path d="M-2 2 a3 3 0 0 0 2 3" stroke="#fff" stroke-width="1.2" fill="none" opacity=".6"/></svg>`,
  bubble: () => `<svg viewBox="-12 -12 24 24"><circle r="9.5" fill="rgba(180,225,255,.28)" stroke="rgba(220,240,255,.7)" stroke-width="1.2"/><circle cx="-3" cy="-3" r="2.6" fill="rgba(255,255,255,.75)"/></svg>`,
  snowflake: () => `<svg viewBox="-12 -12 24 24"><g stroke="#eaf6ff" stroke-width="1.6" stroke-linecap="round"><path d="M0 -10 V10 M-8.6 -5 L8.6 5 M-8.6 5 L8.6 -5"/><g><path d="M0 -10 l-2.5 3 M0 -10 l2.5 3 M0 10 l-2.5 -3 M0 10 l2.5 -3"/></g></g></svg>`,
  dolphin: () => `<svg viewBox="-12 -12 24 24"><path d="M-10 6 C-6 -6 6 -10 11 -6 C7 -6 3 -3 1 1 C4 0 7 1 9 4 C5 3 2 5 0 8 C-4 9 -8 8 -10 6 Z" fill="#6ab6e8"/><path d="M-2 -4 l3 -5 l1 5 z" fill="#4f97cc"/><circle cx="6" cy="-4" r="1" fill="#0a2436"/></svg>`,
  invader: () => `<svg viewBox="-12 -12 24 24"><g fill="#7ee081"><path d="M-8 -6 h2 v-2 h2 v2 h8 v-2 h2 v2 h2 v6 h2 v4 h-2 v-2 h-2 v2 h-2 v-2 h-8 v2 h-2 v-2 h-2 v2 h-2 v-4 h2 z"/></g><g fill="#0b1a0b"><rect x="-5" y="-4" width="2.4" height="2.4"/><rect x="2.6" y="-4" width="2.4" height="2.4"/></g></svg>`,
  gem: () => `<svg viewBox="-12 -12 24 24"><path d="M-6 -7 H6 L11 -1 L0 11 L-11 -1 Z" fill="#5ad1e6" stroke="#1f8fa8" stroke-width="1" stroke-linejoin="round"/><path d="M-11 -1 H11 M-6 -7 L-3 -1 M6 -7 L3 -1 M-3 -1 L0 11 M3 -1 L0 11" stroke="#1f8fa8" stroke-width=".8" fill="none" opacity=".6"/><path d="M-4 -5 L-2 -2" stroke="#fff" stroke-width="1.2" opacity=".7"/></svg>`,
  flame: () => `<svg viewBox="-12 -12 24 24"><path d="M0 -11 C6 -4 8 3 3 9 A5 5 0 0 1 -5 6 C-6 3 -5 0 -3 -2 C-2.6 0 -1.6 1 -0.6 1.2 C-1.4 -3 0 -7 0 -11 Z" fill="#ff7a1a"/><path d="M0 -2 C3 1 3.6 5 1.4 8 A2.6 2.6 0 0 1 -2.4 6.2 C-2.4 4 -1 2 0 -2 Z" fill="#ffd23f"/></svg>`,
  feather: () => `<svg viewBox="-12 -12 24 24"><path d="M6 -10 C-4 -6 -8 3 -7 9 C-2 6 6 2 8 -6 C8 -9 7 -10 6 -10 Z" fill="url(#wf-phx-wing)"/><path d="M6 -9 C0 -4 -4 3 -6 8" stroke="#8a2a12" stroke-width="1" fill="none" opacity=".6"/></svg>`,
  heart: () => `<svg viewBox="-12 -12 24 24"><path d="M0 9 C-9 2 -10 -4 -6 -8 C-3 -11 1 -9 0 -5 C1 -9 5 -11 8 -8 C12 -4 9 2 0 9 Z" fill="#ff5d8a"/></svg>`,
  puff: () => `<svg viewBox="-12 -12 24 24"><g fill="rgba(210,220,240,.55)"><circle cx="-3" cy="1" r="5"/><circle cx="3" cy="-1" r="6"/><circle cx="6" cy="3" r="4"/></g></svg>`,
  satellite: () => `<svg viewBox="-12 -12 24 24"><rect x="-3" y="-3" width="6" height="6" rx="1" fill="#cdd6e6"/><rect x="-11" y="-2" width="6" height="4" fill="#4f8fff"/><rect x="5" y="-2" width="6" height="4" fill="#4f8fff"/><circle cx="0" cy="0" r="1.4" fill="#1b2740"/></svg>`,
  seven: () => `<svg viewBox="-12 -12 24 24"><path d="M-6 -8 H6 L-1 10 H-6 L1 -3 H-6 Z" fill="#ffd24a" stroke="#b98a12" stroke-width="1" stroke-linejoin="round"/></svg>`,
  burst: () => `<svg viewBox="-12 -12 24 24"><g stroke="#ffd98a" stroke-width="2" stroke-linecap="round"><path d="M0 -10 V-4 M0 10 V4 M-10 0 H-4 M10 0 H4 M-7 -7 l3 3 M7 7 l-3 -3 M7 -7 l-3 3 M-7 7 l3 -3"/></g></svg>`,
  note: () => `<svg viewBox="-12 -12 24 24"><path d="M-3 6 V-8 L8 -10 V4" stroke="#c9b3ff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="-5" cy="6" rx="3.4" ry="2.6" fill="#c9b3ff"/><ellipse cx="6" cy="4" rx="3.4" ry="2.6" fill="#c9b3ff"/></svg>`,
};
// Liefert die SVG-Form eines Partikels. Unbekannt ⇒ '' (nie Emoji/Rohstring).
export function winShape(name, hue) { const f = SHAPES[name]; return f ? f(hue) : ''; }
export const WIN_SHAPE_NAMES = Object.keys(SHAPES);

// ── DRACHE ────────────────────────────────────────────────────────────────────
// viewBox-Bezug ~ -100..100 / -80..80, Kopf oben rechts, Schwanz unten links.
export function dragonMarkup() { return `<svg viewBox="-125 -80 240 150">${dragonSvg()}</svg>`; }
export function unicornMarkup() { return `<svg viewBox="-65 -72 130 116">${unicornSvg()}</svg>`; }
export function phoenixMarkup() { return `<svg viewBox="-42 -56 84 150">${phoenixSvg()}</svg>`; }
// Rakete (zeigt nach oben) + Discokugel — SVG-Helden als Emoji-Ersatz für die
// gleichnamigen Sieganimationen (rein deterministisch, kein Zufall/DOM).
export function rocketMarkup() { return `<svg viewBox="-26 -42 52 92">${rocketSvg()}</svg>`; }
export function discoMarkup() { return `<svg viewBox="-24 -30 48 60">${discoSvg()}</svg>`; }
function rocketSvg() {
  return '<g>' +
    // Antriebsflamme
    '<path d="M-6 26 C-3 40 3 40 6 26 C3 33 -3 33 -6 26 Z" fill="#ffbf3a"/>' +
    '<path d="M-3.4 26 C-2 35 2 35 3.4 26 C2 31 -2 31 -3.4 26 Z" fill="#ff6a1a"/>' +
    // Flossen
    '<path d="M-8 10 L-17 24 L-8 21 Z" fill="#e5483d"/>' +
    '<path d="M8 10 L17 24 L8 21 Z" fill="#e5483d"/>' +
    // Rumpf
    '<path d="M0 -40 C10 -22 12 2 8 24 L-8 24 C-12 2 -10 -22 0 -40 Z" fill="#eef1f6" stroke="#b9c2d0" stroke-width="1.6"/>' +
    // Nasenkegel
    '<path d="M0 -40 C6 -31 8 -22 8 -15 L-8 -15 C-8 -22 -6 -31 0 -40 Z" fill="#e5483d"/>' +
    // Bullauge
    '<circle cx="0" cy="-4" r="5.2" fill="#8fd0ff" stroke="#3a7bd5" stroke-width="1.8"/>' +
    '<circle cx="-1.6" cy="-5.6" r="1.6" fill="#eaf6ff" opacity=".8"/>' +
  '</g>';
}
function discoSvg() {
  let facets = '';
  for (let y = -16; y <= 16; y += 4) {
    for (let x = -16; x <= 16; x += 4.5) {
      if (Math.hypot(x, y) > 16.5) continue;
      const shade = 42 + ((Math.round(x) + Math.round(y)) % 5) * 9;
      facets += `<rect x="${(x - 2).toFixed(1)}" y="${(y - 1.6).toFixed(1)}" width="4" height="3.2" rx="0.6" fill="hsl(206 26% ${shade}%)"/>`;
    }
  }
  return '<g>' +
    '<line x1="0" y1="-30" x2="0" y2="-18" stroke="#9aa3b2" stroke-width="1.6"/>' +
    '<circle cx="0" cy="0" r="18" fill="#4f5967"/>' +
    facets +
    '<circle cx="-6" cy="-6" r="4" fill="#ffffff" opacity=".5"/>' +
  '</g>';
}
export function dragonSvg() {
  return '<g class="wf-dragon">' +
    // Fern-Flügel (hinter dem Körper)
    '<g class="wf-wing-far" style="transform-origin:14px -6px"><path d="M14 -6 C-6 -40 -34 -52 -58 -44 C-44 -40 -40 -30 -46 -20 C-30 -24 -20 -18 -22 -8 C-8 -14 2 -12 14 -6 Z" fill="#5c1626" opacity=".85"/>' +
    '<path d="M-58 -44 L-40 -30 M-46 -20 L-26 -14 M-22 -8 L-6 -6" stroke="#3c0d20" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>' +
    // Schwanz
    '<path d="M-2 8 C-30 2 -58 12 -80 30 C-88 37 -96 34 -102 40 C-93 40 -86 44 -88 52 C-78 44 -66 44 -60 34 C-40 20 -18 14 0 10 Z" fill="url(#wf-drag-body)"/>' +
    // Schwanzspitze (Speerblatt)
    '<path d="M-102 40 L-118 44 L-104 30 L-114 28 L-100 24 Z" fill="#e0662f"/>' +
    // Körper
    '<path d="M-4 -10 C24 -22 44 -18 54 -2 C60 8 56 20 40 22 C18 26 -6 20 -14 6 C-18 -2 -12 -8 -4 -10 Z" fill="url(#wf-drag-body)"/>' +
    // Bauchplatten
    '<path d="M-10 8 C6 20 30 22 46 16 C40 24 22 26 6 22 C-4 20 -10 14 -10 8 Z" fill="url(#wf-drag-belly)"/>' +
    '<g stroke="#b3702e" stroke-width="1" opacity=".6"><path d="M-4 12 h10 M6 16 h11 M20 18 h11 M34 16 h8"/></g>' +
    // Hinterbein + Kralle
    '<path d="M6 20 C4 30 8 40 2 48 L8 48 L6 40 L12 46 L12 40 L18 44 C16 34 16 26 20 22 Z" fill="url(#wf-drag-body)"/>' +
    // Vorderbein
    '<path d="M40 20 C42 30 40 40 46 46 L40 46 L42 40 L36 44 L38 38 L32 42 C34 32 34 26 32 22 Z" fill="#7a1a2a"/>' +
    // Hals + Kopf
    '<path d="M48 -6 C64 -14 72 -26 78 -40 C82 -48 92 -50 96 -44 C99 -40 96 -34 90 -32 C96 -30 96 -24 90 -22 C82 -18 74 -12 66 -6 C58 0 50 2 46 -2 Z" fill="url(#wf-drag-body)"/>' +
    // Hörner
    '<path d="M84 -40 C86 -54 96 -58 104 -56 C98 -52 96 -46 96 -40 Z" fill="#e9c07a"/>' +
    '<path d="M78 -38 C78 -50 86 -56 92 -56 C86 -50 84 -44 84 -38 Z" fill="#d9a94a"/>' +
    // Kiefer/Zähne (offenes Maul für Feuer)
    '<path d="M90 -22 C98 -22 104 -18 108 -14 L98 -14 L104 -10 L92 -12 Z" fill="#7a1a2a"/>' +
    '<path d="M92 -20 L96 -16 L100 -18 L102 -14" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
    // Auge
    '<ellipse cx="82" cy="-34" rx="3.4" ry="2.4" fill="#ffd94a"/><circle cx="83" cy="-34" r="1.2" fill="#1a0808"/>' +
    // Rückenstacheln
    '<g fill="#e9c07a"><path d="M-2 -12 l4 -8 l4 8 Z"/><path d="M14 -16 l4 -8 l5 8 Z"/><path d="M32 -16 l4 -7 l5 7 Z"/><path d="M-20 4 l3 -7 l5 6 Z"/><path d="M-40 12 l3 -6 l5 5 Z"/></g>' +
    // Nah-Flügel (groß, gespreizt) — animiertes Teil
    '<g class="wf-wing" style="transform-origin:16px -8px">' +
      '<path d="M16 -8 C0 -52 -30 -74 -62 -70 C-52 -60 -50 -48 -54 -38 C-60 -50 -46 -30 -44 -20 C-52 -32 -34 -14 -30 -4 C-38 -18 -20 -2 -14 6 C-2 -4 8 -6 16 -8 Z" fill="url(#wf-drag-wing)"/>' +
      // Fingerknochen
      '<g stroke="#3c0d20" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M16 -8 L-62 -70"/><path d="M16 -8 L-54 -38"/><path d="M16 -8 L-44 -20"/><path d="M16 -8 L-30 -4"/></g>' +
      // Membran-Highlight
      '<path d="M16 -8 C2 -44 -22 -60 -48 -58" stroke="#ff8a4a" stroke-width="1.4" fill="none" opacity=".5"/>' +
    '</g>' +
  '</g>';
}
// Mündungspunkt des Drachen-Feuers (für die Partikel in app.js), im lokalen Raum.
export const DRAGON_MOUTH = { x: 106, y: -13 };

// ── EINHORN ───────────────────────────────────────────────────────────────────
export function unicornSvg() {
  const mane = (dx, dy, cols) => cols.map((c, i) =>
    `<path class="wf-mane" d="M${34+dx} ${-24+dy+i*3} C${16} ${-30+i*4}, ${-6} ${-14+i*3}, ${-24} ${-2+i*3}" stroke="${c}" stroke-width="4.2" fill="none" stroke-linecap="round" style="transform-origin:34px -20px"/>`).join('');
  const RB = ['#ff5d73', '#ff9f45', '#ffe14d', '#5ed17a', '#49b6ff', '#8a7bff'];
  return '<g class="wf-unicorn">' +
    // Schweif (fließend, animiert)
    '<g class="wf-tail" style="transform-origin:-30px 4px">' + RB.map((c, i) =>
      `<path d="M-30 ${2+i*2} C-52 ${8+i*3}, -58 ${26+i*2}, -46 ${40+i*2}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>`).join('') + '</g>' +
    // Beine (Galopp)
    '<g fill="#efe9ff" stroke="#d3c8f2" stroke-width="1">' +
      '<path class="wf-leg-b" d="M-16 8 l-6 24 l7 0 l4 -22 Z" style="transform-origin:-16px 8px"/>' +
      '<path class="wf-leg-b2" d="M-8 10 l4 24 l7 0 l-2 -22 Z" style="transform-origin:-8px 10px"/>' +
      '<path class="wf-leg-f" d="M14 8 l-4 24 l7 0 l2 -22 Z" style="transform-origin:14px 8px"/>' +
      '<path class="wf-leg-f2" d="M22 8 l6 24 l7 0 l-4 -22 Z" style="transform-origin:22px 8px"/>' +
    '</g>' +
    // Körper
    '<path d="M-34 2 C-34 -18 -8 -22 8 -20 C30 -22 40 -6 34 8 C24 18 -6 22 -30 14 C-34 10 -34 6 -34 2 Z" fill="url(#wf-uni-body)"/>' +
    // Hals + Kopf
    '<path d="M22 -12 C34 -22 40 -34 46 -42 C52 -50 60 -46 58 -38 C56 -32 50 -28 48 -24 C52 -22 50 -16 44 -14 C36 -10 30 -6 26 -2 C20 0 16 -6 22 -12 Z" fill="url(#wf-uni-body)"/>' +
    // Horn (spiralig)
    '<path d="M52 -42 L56 -42 L59 -66 Z" fill="url(#wf-uni-horn)"/>' +
    '<g stroke="#e0a828" stroke-width="1" opacity=".7"><path d="M53 -48 l4 -1 M54 -54 l3.5 -1 M55 -60 l2.5 -0.8"/></g>' +
    // Ohr
    '<path d="M40 -40 L44 -50 L48 -40 Z" fill="#efe9ff"/>' +
    // Auge + Nüster
    '<circle cx="48" cy="-32" r="2" fill="#3a2b6b"/>' +
    '<circle cx="55" cy="-20" r="1.2" fill="#b9a9d6"/>' +
    // Mähne (Regenbogen, animiert)
    mane(0, 0, RB) +
  '</g>';
}

// ── PHÖNIX ────────────────────────────────────────────────────────────────────
export function phoenixSvg() {
  const featherRow = (cls, mirror) =>
    `<g class="${cls}" style="transform-origin:0px 0px${mirror ? ';transform:scale(-1,1)' : ''}">` +
      '<path d="M0 -4 C22 -22 46 -20 68 -30 C54 -18 58 -12 66 -8 C50 -8 52 0 60 6 C44 4 46 12 52 20 C34 14 34 22 32 32 C20 20 10 12 0 8 Z" fill="url(#wf-phx-wing)"/>' +
      '<g stroke="#ffe9a0" stroke-width="1.1" opacity=".55" fill="none"><path d="M6 -2 L52 -20 M8 2 L50 -6 M10 6 L44 10"/></g>' +
    '</g>';
  return '<g class="wf-phoenix">' +
    // Schweiffedern (flammend, animiert)
    '<g class="wf-phx-tail" style="transform-origin:0px 20px">' +
      '<path d="M-3 22 C-10 44 -8 64 -14 84 C-4 66 -2 54 0 40 C2 54 4 66 14 84 C8 64 10 44 3 22 Z" fill="url(#wf-phx-body)"/>' +
      '<path d="M0 26 C-4 44 -3 60 0 78 C3 60 4 44 0 26 Z" fill="#ffd24a" opacity=".8"/>' +
    '</g>' +
    // Flügel gespiegelt (animiert)
    featherRow('wf-phx-wing-l', false) +
    featherRow('wf-phx-wing-r', true) +
    // Körper
    '<path d="M0 -18 C12 -14 11 4 9 14 C7 26 3 34 0 40 C-3 34 -7 26 -9 14 C-11 4 -12 -14 0 -18 Z" fill="url(#wf-phx-body)"/>' +
    // Brustfedern
    '<g stroke="#e5341e" stroke-width="1" opacity=".45" fill="none"><path d="M0 -6 q-4 6 0 12 M0 -6 q4 6 0 12 M0 6 q-4 6 0 12 M0 6 q4 6 0 12"/></g>' +
    // Kopf + Schnabel
    '<circle cx="0" cy="-20" r="6.5" fill="#ffe07a"/>' +
    '<path d="M3 -22 L14 -21 L4 -16 Z" fill="#ff8a2a"/>' +
    '<circle cx="3" cy="-21" r="1.3" fill="#3a1206"/>' +
    // Federkrone (flammend)
    '<g stroke="#ffcf4a" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M0 -24 C-3 -36 -8 -40 -10 -46"/><path d="M0 -25 C0 -38 0 -44 0 -50"/><path d="M0 -24 C3 -36 8 -40 10 -46"/></g>' +
  '</g>';
}
