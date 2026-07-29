// duelbot.js — KI-Duellgegner mit MENSCHLICHEM Tempo-Modell (reine Logik).
//
// Der Bot ist bewusst KEIN Timer, der alle X Sekunden einen bekannten Zug setzt.
// Er sucht wie ein Mensch: Er kennt zwar die Lösung (er braucht sie als Fangnetz,
// s. TIER.HARD), wählt seinen nächsten Zug aber aus den AKTUELL ERZWINGBAREN
// Deduktionen und braucht dafür umso länger, je schwerer die Deduktion ist und je
// weniger Ansatzpunkte das Brett gerade hergibt.
//
// ── Warum daraus die U-Kurve entsteht (Kernidee) ──────────────────────────────
// Die Denkzeit hängt an der BRETTLAGE, nicht an der Uhr:
//   delay = think[tier] × searchFactor(Anzahl offener Ansatzpunkte) × jitter
// Damit ergibt sich der menschliche Verlauf von selbst aus dem Rätsel:
//   • Anfang: mehrere leichte Tier-1-Footholds  → schnell
//   • Mitte:  1–2 Ansatzpunkte, davon Teilsummen → lange Suche
//   • Ende:   Kaskade, viele triviale Tier-1     → wieder schnell
// Zusätzlich modelliert `queue` BURSTS: EINE Deduktion, die mehrere Zellen
// erzwingt („Summe erreicht → alle übrigen weg"), kostet EINMAL Denkzeit und wird
// danach im Sekundenbruchteil-Takt (`burstMs`) eingetragen. Das ist der
// Hauptgrund, warum Menschen zum Schluss regelrecht rasen.
//
// Rein im Sinne dieses Projekts: kein DOM, kein Firebase, keine Timer — die
// Zeitplanung macht der Aufrufer (app.js) anhand von `delayMs`. Bei gleichem
// `seed` ist der komplette Spielverlauf reproduzierbar (unit-getestet).

import { buildModel, UNK, KEEP, REMOVE } from './solver.js';

// Deduktionstypen, nach „wie schnell findet ein Mensch das" aufsteigend.
// HARD = Fangnetz: alles, was über Teilsummen hinausgeht (z.B. der
// Käfig↔Zeile-Überlapp aus Tier 2.5). Statt diese Logik hier ein drittes Mal zu
// spiegeln (solver.js/training.js/hinttutor.js haben sie schon), greift der Bot
// dann auf die Lösung zurück — mit einer LANGEN Denkzeit, die genau dem
// entspricht, was ein Mensch dort tut: lange starren, dann den Trick sehen.
// Nebeneffekt: der Bot kann nie hängenbleiben, egal wie das Rätsel aussieht.
export const TIER = { T1: 't1', T2: 't2', HARD: 'hard' };

// ─── Zielzeiten: der Bot orientiert sich an DURCHSCHNITTSzeiten ───────────────
// Eine Bestzeit ist ein Ausnahmelauf; ein Duellgegner, der immer Bestzeit spielt,
// wäre unfair und unrealistisch. Maßstab ist deshalb die DURCHSCHNITTSzeit je
// Schwierigkeit. Die steht bereits in den Statistiken: `sumTimeMs / won` aus
// `stats.byDifficulty[id]` (js/storage.js) — es braucht dafür keine neue
// Aufzeichnung.
//
// Diese Tabelle sind echte Spieler-Durchschnitte und dient als Vorgabe, solange
// ein Spieler für eine Schwierigkeit noch keine eigenen Werte hat.
// WICHTIG: Die Zeit skaliert stark überlinear mit der Brettgröße (6×6 ≈ 44 s,
// 14×14 ≈ 24 min — Faktor 32 bei nur 5,4× so vielen Zellen). Ein Modell mit
// einer globalen Denkzeit-Tabelle trifft das NICHT (gemessen: es war auf kleinen
// Brettern zu langsam und auf großen bis 3,4× zu schnell). Darum wird pro Duell
// auf die Zielzeit kalibriert (s. createBot/timeScale).
export const DEFAULT_AVG_MS = {
  sehrleicht:   44000,   // 6×6
  leicht:       74000,   // 7×7
  mittel:      193000,   // 8×8
  schwer:      283000,   // 9×9
  extrem:      438000,   // 10×10
  mashallah:  1046000,   // 11×11
  dikkawas:   1009000,   // 12×12
  bismillah:  1051000,   // 13×13
  rip:        1421000,   // 14×14
};

