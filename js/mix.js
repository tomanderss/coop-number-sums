// mix.js — der Zufallsmodus „Mix" über ALLE Spiele (reine Logik, unit-getestet).
//
// Ein Mix-Lauf ist ein Endlos-Lauf, bei dem JEDES Level ein zufälliges Spiel in
// einer zufälligen Schwierigkeit ist. Welche Spiele und Stufen dabei sein dürfen,
// legt der „Pool" fest. Er speichert bewusst nur, was AUSGESCHLOSSEN ist — so ist
// jedes neu hinzukommende Spiel und jede neue Stufe automatisch dabei
// (Nutzerwunsch), ohne dass irgendwo eine Liste nachgepflegt werden muss.
//
// Pool:     { off: { [gameId]: true | [diffId, …] } }
//           true = ganzes Spiel aus, Array = diese Stufen aus. {} = alles an.
// Katalog:  [{ id, diffs: [diffId, …] }] — aus den Spiel-Beschreibungen.

export const MIX_ID = 'mix';

/** Den Katalog aus den Spiel-Beschreibungen (games/index.js GAMES) bauen. */
export function mixCatalog(games) {
  return (games || [])
    .map((g) => ({ id: g.id, diffs: (g.DIFFICULTIES || []).map((d) => d.id) }))
    .filter((g) => g.diffs.length);
}

/** Pool säubern: unbekannte Spiele/Stufen fallen raus, leere Ausschlüsse ebenso. */
export function normalizeMixPool(pool, catalog) {
  const off = {};
  const src = (pool && typeof pool === 'object' && pool.off && typeof pool.off === 'object') ? pool.off : {};
  for (const g of catalog || []) {
    const v = src[g.id];
    if (v === true) { off[g.id] = true; continue; }
    if (!Array.isArray(v)) continue;
    const ds = g.diffs.filter((d) => v.includes(d));
    if (ds.length === g.diffs.length) off[g.id] = true;
    else if (ds.length) off[g.id] = ds;
  }
  return { off };
}

/** Ist dieses Spiel (irgendeine Stufe) im Pool? */
export function mixGameOn(pool, gameId, catalog) {
  const g = (catalog || []).find((x) => x.id === gameId);
  if (!g) return false;
  return mixDiffsOn(pool, gameId, catalog).length > 0;
}
/** Die eingeschalteten Stufen eines Spiels (in Leiter-Reihenfolge). */
export function mixDiffsOn(pool, gameId, catalog) {
  const g = (catalog || []).find((x) => x.id === gameId);
  if (!g) return [];
  const v = pool && pool.off ? pool.off[gameId] : null;
  if (v === true) return [];
  return Array.isArray(v) ? g.diffs.filter((d) => !v.includes(d)) : g.diffs.slice();
}
export function mixDiffOn(pool, gameId, diffId, catalog) {
  return mixDiffsOn(pool, gameId, catalog).includes(diffId);
}

/** Alle erlaubten Kombinationen { game, diff }. */
export function mixCombos(pool, catalog) {
  const out = [];
  for (const g of catalog || []) for (const d of mixDiffsOn(pool, g.id, catalog)) out.push({ game: g.id, diff: d });
  return out;
}
/** Wie viele Spiele / Kombinationen sind an? */
export function mixSummary(pool, catalog) {
  const games = (catalog || []).filter((g) => mixDiffsOn(pool, g.id, catalog).length).length;
  return { games, combos: mixCombos(pool, catalog).length, totalGames: (catalog || []).length };
}

/** Ein ganzes Spiel an/aus. Ein Spiel, das AUS war, kommt mit ALLEN Stufen zurück. */
export function toggleMixGame(pool, gameId, catalog) {
  const p = normalizeMixPool(pool, catalog);
  const off = { ...p.off };
  if (mixDiffsOn(p, gameId, catalog).length) off[gameId] = true;
  else delete off[gameId];
  return normalizeMixPool({ off }, catalog);
}
/** Eine Stufe eines Spiels an/aus. */
export function toggleMixDiff(pool, gameId, diffId, catalog) {
  const p = normalizeMixPool(pool, catalog);
  const g = (catalog || []).find((x) => x.id === gameId);
  if (!g || !g.diffs.includes(diffId)) return p;
  const offNow = g.diffs.filter((d) => !mixDiffOn(p, gameId, d, catalog));
  const next = offNow.includes(diffId) ? offNow.filter((d) => d !== diffId) : offNow.concat([diffId]);
  const off = { ...p.off };
  if (next.length) off[gameId] = next; else delete off[gameId];
  return normalizeMixPool({ off }, catalog);
}

