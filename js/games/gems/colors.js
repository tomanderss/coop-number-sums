// games/gems/colors.js — Käfigfarben von „Gem Hunt" (rein, unit-getestet).
//
// Kuratierte Palette (Nutzerwunsch „unstimmig, matschig"): elf klar getrennte
// Töne mit abgestimmter Helligkeit — kein Oliv/Braun, wie es die frühere
// gleichmäßige Verteilung über den Farbkreis bei Gelb/Rot ergab. Vergeben wird
// per Färbung der Nachbarschaft: zwei angrenzende Käfige bekommen nie denselben
// Ton, und möglichst Töne, die weit auseinanderliegen.

export const GEM_PALETTE = [
  { h: 262, s: 76, l: 67 },   // Violett
  { h: 206, s: 82, l: 60 },   // Himmel
  { h: 44, s: 90, l: 60 },    // Bernstein
  { h: 140, s: 52, l: 50 },   // Grün
  { h: 336, s: 74, l: 64 },   // Rosa
  { h: 186, s: 66, l: 47 },   // Petrol
  { h: 12, s: 80, l: 62 },    // Koralle
  { h: 88, s: 56, l: 55 },    // Limette
  { h: 300, s: 52, l: 60 },   // Magenta
  { h: 162, s: 58, l: 52 },   // Mint
  { h: 28, s: 86, l: 58 },    // Orange
]
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/** Paletten-Index je Käfig (rein): Nachbarn nie gleich, Töne möglichst weit auseinander. */
export function regionColors(p) {
  const n = p.rows, reg = p.regions, K = n;
  const adj = Array.from({ length: K }, () => new Set());
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    if (c < n - 1 && reg[i + 1] !== reg[i]) { adj[reg[i]].add(reg[i + 1]); adj[reg[i + 1]].add(reg[i]); }
    if (r < n - 1 && reg[i + n] !== reg[i]) { adj[reg[i]].add(reg[i + n]); adj[reg[i + n]].add(reg[i]); }
  }
  // Käfige mit den meisten Nachbarn zuerst (deterministisch).
  const order = [...Array(K).keys()].sort((a, b) => adj[b].size - adj[a].size || a - b);
  const col = new Array(K).fill(-1), used = new Set();
  for (const k of order) {
    let best = -1, bestScore = -Infinity;
    for (let ci = 0; ci < GEM_PALETTE.length; ci++) {
      if ([...adj[k]].some((m) => col[m] === ci)) continue;
      // Möglichst noch unbenutzt, und weit weg vom Ton der Nachbarn.
      const near = Math.min(360, ...[...adj[k]].filter((m) => col[m] >= 0).map((m) => hueDist(GEM_PALETTE[ci].h, GEM_PALETTE[col[m]].h)));
      const score = (used.has(ci) ? 0 : 1000) + near;
      if (score > bestScore) { bestScore = score; best = ci; }
    }
    col[k] = best < 0 ? k % GEM_PALETTE.length : best;
    used.add(col[k]);
  }
  return col;
}