// Feste Stärke-Stufen: Multiplikator auf die Zielzeit (>1 = langsamer/schwächer)
// plus das Fehlerverhalten. „Mittel" entspricht genau dem Durchschnittsspieler.
// mistakesPerGame = ERWARTETE Fehler je PARTIE (nicht je Zug!). Eine Quote pro
// Zug skaliert mit der Brettgröße und tötete den Bot auf großen Feldern fast
// immer: 0,03/Zug × ~150 Entscheidungen ≈ 4,5 Fehler bei 3 Leben (gemessen:
// 14×14 flog in 3 von 4 Läufen raus). Ein Mensch macht auf einem großen Brett
// aber nicht mehr Fehler, nur weil es größer ist.
export const PRESET_LEVELS = {
  easy:   { speed: 1.45, mistakesPerGame: 2.20, stallRate: 0.075 },
  medium: { speed: 1.00, mistakesPerGame: 1.20, stallRate: 0.060 },
  hard:   { speed: 0.78, mistakesPerGame: 0.60, stallRate: 0.045 },
  brutal: { speed: 0.58, mistakesPerGame: 0.25, stallRate: 0.030 },
};

// Zielzeit für ein Duell. `avgMs` = eigene Durchschnittszeiten (aus den Stats),
// sonst DEFAULT_AVG_MS. `level` = feste Stufe, `skill` = Prozent-Regler
// (1.1 ⇒ 10 % schneller als die Vorlage). Beide Regler wirken multiplikativ auf
// dieselbe Zielzeit — genau die „feste Stufen UND relativ"-Anforderung.
export function targetMsFor({ avgMs, difficulty, level = 'medium', skill = 1 } = {}) {
  const own = Number(avgMs && avgMs[difficulty]);
  const base = Number.isFinite(own) && own > 0 ? own : (DEFAULT_AVG_MS[difficulty] || DEFAULT_AVG_MS.mittel);
  const speed = PRESET_LEVELS[level]?.speed ?? 1;
  const sk = clampNum(skill, [0.4, 2.5], 1);
  return Math.max(5000, (base * speed) / sk);
}

// Zeit-SHAPE der Profile: nach der Kalibrierung zählen nur noch die VERHÄLTNISSE
// (Tier 1 : Tier 2 : hart : Burst) — die absoluten Werte skaliert `timeScale` auf
// die Zielzeit. Fehler-/Hängerquoten bleiben absolut.
export const PRESET_PROFILES = {
  easy:   { think: { t1: 3400, t2: 9000, hard: 15000 }, burstMs: 620, searchMax: 2.8, mistakesPerGame: 2.20, recoverMs: 4200, stallRate: 0.075, stallMin: 7, stallSpan: 26 },
  medium: { think: { t1: 2000, t2: 5200, hard: 9000 },  burstMs: 340, searchMax: 2.5, mistakesPerGame: 1.20, recoverMs: 3000, stallRate: 0.060, stallMin: 6, stallSpan: 22 },
  hard:   { think: { t1: 1250, t2: 3200, hard: 5600 },  burstMs: 230, searchMax: 2.2, mistakesPerGame: 0.60, recoverMs: 2200, stallRate: 0.045, stallMin: 5, stallSpan: 18 },
  brutal: { think: { t1: 780,  t2: 2000, hard: 3400 },  burstMs: 165, searchMax: 1.9, mistakesPerGame: 0.25, recoverMs: 1500, stallRate: 0.030, stallMin: 4, stallSpan: 14 },
};

