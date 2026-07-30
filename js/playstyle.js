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

import { candidateBuckets, createBot, searchFactor, TIER, PRESET_PROFILES } from './duelbot.js';

const nz = (v) => Number(v) || 0;

// Median statt Mittelwert: eine einzelne Partie, in der jemand das Handy weglegt,
// darf den Klon nicht verzerren.
export function median(xs) {
  const a = (xs || []).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

// Dieselbe Mitte, aber OHNE Rundung. Pflicht für alles, was ein Anteil oder ein
// Faktor ist: `median` rundet auf ganze Millisekunden (dafür wurde es gebaut) und
// machte aus einem Käfig-Anteil von 0,2 glatt 0 und aus einer Lokalität von 0,83
// eine 1 — die Verhaltensmuster kamen dadurch messbar NICHT im Profil an.
export function medianF(xs) {
  const a = (xs || []).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
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
  const total = puzzle.rows * puzzle.cols;
  const searchMax = PRESET_PROFILES.medium.searchMax;
  const kindOfGroup = (id) => (bot.model.groups[id] || {}).kind || '';

  // Je Zug (Index im moves-Array, nicht je Zelle — eine Zelle kann mehrfach
  // vorkommen) festhalten, was die Brettlage in DIESEM Moment hergab.
  const info = [];
  for (const m of moves) {
    const ci = m.r * puzzle.cols + m.c;
    const buckets = candidateBuckets(bot);
    let tier = TIER.HARD, groupKind = '';
    for (const b of buckets) {
      if (b.moves.some((x) => x.ci === ci)) { tier = b.tier; groupKind = kindOfGroup(b.groupId); break; }
    }
    // Wie schwer war es in DIESEM Moment überhaupt, einen Ansatzpunkt zu finden?
    // Genau dieser Faktor steckt multiplikativ in der gemessenen Zugdauer und
    // wird unten herausgerechnet — sonst erscheinen leichte Deduktionen in einer
    // zähen Brettlage als „langsam" und die Tier-Verhältnisse verwaschen
    // (gemessen: t2/t1 kam als 1,38 statt 2,60 zurück).
    const covered = new Set();
    for (const b of buckets) for (const x of b.moves) covered.add(x.ci);
    const decidedBefore = bot.decided;
    info.push({
      ci, tier, groupKind,
      factor: searchFactor(buckets.length, covered.size, total - decidedBefore, total, searchMax),
      // Fortschritt VOR dem Zug — daraus wird die Spielphase.
      progress: total > 0 ? decidedBefore / total : 0,
      // Gruppen der Zelle: Grundlage fürs Lokalitäts-Maß (arbeitet der Spieler
      // in derselben Struktur weiter oder springt er über das Brett?).
      groups: bot.model.cells[ci] ? bot.model.cells[ci].groups : [],
    });
    // Ein FEHLGRIFF landet nie auf dem Brett (setMark bricht vorher ab) — er darf
    // den Nachbau also nicht verändern, sonst läuft die Rekonstruktion auseinander.
    if (!m.err && bot.mark[ci] === 0) {
      bot.mark[ci] = m.want === 'kept' ? 1 : 2;
      bot.decided++;
    }
  }

  // Phase aus dem Fortschritt: dieselbe Dreiteilung, die der Bot beim Tempo nutzt.
  const phaseOf = (progress) => (progress < 1 / 3 ? 'early' : progress < 2 / 3 ? 'mid' : 'late');

  // Zeitabstände klassifizieren. Gemessen werden NUR eigene, gültige Züge; fremde
  // (`other`) und Fehlgriffe (`err`) dienen der Rekonstruktion bzw. der
  // Fehleranalyse. Der Abstand zählt ab dem letzten Zug, den ich SELBST gesehen
  // habe — sonst zerschneidet ein Partnerzug meine Denkzeit in zwei Hälften.
  const think = { t1: [], t2: [], hard: [] };
  const bursts = [];
  const errPhase = { early: 0, mid: 0, late: 0 };
  const errTier = { t1: 0, t2: 0, hard: 0 };
  // Denkzüge mit ihrem Tier und ihrer Phase merken: das Phasen-Tempo lässt sich
  // erst NACH den Tier-Medianen sauber bestimmen (s. unten).
  const timed = [];
  let stalls = 0, ownMoves = 0, regionMoves = 0, kindKnown = 0, localHits = 0, localTotal = 0;
  let prevT = null, prevGroups = null;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i], d = info[i];
    if (m.other) continue;                       // Partnerzug: nur Brettzustand

    const dt = prevT == null ? 0 : nz(m.t) - prevT;
    prevT = nz(m.t);

    if (m.err) {
      // Ein Fehlgriff ist auch ein ZEITanker: die Zeit davor war echtes Überlegen
      // (das eben schiefging), die Erholpause danach darf aber nicht als Denkzeit
      // des NÄCHSTEN Zuges gelten. Deshalb prevT oben schon fortgeschrieben.
      errPhase[phaseOf(d.progress)]++;
      errTier[d.tier] = (errTier[d.tier] || 0) + 1;
      if (dt > BURST_MAX_MS && dt < STALL_MIN_MS) {
        timed.push({ ms: dt / (d.factor || 1), tier: d.tier, phase: phaseOf(d.progress) });
      }
      continue;
    }

    ownMoves++;
    if (d.groupKind) {
      kindKnown++;
      if (d.groupKind === 'region') regionMoves++;
    }
    if (prevGroups) {
      localTotal++;
      if (d.groups.some((g) => prevGroups.includes(g))) localHits++;
    }
    prevGroups = d.groups;

    if (dt <= 0) continue;
    if (dt <= BURST_MAX_MS) { bursts.push(dt); continue; }
    if (dt >= STALL_MIN_MS) { stalls++; continue; }
    // Suchaufwand der Brettlage herausrechnen → übrig bleibt die reine Denkzeit
    // für diesen Deduktionstyp.
    const pure = dt / (d.factor || 1);
    (think[d.tier] || think.hard).push(pure);
    timed.push({ ms: pure, tier: d.tier, phase: phaseOf(d.progress) });
  }

  const thinkCount = think.t1.length + think.t2.length + think.hard.length;
  if (thinkCount < 4) return null;   // zu wenig Substanz für eine Stichprobe

  // Phasen-Tempo als Verhältnis — und zwar relativ zur Denkzeit des JEWEILIGEN
  // Deduktionstyps, nicht zum Gesamt-Median. Sonst misst „Phase" bloß mit, welche
  // Tiers in dieser Phase häufig sind (die Mitte ist teilsummenlastig), und der
  // Tier-Unterschied würde doppelt gezählt — derselbe Fehler wie beim Suchaufwand,
  // gemessen kam die Eröffnung dadurch als 1,86 statt ~1 zurück.
  const tierRef = {
    t1: median(think.t1) || 0,
    t2: median(think.t2) || 0,
    hard: median(think.hard) || 0,
  };
  const rel = { early: [], mid: [], late: [] };
  for (const x of timed) {
    const ref = tierRef[x.tier];
    if (ref > 0) rel[x.phase].push(x.ms / ref);
  }
  const ratio = (xs) => (xs.length >= 2 ? Math.round(medianF(xs) * 100) / 100 : 0);

  return {
    ts: Date.now(),
    difficulty: difficulty || puzzle.difficulty || '',
    cells: puzzle.rows * puzzle.cols,
    totalMs: nz(totalMs),
    mistakes: nz(mistakes),
    // Auf ganze Millisekunden runden: die Werte reisen im Cloud-Snapshot mit,
    // und Nachkommastellen einer Median-Denkzeit tragen keine Information.
    think: { t1: Math.round(median(think.t1)), t2: Math.round(median(think.t2)), hard: Math.round(median(think.hard)) },
    burstMs: Math.round(median(bursts)),
    stalls,
    thinkCount,
    // ── Verhaltensmuster ──────────────────────────────────────────────────────
    // Anteil der Züge, die aus einem KÄFIG statt aus Zeile/Spalte kamen: die
    // deutlichste stilistische Trennung zwischen zwei Spielern desselben Tempos.
    regionShare: kindKnown >= 4 ? Math.round((regionMoves / kindKnown) * 100) / 100 : 0,
    // Arbeitet der Spieler in derselben Struktur weiter oder springt er?
    locality: localTotal >= 4 ? Math.round((localHits / localTotal) * 100) / 100 : 0,
    phase: { early: ratio(rel.early), mid: ratio(rel.mid), late: ratio(rel.late) },
    // WO es hakt bzw. wo danebengegriffen wird — beides als reine Zählungen, die
    // sich über viele Partien zu einer Verteilung addieren.
    errPhase,
    errTier,
    ownMoves,
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
  // Anteile/Faktoren dürfen NICHT durch die gerundete Median-Variante laufen.
  const pickF = (f) => medianF(list.map(f).filter((v) => v > 0));
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
    // Fehler pro Partie: MITTELWERT, nicht Median. Fehlerzahlen sind kleine
    // Ganzzahlen (0–4) — der Median springt dort in ganzen Schritten und
    // überschätzte die Quote deutlich (gemessen: 2 statt 1,2). Ein Ausreißer-
    // Risiko wie bei den Zeiten gibt es hier nicht, weil die Werte nach oben
    // ohnehin durch die Leben begrenzt sind.
    mistakesPerGame: Math.round((list.reduce((a, s) => a + nz(s.mistakes), 0) / games) * 100) / 100,
    // Hänger je Partie in eine Wahrscheinlichkeit je Denkzug umrechnen.
    stallRate: (() => {
      const perGame = list.map((s) => nz(s.stalls) / Math.max(1, nz(s.thinkCount)));
      return Math.min(0.3, median(perGame.map((v) => Math.round(v * 1000))) / 1000);
    })(),
    // ── Verhaltensmuster ──────────────────────────────────────────────────────
    // Käfig- vs. Zeilen/Spalten-Vorliebe und Lokalität: beides steuert beim Bot
    // die Auswahl des nächsten Zuges, nicht seine Geschwindigkeit. Fehlt der Wert
    // (zu kurze Partien), bleibt es beim neutralen Preset-Verhalten.
    regionBias: r2(pickF((s) => nz(s.regionShare))),
    locality: r2(pickF((s) => nz(s.locality))),
    // Persönliches Phasen-Tempo. Über die Partien gemittelt, weil einzelne Rätsel
    // je nach Struktur stark schwanken. 0 = keine Aussage → Bot bleibt neutral.
    phase: {
      early: r2(pickF((s) => nz(s.phase && s.phase.early))) || 1,
      mid: r2(pickF((s) => nz(s.phase && s.phase.mid))) || 1,
      late: r2(pickF((s) => nz(s.phase && s.phase.late))) || 1,
    },
    // Fehler-Verteilung über die Spielphasen als Anteile. Summiert über ALLE
    // Partien (nicht Median): Fehler sind seltene Ereignisse, ein Median je Partie
    // wäre fast immer 0. Ohne beobachtete Fehler bleibt die Verteilung gleich.
    errPhase: sharesOf(list, 'errPhase', ['early', 'mid', 'late']),
    errTier: sharesOf(list, 'errTier', ['t1', 't2', 'hard']),
  };
  return { profile, games, ready: games >= MIN_GAMES };
}

const r2 = (v) => Math.round(nz(v) * 100) / 100;

// Zählungen über alle Stichproben addieren und in Anteile umrechnen. Gibt es
// nichts zu verteilen, kommt eine Gleichverteilung zurück — „keine Beobachtung"
// darf nicht als „passiert nie" durchgehen.
function sharesOf(list, field, keys) {
  const sum = {};
  let all = 0;
  for (const k of keys) sum[k] = 0;
  for (const s of list) {
    const o = (s && s[field]) || {};
    for (const k of keys) { const v = nz(o[k]); sum[k] += v; all += v; }
  }
  const out = {};
  for (const k of keys) out[k] = all > 0 ? r2(sum[k] / all) : r2(1 / keys.length);
  return out;
}
