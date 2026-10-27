// games/numbersums/snapshot.js — was die SCHALE über einen gespeicherten
// Spielstand dieses Spiels wissen muss, ohne das Spiel selbst zu laden:
// ist er schon gelöst, wie weit ist er, und muss er nach dem Laden geheilt
// werden. Bewusst leicht (keine Imports) — storage.js braucht es und darf
// weder Solver noch Generator mitladen. Bis zur Spiel-Trennung standen die
// beiden Funktionen direkt in storage.js.

// Ein Stand, dessen Brett bereits VOLLSTÄNDIG korrekt markiert ist, ist faktisch
// abgeschlossen und darf nicht als „Fortsetzen" wiederauftauchen (s. storage.js).
export function snapshotSolved(g) {
  const p = g && g.puzzle;
  if (!p || !Array.isArray(p.solution) || !Array.isArray(g.marks)) return false;
  for (let r = 0; r < p.rows; r++) {
    const sol = p.solution[r], m = g.marks[r];
    if (!sol || !m) return false;
    for (let c = 0; c < p.cols; c++) {
      if (m[c] !== (sol[c] ? 'kept' : 'removed')) return false;
    }
  }
  return true;
}

// Fortschritt in Prozent — korrekt gesetzte Zellen / Gesamtzellen. Dieselbe
// Formel wie progressPct() im Modell, damit Liste und laufendes Spiel dieselbe
// Zahl zeigen (model.test.js prüft beide gegeneinander).
export function snapshotProgress(g) {
  const p = g && g.puzzle;
  if (!p || !Array.isArray(p.solution) || !Array.isArray(g.marks)) return 0;
  const total = (Number(p.rows) || 0) * (Number(p.cols) || 0);
  if (!total) return 0;
  let ok = 0;
  for (let r = 0; r < p.rows; r++) {
    const sol = p.solution[r], m = g.marks[r];
    if (!sol || !m) continue;
    for (let c = 0; c < p.cols; c++) {
      if (m[c] && m[c] !== 'none' && m[c] === (sol[c] ? 'kept' : 'removed')) ok++;
    }
  }
  return Math.round((ok / total) * 100);
}

// Das Rätsel dieses Spiels übersteht die RTDB unbeschadet (keine null-Zellen
// im Rätsel selbst; das löchrige markedBy heilt loadPuzzleIntoState).
export function healSnapshot(g) { return g; }