// Grenzen für JEDES Profilfeld. Pflicht für Fremdprofile (Freunde-Klone kommen
// aus der Cloud, s. Stufe 4): ein manipuliertes oder kaputtes Profil darf den
// Bot weder sofort gewinnen lassen noch die Engine sprengen (Infinity/NaN/0).
const LIMITS = {
  't1':   [250, 30000], 't2': [400, 60000], 'hard': [600, 90000],
  burstMs: [60, 4000], searchMax: [1, 6], mistakesPerGame: [0, 8],
  recoverMs: [200, 20000], stallRate: [0, 0.3], stallMin: [0, 40], stallSpan: [0, 80],
};
const clampNum = (v, [lo, hi], fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};
// Bringt ein beliebiges (auch fremdes/unvollständiges) Profil in eine garantiert
// benutzbare Form. Fehlende Felder erben vom medium-Preset.
export function clampProfile(p) {
  const base = PRESET_PROFILES.medium;
  const src = (p && typeof p === 'object') ? p : {};
  const th = (src.think && typeof src.think === 'object') ? src.think : {};
  return {
    think: {
      t1:   clampNum(th.t1,   LIMITS['t1'],   base.think.t1),
      t2:   clampNum(th.t2,   LIMITS['t2'],   base.think.t2),
      hard: clampNum(th.hard, LIMITS['hard'], base.think.hard),
    },
    burstMs:     clampNum(src.burstMs,     LIMITS.burstMs,     base.burstMs),
    searchMax:   clampNum(src.searchMax,   LIMITS.searchMax,   base.searchMax),
    mistakesPerGame: clampNum(src.mistakesPerGame, LIMITS.mistakesPerGame, base.mistakesPerGame),
    recoverMs:   clampNum(src.recoverMs,   LIMITS.recoverMs,   base.recoverMs),
    stallRate:   clampNum(src.stallRate,   LIMITS.stallRate,   base.stallRate),
    stallMin:    clampNum(src.stallMin,    LIMITS.stallMin,    base.stallMin),
    stallSpan:   clampNum(src.stallSpan,   LIMITS.stallSpan,   base.stallSpan),
  };
}

// Seedbarer Zufall (mulberry32, wie generator.js) — gleicher Seed ⇒ gleiches Spiel.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Teilsummen-Zwang (Tier 2) ────────────────────────────────────────────────
// Welche offenen Zellen stecken in JEDER gültigen Kombination (→ behalten) bzw.
// in KEINER (→ entfernen)? Bewusst schlichte Boolean-DP statt der BigInt-Bitsets
// aus solver.js: Tier 2 wird nur berechnet, wenn Tier 1 GAR NICHTS liefert
// (s. candidateBuckets) — das passiert selten, und Gruppen sind ≤14 Zellen groß.
function reachWithout(vals, skipIdx, target) {
  const reach = new Uint8Array(target + 1);
  reach[0] = 1;
  for (let i = 0; i < vals.length; i++) {
    if (i === skipIdx) continue;
    const v = vals[i];
    for (let s = target; s >= v; s--) if (reach[s - v]) reach[s] = 1;
  }
  return reach;
}
// force[k]: 1 = muss behalten, 2 = muss weg, 0 = offen
function subsetForce(vals, rem) {
  const n = vals.length;
  const force = new Array(n).fill(0);
  if (rem < 0) return force;
  for (let k = 0; k < n; k++) {
    const reach = reachWithout(vals, k, rem);
    const withK = vals[k] <= rem ? !!reach[rem - vals[k]] : false;
    const withoutK = !!reach[rem];
    if (withK && !withoutK) force[k] = 1;       // ohne diese Zahl geht es nicht
    else if (!withK && withoutK) force[k] = 2;  // mit dieser Zahl geht es nicht
  }
  return force;
}

