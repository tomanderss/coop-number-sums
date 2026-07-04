// icons.js — Selbst gezeichnetes Custom-Icon-Set (Emoji-Ersatz für UI-Chrome).
//
// Ziel: eigene, konsistente Bildsprache statt System-Emojis. Ein einheitliches
// 24×24-Raster, überwiegend Strich-Icons (stroke, round joins/caps) in
// `currentColor` — sie erben also Farbe/Größe vom Umgebungstext. Ein paar
// Glyphen (Münze, Flamme, Krone, Edelstein) sind bewusst gefüllt/mehrfarbig,
// weil sie als „Objekt" gelesen werden, nicht als Symbol.
//
// Reine String-Erzeugung (kein DOM) → unit-testbar. Rendern per v-html über den
// `icon()`-Helfer in app.js. Unbekannte Namen ⇒ '' (nie rohen Fremdtext rendern).

// Jeder Eintrag ist der INNERE Markup eines 24×24-<svg> (viewBox 0 0 24 24).
// `s` = reine Strich-Pfade (nutzen currentColor über stroke), `f` = gefüllte/
// mehrfarbige Icons (bringen ihre Farben selbst mit). Default: Strich.
const STROKE = new Set();
const PATHS = {};
function stroke(name, body) { PATHS[name] = body; STROKE.add(name); }
function filled(name, body) { PATHS[name] = body; }

// ── Navigation / Chrome (Strich) ─────────────────────────────────────────────
stroke('close', '<path d="M6 6l12 12M18 6L6 18"/>');
stroke('check', '<path d="M4 12.5l5 5L20 6.5"/>');
stroke('plus', '<path d="M12 5v14M5 12h14"/>');
stroke('minus', '<path d="M5 12h14"/>');
stroke('chevron-right', '<path d="M9 5l7 7-7 7"/>');
stroke('chevron-left', '<path d="M15 5l-7 7 7 7"/>');
stroke('arrow-up', '<path d="M12 19V5M6 11l6-6 6 6"/>');
stroke('arrow-down', '<path d="M12 5v14M6 13l6 6 6-6"/>');
stroke('refresh', '<path d="M20 11a8 8 0 0 0-14-4.5L4 8m0 0V4m0 4h4M4 13a8 8 0 0 0 14 4.5L20 16m0 0v4m0-4h-4"/>');
stroke('shuffle', '<path d="M4 6h4l9 12h3m0 0l-2.5-2.5M20 18l-2.5 2.5M4 18h4l2.5-3.4M14 8l2.5-2H20m0 0l-2.5-2.5M20 6l-2.5 2.5"/>');
stroke('back', '<path d="M11 5l-7 7 7 7M4 12h16"/>');

// ── Bereiche / Tabs ──────────────────────────────────────────────────────────
stroke('gear', '<circle cx="12" cy="12" r="3"/><path d="M10.4 2.8h3.2l.5 2.4 1.7.7 2-1.4 2.3 2.3-1.4 2 .7 1.7 2.4.5v3.2l-2.4.5-.7 1.7 1.4 2-2.3 2.3-2-1.4-1.7.7-.5 2.4h-3.2l-.5-2.4-1.7-.7-2 1.4-2.3-2.3 1.4-2-.7-1.7-2.4-.5v-3.2l2.4-.5.7-1.7-1.4-2 2.3-2.3 2 1.4 1.7-.7z"/>');
stroke('sound', '<path d="M4 9v6h3.5L13 19V5L7.5 9zM17 9.5a3.5 3.5 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10"/>');
stroke('mute', '<path d="M4 9v6h3.5L13 19V5L7.5 9zM17 10l4 4M21 10l-4 4"/>');
stroke('user', '<circle cx="12" cy="8" r="3.6"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>');
stroke('users', '<circle cx="9" cy="8.5" r="3.1"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19.5a5.5 5.5 0 0 0-2.2-4.4"/>');
stroke('save', '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>');
stroke('chart', '<path d="M4 20V4M4 20h16M8 20v-6M12 20v-10M16 20v-4"/>');
stroke('chart-up', '<path d="M4 20V4M4 20h16M7 15l3.5-4 3 2.5L20 7"/>');
stroke('book', '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM20 18v3H6.5A2.5 2.5 0 0 1 4 18.5"/>');
stroke('scroll', '<path d="M7 4h10v13a3 3 0 0 1-3 3H7a3 3 0 0 0 3-3V4zM7 4a2 2 0 0 0-2 2v1h3M10 8h5M10 11h5M10 14h3"/>');
stroke('cart', '<path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/>');
stroke('backpack', '<path d="M6 9a6 6 0 0 1 12 0v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM9 9V7a3 3 0 0 1 6 0v2M8.5 13h7v4h-7z"/>');
stroke('box', '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9"/>');
stroke('graduation', '<path d="M2.5 9L12 5l9.5 4L12 13zM6 11v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5M21.5 9v4"/>');
stroke('puzzle', '<path d="M9 4h6v3a1.5 1.5 0 0 0 3 0V4h2v6h-3a1.5 1.5 0 0 0 0 3h3v6h-6v-3a1.5 1.5 0 0 0-3 0v3H4v-6h3a1.5 1.5 0 0 0 0-3H4V4z"/>');

