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