// ─── Bot-Zustand ──────────────────────────────────────────────────────────────
function makeBot(puzzle, profile, skill, seed) {
  const model = buildModel(puzzle);
  return {
    model,
    solution: puzzle.solution,
    prof: clampProfile(profile),
    skill: clampNum(skill, [0.4, 2.5], 1),
    rng: mulberry32(seed),
    timeScale: 1,       // wird von createBot auf die Zielzeit kalibriert
    mistakeP: 0,        // Fehlerwahrscheinlichkeit je DENKZUG (aus mistakesPerGame, s. createBot)
    mark: new Array(model.cells.length).fill(UNK),
    total: puzzle.rows * puzzle.cols,
    decided: 0,
    mistakes: 0,
    lives: 3,
    queue: [],          // offene Züge der AKTUELLEN Deduktion (Burst)
    lastGroupId: -1,    // Lokalität: Menschen arbeiten dort weiter, wo sie waren
  };
}

// Trockenlauf: spielt das Rätsel ohne echte Zeit durch. Liefert die Referenzdauer
// UND die Anzahl der DENKZÜGE (Bursts zählen nicht — auf ihnen passieren keine
// Fehler). Fehler sind hier bewusst AUS: der Lauf misst die reine Lösezeit und
// darf nicht durch ein Ausscheiden abbrechen (das würde die Skalierung sprengen).
// Kosten gemessen: 4,6 ms (8×8) bis 17,7 ms (14×14) — läuft beim Duell-Start
// hinter dem ohnehin sichtbaren Lade-Overlay, also unkritisch.
function dryRun(puzzle, profile, skill, seed) {
  const dry = makeBot(puzzle, { ...clampProfile(profile), mistakesPerGame: 0 }, skill, seed);
  let total = 0, thinks = 0;
  for (let i = 0; i < 100000 && !botDone(dry); i++) {
    const a = nextAction(dry);
    if (a.kind === 'done') break;
    total += a.delayMs;
    if (!a.burst) thinks++;
    applyAction(dry, a);
  }
  return { total, thinks };
}

// `targetMs` (optional) = gewünschte GESAMTdauer des Duells, i.d.R. aus
// targetMsFor() und damit aus DURCHSCHNITTSzeiten. Ist sie gesetzt, kalibriert
// sich der Bot per Trockenlauf exakt darauf: alle Zeiten werden mit demselben
// Faktor skaliert, die VERHÄLTNISSE (Tier-Trennung, U-Kurve, Bursts) bleiben
// dadurch unverändert erhalten.
// `skill` beeinflusst zusätzlich die Fehleranfälligkeit; auf die Dauer wirkt es
// über targetMs (nicht doppelt — der Trockenlauf enthält denselben Faktor).
export function createBot({ puzzle, profile, skill = 1, seed = 1, targetMs = null } = {}) {
  const bot = makeBot(puzzle, profile, skill, seed);
  const { total: base, thinks } = dryRun(puzzle, profile, skill, seed);
  // Zeit auf die Zielzeit (= Durchschnittszeit) skalieren. Die erwartete
  // Fehler-Erholzeit gehört in die Referenz: die Durchschnittszeit eines echten
  // Spielers ENTHÄLT dessen Fehler schon — sonst käme sie oben drauf und der Bot
  // wäre systematisch langsamer als die Vorlage.
  const overhead = bot.prof.mistakesPerGame * bot.prof.recoverMs;
  if (Number.isFinite(targetMs) && targetMs > 0 && base > 0) {
    bot.timeScale = clampNum(targetMs / (base + overhead), [0.02, 50], 1);
  }
  // Fehler PRO PARTIE in eine Wahrscheinlichkeit je Denkzug umrechnen — dadurch
  // bleibt die erwartete Fehlerzahl über alle Brettgrößen konstant.
  bot.mistakeP = thinks > 0 ? Math.min(0.5, bot.prof.mistakesPerGame / thinks) : 0;
  return bot;
}

