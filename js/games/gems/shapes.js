// games/gems/shapes.js — die Käfige von „Gem Hunt" als FORMEN (rein, unit-getestet).
//
// Gemeldet: „die Ecken sind abgerundet, aber teilweise ragen Ecken raus — die
// Käfige wirken nicht stimmig". Die frühere Lösung rundete nur die Außenecken
// einzelner Zellen; an INNENecken (wo ein Käfig um die Ecke geht) ragte die
// eckige Zellkante in die Fuge. Jetzt wird jeder Käfig als EIN Umriss gezeichnet:
//   1. Grenzkanten sammeln (Käfig liegt in Laufrichtung rechts; y zeigt nach unten)
//      und zu geschlossenen Schleifen verketten — an Berührpunkten über Eck
//      biegt die Schleife nach rechts ab, so bleiben diagonale Kontakte getrennt;
//      Löcher (ein Käfig umschließt einen anderen) werden eigene Schleifen.
//   2. Jede Ecke um die halbe Fuge `gi` nach innen versetzen.
//   3. Außenecken mit Radius `R`, Innenecken mit `rc` ausrunden.
// Koordinaten in Zelleinheiten (Brett = n × n).

const DIRS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };

/** Grenzkanten eines Käfigs: [{ a:[x,y], b:[x,y], d:'E'|'S'|'W'|'N' }] */
function boundaryEdges(p, k) {
  const n = p.rows, reg = p.regions, out = [];
  for (let i = 0; i < n * n; i++) {
    if (reg[i] !== k) continue;
    const r = Math.floor(i / n), c = i % n;
    if (r === 0 || reg[i - n] !== k) out.push({ a: [c, r], b: [c + 1, r], d: 'E' });
    if (c === n - 1 || reg[i + 1] !== k) out.push({ a: [c + 1, r], b: [c + 1, r + 1], d: 'S' });
    if (r === n - 1 || reg[i + n] !== k) out.push({ a: [c + 1, r + 1], b: [c, r + 1], d: 'W' });
    if (c === 0 || reg[i - 1] !== k) out.push({ a: [c, r + 1], b: [c, r], d: 'N' });
  }
  return out;
}
const key = (pt) => pt[0] + ',' + pt[1];
// Rechts-, gerade-, links-Abbiegen relativ zur Richtung d (y nach unten).
const RIGHT = { E: 'S', S: 'W', W: 'N', N: 'E' };
const LEFT = { E: 'N', N: 'W', W: 'S', S: 'E' };

/** Schleifen als Eckpunkt-Listen [{ x, y, din, dout }] (kollineare Kanten zusammengefasst). */
export function regionLoops(p, k) {
  const edges = boundaryEdges(p, k);
  const from = new Map();
  for (const e of edges) { const s = key(e.a); if (!from.has(s)) from.set(s, []); from.get(s).push(e); }
  const used = new Set(), loops = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const chain = [];
    let e = start;
    while (e && !used.has(e)) {
      used.add(e); chain.push(e);
      const cand = (from.get(key(e.b)) || []).filter((x) => !used.has(x) || x === start);
      // Bevorzugt nach rechts, dann geradeaus, dann links.
      e = cand.find((x) => x.d === RIGHT[e.d]) || cand.find((x) => x.d === e.d) || cand.find((x) => x.d === LEFT[e.d]) || null;
      if (e === start) break;
    }
    // Ecken (Richtungswechsel) herausziehen.
    const pts = [];
    for (let j = 0; j < chain.length; j++) {
      const prev = chain[(j - 1 + chain.length) % chain.length], cur = chain[j];
      if (prev.d !== cur.d) pts.push({ x: cur.a[0], y: cur.a[1], din: prev.d, dout: cur.d });
    }
    if (pts.length >= 4) loops.push(pts);
  }
  return loops;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
/** SVG-Pfad eines Käfigs (alle Schleifen; mit fill-rule evenodd zeichnen). */
export function regionPath(p, k, { gi = 0.035, R = 0.2, rc = 0.12 } = {}) {
  let d = '';
  for (const loop of regionLoops(p, k)) {
    const V = loop.map((v) => {
      const [ix, iy] = DIRS[v.din], [ox, oy] = DIRS[v.dout];
      // Rechte Normale (zeigt in den Käfig): (dx,dy) → (−dy, dx).
      const x = v.x + gi * (-iy + -oy), y = v.y + gi * (ix + ox);
      const convex = ix * oy - iy * ox > 0;   // Rechtskurve = Außenecke
      return { x, y, ix, iy, ox, oy, convex, rad: convex ? R : rc };
    });
    const pin = (v) => [r3(v.x - v.ix * v.rad), r3(v.y - v.iy * v.rad)];
    const pout = (v) => [r3(v.x + v.ox * v.rad), r3(v.y + v.oy * v.rad)];
    const s = pout(V[0]);
    d += `M${s[0]} ${s[1]}`;
    for (let j = 1; j <= V.length; j++) {
      const v = V[j % V.length], a = pin(v), b = pout(v);
      d += `L${a[0]} ${a[1]}A${v.rad} ${v.rad} 0 0 ${v.convex ? 1 : 0} ${b[0]} ${b[1]}`;
    }
    d += 'Z';
  }
  return d;
}

/** Feines Raster: die Kanten zwischen zwei Zellen DESSELBEN Käfigs (ein Pfad). */
export function interiorGrid(p) {
  const n = p.rows, reg = p.regions;
  let d = '';
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    if (c < n - 1 && reg[i + 1] === reg[i]) d += `M${c + 1} ${r}V${r + 1}`;
    if (r < n - 1 && reg[i + n] === reg[i]) d += `M${c} ${r + 1}H${c + 1}`;
  }
  return d;
}
