// shopitems.js — generischer Katalog aller kaufbaren Shop-Artikel jenseits der
// Sieganimationen (die leben mit eigenem Overlay-System in wineffects.js).
// KEINE Render-Logik hier: reine Daten + unit-testbare Besitz-/Auflösungs-/
// Transformations-Logik. Preise gestaffelt wie bei den Sieganimationen,
// erweitert um Tier 4 („Legendär") für besonders aufwendige Artikel.
export const SHOP_TIER_PRICES = { 1: 400, 2: 600, 3: 900, 4: 1500 };

// Kategorie-Metadaten: settingKey = Einstellungs-Feld für den ausgerüsteten
// Artikel, free = eingebauter Gratis-Standard (nicht im Katalog, immer wählbar).
// skinpreset hat keinen settingKey — Presets werden ANGEWENDET (schreiben die
// Skin-Einstellungen), nicht ausgerüstet.
export const SHOP_CATS = {
  palette:    { icon: '🌈', settingKey: 'boardPalette', free: 'classic' },
  theme:      { icon: '🖌️', settingKey: 'appTheme',     free: 'standard' },
  frame:      { icon: '🖼️', settingKey: 'boardFrame',   free: 'none' },
  font:       { icon: '🔢', settingKey: 'numberFont',   free: 'classic' },
  badge:      { icon: '🏅', settingKey: 'profileBadge', free: 'none' },
  skinpreset: { icon: '🎨', settingKey: null,           free: null },
  sfx:        { icon: '🎵', settingKey: 'sfxPack',      free: 'standard' },
};

// ─── Katalog ──────────────────────────────────────────────────────────────────
// 🌈 Brett-Paletten: HSL-Transformationen (hue-Rotation °, Sättigungs-Faktor,
// Helligkeits-Offset) der 18 Cage-Farben. WICHTIG: nur Rotation + gleichmäßige
// Skalierung — das erhält die sorgfältig optimierten wahrgenommenen Abstände
// zwischen den Cage-Farben (siehe REGION_COLORS in config.js); niemals Farbtöne
// in einen Teilbereich stauchen (Kollisionsgefahr).
export const SHOP_CATALOG = [
  { id: 'pastell',    cat: 'palette', icon: '🍭', tier: 1, fx: { hue: 0,   sat: 0.55, light: 16 } },
  { id: 'vintage',    cat: 'palette', icon: '📻', tier: 1, fx: { hue: 15,  sat: 0.70, light: 6 } },
  { id: 'daemmerung', cat: 'palette', icon: '🌆', tier: 1, fx: { hue: -25, sat: 0.90, light: -6 } },
  { id: 'neon',       cat: 'palette', icon: '💡', tier: 2, fx: { hue: 0,   sat: 1.30, light: 4 } },
  { id: 'arktis',     cat: 'palette', icon: '🧊', tier: 2, fx: { hue: 160, sat: 0.85, light: 8 } },
  { id: 'spiegel',    cat: 'palette', icon: '🪞', tier: 2, fx: { hue: 180, sat: 1.00, light: 0 } },
  { id: 'cyber',      cat: 'palette', icon: '🤖', tier: 3, fx: { hue: 45,  sat: 1.20, light: -2 } },
  { id: 'karneval',   cat: 'palette', icon: '🎭', tier: 3, fx: { hue: 90,  sat: 1.35, light: 2 } },
];

// 🖌️ App-Themes: komplette UI-Farbwelten (CSS-Variablen-Sets in styles.css,
// :root[data-apptheme="<id>"]). data.base legt fest, ob das Theme auf der
// dunklen oder hellen Grundwelt aufsetzt (steuert data-theme + Farbblind-
// Overrides), data.top = Browser-Chrome-Farbe (meta theme-color),
// data.sw = 4 Vorschau-Farben für die Shop-Karte (bg, Karte, Akzent, Text).
export const THEME_ITEMS = [
  { id: 'kaffee',    cat: 'theme', icon: '☕', tier: 1, data: { base: 'light', top: '#f3ece2', sw: ['#f3ece2', '#fffaf2', '#8a5a2b', '#3c2f23'] } },
  { id: 'oled',      cat: 'theme', icon: '🖤', tier: 2, data: { base: 'dark',  top: '#000000', sw: ['#000000', '#0d0d11', '#4f7dff', '#e8e8ee'] } },
  { id: 'tiefsee',   cat: 'theme', icon: '🐋', tier: 2, data: { base: 'dark',  top: '#04121c', sw: ['#04121c', '#0a2434', '#2dd4bf', '#dcf3f7'] } },
  { id: 'wald',      cat: 'theme', icon: '🌲', tier: 2, data: { base: 'dark',  top: '#0c1510', sw: ['#0c1510', '#15251a', '#7cc26a', '#e6f2e4'] } },
  { id: 'sakura',    cat: 'theme', icon: '🌸', tier: 2, data: { base: 'light', top: '#fdf0f4', sw: ['#fdf0f4', '#ffffff', '#d6488a', '#43222f'] } },
  { id: 'nebula',    cat: 'theme', icon: '🌌', tier: 3, data: { base: 'dark',  top: '#0d0a1f', sw: ['#0d0a1f', '#1a1438', '#c26bff', '#ece6fb'] } },
  { id: 'sunset',    cat: 'theme', icon: '🌇', tier: 3, data: { base: 'dark',  top: '#1d0f12', sw: ['#1d0f12', '#301a1c', '#ff8a4c', '#f7e8de'] } },
  { id: 'cyberpunk', cat: 'theme', icon: '🦾', tier: 4, data: { base: 'dark',  top: '#08080c', sw: ['#08080c', '#12121c', '#f7e733', '#ff2e88'] } },
];
SHOP_CATALOG.push(...THEME_ITEMS);