// Fortschritt in Prozent — MUSS dieselbe Formel wie progressPct() in app.js
// benutzen (korrekte Zellen / Gesamtzellen), sonst sind die Duell-Balken nicht
// vergleichbar. Der Bot setzt nur korrekte Marken (ein Fehlgriff wird gar nicht
// eingetragen, genau wie setMark() es beim Spieler macht), also gilt
// decided === korrekt.
export function botPct(bot) {
  return bot.total ? Math.round((bot.decided / bot.total) * 100) : 0;
}
export function botDone(bot) { return bot.decided >= bot.total; }

function groupState(bot, g) {
  let rem = g.target;
  const und = [];
  for (const ci of g.cells) {
    if (bot.mark[ci] === KEEP) rem -= bot.model.cells[ci].val;
    else if (bot.mark[ci] === UNK) und.push(ci);
  }
  return { rem, und };
}

// Alle aktuell erzwingbaren Deduktionen als BUCKETS: ein Bucket = eine Deduktion
// und damit ALLE Zellen, die sie auf einen Schlag festlegt (= ein Burst).
// Reihenfolge der Suche entspricht „was ein Mensch zuerst sieht":
// Tier 1 über alle Gruppen → nur wenn das leer ist, Tier 2 → sonst Fangnetz.
export function candidateBuckets(bot) {
  const t1 = [];
  for (const g of bot.model.groups) {
    const { rem, und } = groupState(bot, g);
    if (!und.length) continue;
    if (rem === 0) {                                  // Ziel erreicht → Rest weg
      t1.push({ tier: TIER.T1, groupId: g.id, moves: und.map(ci => ({ ci, want: 'removed' })) });
      continue;
    }
    let total = 0; for (const ci of und) total += bot.model.cells[ci].val;
    if (total === rem) {                              // alle Offenen gebraucht
      t1.push({ tier: TIER.T1, groupId: g.id, moves: und.map(ci => ({ ci, want: 'kept' })) });
      continue;
    }
    const tooBig = und.filter(ci => bot.model.cells[ci].val > rem);
    if (tooBig.length) {                              // zu groß für den Rest
      t1.push({ tier: TIER.T1, groupId: g.id, moves: tooBig.map(ci => ({ ci, want: 'removed' })) });
    }
  }
  if (t1.length) return t1;

  // Tier 2 erst, wenn nichts Einfaches mehr offen ist (auch der Perf-Schutz).
  const t2 = [];
  for (const g of bot.model.groups) {
    const { rem, und } = groupState(bot, g);
    if (und.length < 2 || rem <= 0) continue;
    const vals = und.map(ci => bot.model.cells[ci].val);
    const force = subsetForce(vals, rem);
    const moves = [];
    for (let k = 0; k < und.length; k++) {
      if (force[k] === 1) moves.push({ ci: und[k], want: 'kept' });
      else if (force[k] === 2) moves.push({ ci: und[k], want: 'removed' });
    }
    if (moves.length) t2.push({ tier: TIER.T2, groupId: g.id, moves });
  }
  if (t2.length) return t2;

  // Fangnetz: irgendeine offene Zelle aus der Lösung, mit langer Denkzeit.
  for (let ci = 0; ci < bot.mark.length; ci++) {
    if (bot.mark[ci] !== UNK) continue;
    const cell = bot.model.cells[ci];
    const want = bot.solution[cell.r][cell.c] ? 'kept' : 'removed';
    return [{ tier: TIER.HARD, groupId: -1, moves: [{ ci, want }] }];
  }
  return [];
}

