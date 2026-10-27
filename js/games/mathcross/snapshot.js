// games/mathcross/snapshot.js — was die SCHALE über einen gespeicherten
// Spielstand dieses Spiels wissen muss (s. numbersums/snapshot.js). Stand in
// Coop Math Cross in storage.js. Leicht: model.js zieht nur equations.js nach.

import { normalizePuzzle } from './model.js';

// Ein Stand, in dem JEDES offene Feld seine Lösungszahl trägt, ist gelöst.
export function snapshotSolved(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.slots) || !Array.isArray(g.placed)) return false;
  let blanks = 0;
  for (let r = 0; r < (p.rows || 0); r++) {
    const row = p.slots[r], pl = g.placed[r];
    if (!row) return false;
    for (let c = 0; c < p.cols; c++) {
      const sl = row[c];
      if (!sl || sl.given) continue;
      blanks++;
      const v = pl && pl[c];
      if (v == null || v === '' || v !== sl.v) return false;
    }
  }
  return blanks > 0;
}

// Fortschritt in Prozent — BELEGTE offene Felder / alle offenen Felder (in
// Math Cross ist ein gelegter Stein Fortschritt, ob er stimmt, zeigt erst die
// fertige Rechnung).
export function snapshotProgress(g) {
  const p = g && g.puzzle && normalizePuzzle(g.puzzle);
  if (!p || !Array.isArray(p.slots) || !Array.isArray(g.placed)) return 0;
  let total = 0, filled = 0;
  for (let r = 0; r < (p.rows || 0); r++) {
    const row = p.slots[r], pl = g.placed[r];
    if (!row) continue;
    for (let c = 0; c < p.cols; c++) {
      const sl = row[c];
      if (!sl || sl.given) continue;
      total++;
      const v = pl && pl[c];
      if (v != null && v !== '') filled++;
    }
  }
  return total ? Math.round((filled / total) * 100) : 0;
}

// Ein aus der CLOUD stammender Stand hat ein löchriges Rätsel-Raster: die RTDB
// speichert keine null-Werte, `puzzle.slots` kommt als Objekt mit numerischen
// Schlüsseln zurück und eine komplett tote Zeile fehlt ganz. Jeder Lesepfad
// heilt ihn deshalb (rein, idempotent) — sonst warf buildDisplay() beim
// Fortsetzen eines auf einem anderen Gerät begonnenen Spiels.
export function healSnapshot(g) {
  if (!g || !g.puzzle) return g;
  const p = normalizePuzzle(g.puzzle);
  return p === g.puzzle ? g : { ...g, puzzle: p };
}
