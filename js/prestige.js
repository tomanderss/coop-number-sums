// prestige.js — Prestige-/Verdienst-System für Profil-Abzeichen.
//
// Abzeichen werden NICHT gekauft, sondern verdient. Jedes der 12 Symbole ist
// eine Prestige-KATEGORIE, die an eine echte Statistik gekoppelt ist. Jede
// Kategorie gibt es in ALLEN vier Stufen (1 Bronze → 4 Legendär), die an
// Schwellen freigeschaltet werden. Man rüstet eine freigeschaltete
// (Symbol + Stufe) als Profil-Abzeichen aus, um sein Prestige zu zeigen.
//
// Reine Logik (kein DOM, kein Zufall) → voll unit-testbar. Die Medaillen-Optik
// kommt aus badgeart.js (badgeMedalMarkup(sym, {tier})).

// Reihenfolge = Anzeige-Reihenfolge im Prestige-Screen.
// metric(ctx) liefert den aktuellen Zahlenwert der Kategorie aus dem Kontext
// { stats, streak, race, difficulties }. thresholds = [t1,t2,t3,t4] (aufsteigend);
// erreichte Stufe = Anzahl unterschrittener/erreichter Schwellen.
export const PRESTIGE = [
  { sym: 'trophae', key: 'soloMaster',  thresholds: [10, 50, 150, 500],
    metric: c => c.stats.won || 0 },
  { sym: 'rakete',  key: 'teamSpirit',  thresholds: [5, 20, 60, 150],
    metric: c => c.stats.coopWon || 0 },
  { sym: 'stern',   key: 'duelist',     thresholds: [5, 15, 40, 100],
    metric: c => c.race?.['1v1']?.racesWon || 0 },
  { sym: 'blitz',   key: 'teamDuel',    thresholds: [5, 15, 40, 100],
    metric: c => c.race?.['2v2']?.racesWon || 0 },
  { sym: 'flamme',  key: 'streak',      thresholds: [3, 7, 14, 30],
    metric: c => c.streak?.bestStreak || 0 },
  { sym: 'drache',  key: 'flawless',    thresholds: [5, 25, 75, 200],
    metric: c => (c.stats.perfectWins || 0) + (c.stats.coopPerfectWins || 0) },
  { sym: 'einhorn', key: 'perfectTeam', thresholds: [3, 10, 30, 80],
    metric: c => c.stats.coopPerfectWins || 0 },
  { sym: 'gehirn',  key: 'thinker',     thresholds: [25, 100, 300, 1000],
    metric: c => (c.stats.won || 0) + (c.stats.coopWon || 0) },
  { sym: 'klee',    key: 'endurance',   thresholds: [25, 100, 300, 1000],
    metric: c => (c.stats.played || 0) + (c.stats.coopPlayed || 0) },
  { sym: 'diamant', key: 'recordHunter', thresholds: [2, 4, 6, 9],
    metric: c => countBestTimes(c) },
  { sym: 'krone',   key: 'topClass',    thresholds: [3, 10, 30, 100],
    metric: c => topDifficultyWins(c) },
  { sym: 'alien',   key: 'explorer',    thresholds: [3, 5, 7, 9],
    metric: c => distinctDifficultiesWon(c) },
];

const BY_SYM = Object.fromEntries(PRESTIGE.map(p => [p.sym, p]));
export function prestigeBySym(sym) { return BY_SYM[sym] || null; }
export function isPrestigeSym(sym) { return !!BY_SYM[sym]; }

// Anzahl Schwierigkeiten mit einer persönlichen Bestzeit (Solo ODER Coop).
function countBestTimes(c) {
  const bd = c.stats?.byDifficulty || {};
  let n = 0;
  for (const id in bd) { const d = bd[id]; if ((d.bestTimeMs != null) || (d.coopBestTimeMs != null)) n++; }
  return n;
}
// Anzahl unterschiedlicher Schwierigkeiten mit mindestens einem Sieg.
function distinctDifficultiesWon(c) {
  const bd = c.stats?.byDifficulty || {};
  let n = 0;
  for (const id in bd) { const d = bd[id]; if ((d.won || 0) + (d.coopWon || 0) > 0) n++; }
  return n;
}
// Siege auf der HÖCHSTEN Schwierigkeit (letzte in der Reihenfolge difficulties[]).
function topDifficultyWins(c) {
  const order = c.difficulties || [];
  const bd = c.stats?.byDifficulty || {};
  const topId = order.length ? order[order.length - 1] : null;
  if (!topId) return 0;
  const d = bd[topId] || {};
  return (d.won || 0) + (d.coopWon || 0);
}

// Erreichte Stufe einer Kategorie (0 = noch nichts, 1..4). thresholds aufsteigend.
export function tierForValue(value, thresholds) {
  let t = 0;
  for (let i = 0; i < thresholds.length; i++) if (value >= thresholds[i]) t = i + 1;
  return t;
}