// Suchaufwand eines Menschen — der Faktor, der die U-Kurve erzeugt.
//
// Entscheidend ist NICHT die Anzahl der Ansatzpunkte allein, sondern ihre DICHTE:
// wie viel des noch OFFENEN Bretts von erzwungenen Deduktionen abgedeckt ist.
// Nur damit stimmt das Endspiel: dort sind wenige Gruppen offen (wenige Buckets),
// aber fast jede offene Zelle ist erzwungen — man löst nur noch auf und ist
// schnell. Ein Modell nur über die Bucket-Anzahl machte das Ende fälschlich zur
// langsamsten Phase (genau dieser Fehler ist im Unit-Test festgenagelt).
//   • Anfang:  viel offenes Brett, einige leichte Footholds → mittel
//   • Mitte:   viel offenes Brett, 1–2 zähe Ansatzpunkte    → langsam (Maximum)
//   • Endspiel: kaum offenes Brett, fast alles erzwungen     → schnell
// Exportiert, weil js/playstyle.js beim Auswerten echter Partien denselben
// Faktor HERAUSRECHNEN muss: die gemessene Zugdauer eines Spielers enthält ihn
// multiplikativ und ist daher kein reines Signal für den Deduktionstyp.
export function searchFactor(bucketCount, coveredCells, undecided, total, searchMax) {
  const density = undecided > 0 ? Math.min(1, coveredCells / undecided) : 1;
  // Sättigt früh: schon ~4 gleichzeitig offene Deduktionen heißen „ich finde
  // sofort eine". Ein Mensch scannt das Brett nicht proportional zu seiner Größe.
  const breadth = Math.min(1, bucketCount / 4);
  // Anzahl der Ansatzpunkte ist der PRIMÄRE Treiber (sonst gilt das leere
  // Startbrett als schwerste Lage, obwohl dort die leichten Footholds liegen);
  // die Dichte trägt vor allem das Endspiel.
  const ease = 0.65 * breadth + 0.35 * density;
  let f = searchMax + (0.6 - searchMax) * ease;
  // Endspiel-Bonus: sind nur noch wenige Zellen offen, ist das Suchen praktisch
  // vorbei — der Blick überfliegt den Rest. Das ist der „am Ende geht es wieder
  // schnell, weil man nur noch auflöst"-Effekt in Reinform.
  // Fenster BEWUSST breit (30 % statt 15 %): das letzte Fortschritts-Drittel eines
  // Rätsels umfasst deutlich mehr als die letzten 15 % der Zellen, und genau dort
  // soll sich das „ich löse nur noch auf"-Gefühl einstellen. Gemessen war das
  // Endspiel mit dem engen Fenster kaum schneller als die zähe Mitte.
  if (total > 0 && undecided <= total * 0.30) f *= 0.5;
  // Eröffnungs-Bonus: der Generator garantiert jedem Rätsel einen leichten
  // Einstieg (Foothold-Kriterium, s. js/generator.js) — die ersten Züge sind
  // gesuchte, offensichtliche Ansatzpunkte und gehen entsprechend flott. Ohne
  // das wäre das noch leere Brett rechnerisch die schwerste Lage und der Bot
  // würde ausgerechnet am Anfang am längsten grübeln.
  else if (total > 0 && undecided >= total * 0.88) f *= 0.7;
  return Math.max(0.4, f);
}

