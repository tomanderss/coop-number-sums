// wineffects.js — Katalog + reine Logik der kaufbaren Sieganimationen (Shop).
// KEINE Render-Logik hier: das Erzeugen der Partikel (mit Math.random) lebt in
// app.js (launchWinFx), die Optik in css/styles.css (.winfx.fx-<id>). Dieses
// Modul bleibt dadurch ohne DOM/Zufall voll unit-testbar.
//
// Preismodell (vom Nutzer abgesegnet): gestaffelt nach Aufwand/Spektakel.
// Tier 0 = Confetti, der kostenlose Standard (immer im Besitz, nicht kaufbar).
export const CONFETTI_ID = 'confetti';
export const TIER_PRICES = { 0: 0, 1: 400, 2: 600, 3: 900, 4: 1500 };

// Reihenfolge = Anzeige-Reihenfolge im Shop (aufsteigend nach Preis, dann Kuration).
export const WIN_EFFECTS = [
  { id: 'confetti',  icon: '🎊', tier: 0 },
  // ── Tier 1 (400): klassisch-festlich ────────────────────────────────────────
  { id: 'balloons',  icon: '🎈', tier: 1 },
  { id: 'stars',     icon: '⭐', tier: 1 },
  { id: 'bubbles',   icon: '🫧', tier: 1 },
  { id: 'petals',    icon: '🌸', tier: 1 },
  { id: 'snow',      icon: '❄️', tier: 1 },
  { id: 'sparklers', icon: '🎇', tier: 1 },
  // ── Tier 2 (600): aufwendiger ───────────────────────────────────────────────
  { id: 'fireworks', icon: '🎆', tier: 2 },
  { id: 'coins',     icon: '🪙', tier: 2 },
  { id: 'rainbow',   icon: '🌈', tier: 2 },
  { id: 'wave',      icon: '🌊', tier: 2 },
  { id: 'matrix',    icon: '🟢', tier: 2 },
  { id: 'disco',     icon: '🪩', tier: 2 },
  { id: 'arcade',    icon: '👾', tier: 2 },
  { id: 'galaxy',    icon: '🌌', tier: 2 },
  // ── Tier 3 (900): spektakuläre Highlights ───────────────────────────────────
  { id: 'blackhole', icon: '🕳️', tier: 3 },
  { id: 'chain',     icon: '🧨', tier: 3 },
  { id: 'dragon',    icon: '🐉', tier: 3 },
  { id: 'rocket',    icon: '🚀', tier: 3 },
  { id: 'shatter',   icon: '💎', tier: 3 },
  { id: 'phoenix',   icon: '🔥', tier: 3 },
  { id: 'jackpot',   icon: '🎰', tier: 3 },
  { id: 'unicorn',   icon: '🦄', tier: 3 },
  // ── Tier 4 (1500): Legendär — mehrphasige Groß-Spektakel ────────────────────
  { id: 'meteor',    icon: '☄️', tier: 4 },
  { id: 'gewitter',  icon: '⛈️', tier: 4 },
  { id: 'portal',    icon: '🌀', tier: 4 },
  { id: 'feuertornado', icon: '🌪️', tier: 4 },
  { id: 'synthgrid', icon: '🌇', tier: 4 },
];

export function effectById(id) { return WIN_EFFECTS.find((e) => e.id === id) || null; }
export function effectPrice(id) { const e = effectById(id); return e ? TIER_PRICES[e.tier] : 0; }

// Inventar-Schlüssel: bewusst mit Präfix, damit Sieganimationen im geteilten
// Inventar-Knoten (/users/{uid}/inventory) nicht mit anderen Item-Arten
// (dynamicColor, founder, …) kollidieren.
export function winEffectInvKey(id) { return 'winfx_' + id; }

// Besitz: Confetti gehört immer allen; alles andere braucht den Inventar-Eintrag.
export function ownsEffect(inventory, id) {
  if (id === CONFETTI_ID) return true;
  return !!(inventory && inventory[winEffectInvKey(id)]);
}

// Aktive Animation auflösen: gewählte Einstellung nur verwenden, wenn sie (noch)
// im Besitz und bekannt ist — sonst Fallback auf Confetti (z.B. nach Admin-Entzug
// oder auf einem Gerät, auf dem der Kauf noch nicht gesynct ist).
export function resolveActiveEffect(settingId, inventory) {
  if (settingId && effectById(settingId) && ownsEffect(inventory, settingId)) return settingId;
  return CONFETTI_ID;
}