// ── Status / Verbindung ──────────────────────────────────────────────────────
stroke('cloud', '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 10.5a3.75 3.75 0 0 1-.5 7.5z"/>');
stroke('cloud-sync', '<path d="M7 17a4 4 0 0 1-.4-8A5.3 5.3 0 0 1 16.8 9.8 3.6 3.6 0 0 1 17 17M12 12v3.5m0 0l1.6-1.6M12 15.5l-1.6-1.6"/>');
stroke('signal', '<path d="M4 20a12 12 0 0 1 12-12M4 20a7 7 0 0 1 7-7M4 20h.01"/><path d="M18 4l2 2m0-2l-2 2"/>');
stroke('signal-on', '<path d="M4 20a12 12 0 0 1 12-12M4 20a7 7 0 0 1 7-7M4 20h.01M15.5 8h5m-2.5-2.5v5"/>');
stroke('bell', '<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6zM10 20a2 2 0 0 0 4 0"/>');
stroke('clock', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
stroke('mail', '<path d="M3.5 6h17v12h-17zM3.5 7l8.5 6 8.5-6"/>');
stroke('lock', '<path d="M6.5 11V8a5.5 5.5 0 0 1 11 0v3M5 11h14v9H5z"/>');
stroke('key', '<circle cx="8" cy="8" r="4"/><path d="M11 11l8 8m-3 0l2-2m-4-2l2-2"/>');
stroke('link', '<path d="M9 15l6-6M9.5 7.5l1.8-1.8a3.5 3.5 0 0 1 5 5L13.5 12M10.5 12L8.7 13.8a3.5 3.5 0 0 1-5-5l1.8-1.8"/>');
stroke('trash', '<path d="M4 6.5h16M9 6.5V4h6v2.5M6.5 6.5L7.5 20h9l1-13.5M10 10v6M14 10v6"/>');
stroke('warning', '<path d="M12 3.5L22 20H2zM12 9v5M12 17h.01"/>');
stroke('bulb', '<path d="M8.5 15a5.5 5.5 0 1 1 7 0c-.8.6-1 1-1 2v.5h-5V17c0-1-.2-1.4-1-2zM9.5 20.5h5M10 22.5h4"/>');
stroke('flag', '<path d="M6 21V4M6 4h11l-2 3.5 2 3.5H6"/>');
stroke('theme', '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>');
stroke('sun', '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19"/>');
stroke('moon', '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>');
stroke('swords', '<path d="M4 4h3l9 9-3 3zM20 4h-3l-3.5 3.5M4.5 15.5L3 17l2 2 3-3M19.5 15.5L21 17l-2 2-3-3M14 14l2.5 2.5"/>');
stroke('play', '<path d="M7 5l12 7-12 7z"/>');
stroke('grid', '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>');
stroke('smiley', '<circle cx="12" cy="12" r="8.5"/><path d="M9 10.5h.01M15 10.5h.01M8.5 14.5a4 4 0 0 0 7 0"/>');

// ── Objekte (gefüllt / mehrfarbig) ───────────────────────────────────────────
// Münze — Goldscheibe mit Prägekante und ✦-Glanz.
filled('coin', '<circle cx="12" cy="12" r="9" fill="#f2b529"/><circle cx="12" cy="12" r="9" fill="none" stroke="#b9821a" stroke-width="1.4"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#ffe08a" stroke-width="1.3"/><path d="M12 8.2l1 2.4 2.6.2-2 1.7.6 2.5-2.2-1.4-2.2 1.4.6-2.5-2-1.7 2.6-.2z" fill="#fff4cf"/>');
// Flamme — Streak.
filled('flame', '<path d="M12 2.5c3 3.5 6 6 6 10.5a6 6 0 0 1-12 0c0-2 .8-3.6 2-5 .3 1.3 1 2 2 2.3-.2-3 .8-5.8 2-7.8z" fill="#ff7a1a"/><path d="M12 10.5c1.4 1.6 2.4 3 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.2.9-2.4 2.4-4.6z" fill="#ffd23f"/>');
// Krone — Admin / legendär.
filled('crown', '<path d="M3 8l3.5 3L12 5l5.5 6L21 8l-1.8 10H4.8zM4.8 18h14.4" fill="#f4c430" stroke="#b98a12" stroke-width="1" stroke-linejoin="round"/><circle cx="3" cy="8" r="1.5" fill="#ffe98a"/><circle cx="21" cy="8" r="1.5" fill="#ffe98a"/><circle cx="12" cy="5" r="1.7" fill="#ffe98a"/>');
// Edelstein.
filled('gem', '<path d="M6 3h12l4 6-10 12L2 9zM2 9h20M6 3l4 6M18 3l-4 6M12 21l-2-12M12 21l2-12" fill="#5ad1e6" stroke="#1f8fa8" stroke-width="1" stroke-linejoin="round"/>');
// Pokal.
filled('trophy', '<path d="M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M10 13h4v3h-4zM8 20h8v-1a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3z" fill="#f4c430" stroke="#b98a12" stroke-width="1" stroke-linejoin="round"/>');
// Medaille (Rang / erste Bestzeit).
filled('medal', '<path d="M8 3l-3 6 4 1 3-4zM16 3l3 6-4 1-3-4z" fill="#c0473f"/><circle cx="12" cy="15" r="6" fill="#f4c430" stroke="#b98a12" stroke-width="1"/><path d="M12 12l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 14.2l2-.3z" fill="#fff4cf"/>');
// Herz.
filled('heart', '<path d="M12 20S3.5 14.5 3.5 8.8A4.3 4.3 0 0 1 12 6.5a4.3 4.3 0 0 1 8.5 2.3C20.5 14.5 12 20 12 20z" fill="#e7405a"/>');
// Herz gebrochen (Streak verloren).
filled('heart-broken', '<path d="M12 20S3.5 14.5 3.5 8.8A4.3 4.3 0 0 1 12 6.5a4.3 4.3 0 0 1 8.5 2.3C20.5 14.5 12 20 12 20z" fill="#8a94a2"/><path d="M12 6.5l-2 4 3 2.5-2.5 4" fill="none" stroke="#5a636e" stroke-width="1.4" stroke-linejoin="round"/>');
// Kaffee (Spenden).
filled('coffee', '<path d="M4 8h13v5a5 5 0 0 1-10 0zM17 9h2.2a2.3 2.3 0 0 1 0 4.6H16.8M4 20h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 3c-.6 1 .6 1.7 0 2.7M12 3c-.6 1 .6 1.7 0 2.7" fill="none" stroke="currentColor" stroke-width="1.6"/>');
// Geschenk.
filled('gift', '<path d="M4 9h16v3H4zM5 12h14v9H5zM12 9v12M12 9C10 9 8 8 8 6.2 8 5 9 4 12 9c3-5 4-4 4-2.8C16 8 14 9 12 9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>');
// Party-Popper (Sieg/Feier-Chrome — die Animationen selbst kommen separat).
filled('party', '<path d="M3 21l5-13 8 8zM8 8l0 0M14 4l1 1M18 3l-.5 1.5L19 5M20 8l-1.5.5M16 10l1 .3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M10.5 12.5l3 1M8.5 15l2.5 1" stroke="currentColor" stroke-width="1.4"/>');
// Palette (Themes/Farben).
filled('palette', '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.4-2-.6-1 .1-2 1.1-2H16a5 5 0 0 0 5-5c0-4.5-4-7-9-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.1" fill="currentColor"/><circle cx="12" cy="8" r="1.1" fill="currentColor"/><circle cx="16" cy="10" r="1.1" fill="currentColor"/>');
// Rainbow (Palette-Kategorie).
filled('rainbow', '<path d="M3 18a9 9 0 0 1 18 0" fill="none" stroke="#e7405a" stroke-width="2"/><path d="M6 18a6 6 0 0 1 12 0" fill="none" stroke="#f2b529" stroke-width="2"/><path d="M9 18a3 3 0 0 1 6 0" fill="none" stroke="#3fb27f" stroke-width="2"/>');
// Pinsel.
filled('brush', '<path d="M14 3l7 7-6 3-4-4zM11 9l4 4-4.5 4.5a3 3 0 0 1-2 .9c-1 0-1.5.8-2.5 1.1-.8.2-1.5-.5-1.3-1.3C4.9 16.9 5.7 16 5.6 15a3 3 0 0 1 .9-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>');
// Ziffern (Fonts).
filled('digits', '<path d="M7 4l-2 1.5M7 4v9M13 6.5a2 2 0 1 1 3.2 1.6L13 13h4M6 20v-3.5M6 16.5H8.5V20M15 16.5h2.5l-2 2.7a1.5 1.5 0 1 1 .3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>');
// Bild/Rahmen (Frames).
filled('frame', '<path d="M4 4h16v16H4zM7 7h10v10H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 15l3-3 2 2 3-3.5 2 2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>');
// Note (SFX/Musik).
filled('music', '<path d="M9 18V6l10-2v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>');
// Versus (Wettkampf 1v1) — fettes „VS" mit Trennblitz.
filled('versus', '<path d="M3 5.5l2.6 8 2.6-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M20.5 6.2a2.4 2.4 0 0 0-3.6.6c-.7 1.2.2 2.2 1.5 2.7 1.3.5 2.2 1.5 1.5 2.7a2.4 2.4 0 0 1-3.6.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12.5 3l-2 8 3 2-2 8" fill="none" stroke="#f2b529" stroke-width="1.6" stroke-linejoin="round"/>');
// Controller (Spielmodus).
filled('controller', '<path d="M8 8h8a5 5 0 0 1 5 5 3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1.8A3 3 0 0 1 3 13a5 5 0 0 1 5-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 11v3M5.5 12.5h3M15.5 11.5h.01M17.5 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
// Stern (Skin/Highlight).
filled('star', '<path d="M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 17l-5.6 3 1.6-6.3-5-4.2 6.5-.5z" fill="#f2b529" stroke="#b9821a" stroke-width="1" stroke-linejoin="round"/>');
// Punkt „online" (Präsenz).
filled('dot', '<circle cx="12" cy="12" r="5" fill="currentColor"/>');

// Öffentliches Set aller Namen (für Tests).
export const ICON_NAMES = Object.keys(PATHS);

// Ist `name` ein gezeichnetes Icon?
export function hasIcon(name) { return !!(name && Object.prototype.hasOwnProperty.call(PATHS, name)); }

// Liefert das <svg>-Markup eines Icons. opts.size (px, Default via CSS em),
// opts.cls (zusätzliche Klasse), opts.title (aria-label). Unbekannt ⇒ ''.
export function icon(name, opts = {}) {
  if (!hasIcon(name)) return '';
  const isStroke = STROKE.has(name);
  const cls = 'ico ico-' + name + (opts.cls ? ' ' + opts.cls : '');
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = opts.title ? ` role="img" aria-label="${opts.title}"` : ' aria-hidden="true"';
  const paint = isStroke
    ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    : '';
  return `<svg class="${cls}" viewBox="0 0 24 24"${size}${paint}${label}>${PATHS[name]}</svg>`;
}