// Nächste Aktion. Verändert den Bot NICHT — der Aufrufer wartet `delayMs` und
// ruft dann applyAction(). kind: 'move' | 'mistake' | 'done'.
export function nextAction(bot) {
  const p = bot.prof, sk = bot.skill;
  // Streuung LOGNORMAL statt gleichverteilt: ein Mensch braucht für dieselbe
  // Deduktion mal 3 s und mal 20 s. Eine enge Gleichverteilung (früher ±25 %)
  // erzeugte ein mechanisches Ticken — gemessen lag die längste Pause auf 8×8 bei
  // 13,6 s, es gab NIE eine über 30 s. Genau das soll der Gegner nicht sein.
  const jit = () => {
    // Box-Muller aus dem seedbaren RNG (bleibt reproduzierbar).
    const u = Math.max(1e-9, bot.rng()), v = bot.rng();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.exp(g * 0.55);   // Median 1, p90 ≈ 2,0, p99 ≈ 3,6
  };

  const scale = bot.timeScale || 1;
  // Läuft noch ein Burst? Dann keine neue Denkzeit — nur Eintragetempo.
  if (bot.queue.length) {
    return { kind: 'move', delayMs: Math.round((p.burstMs / sk) * jit() * scale), move: bot.queue[0], burst: true };
  }
  const buckets = candidateBuckets(bot);
  if (!buckets.length) return { kind: 'done', delayMs: 0 };

  // Bucket wählen: leichte Deduktionen bevorzugt, und bevorzugt dort, wo der Bot
  // gerade gearbeitet hat (Lokalität) — sonst wirkt er wie ein Scanner.
  let best = null, bestW = -1;
  for (const b of buckets) {
    let w = b.tier === TIER.T1 ? 3 : b.tier === TIER.T2 ? 1.5 : 1;
    if (b.groupId === bot.lastGroupId) w *= 2.5;
    w *= 0.5 + bot.rng();
    if (w > bestW) { bestW = w; best = b; }
  }
  const think = p.think[best.tier] ?? p.think.hard;
  // Abdeckung über ALLE Buckets (Zellen können sich zwischen Gruppen doppeln —
  // für das Dichte-Maß reicht die Menge der eindeutigen Zellen).
  const covered = new Set();
  for (const b of buckets) for (const m of b.moves) covered.add(m.ci);
  const undecided = bot.total - bot.decided;
  let delay = (think / sk) * searchFactor(buckets.length, covered.size, undecided, bot.total, p.searchMax) * jit();

  // Echte HÄNGER: Phasen, in denen scheinbar nichts passiert — man starrt aufs
  // Brett, findet den Faden nicht, legt das Handy kurz weg. Als VIELFACHES der
  // eigenen Denkzeit modelliert, damit es auf jedem Brett stimmt: auf einem
  // großen Feld (langsameres Grundtempo) werden daraus ein bis zwei Minuten, auf
  // einem kleinen entsprechend weniger. Ein fester ms-Wert konnte das nicht —
  // er war auf 14×14 zu kurz und auf 6×6 absurd lang.
  if (bot.rng() < p.stallRate) {
    const r = bot.rng();
    delay += (think / sk) * (p.stallMin + p.stallSpan * r * r);
  }

  // Fehlgriff: kostet Leben + Zeit, das Brett bleibt unverändert (wie setMark()).
  if (bot.rng() < bot.mistakeP / sk) {
    return { kind: 'mistake', delayMs: Math.round((delay + p.recoverMs / sk) * scale) };
  }
  return { kind: 'move', delayMs: Math.round(delay * scale), move: best.moves[0], rest: best.moves.slice(1), groupId: best.groupId, tier: best.tier };
}

// Aktion anwenden. Mutiert den Bot (interne Zustandsmaschine, kein
// Vue-reaktives Objekt) und liefert zurück, was für die UI relevant ist.
export function applyAction(bot, action) {
  if (!action || action.kind === 'done') return { pct: botPct(bot), done: true };
  if (action.kind === 'mistake') {
    bot.mistakes++;
    bot.lives--;
    // Die Deduktion bleibt bewusst STEHEN: ein Fehlgriff ist ein Vertipper, kein
    // Gedächtnisverlust — der Spieler weiß weiter, was er gerade eintragen wollte.
    // (Vorher wurde die Burst-Queue geleert; die Folgezellen wurden dann als neue
    // DENKzüge gewertet, was zusätzliche Fehlerchancen schuf und sich
    // aufschaukelte: der Bot flog auf großen Brettern fast immer raus.)
    return { pct: botPct(bot), mistake: true, out: bot.lives <= 0 };
  }
  const { ci, want } = action.move;
  if (bot.mark[ci] === UNK) {
    bot.mark[ci] = want === 'kept' ? KEEP : REMOVE;
    bot.decided++;
  }
  bot.queue = action.burst ? bot.queue.slice(1) : (action.rest || []);
  if (action.groupId != null && action.groupId >= 0) bot.lastGroupId = action.groupId;
  return { pct: botPct(bot), done: botDone(bot) };
}