// 🎵 Sound-Pakete: Klangfarben für ALLE UI-Sounds (parametrische Synthese in
// js/music.js SFX_PACKS — Wellenform, Tonlage, Hüllkurve, Schimmer/Sub/Chorus).
export const SFX_ITEMS = [
  { id: 'zen',       cat: 'sfx', icon: '🧘', tier: 1 },
  { id: 'arcade',    cat: 'sfx', icon: '👾', tier: 2 },
  { id: 'kristall',  cat: 'sfx', icon: '🔔', tier: 2 },
  { id: 'kosmos',    cat: 'sfx', icon: '🪐', tier: 3 },
  { id: 'synthwave', cat: 'sfx', icon: '🌆', tier: 4 },
];
SHOP_CATALOG.push(...SFX_ITEMS);

// 🔢 Zahlen-Stile: Typo/Effekte für die Ziffern auf dem Brett (Zellwerte,
// Kopfsummen, Cage-Chips). Reine System-Font-Stacks + CSS-Text-Effekte
// (.board.font-<id>, styles.css) — kein Font-Download, kein Build-Schritt.
export const FONT_ITEMS = [
  { id: 'mono',     cat: 'font', icon: '⌨️', tier: 1 },
  { id: 'serif',    cat: 'font', icon: '📜', tier: 1 },
  { id: 'hand',     cat: 'font', icon: '✍️', tier: 2 },
  { id: 'graviert', cat: 'font', icon: '🪨', tier: 2 },
  { id: 'neonfont', cat: 'font', icon: '💫', tier: 3 },
  { id: 'umriss',   cat: 'font', icon: '⭕', tier: 3 },
  { id: 'gold',     cat: 'font', icon: '🥇', tier: 4 },
];
SHOP_CATALOG.push(...FONT_ITEMS);

// 🖼️ Brett-Rahmen: dekorative Ring-Overlays am Brett (.board.frame-<id>,
// ::before/::after in styles.css). Animationen ausschließlich transform/
// opacity (Orbiter-Glanzpunkte, Puls/Flackern) — GPU-Compositor-Regel.
export const FRAME_ITEMS = [
  { id: 'holz',       cat: 'frame', icon: '🪵', tier: 1 },
  { id: 'goldbarock', cat: 'frame', icon: '🏛️', tier: 2 },
  { id: 'eis',        cat: 'frame', icon: '❄️', tier: 2 },
  { id: 'neonpuls',   cat: 'frame', icon: '💜', tier: 3 },
  { id: 'feuer',      cat: 'frame', icon: '🔥', tier: 3 },
  { id: 'regenbogen', cat: 'frame', icon: '🌈', tier: 3 },
  { id: 'galaxie',    cat: 'frame', icon: '🌌', tier: 4 },
];
SHOP_CATALOG.push(...FRAME_ITEMS);

// 🏅 Profil-Badges: Emoji-Abzeichen neben dem eigenen Namen — sichtbar im
// Coop-Roster (IDENTITY/ROSTER), in der Freundesliste (Präsenz) und in der
// Bestenliste. Fremde Clients rendern NUR bekannte Katalog-IDs (badgeIcon-
// Lookup) — beliebige Strings aus der RTDB werden nie direkt angezeigt.
export const BADGE_ITEMS = [
  { id: 'stern',   cat: 'badge', icon: '🌟', tier: 1 },
  { id: 'klee',    cat: 'badge', icon: '🍀', tier: 1 },
  { id: 'blitz',   cat: 'badge', icon: '⚡', tier: 1 },
  { id: 'flamme',  cat: 'badge', icon: '🔥', tier: 2 },
  { id: 'einhorn', cat: 'badge', icon: '🦄', tier: 2 },
  { id: 'rakete',  cat: 'badge', icon: '🚀', tier: 2 },
  { id: 'gehirn',  cat: 'badge', icon: '🧠', tier: 2 },
  { id: 'alien',   cat: 'badge', icon: '👽', tier: 2 },
  { id: 'trophae', cat: 'badge', icon: '🏆', tier: 3 },
  { id: 'diamant', cat: 'badge', icon: '💎', tier: 3 },
  { id: 'drache',  cat: 'badge', icon: '🐉', tier: 3 },
  { id: 'krone',   cat: 'badge', icon: '👑', tier: 4 },
];
SHOP_CATALOG.push(...BADGE_ITEMS);
// Sicherer Icon-Lookup für Fremd-Daten (unbekannte ID ⇒ leer, nie Roh-String).
export function badgeIcon(id) {
  const it = shopItemById(id);
  return it && it.cat === 'badge' ? it.icon : '';
}