// Fortschritt einer Kategorie: aktuelle Stufe, Wert, nächste Schwelle (oder null,
// wenn schon Legendär), sowie ein 0..1-Fortschritt auf die nächste Stufe.
// frac = Wert RELATIV ZUR NÄCHSTEN SCHWELLE (value/next, ab 0 gemessen) — so
// deckt sich der Balken mit der Anzeige „{value}" und „Noch {next−value} bis …".
// Die frühere Segment-Rechnung (von voriger zu nächster Schwelle) zeigte z.B.
// bei 8/9 nur 50% (Segment 7→9) und wirkte damit widersinnig.
export function categoryProgress(cat, ctx) {
  const value = cat.metric(ctx) || 0;
  const tier = tierForValue(value, cat.thresholds);
  const next = tier < 4 ? cat.thresholds[tier] : null;
  const frac = next == null ? 1 : Math.max(0, Math.min(1, value / next));
  return { sym: cat.sym, key: cat.key, value, tier, next, thresholds: cat.thresholds, frac };
}

// Fortschritt ALLER Kategorien (für den Prestige-Screen).
export function allPrestige(ctx) { return PRESTIGE.map(cat => categoryProgress(cat, ctx)); }

// ── Aufstiegs-Feier: alle aktuell freigeschalteten (Symbol, Stufe) als Codes ──
// (jede Kategorie schaltet Stufen 1..tier frei). Grundlage für die einmalige
// Feier eines NEU erreichten Rangs. Rein & unit-getestet.
export function unlockedTierCodes(ctx) {
  const out = [];
  for (const p of allPrestige(ctx)) for (let t = 1; t <= p.tier; t++) out.push(encodeBadge(p.sym, t));
  return out;
}
// Welche freigeschalteten Stufen sind noch NICHT gefeiert worden?
// celebrated = Array/Set bereits gefeierter Codes. Rückgabe: [{sym,tier,code,key}].
export function newlyUnlockedTiers(ctx, celebrated) {
  const set = celebrated instanceof Set ? celebrated : new Set(celebrated || []);
  const res = [];
  for (const p of allPrestige(ctx)) {
    for (let t = 1; t <= p.tier; t++) {
      const code = encodeBadge(p.sym, t);
      if (!set.has(code)) res.push({ sym: p.sym, tier: t, code, key: p.key });
    }
  }
  return res;
}
// Aus mehreren neuen Aufstiegen den „Aufmacher" wählen: höchste Stufe zuerst,
// bei Gleichstand die frühere Kategorie in der PRESTIGE-Reihenfolge (stabil).
export function headlineUnlock(list) {
  if (!list || !list.length) return null;
  const order = PRESTIGE.map(p => p.sym);
  return [...list].sort((a, b) => (b.tier - a.tier) || (order.indexOf(a.sym) - order.indexOf(b.sym)))[0];
}

// Ist (Symbol, Stufe) freigeschaltet? (Stufe ≤ erreichte Stufe der Kategorie.)
export function isUnlocked(sym, tier, ctx) {
  const cat = BY_SYM[sym];
  if (!cat || tier < 1 || tier > 4) return false;
  return tierForValue(cat.metric(ctx) || 0, cat.thresholds) >= tier;
}

// ── Master-Badge „Großmeister" ────────────────────────────────────────────────
// Das Krönungs-Abzeichen: freigeschaltet, wenn ALLE Kategorien Stufe 4 (Legendär)
// erreicht haben — „das Spiel durchgespielt". Eigene ID (kein sym-tier-Format),
// eigene Medaille (badgeart.js masterMedalMarkup).
export const MASTER_BADGE = 'grossmeister';
export function isMasterBadge(id) { return id === MASTER_BADGE; }
// { maxed, total, unlocked } — wie viele Kategorien schon auf Stufe 4 sind.
export function masterProgress(ctx) {
  const all = allPrestige(ctx);
  const maxed = all.reduce((n, p) => n + (p.tier >= 4 ? 1 : 0), 0);
  return { maxed, total: all.length, unlocked: all.length > 0 && maxed >= all.length };
}
export function hasMasterBadge(ctx) { return masterProgress(ctx).unlocked; }

// ── Kodierung des ausgerüsteten Abzeichens: "sym-tier" (z.B. "drache-3") ──────
// Rückwärtskompatibel: eine nackte Symbol-ID (alt, aus dem Shop) wird als Stufe
// aus dem alten Katalog interpretiert bzw. auf Stufe 1 abgebildet.
export function encodeBadge(sym, tier) { return sym && tier ? `${sym}-${tier}` : ''; }
export function decodeBadge(id) {
  if (!id || typeof id !== 'string') return null;
  const m = id.match(/^([a-z]+)-([1-4])$/);
  if (m && BY_SYM[m[1]]) return { sym: m[1], tier: +m[2] };
  if (BY_SYM[id]) return { sym: id, tier: 1 }; // Alt-Format (nur Symbol)
  return null;
}
