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
stroke('chat', '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v8A1.5 1.5 0 0 1 18.5 15H10l-4 4v-4H5.5A1.5 1.5 0 0 1 4 13.5z"/><path d="M8 8h8M8 11h5"/>');
stroke('send', '<path d="M21 4L3 11l6.5 2.2M21 4l-6 16-3.5-8.5M21 4L9.5 13.2"/>');
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
// Kaffee (Spenden) — symmetrische Tasse mit Herz (Ko-fi-Stil), Henkel, Untertasse
// und mittigem Dampf. Die alte Version hatte eine schräge linke Wand (Boden war
// schmaler gezeichnet als der Rand) und wirkte dadurch „verbeult".
filled('coffee', '<path d="M5 8.5h11v4.6a4.9 4.9 0 0 1-4.9 4.9h-1.2A4.9 4.9 0 0 1 5 13.1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M16 9.8h1.9a2.4 2.4 0 0 1 0 4.8h-2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 21h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.5 16.2S7.7 14.4 7.7 12.5a1.6 1.6 0 0 1 2.8-1.1 1.6 1.6 0 0 1 2.8 1.1c0 1.9-2.8 3.7-2.8 3.7z" fill="#e7405a"/><path d="M8.7 2.8c-.6.9.6 1.6 0 2.6M12.3 2.8c-.6.9.6 1.6 0 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>');
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
// Versus (Wettkampf 1v1) — wörtliches „1 gegen 1": zwei Spieler-Köpfe (im Stil
// der user/users-Icons) mit gefülltem Gold-Blitz dazwischen. Das alte „VS"-
// Buchstaben-Lockup verschmolz in Chipgröße zum Gestrüpp.
filled('versus', '<circle cx="5.5" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M1.8 18.5a4.2 4.2 0 0 1 7.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18.5" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14.8 18.5a4.2 4.2 0 0 1 7.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.9 3.2l-4.3 7.8h2.9l-1.7 8.8 5.3-8.6h-3z" fill="#f2b529" stroke="#b9821a" stroke-width="1" stroke-linejoin="round"/>');
// Controller (Spielmodus).
filled('controller', '<path d="M8 8h8a5 5 0 0 1 5 5 3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1.8A3 3 0 0 1 3 13a5 5 0 0 1 5-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 11v3M5.5 12.5h3M15.5 11.5h.01M17.5 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
// Stern (Skin/Highlight).
filled('star', '<path d="M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 17l-5.6 3 1.6-6.3-5-4.2 6.5-.5z" fill="#f2b529" stroke="#b9821a" stroke-width="1" stroke-linejoin="round"/>');
// Punkt „online" (Präsenz).
filled('dot', '<circle cx="12" cy="12" r="5" fill="currentColor"/>');
// Würfel (Zufalls-Schwierigkeit) — abgerundetes Quadrat mit 5 Augen.
filled('dice', '<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="8" cy="16" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>');

// ── Shop-Artikel & -Kategorien (Emoji-Ersatz im Shop) ────────────────────────
// Kleine, im gleichen Stil gezeichnete Glyphen für jede Palette/Theme/SFX/Font/
// Rahmen/Skin-Vorlage und jede Sieganimation. Bewusst objekthaft (gefüllt) wo es
// als „Ding" gelesen wird, sonst Strich. Werden über item.icon → ic() gerendert.

// Paletten
filled('candy', '<circle cx="9.5" cy="8" r="5.3" fill="#ff8fb0" stroke="#d64d7e" stroke-width="1"/><path d="M9.5 3.2a4.8 4.8 0 0 1 0 9.6 3 3 0 0 1 0-6 1.4 1.4 0 0 1 0 2.8" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M12.2 12.3l2.8 7.9" fill="none" stroke="#c99a52" stroke-width="2" stroke-linecap="round"/>');
stroke('radio', '<path d="M4 9.5h16v9.5H4zM7.5 9.5l9.5-4.2"/><circle cx="14.5" cy="14.2" r="2.6"/><path d="M6.5 12.5h3.5M6.5 15.5h3.5"/>');
filled('sunset', '<path d="M4.5 16.5a7.5 7.5 0 0 1 15 0z" fill="#f7a63b"/><path d="M12 3.5v3M4.6 8.6l1.7 1.7M19.4 8.6l-1.7 1.7M2.5 16.5H5.5M18.5 16.5h3" fill="none" stroke="#f2b529" stroke-width="1.6" stroke-linecap="round"/><path d="M2.5 19.5h19M6.5 22h11" fill="none" stroke="#e0873a" stroke-width="1.6" stroke-linecap="round"/>');
stroke('snow', '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M12 6.4l-2.3-1.7M12 6.4l2.3-1.7M12 17.6l-2.3 1.7M12 17.6l2.3 1.7M5.2 9.4l.2-2.8M5.2 9.4l-2.6.9M18.8 14.6l-.2 2.8M18.8 14.6l2.6-.9M5.2 14.6l-2.6-.9M5.2 14.6l.2 2.8M18.8 9.4l2.6.9M18.8 9.4l-.2-2.8"/>');
stroke('mirror', '<ellipse cx="12" cy="9" rx="5.6" ry="6.4"/><path d="M12 15.4V20M9.5 20.5h5M9.5 7.5a3.5 4 0 0 1 2.5-2"/>');
stroke('robot', '<rect x="6" y="8" width="12" height="10" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="3.8" r="1.2"/><circle cx="9.6" cy="12" r="1"/><circle cx="14.4" cy="12" r="1"/><path d="M9.6 15.4h4.8M4 11.5v3M20 11.5v3"/>');
filled('mask', '<path d="M5 5.5c4.5-1.2 9.5-1.2 14 0 .2 6-1.8 11.5-7 13.5C6.8 17 4.8 11.5 5 5.5z" fill="#7b61ff" stroke="#4b37c9" stroke-width="1"/><path d="M8.3 10c1 .9 2.2.9 3.2 0M12.5 10c1 .9 2.2.9 3.2 0M9 13.5a3.6 2.6 0 0 0 6 0" fill="none" stroke="#fff" stroke-width="1.3"/>');

// Themes
filled('oled', '<circle cx="12" cy="12" r="9" fill="#0d0d12" stroke="#3a3a46" stroke-width="1.5"/><path d="M8.5 7.5a5.5 5.5 0 0 0 8 7.2" fill="none" stroke="#2b2b36" stroke-width="1.6"/><circle cx="9" cy="9" r="1" fill="#4a4a5a"/>');
filled('whale', '<path d="M2.5 12.5c1-4 5-6 9-5.5 3 .4 5 2 6.5 2.2 1.2.1 2-.4 2.5-.9-.1 1.5-1 2.6-2.4 2.7 0 3.2-3.4 6-7.7 6-4.2 0-7.4-2.6-7.6-5.6-.4 0-.8.1-1.3.4z" fill="#4a90d9" stroke="#2a6bb0" stroke-width="1" stroke-linejoin="round"/><path d="M18 6.5c.4-1.2 1.4-1.8 2.6-1.6-.3.7-.2 1.4.2 2" fill="none" stroke="#7fbce8" stroke-width="1.3"/><circle cx="7.5" cy="11.5" r="1" fill="#fff"/>');
filled('tree', '<path d="M12 3l4.5 6h-2.5l3 4.5h-2.5l3 4.5H6.5l3-4.5H7l3-4.5H7.5z" fill="#3fb27f" stroke="#2a7d59" stroke-width="1" stroke-linejoin="round"/><path d="M11 18h2v3h-2z" fill="#8a5a3a"/>');
filled('blossom', '<g fill="#ff9ec4"><circle cx="12" cy="6.6" r="3.1"/><circle cx="6.9" cy="10.3" r="3.1"/><circle cx="8.9" cy="16.3" r="3.1"/><circle cx="15.1" cy="16.3" r="3.1"/><circle cx="17.1" cy="10.3" r="3.1"/></g><circle cx="12" cy="12" r="2.4" fill="#ffd23f"/>');
filled('galaxy', '<circle cx="12" cy="12" r="9" fill="#241b3d"/><path d="M12 12c0-3 3-4.5 5.5-3.5M12 12c0 3-3 4.5-5.5 3.5" fill="none" stroke="#b98bff" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="#fff"/><circle cx="7" cy="7.5" r=".7" fill="#fff"/><circle cx="17" cy="16" r=".7" fill="#fff"/>');
stroke('circuit', '<path d="M4 12h4M16 12h4M12 4v4M12 16v4"/><rect x="8" y="8" width="8" height="8" rx="1"/><circle cx="4" cy="12" r="1.3"/><circle cx="20" cy="12" r="1.3"/><circle cx="12" cy="4" r="1.3"/><circle cx="12" cy="20" r="1.3"/>');

// SFX
stroke('lotus', '<path d="M12 20c-4 0-7-2-7-5 1.6 0 3 .6 4 1.5C8.5 13 10 11 12 9.5c2 1.5 3.5 3.5 3 7 1-.9 2.4-1.5 4-1.5 0 3-3 5-7 5z"/><path d="M12 20c-1.6 0-3-2-3-5 0-2 1.2-4 3-5.5 1.8 1.5 3 3.5 3 5.5 0 3-1.4 5-3 5z"/>');
filled('invader', '<path d="M8 6h2v2H8zM14 6h2v2h-2zM6 8h12v2H6zM4 10h16v4H4zM4 14h4v2H4zM16 14h4v2h-4zM8 16h2v2H8zM14 16h2v2h-2z" fill="#6ee06e"/><rect x="9.5" y="11.5" width="1.6" height="1.6" fill="#0a0a12"/><rect x="12.9" y="11.5" width="1.6" height="1.6" fill="#0a0a12"/>');
filled('planet', '<circle cx="11" cy="11" r="6" fill="#d98a4a" stroke="#a8632f" stroke-width="1"/><path d="M8 9.5a5 5 0 0 1 6 0M8.5 13a5 5 0 0 0 5.5.5" stroke="#a8632f" stroke-width="1" fill="none"/><ellipse cx="11" cy="11" rx="10" ry="3.2" fill="none" stroke="#f2c98a" stroke-width="1.6" transform="rotate(-20 11 11)"/>');

// Fonts
stroke('keyboard', '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6.5 13.5h11"/>');
stroke('pen', '<path d="M15.5 4.5l4 4L9 19l-4.5 1.2L6 15.7zM14 6l4 4"/>');
filled('stone', '<path d="M5 14c-1-3 1-6 4-6.5 2-1 5-1 7 .5 2.5 1 3.5 4 2.5 6.5-1 2.5-4 3.5-7 3.5s-6-1-6.5-3z" fill="#9aa3ad" stroke="#6b7580" stroke-width="1" stroke-linejoin="round"/><path d="M9 11l2 1.5M14 10.5l-1.5 2" stroke="#6b7580" stroke-width="1.2" fill="none"/>');
filled('sparkles', '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" fill="#f2b529"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" fill="#ffe08a"/><path d="M5.5 15l.5 1.6L7.7 17l-1.7.4L5.5 19l-.5-1.6L3.3 17l1.7-.4z" fill="#ffe08a"/>');
stroke('outline', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>');

// Rahmen
filled('wood', '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="#b07a44" stroke="#835a30" stroke-width="1"/><path d="M4 10c4 .5 12 .5 16 0M4 14c4 .5 12 .5 16 0" fill="none" stroke="#8a5f34" stroke-width="1"/><ellipse cx="9" cy="9" rx="1.3" ry="1" fill="#8a5f34"/>');
stroke('column', '<path d="M5 6h14M5 6l1.5-2h11L19 6M7 6v12M17 6v12M10 6v12M14 6v12M4 18h16M4 20h16"/>');
stroke('pulse', '<path d="M2 12h4l2-6 4 12 2.5-8 1.5 2h6"/>');
filled('orb', '<circle cx="12" cy="12" r="8.5" fill="#3a1e6e"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#a86bff" stroke-width="1"/><path d="M12 12c-2-2-2-5 0-7M12 12c2 2 2 5 0 7M12 12c2-2 5-2 7 0M12 12c-2 2-5 2-7 0" fill="none" stroke="#d9a6ff" stroke-width="1.2"/><circle cx="12" cy="12" r="1.6" fill="#fff"/>');
filled('bolt', '<path d="M13 2L4 13h6l-2 9 10-12h-6z" fill="#f7d038" stroke="#c99a10" stroke-width="1" stroke-linejoin="round"/>');

// Skin-Vorlagen
filled('island', '<path d="M3 18a9 3 0 0 0 18 0z" fill="#e6c477"/><path d="M12 18V9M12 9c-2-2-5-2-6.5-.5M12 9c2-2 5-2 6.5-.5M12 9c-1-2.5-.5-5 1-6.5M12 9c1-2.5.5-5-1-6.5" fill="none" stroke="#3fb27f" stroke-width="1.6" stroke-linecap="round"/>');
filled('aurora', '<path d="M4 18c2-8 4-10 5-10s1 8 3 8 3-9 4-9 2 6 4 8" fill="none" stroke="#3fb27f" stroke-width="1.8" stroke-linecap="round"/><path d="M4 20c2-7 4-9 5-9s1 7 3 7 3-8 4-8 2 5 4 7" fill="none" stroke="#5ad1e6" stroke-width="1.6" stroke-linecap="round"/><path d="M6 21h.01M10 21h.01M14 21h.01M18 21h.01" fill="none" stroke="#fff" stroke-width="1.2"/>');
filled('volcano', '<path d="M2 20l7-11h1.5l1.5 2 2-2H16l6 11z" fill="#7a6a5a" stroke="#4f4238" stroke-width="1" stroke-linejoin="round"/><path d="M9 9c1-2 .5-4 2-5.5.5 2 2 2.5 2 4.5" fill="none" stroke="#ff5a1a" stroke-width="1.6" stroke-linecap="round"/><path d="M7 20l2-4 2 2 2-3 2 3 2-2 2 4z" fill="#ff7a1a"/>');

// Sieganimationen
filled('party', '<path d="M3 21l5-13 8 8zM8 8l0 0M14 4l1 1M18 3l-.5 1.5L19 5M20 8l-1.5.5M16 10l1 .3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M10.5 12.5l3 1M8.5 15l2.5 1" stroke="currentColor" stroke-width="1.4"/>');
filled('balloon', '<path d="M12 3a5 5 0 0 1 5 5c0 3.5-3 6-5 6.5C10 14 7 11.5 7 8a5 5 0 0 1 5-5z" fill="#e7405a"/><path d="M12 14.5l-.7 1.4h1.4z" fill="#e7405a"/><path d="M12 16.2c1 1-1 2 0 3.6" fill="none" stroke="#b02a40" stroke-width="1"/><path d="M9.6 7a2.5 3 0 0 1 1.5-2.3" fill="none" stroke="#fff" stroke-width="1.1"/>');
stroke('bubbles', '<circle cx="10" cy="13" r="5.5"/><circle cx="17" cy="8" r="3"/><circle cx="7" cy="6" r="2"/><path d="M7.5 11.5a2.5 2.5 0 0 1 2-2" stroke-width="1.2"/>');
filled('sparkler', '<path d="M6 20l7-9" stroke="#caa15a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M14 9l.8 2 2 .3-1.6 1.4.5 2.1L14 15.6l-1.7.8.5-2.1-1.6-1.4 2-.3z" fill="#ffd23f"/><path d="M18 5l.5 1.5M20 8l-1.5.5M19 11l1.5-.3M15 5.5l-.5-1.6M11 8l-1.6-.3" stroke="#ffb340" stroke-width="1.2" stroke-linecap="round" fill="none"/>');
filled('firework', '<g stroke="#f2b529" stroke-width="1.6" stroke-linecap="round"><path d="M12 12V4M12 12v8M12 12H4M12 12h8M12 12L6.5 6.5M12 12l5.5 5.5M12 12l5.5-5.5M12 12L6.5 17.5"/></g><g fill="#e7405a"><circle cx="12" cy="3.5" r="1.1"/><circle cx="20.5" cy="12" r="1.1"/><circle cx="12" cy="20.5" r="1.1"/><circle cx="3.5" cy="12" r="1.1"/></g><circle cx="12" cy="12" r="1.6" fill="#fff"/>');
stroke('wave', '<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>');
stroke('matrix', '<path d="M6 3v10M6 16v2M12 6v9M12 18v2M18 3v5M18 11v6"/><path d="M4.5 13l1.5 1.5 1.5-1.5M10.5 15l1.5 1.5 1.5-1.5M16.5 8l1.5 1.5 1.5-1.5"/>');
filled('disco', '<circle cx="12" cy="11" r="7" fill="#9aa3ad" stroke="#6b7580" stroke-width="1"/><path d="M12 4v14M5 11h14M7 6l10 10M17 6L7 16" stroke="#c3ccd6" stroke-width="1" fill="none"/><path d="M12 18v3M9 21.5h6" stroke="#6b7580" stroke-width="1.4" fill="none"/><circle cx="9" cy="8" r="1.2" fill="#fff"/>');
filled('blackhole', '<circle cx="12" cy="12" r="9" fill="none" stroke="#7b61ff" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="9" ry="3.2" fill="none" stroke="#b98bff" stroke-width="1.4" transform="rotate(-18 12 12)"/><circle cx="12" cy="12" r="3.4" fill="#0a0a12"/>');
filled('firecracker', '<rect x="8" y="8" width="6" height="12" rx="1" fill="#e7405a" stroke="#b02a40" stroke-width="1" transform="rotate(8 11 14)"/><path d="M9 8l-2-4M12 7l1-4M14.5 8.5l3-2.5" stroke="#f2b529" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M6.5 4l-.5-1.5M13 3l.3-1.6M17.5 6l1.4-.8" stroke="#ffd23f" stroke-width="1.2" fill="none" stroke-linecap="round"/>');
filled('dragon', '<path d="M4 15c0-4 3-7 7-7 2 0 3-1 3-2.5 1 .5 1.5 1.5 1.3 2.7C18 8.5 20 10 20 13c0 1-.5 1.8-1.3 2.3.3 1-.2 2-1.2 2.3.2 1-.6 1.9-1.6 1.9-3 0-4-2-6.4-2-2 0-3.5 1.5-3.5 1.5S4 18 4 15z" fill="#3fb27f" stroke="#2a7d59" stroke-width="1" stroke-linejoin="round"/><circle cx="9.5" cy="12" r="1.1" fill="#0a0a12"/><path d="M14 5.5l1-2.5.8 2.2M11 8l-3-2M12 15c1.5 1 3 1 4.5 0" stroke="#2a7d59" stroke-width="1.1" fill="none" stroke-linecap="round"/>');
filled('rocket', '<path d="M12 2c3 2 4.5 5 4.5 9l-1.5 4h-6L7.5 11C7.5 7 9 4 12 2z" fill="#dce3ea" stroke="#8f9aa6" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="9" r="1.8" fill="#5ad1e6" stroke="#1f8fa8" stroke-width="1"/><path d="M9 15c-2 .5-3 2-3 4 1.5 0 2.5-.5 3-1.5M15 15c2 .5 3 2 3 4-1.5 0-2.5-.5-3-1.5" fill="#e7405a"/><path d="M11 19h2l-1 3z" fill="#ff7a1a"/>');
filled('shatter', '<path d="M6 4h12l3.5 5-9.5 11L2.5 9zM2.5 9h19M12 4l-2 5 3 3-2 8M12 4l4 5-3 3" fill="#5ad1e6" stroke="#1f8fa8" stroke-width="1" stroke-linejoin="round"/>');
filled('phoenix', '<path d="M12 4c1.5 1.5 2 3 1.5 5 2-1 3.5-1 5-.5-1 1.5-2.5 2.5-4.5 2.8 1.5 1 2 2.5 2 4.2-1.5-.5-2.8-1.4-3.5-2.7-.5 2-2 3.4-4 3.9-.5-2 0-3.8 1-5.2-2 .3-3.8-.3-5-1.8 1.8-.8 3.3-.8 4.8-.2-1-1.6-1-3.4.2-5C12 6 12 5 12 4z" fill="#ff7a1a" stroke="#d4560f" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="11" r="1.4" fill="#ffd23f"/>');
stroke('jackpot', '<rect x="4" y="5" width="14" height="14" rx="2"/><path d="M4 9.5h14M7.5 5V3.5M14.5 5V3.5M7 13.5h.01M11 13.5h.01M15 13.5h.01M7 16.5h8M20 9v4"/><circle cx="20" cy="8" r="1.3"/>');
filled('unicorn', '<path d="M4 18c0-4 2.5-7 6-8 1-.3 1.5-1 1.5-2l3.5-1c0 1.5-.5 2.5-1.5 3.3 2 .7 3.5 2.7 3.5 5.2 0 .5-.1 1-.3 1.5" fill="#fff2fb" stroke="#c98ad8" stroke-width="1" stroke-linejoin="round"/><path d="M15 4l3-3-1 4z" fill="#f2b529" stroke="#c99a10" stroke-width=".8"/><path d="M14 3.5c1.5.5 2.5 2 2.5 4M12 5.5c1 1 3 3 3 6" fill="none" stroke="#ff9ec4" stroke-width="1.4" stroke-linecap="round"/><circle cx="9.5" cy="12" r="1" fill="#0a0a12"/>');
filled('meteor', '<defs><radialGradient id="mHead" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="#fff6d8"/><stop offset="38%" stop-color="#ffb04a"/><stop offset="72%" stop-color="#e0631f"/><stop offset="100%" stop-color="#7c3d15"/></radialGradient><linearGradient id="mTail" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="45%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#ff7a1a" stop-opacity="0"/></linearGradient><radialGradient id="mGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb04a" stop-opacity=".5"/><stop offset="100%" stop-color="#ffb04a" stop-opacity="0"/></radialGradient></defs><circle cx="14.6" cy="9.2" r="7.4" fill="url(#mGlow)"/><path d="M12.8 10.8L4.8 18.6" stroke="url(#mTail)" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M14.4 12.2L7.6 19.4" stroke="url(#mTail)" stroke-width="1.9" stroke-linecap="round" fill="none"/><path d="M11.4 9.2L5 15.4" stroke="url(#mTail)" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="14.6" cy="9.2" r="4.1" fill="url(#mHead)" stroke="#7c3d15" stroke-width=".6"/><circle cx="13.1" cy="7.8" r="1.05" fill="#fff3cf" opacity=".85"/><circle cx="6.2" cy="17.4" r=".7" fill="#ffd23f"/><circle cx="9" cy="14.2" r=".5" fill="#ffe38a"/>');
filled('storm', '<path d="M7 13a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 16.5 7 3.3 3.3 0 0 1 16 13.5H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 12.5l-2.5 4.5H12l-1.5 4 4.5-6H12l1.5-2.5z" fill="#f2b529" stroke="none"/>');
stroke('portal', '<ellipse cx="12" cy="12" rx="6" ry="8.5"/><ellipse cx="12" cy="12" rx="3.4" ry="5.5"/><ellipse cx="12" cy="12" rx="1.2" ry="2.5"/>');
stroke('tornado', '<path d="M4 5h16M6 8.5h13M9 12h9M11 15h5M13 18h1.5"/><path d="M18 8.5c-3 1.5-3 3-1 3.5"/>');

// ── Erfolge (Achievements) ───────────────────────────────────────────────────
filled('ribbon', '<circle cx="12" cy="9" r="5" fill="#e7405a" stroke="#b02a40" stroke-width="1"/><circle cx="12" cy="9" r="2" fill="#fff4cf"/><path d="M9 13l-2 8 3-2 2 2 2-2 3 2-2-8" fill="#c0473f" stroke="#8a2f2a" stroke-width="1" stroke-linejoin="round"/>');
stroke('broom', '<path d="M18 4l-6 6"/><path d="M5 19l7-7 3 3-2.5 4.5c-2.5.5-5 .5-7.5-.5z"/><path d="M8 15.5l2 2M11 13l2 2"/>');
stroke('brain', '<path d="M11 4.5A2.2 2.2 0 0 0 7.2 6 2.3 2.3 0 0 0 5 8.3a2.3 2.3 0 0 0 .4 4A2.3 2.3 0 0 0 8 16.4c.4 1.5 1.6 2.2 3 1.8V4.6A2 2 0 0 0 11 4.5zM13 4.5A2.2 2.2 0 0 1 16.8 6 2.3 2.3 0 0 1 19 8.3a2.3 2.3 0 0 1-.4 4A2.3 2.3 0 0 1 16 16.4c-.4 1.5-1.6 2.2-3 1.8V4.6A2 2 0 0 1 13 4.5z"/>');
filled('skull', '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V19a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8z" fill="#e8eaed" stroke="#a8adb5" stroke-width="1" stroke-linejoin="round"/><circle cx="9" cy="11" r="2" fill="#3a3f47"/><circle cx="15" cy="11" r="2" fill="#3a3f47"/><path d="M12 14l-1 2.5h2z" fill="#3a3f47"/><path d="M9 20v-2M12 20v-2.5M15 20v-2" stroke="#a8adb5" stroke-width="1"/>');
stroke('calendar', '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01"/>');
filled('shield', '<path d="M12 3l7 2.5v5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5v-5z" fill="#5a8fd9" stroke="#2a6bb0" stroke-width="1" stroke-linejoin="round"/><path d="M9 12l2 2 4-4.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>');
stroke('runner', '<circle cx="15" cy="4.6" r="2"/><path d="M15 7l-2.5 4L9 10.5M15 7l1.5 4 3 1.5M12.5 11l-.5 4.5-3 4M12 15.5l2.5 4.5"/>');

// ── Weitere UI-Glyphen (Emoji-Sweep) ─────────────────────────────────────────
stroke('pause', '<path d="M8 5v14M16 5v14"/>');
stroke('hourglass', '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>');

// Schwierigkeits-Glyphen: farbige Stufen-Punkte (bringen eigene Farbe mit) +
// thematische „Härtegrade" (Schädel/Meteor/Geist/Grabstein).
filled('lvl-green',  '<circle cx="12" cy="12" r="8" fill="#3fb27f" stroke="#2a7d59" stroke-width="1.3"/>');
filled('lvl-yellow', '<circle cx="12" cy="12" r="8" fill="#f2c024" stroke="#c99a10" stroke-width="1.3"/>');
filled('lvl-orange', '<circle cx="12" cy="12" r="8" fill="#f2953b" stroke="#c96f1e" stroke-width="1.3"/>');
filled('lvl-red',    '<circle cx="12" cy="12" r="8" fill="#e7405a" stroke="#b02a40" stroke-width="1.3"/>');
filled('lvl-purple', '<circle cx="12" cy="12" r="8" fill="#9a6bff" stroke="#6b3fd0" stroke-width="1.3"/>');
filled('ghost', '<path d="M6 11a6 6 0 0 1 12 0v9l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6V11z" fill="#e6e9ff" stroke="#a9b0e0" stroke-width="1" stroke-linejoin="round"/><circle cx="9.5" cy="11" r="1.1" fill="#3a3f57"/><circle cx="14.5" cy="11" r="1.1" fill="#3a3f57"/>');
filled('grave', '<path d="M7 21V10.5a5 5 0 0 1 10 0V21z" fill="#9aa3ad" stroke="#6b7580" stroke-width="1" stroke-linejoin="round"/><path d="M12 7.5v5M9.7 9.8h4.6" fill="none" stroke="#6b7580" stroke-width="1.4"/><path d="M5 21h14" stroke="#5a636e" stroke-width="1.4"/>');

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