// 🎨 Skin-Vorlagen: kuratierte Konfigurationen für den EXKLUSIVEN dynamischen
// Skin (Inventar-Item 'dynamicColor' — Kauf setzt dessen Besitz voraus, s.
// buyShopItem in app.js). „Anwenden" SCHREIBT die Skin-Einstellungen (Stil,
// Farben, Tempo, Glow, Dicke) — danach frei weiter-editierbar; deshalb kein
// settingKey/„ausgerüstet"-Zustand. data.c = 3 Verlaufs-Farben (leer bei rainbow).
export const SKINPRESET_ITEMS = [
  { id: 'lagune',          cat: 'skinpreset', icon: '🏝️', tier: 1, data: { style: 'gradient', c: ['#00c2a8', '#1976d2', '#0a3d62'], speed: 4,  glow: 6,  thickness: 2.5 } },
  { id: 'smaragd',         cat: 'skinpreset', icon: '💚', tier: 1, data: { style: 'gradient', c: ['#2ecc71', '#00b894', '#145a32'], speed: 3,  glow: 5,  thickness: 2.5 } },
  { id: 'abendrot',        cat: 'skinpreset', icon: '🌅', tier: 2, data: { style: 'gradient', c: ['#ff7043', '#e91e63', '#6a1b9a'], speed: 5,  glow: 7,  thickness: 2.5 } },
  { id: 'goldrausch',      cat: 'skinpreset', icon: '🪙', tier: 2, data: { style: 'gradient', c: ['#ffd700', '#ff9800', '#8d5a00'], speed: 4,  glow: 9,  thickness: 3 } },
  { id: 'mitternacht',     cat: 'skinpreset', icon: '🌙', tier: 2, data: { style: 'gradient', c: ['#283593', '#5e35b1', '#0d1117'], speed: 2,  glow: 4,  thickness: 2 } },
  { id: 'polarlicht',      cat: 'skinpreset', icon: '❇️', tier: 3, data: { style: 'gradient', c: ['#00e5a0', '#00b0ff', '#7c4dff'], speed: 7,  glow: 10, thickness: 3 } },
  { id: 'lava',            cat: 'skinpreset', icon: '🌋', tier: 3, data: { style: 'gradient', c: ['#ff3d00', '#ff9100', '#3e2723'], speed: 8,  glow: 12, thickness: 3.5 } },
  { id: 'hyperregenbogen', cat: 'skinpreset', icon: '🌈', tier: 4, data: { style: 'rainbow',  c: [],                                speed: 10, glow: 12, thickness: 3 } },
];
SHOP_CATALOG.push(...SKINPRESET_ITEMS);

export function shopItemById(id) { return SHOP_CATALOG.find((i) => i.id === id) || null; }
export function catItems(cat) { return SHOP_CATALOG.filter((i) => i.cat === cat); }
export function shopItemPrice(idOrItem) {
  const it = typeof idOrItem === 'string' ? shopItemById(idOrItem) : idOrItem;
  return it ? SHOP_TIER_PRICES[it.tier] || 0 : 0;
}
// Inventar-Schlüssel mit Kategorie-Präfix — kollidiert nie mit anderen Item-
// Arten im geteilten Union-Inventar (winfx_*, dynamicColor, founder, …).
export function shopInvKey(item) { return `${item.cat}_${item.id}`; }
export function ownsShopItem(inventory, item) { return !!(item && inventory && inventory[shopInvKey(item)]); }

// Ausgerüsteten Artikel einer Kategorie auflösen: gewählte Einstellung nur,
// wenn (noch) im Besitz und bekannt — sonst der eingebaute Gratis-Standard
// (z.B. nach Admin-Entzug oder auf einem noch nicht gesyncten Gerät).
export function resolveEquipped(cat, settingVal, inventory) {
  const meta = SHOP_CATS[cat];
  if (!meta) return null;
  const it = shopItemById(settingVal);
  if (it && it.cat === cat && ownsShopItem(inventory, it)) return settingVal;
  return meta.free;
}

// ─── Paletten-Transformation (pure) ──────────────────────────────────────────
// Wendet die fx-Parameter einer Palette auf eine {h,s,l}-Farbe an. Hue rotiert
// modulo 360, Sättigung/Helligkeit werden auf sinnvolle Bereiche geklemmt,
// damit Chips lesbar bleiben (nie ganz weiß/schwarz/grau).
export function applyPaletteFx(color, fx) {
  if (!color) return color;
  if (!fx) return { h: color.h, s: color.s, l: color.l };
  const h = ((color.h + (fx.hue || 0)) % 360 + 360) % 360;
  const s = Math.max(12, Math.min(100, Math.round(color.s * (fx.sat ?? 1))));
  const l = Math.max(14, Math.min(86, Math.round(color.l + (fx.light || 0))));
  return { h, s, l };
}