/**
 * Schnellwahl über ALLE Spiele: welche Stufen der Leiter an sind. `ladder` =
 * die gemeinsame Leiter (Stufen-IDs in Reihenfolge). Spiele, die ganz aus waren,
 * bleiben aus — die Schnellwahl betrifft die Schwierigkeit, nicht die Spielwahl.
 */
export const MIX_PRESETS = {
  all: () => true,
  easy: (i, n) => i < Math.ceil(n / 3),
  mid: (i, n) => i >= Math.floor(n / 3) && i < Math.ceil((2 * n) / 3),
  hard: (i, n) => i >= Math.floor((2 * n) / 3),
};
export function applyMixPreset(pool, preset, ladder, catalog) {
  const fn = MIX_PRESETS[preset];
  if (!fn) return normalizeMixPool(pool, catalog);
  const p = normalizeMixPool(pool, catalog);
  const n = (ladder || []).length;
  const keep = new Set((ladder || []).filter((_, i) => fn(i, n)));
  const off = {};
  for (const g of catalog || []) {
    if (p.off[g.id] === true) { off[g.id] = true; continue; }
    const out = g.diffs.filter((d) => !keep.has(d));
    if (out.length) off[g.id] = out;
  }
  return normalizeMixPool({ off }, catalog);
}
/** Welche Schnellwahl beschreibt den Pool gerade genau? (für die Markierung) */
export function activeMixPreset(pool, ladder, catalog) {
  const p = normalizeMixPool(pool, catalog);
  for (const k of Object.keys(MIX_PRESETS)) {
    const q = applyMixPreset(p, k, ladder, catalog);
    if (JSON.stringify(q) === JSON.stringify(p)) return k;
  }
  return null;
}

/**
 * Das nächste Level ziehen: erst ein SPIEL (gleich wahrscheinlich je Spiel, nicht
 * je Kombination — sonst würde ein Spiel mit mehr Stufen öfter kommen), dabei
 * nicht zweimal hintereinander dasselbe, solange es Alternativen gibt; dann eine
 * Stufe dieses Spiels. `rand` = () => [0,1). Liefert null bei leerem Pool.
 */
export function pickMixLevel(pool, catalog, prevGame = null, rand = Math.random) {
  const games = (catalog || []).filter((g) => mixDiffsOn(pool, g.id, catalog).length);
  if (!games.length) return null;
  const choices = games.length > 1 ? games.filter((g) => g.id !== prevGame) : games;
  const g = choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
  const ds = mixDiffsOn(pool, g.id, catalog);
  const diff = ds[Math.min(ds.length - 1, Math.floor(rand() * ds.length))];
  return { game: g.id, diff };
}

/**
 * Die Walze der Ziehungs-Animation: eine Folge von Spiel-IDs, die mit dem
 * gezogenen Spiel endet. Nachbarn sind nie gleich (sonst „stockt" die Walze).
 */
export function mixReel(gameIds, target, length = 14, rand = Math.random) {
  const ids = (gameIds || []).length ? gameIds : [target];
  const out = [];
  for (let i = 0; i < length - 1; i++) {
    let id = ids[Math.floor(rand() * ids.length)];
    if (ids.length > 1) { let guard = 0; while ((id === out[i - 1] || (i === length - 2 && id === target)) && guard++ < 10) id = ids[Math.floor(rand() * ids.length)]; }
    out.push(id);
  }
  out.push(target);
  return out;
}

/** Mix-Bestwerte zweier Seiten zusammenführen (Maximum je Zähler). */
export function mergeMixStats(a, b) {
  const x = a || {}, y = b || {};
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  const out = {};
  for (const k of keys) {
    const u = Number(x[k]) || 0, v = Number(y[k]) || 0;
    out[k] = Math.max(u, v);
  }
  return out;
}
