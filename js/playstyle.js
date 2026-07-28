// playstyle.js — Aus echten Partien den SPIELSTIL des Spielers ableiten (reine
// Logik, unit-getestet). Grundlage für den auf den Spieler kalibrierten
// KI-Duellgegner (js/duelbot.js).
//
// ── Arbeitsteilung mit duelbot.js ────────────────────────────────────────────
// Die ZEIT des Bots kommt bereits ohne dieses Modul aus: `avgTimesByDifficulty`
// (storage.js) liefert die Durchschnittszeit je Schwierigkeit aus `sumTimeMs/won`,
// und `createBot({targetMs})` kalibriert sich darauf. Was hier entsteht, ist das
// VERHALTEN: Wie verteilt der Spieler seine Zeit zwischen leichten und schweren
// Deduktionen? Wie schnell trägt er eine erkannte Kette ein? Wie oft verklickt er
// sich? Genau das macht den Unterschied zwischen „braucht so lange wie ich" und
// „spielt wie ich".
//
// ── Aufzeichnung (billig!) ──────────────────────────────────────────────────
// Während des Spiels wird NUR `{r, c, want, t}` je Zug in ein Array im Speicher
// geschoben (app.js, in setMark). Keine Analyse, kein localStorage im Tap-Pfad —
// die Board-Render-/Performance-Regeln in CLAUDE.md verbieten schwere Arbeit dort.
// Die Auswertung läuft EINMAL am Spielende (in der afterPaint-Buchhaltung von
// win()/lose()) über `analyzeGame()`.

import { candidateBuckets, createBot, TIER } from './duelbot.js';

const nz = (v) => Number(v) || 0;

// Median statt Mittelwert: eine einzelne Partie, in der jemand das Handy weglegt,
// darf den Klon nicht verzerren.
export function median(xs) {
  const a = (xs || []).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

// Ab wann gilt ein Klon als kalibriert? Weniger Partien ergeben zu verrauschte
// Mediane; mehr zu verlangen würde den Klon unnötig lange sperren.
export const MIN_GAMES = 8;
// Ein Zug-Abstand unter dieser Schwelle zählt als „Teil derselben erkannten
// Kette" (Burst) statt als neue Denkzeit — dieselbe Trennung, die duelbot.js
// zwischen `burstMs` und `think[tier]` macht.
export const BURST_MAX_MS = 900;
// Alles darüber ist keine Deduktionszeit mehr, sondern eine Unterbrechung
// (Telefon weg, Gespräch). Fließt als „Hänger" ein, nicht in die Denkzeiten.
export const STALL_MIN_MS = 25000;

// Wertet EINE gespielte Partie aus. `moves` = [{r, c, want, t}] in Spielreihenfolge
// (t = ms seit Spielstart). Liefert eine kompakte Stichprobe — bewusst nur
// Aggregate, keine Brettinhalte und keine Zugfolge (klein genug für den Sync).
// Gibt null zurück, wenn zu wenig verwertbar ist.
export function analyzeGame({ puzzle, moves, mistakes = 0, totalMs = 0, difficulty } = {}) {
  if (!puzzle || !Array.isArray(moves) || moves.length < 8) return null;

  // Den Brettzustand Zug für Zug nachstellen und jeden Zug danach einordnen,
  // WELCHE Deduktion ihn zu diesem Zeitpunkt erzwungen hätte. Dafür wird derselbe
  // Kandidaten-Enumerator benutzt wie beim Bot — was der Bot als „Tier 1" ansieht,
  // gilt hier also identisch.
  const bot = createBot({ puzzle, seed: 1 });
  const tierOf = new Map();   // ci -> Tier zum Zeitpunkt des Zuges
  for (const m of moves) {
    const ci = m.r * puzzle.cols + m.c;
    let tier = TIER.HARD;
    for (const b of candidateBuckets(bot)) {
      if (b.moves.some((x) => x.ci === ci)) { tier = b.tier; break; }
    }
    tierOf.set(ci, tier);
    // Zug im Modell nachziehen (nur gültige, eigene Züge kommen hier an).
    if (bot.mark[ci] === 0) {
      bot.mark[ci] = m.want === 'kept' ? 1 : 2;
      bot.decided++;
    }
  }

  // Zeitabstände klassifizieren.
  const think = { t1: [], t2: [], hard: [] };
  const bursts = [];
  let stalls = 0;
  for (let i = 1; i < moves.length; i++) {
    const dt = nz(moves[i].t) - nz(moves[i - 1].t);
    if (dt <= 0) continue;
    if (dt <= BURST_MAX_MS) { bursts.push(dt); continue; }
    if (dt >= STALL_MIN_MS) { stalls++; continue; }
    const ci = moves[i].r * puzzle.cols + moves[i].c;
    const tier = tierOf.get(ci) || TIER.HARD;
    (think[tier] || think.hard).push(dt);
  }

  const thinkCount = think.t1.length + think.t2.length + think.hard.length;
  if (thinkCount < 4) return null;   // zu wenig Substanz für eine Stichprobe

  return {
    ts: Date.now(),
    difficulty: difficulty || puzzle.difficulty || '',
    cells: puzzle.rows * puzzle.cols,
    totalMs: nz(totalMs),
    mistakes: nz(mistakes),
    think: { t1: median(think.t1), t2: median(think.t2), hard: median(think.hard) },
    burstMs: median(bursts),
    stalls,
    thinkCount,
  };
}

// Führt mehrere Stichproben zu EINEM Bot-Profil zusammen. Liefert
// `{ profile, games, ready }` — `ready:false` heißt „lernt noch" (die UI zeigt
// dann den Fortschritt, s. Plan Stufe 4 für Freunde-Klone).
//
// Wichtig: Die absoluten Zeiten spielen hier KEINE Rolle mehr — `createBot`
// skaliert das Profil ohnehin auf die Zielzeit. Entscheidend sind die
// VERHÄLTNISSE (wie viel länger dauert eine Teilsummen-Deduktion als eine
// direkte?) und das Fehler-/Burst-Verhalten. Genau die machen den Spielstil aus.
export function buildProfile(samples) {
  const list = (samples || []).filter((s) => s && nz(s.thinkCount) >= 4);
  const games = list.length;
  if (!games) return { profile: null, games: 0, ready: false };

  const pick = (f) => median(list.map(f).filter((v) => v > 0));
  const t1 = pick((s) => nz(s.think && s.think.t1));
  const t2 = pick((s) => nz(s.think && s.think.t2));
  const hard = pick((s) => nz(s.think && s.think.hard));
  const burstMs = pick((s) => nz(s.burstMs));

  // Fehlt ein Deduktionstyp im Verlauf (kommt vor: manche Rätsel erzwingen keine
  // Teilsummen), aus dem nächstniedrigeren hochrechnen statt eine 0 zu erzeugen.
  const base = t1 || 2000;
  const profile = {
    think: {
      t1: base,
      t2: t2 || Math.round(base * 2.4),
      hard: hard || Math.round((t2 || base * 2.4) * 1.7),
    },
    burstMs: burstMs || Math.round(base * 0.17),
    // Fehler pro Partie: direkt der Median über die gespielten Partien.
    mistakesPerGame: median(list.map((s) => nz(s.mistakes))),
    // Hänger je Partie in eine Wahrscheinlichkeit je Denkzug umrechnen.
    stallRate: (() => {
      const perGame = list.map((s) => nz(s.stalls) / Math.max(1, nz(s.thinkCount)));
      return Math.min(0.3, median(perGame.map((v) => Math.round(v * 1000))) / 1000);
    })(),
  };
  return { profile, games, ready: games >= MIN_GAMES };
}
