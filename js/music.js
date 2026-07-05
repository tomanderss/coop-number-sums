// music.js — prozedurale Zen-/Ambient-Hintergrundmusik via Web Audio API.
//
// Bewusst KEIN Audio-File: alles wird live synthetisiert (0 KB, endlos, keine
// Lizenz, gehört vollständig zur App — wie der prozedurale Icon-Generator).
//
// IDENTITÄT trotz Nicht-Wiederholung — die Musik soll wiedererkennbar/vertraut
// klingen, sich aber nie wörtlich wiederholen. Erreicht durch feste Anker +
// variable Füllung:
//   • Feste Tonart (C-Dur) und feste, langsam zyklische Akkordfolge
//     C – Am – F – G (I–vi–IV–V) als harmonisches Rückgrat.
//   • Ein festes LEITMOTIV (immer dieselben Töne: G A C A G), das periodisch
//     als "Hook" wiederkehrt — der eigentliche Wiedererkennungswert.
//   • Konstante Klangfarbe: warmes Pad (Akkorde) + weiche Glocke (Melodie),
//     fester Tonika-Drone, ein prozeduraler Hall.
//   • Dazwischen sanfte, zufällige Akkordtöne als Füllung -> nie exakt gleich.
//
// API: play(volume) / stop() / setVolume(v) / isPlaying() / level().
// Web Audio läuft auch auf iOS (nach einer Nutzergeste) — play() wird daher aus
// einem Tap-Pfad (Spielstart) heraus aufgerufen. In der iOS-PWA (Safari) greift
// der Hardware-Stummschalter (Kategorie "ambient", nicht per JS änderbar); die
// native App setzt die Audio-Session dagegen auf ".playback" und ignoriert den
// Schalter (siehe ios/App/App/AppDelegate.swift).

let ctx = null, master = null, reverb = null, analyser = null;
let sfxBus = null, sfxReverb = null; // eigener Bus für UI-Sounds (unabhängig von der Musik)
let droneVoices = [], padTimer = null, melodyTimer = null;
let running = false, curVolume = 0.5, chordIdx = 0;

const C4 = 261.6255653;
const midi = (semi) => C4 * Math.pow(2, semi / 12); // Halbtöne relativ zu C4

// Feste Akkordfolge (Halbtöne ab C4) — das harmonische Rückgrat der Identität.
const PROGRESSION = [
  { name: 'C',  tones: [0, 4, 7] },     // C  E  G
  { name: 'Am', tones: [-3, 0, 4] },    // A  C  E
  { name: 'F',  tones: [-7, -3, 0] },   // F  A  C
  { name: 'G',  tones: [-5, -1, 2] },   // G  B  D
];
const CHORD_SECONDS = 9; // wie lange ein Akkord steht

// Festes Leitmotiv (feste Tonhöhen, C-Dur-Pentatonik) — der wiedererkennbare
// "Hook". Wird NICHT je Akkord transponiert, damit es immer gleich klingt.
const MOTIF = [7, 9, 12, 9, 7]; // G4 A4 C5 A4 G4 (Halbtöne ab C4)

// Tonika-Pentatonik für die zufällige Füllung (passt immer harmonisch).
const FILL = [-5, -3, 0, 2, 4, 7, 9, 12];

// Bibliothek fester Melodie-Phrasen — alle in C-Dur-Pentatonik (Halbtöne ab C4),
// d.h. Klangfarbe UND Tonart bleiben unverändert, es gibt nur deutlich mehr
// Melodien für mehr Abwechslung. Das Leitmotiv oben bleibt als seltener Hook.
const PHRASES = [
  [0, 4, 7, 4],
  [12, 9, 7, 9],
  [7, 12, 9, 16],
  [-5, 0, 4, 7, 4, 0],
  [9, 7, 4, 7, 12],
  [4, 7, 9, 7, 4, 2],
  [16, 12, 9, 12],
  [0, 7, 4, 12, 7],
  [2, 4, 7, 9, 7],
  [12, 16, 19, 16, 12],
  [-3, 0, 4, 2, 0],
  [7, 9, 12, 16, 12, 9],
  [19, 16, 12, 9],
  [0, 2, 4, 7, 9, 12],
  [9, 12, 16, 12, 9, 7],
  [4, 2, 0, -3, 0, 4],
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

// Prozeduraler Hall: abklingendes Rauschen als Impulsantwort. Länger = mehr
// Raum/Tiefe -> die Musik wirkt "im Hintergrund" statt vordergründig.
function buildReverb(seconds = 4.8, decay = 3.0) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

// Eine Stimme: Oszillator -> Tiefpass -> Hüllkurve -> (trocken + Hall).
// Default-Cutoff bewusst tief (warm/weich statt schrill).
function voice(freq, when, dur, peak, { type = 'sine', cutoff = 1000, detune = 0 } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(lp).connect(g);
  g.connect(master); g.connect(reverb);
  osc.start(when); osc.stop(when + dur + 0.1);
  osc.onended = () => { try { osc.disconnect(); lp.disconnect(); g.disconnect(); } catch {} };
}

// Melodieton, warm/hölzern (japanisch-zen): in der Grundoktave (NICHT mehr eine
// Oktave höher -> deutlich weniger schrill), mit tiefem Tiefpass für einen
// gedämpften Holz-/Koto-artigen Klang.
function bell(semi, when, dur, peak) {
  voice(midi(semi), when, dur, peak, { type: 'triangle', cutoff: rand(800, 1300), detune: rand(-4, 4) });
}

// Konstanter Tonika-Drone (C + G), sehr leise, mit langsamem LFO — Grundton der
// Identität, bleibt unter allen Akkorden bestehen.
function startDrone() {
  [midi(-12), midi(-5)].forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = i === 0 ? 0.13 : 0.08;
    const lfo = ctx.createOscillator(); lfo.frequency.value = rand(0.03, 0.07);
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG).connect(g.gain);
    osc.connect(g); g.connect(master); g.connect(reverb);
    osc.start(); lfo.start();
    droneVoices.push(osc, lfo);
  });
}

// Spielt den aktuellen Akkord als weiches Pad und schaltet danach zum nächsten.
function padLoop() {
  if (!running || document.hidden) return; // im Hintergrund nichts planen (sonst Noten-Schwall)
  const chord = PROGRESSION[chordIdx % PROGRESSION.length];
  const now = ctx.currentTime;
  chord.tones.forEach((semi, i) => {
    voice(midi(semi), now + 0.05 + i * 0.08, CHORD_SECONDS + 1.5, rand(0.13, 0.18),
      { type: 'triangle', cutoff: rand(650, 1050), detune: rand(-5, 5) });
  });
  chordIdx++;
  padTimer = setTimeout(padLoop, CHORD_SECONDS * 1000);
}

// Melodie: spielt mal das feste Leitmotiv (Wiedererkennung), meist eine der vielen
// festen Phrasen (Abwechslung), mal nur sparsame Einzeltöne ("Zen-Raum"). Tempo,
// Legato und Timing werden je Durchlauf zufällig variiert -> klingt selten gleich,
// Klangfarbe (bell) und Tonart (C-Dur-Pentatonik) bleiben identisch.
function melodyLoop() {
  if (!running || document.hidden) return; // im Hintergrund nichts planen (sonst Noten-Schwall)
  const now = ctx.currentTime;
  const r = Math.random();
  if (r < 0.16) {
    // Leitmotiv – der wiedererkennbare Hook, jetzt seltener (mehr Varianz).
    MOTIF.forEach((semi, i) => bell(semi, now + 0.1 + i * 0.42, rand(2.2, 3.2), rand(0.14, 0.2)));
    melodyTimer = setTimeout(melodyLoop, rand(8000, 12000));
  } else if (r < 0.82) {
    // Eine der vielen festen Phrasen, mit variabler Phrasierung (Tempo/Legato/Timing).
    const phrase = pick(PHRASES);
    const step = rand(0.34, 0.6);                     // Grundtempo variiert
    const legato = Math.random() < 0.5 ? 1.6 : 0.95;  // mal gebunden, mal perlend
    let t = now + 0.1;
    phrase.forEach((semi) => {
      bell(semi, t, rand(1.8, 3.0) * legato, rand(0.12, 0.18));
      t += step * rand(0.85, 1.2);
    });
    melodyTimer = setTimeout(melodyLoop, (t - now) * 1000 + rand(2500, 6000));
  } else {
    // Sparsame Einzeltöne / kurze Geste – Raum zum Atmen.
    const n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) bell(pick(FILL), now + 0.1 + i * rand(0.4, 0.9), rand(2.5, 4), rand(0.11, 0.16));
    melodyTimer = setTimeout(melodyLoop, rand(4000, 8000));
  }
}

// Weiche Sättigungskennlinie (tanh) für den WaveShaper: begrenzt Spitzen sanft
// statt hart zu clippen — bewusst STATT eines DynamicsCompressors, da dieser auf
// iOS/Safari beim Suspend/Resume (App in den Hintergrund) berüchtigte schrille
// Artefakte erzeugt. Ein WaveShaper ist zustandslos und damit glitch-frei.
function softClipCurve() {
  const n = 2048, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.7); }
  return curve;
}

function ensureContext() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = curVolume;
  // Leichte Makeup-Verstärkung (Stimmen-Peaks sind bewusst klein); der
  // WaveShaper dahinter fängt Spitzen weich ab -> lauter Grundpegel ohne harte,
  // schrille Übersteuerung und ohne Suspend-Artefakte (anders als ein Kompressor).
  const makeup = ctx.createGain(); makeup.gain.value = 0.65;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve(); shaper.oversample = '2x';
  analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
  // Basiston der MUSIK halbiert (eigener Trim nur im Musik-Pfad) — die UI-Sounds
  // laufen über sfxBus direkt in makeup und bleiben dadurch auf ihrem Pegel.
  const musicTrim = ctx.createGain(); musicTrim.gain.value = 0.5;
  master.connect(musicTrim); musicTrim.connect(makeup);
  makeup.connect(shaper); shaper.connect(analyser); analyser.connect(ctx.destination);
  // UI-Sound-Bus: eigener Eingang in dieselbe Ausgangskette (Soft-Clip + Analyser),
  // aber NICHT über die Musik-Lautstärke/Fade -> UI-Töne spielen unabhängig davon,
  // ob/wie laut die Hintergrundmusik läuft. Dezenter eigener Hall für „Raum".
  sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0;
  sfxBus.connect(makeup);
  sfxReverb = buildReverb(2.0, 3.2);
  const sfxWet = ctx.createGain(); sfxWet.gain.value = 0.16;
  sfxBus.connect(sfxReverb); sfxReverb.connect(sfxWet); sfxWet.connect(makeup);
}

// ── UI-Sounds (Aktions-/Vervollständigungs-Töne) ────────────────────────────
// Warm/rund synthetisiert (reine Sinus + sanfter Tiefpass), passend zur Musik.
// Werden aus Tap-Pfaden ausgelöst -> ensureContext() legt den Kontext ggf. in der
// Geste an; sfxReady() resümiert ihn best effort.
function sfxReady() {
  ensureContext();
  try { if (ctx.state === 'suspended') ctx.resume(); } catch {}
  return !!sfxBus;
}
// ─── Klangfarben-Pakete (Shop-Kategorie 'sfx') ───────────────────────────────
// Ein Paket färbt ALLE UI-Sounds um, ohne ihre Melodik/Timing-Identität zu
// ändern: Wellenform, Tonlage (pitch-Faktor), Filter-/Hüllkurven-Skalierung,
// optional Schimmer-Oberton (3×), Sub-Oktave und ein verstimmter Zwilling
// („wide", Chorus-Breite für Synthwave). Rein parametrisch — keine Audiodateien.
export const SFX_PACKS = {
  standard:  { type: 'sine',     pitch: 1,   lpMul: 1,    attackMul: 1,   durMul: 1,    shimmer: 0,    sub: 0,   wide: 0 },
  zen:       { type: 'sine',     pitch: 0.5, lpMul: 0.6,  attackMul: 2.4, durMul: 1.6,  shimmer: 0,    sub: 0.2, wide: 0 },
  arcade:    { type: 'square',   pitch: 1,   lpMul: 0.9,  attackMul: 0.35, durMul: 0.55, shimmer: 0,   sub: 0,   wide: 0 },
  kristall:  { type: 'triangle', pitch: 2,   lpMul: 1.8,  attackMul: 0.6, durMul: 1.35, shimmer: 0.22, sub: 0,   wide: 0 },
  kosmos:    { type: 'sine',     pitch: 1.5, lpMul: 1.2,  attackMul: 1.6, durMul: 1.5,  shimmer: 0.12, sub: 0.25, wide: 6, vibrato: true },
  synthwave: { type: 'sawtooth', pitch: 0.5, lpMul: 0.7,  attackMul: 1.1, durMul: 1.25, shimmer: 0,    sub: 0.3, wide: 10 },
};
let sfxPackId = 'standard';
export function setSfxPack(id) { sfxPackId = SFX_PACKS[id] ? id : 'standard'; }
export function currentSfxPack() { return sfxPackId; }

// Eine kurze Stimme auf dem SFX-Bus: Wellenform/Färbung aus dem aktiven Paket,
// Tiefpass, Hüllkurve, optionales Glissando. when relativ zu ctx.currentTime.
function sfxVoice(freq, dt, dur, peak, { lp = 3000, attack = 0.008, glideTo = 0, glideTime = 0.06, partial2 = 0 } = {}) {
  const P = SFX_PACKS[sfxPackId] || SFX_PACKS.standard;
  freq *= P.pitch; if (glideTo) glideTo *= P.pitch;
  lp = Math.min(12000, lp * P.lpMul); attack *= P.attackMul; dur *= P.durMul;
  if (P.type === 'square' || P.type === 'sawtooth') peak *= 0.55; // harte Wellen sind lauter — angleichen
  const when = ctx.currentTime + dt;
  const mk = (fr, pk, detuneCents, durX = dur) => {
    const osc = ctx.createOscillator(); osc.type = P.type;
    osc.frequency.setValueAtTime(fr, when);
    if (detuneCents) osc.detune.value = detuneCents;
    if (glideTo) { try { osc.frequency.exponentialRampToValueAtTime(glideTo * (fr / freq), when + glideTime); } catch {} }
    if (P.vibrato) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
      const lg = ctx.createGain(); lg.gain.value = 9; // ±9 Cent Schwebung
      lfo.connect(lg).connect(osc.detune); lfo.start(when); lfo.stop(when + durX + 0.05);
    }
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(pk, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + durX);
    osc.connect(lpf).connect(g); g.connect(sfxBus);
    osc.start(when); osc.stop(when + durX + 0.05);
    osc.onended = () => { try { osc.disconnect(); lpf.disconnect(); g.disconnect(); } catch {} };
  };
  mk(freq, peak, 0);
  if (partial2 > 0) mk(freq * 2, peak * partial2, 0, dur * 0.85); // Oktav-Oberton wie bisher
  if (P.wide) mk(freq, peak * 0.6, P.wide);          // verstimmter Zwilling (Chorus-Breite)
  if (P.sub) mk(freq / 2, peak * P.sub, 0);          // Sub-Oktave (Wärme/Wucht)
  if (P.shimmer) mk(freq * 3, peak * P.shimmer, 0);  // Glas-Schimmer
}
// Kurzer gefilterter Rauschimpuls (Anschlag-„plip" beim Wassertropfen).
function sfxNoise(dt, dur, peak, lp) {
  const when = ctx.currentTime + dt;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource(); src.buffer = b;
  const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
  const g = ctx.createGain(); g.gain.value = peak;
  src.connect(lpf).connect(g); g.connect(sfxBus);
  src.start(when);
  src.onended = () => { try { src.disconnect(); lpf.disconnect(); g.disconnect(); } catch {} };
}

// Käfig/Reihe/Spalte fertig — kurzes, prägnantes E5. tier = wie viele Strukturen
// dieselbe Zahl gleichzeitig auflöst (1/2/3+): höhere Stufe = mächtiger durch
// Sub-Oktaven/Quinte DARUNTER (nicht mehr/höhere Töne).
export function sfxComplete(tier = 1) {
  if (!sfxReady()) return;
  sfxVoice(midi(16), 0, 0.34, 0.5, { lp: 3000, attack: 0.008, partial2: 0.18 }); // E5
  if (tier >= 2) sfxVoice(midi(4), 0, 0.6, 0.4, { lp: 900, attack: 0.01 });       // E4 Oktave drunter
  if (tier >= 3) {
    sfxVoice(midi(-8), 0, 0.8, 0.45, { lp: 700, attack: 0.012 });                 // E3 tiefe Sub-Oktave
    sfxVoice(midi(-1), 0, 0.55, 0.26, { lp: 800, attack: 0.012 });                // B3 Quinte (Power)
  }
}
// Korrektes Einkreisen — dunkler/dumpfer Wassertropfen (Pitch steigt G4->D5).
export function sfxKeep() {
  if (!sfxReady()) return;
  sfxNoise(0, 0.006, 0.12, 7000);
  sfxVoice(midi(7), 0, 0.24, 0.6, { lp: 1500, attack: 0.004, glideTo: midi(14), glideTime: 0.06 });
}
// Löschen — weicher „Pop" (Pitch fällt 440->150 Hz).
export function sfxRemove() {
  if (!sfxReady()) return;
  sfxVoice(440, 0, 0.12, 0.6, { lp: 1400, attack: 0.002, glideTo: 150, glideTime: 0.07, partial2: 0.12 });
}
// Fehler — sanftes, dunkles Abwärts-Motiv (Eb4 -> C4 -> Ab3), nicht schrill.
export function sfxError() {
  if (!sfxReady()) return;
  sfxVoice(midi(3), 0, 0.3, 0.5, { lp: 1400, attack: 0.01, partial2: 0.1 });
  sfxVoice(midi(0), 0.16, 0.3, 0.5, { lp: 1400, attack: 0.01, partial2: 0.1 });
  sfxVoice(midi(-4), 0.32, 1.0, 0.58, { lp: 1300, attack: 0.01, partial2: 0.1 });
}
// Hinweis — heller, neugieriger Aufwärts-Schimmer (A4 -> D5 -> E5).
export function sfxHint() {
  if (!sfxReady()) return;
  sfxVoice(midi(9), 0, 0.45, 0.4, { lp: 2400, attack: 0.02, partial2: 0.15 });
  sfxVoice(midi(14), 0.14, 0.45, 0.4, { lp: 2400, attack: 0.02, partial2: 0.15 });
  sfxVoice(midi(16), 0.28, 1.0, 0.44, { lp: 2400, attack: 0.02, partial2: 0.15 });
}
// Rückgängig (Undo) — kurzer Klick + tiefer, leicht abwärts gleitender Sinus-
// Thump (G3 -> Eb3). Bewusst dunkel/dezent: signalisiert "zurück" ohne zu nerven.
export function sfxUndo() {
  if (!sfxReady()) return;
  sfxNoise(0, 0.012, 0.22, 6500);
  sfxVoice(midi(-5), 0, 0.24, 0.5, { lp: 650, attack: 0.006, glideTo: midi(-9), glideTime: 0.12 });
}
// Werkzeug-Wechsel (Stift/Radierer) — kurzer, dezenter Zwei-Ton aufwärts (A4 -> D5).
export function sfxToolSwitch() {
  if (!sfxReady()) return;
  sfxVoice(midi(9), 0, 0.08, 0.42, { lp: 1600, attack: 0.003, partial2: 0.1 });
  sfxVoice(midi(14), 0.06, 0.16, 0.5, { lp: 1800, attack: 0.003, partial2: 0.1 });
}
// Gewonnen — kleine warme Fanfare G-Dur -> C-Dur+Oktave (befriedigend/belohnend).
export function sfxWin() {
  if (!sfxReady()) return;
  [-5, -1, 2].forEach((s, i) => sfxVoice(midi(s), 0, 0.5, i ? 0.22 : 0.28, { lp: 1700, attack: 0.01, partial2: 0.1 }));
  [0, 4, 7, 12].forEach((s, i) => sfxVoice(midi(s), 0.34, 1.4, i ? 0.26 : 0.32, { lp: 2600, attack: 0.01, partial2: 0.18 }));
}
// Sieganimations-Fanfare — an die aktive Animation gekoppelt (launchWinFx in
// app.js) und mit deren Stufe (0–4) grandioser: Basis-Fanfare + je Stufe mehr
// Glanz/Bass/Aufstiegslauf. So „macht" die Siegesanimation selbst Sound (auch in
// der Shop-Vorschau), passend zum Spektakel. Rein prozedural (keine Audiodateien).
export function sfxWinFx(tier = 0) {
  if (!sfxReady()) return;
  // Basis: warme G-Dur → C-Dur-Fanfare (wie sfxWin).
  [-5, -1, 2].forEach((s, i) => sfxVoice(midi(s), 0, 0.5, i ? 0.2 : 0.26, { lp: 1700, attack: 0.01, partial2: 0.1 }));
  [0, 4, 7, 12].forEach((s, i) => sfxVoice(midi(s), 0.32, 1.4, i ? 0.24 : 0.3, { lp: 2600, attack: 0.01, partial2: 0.18 }));
  if (tier >= 2) {
    // Glitzer-Arpeggio aufwärts (C5-E5-G5-C6).
    [12, 16, 19, 24].forEach((s, i) => sfxVoice(midi(s), 0.6 + i * 0.11, 0.5, 0.2, { lp: 3200, attack: 0.005, partial2: 0.2 }));
  }
  if (tier >= 3) {
    // Tiefer Power-Bass + weiches Beckenrauschen für den großen Auftritt.
    sfxVoice(midi(-12), 0.3, 1.8, 0.4, { lp: 500, attack: 0.02 });
    sfxNoise(0.3, 0.5, 0.14, 9000);
  }
  if (tier >= 4) {
    // Legendär: zweiter, höherer Aufstiegslauf + finaler Glockenschlag.
    [19, 24, 28, 31].forEach((s, i) => sfxVoice(midi(s), 1.1 + i * 0.1, 0.6, 0.18, { lp: 4000, attack: 0.004, partial2: 0.25 }));
    sfxVoice(midi(36), 1.7, 1.6, 0.2, { lp: 5000, attack: 0.006, partial2: 0.3 });
  }
}
// Verloren — sanfter, dunkler Moll-Fall G4 -> Eb4 -> C4 (traurig/dramatisch).
export function sfxLose() {
  if (!sfxReady()) return;
  sfxVoice(midi(7), 0, 0.45, 0.42, { lp: 1500, attack: 0.012, partial2: 0.1 });
  sfxVoice(midi(3), 0.22, 0.45, 0.42, { lp: 1500, attack: 0.012, partial2: 0.1 });
  sfxVoice(midi(0), 0.44, 1.8, 0.5, { lp: 1400, attack: 0.012, partial2: 0.1 });
}

export function isPlaying() { return running; }

export function setVolume(v) {
  curVolume = Math.max(0, Math.min(1, v));
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(curVolume, ctx.currentTime + 0.3);
  }
}

export async function play(volume) {
  if (typeof volume === 'number') curVolume = Math.max(0, Math.min(1, volume));
  // iOS-Knackpunkt: Ein AudioContext, der AUSSERHALB einer Nutzergeste erzeugt
  // wurde (z.B. der eager-Versuch beim Laden), bleibt auf iOS/Safari dauerhaft
  // 'suspended' und lässt sich auch im ersten Tap NICHT mehr per resume()
  // starten. Treffen wir hier — typischerweise aus einem Tap-/Tasten-Pfad — auf
  // genau so einen hängenden Kontext, verwerfen wir ihn und bauen SYNCHRON (noch
  // innerhalb der Geste) einen frischen auf; der lässt sich dann zuverlässig
  // starten. Ein bereits laufender ('running') Kontext bleibt unangetastet.
  if (ctx && ctx.state === 'suspended') {
    if (padTimer) { clearTimeout(padTimer); padTimer = null; }
    if (melodyTimer) { clearTimeout(melodyTimer); melodyTimer = null; }
    const stuck = ctx;
    ctx = null; master = null; reverb = null; analyser = null; sfxBus = null; sfxReverb = null; droneVoices = []; running = false;
    try { stuck.close(); } catch {}
  }
  ensureContext();
  try { if (ctx.state === 'suspended') await ctx.resume(); } catch {}
  if (running) { setVolume(curVolume); return; }
  running = true; chordIdx = 0;
  master.gain.value = 0.0001;
  master.gain.linearRampToValueAtTime(curVolume, ctx.currentTime + 1.8); // sanft einblenden
  reverb = buildReverb(); reverb.connect(master);
  startDrone();
  padLoop();
  melodyTimer = setTimeout(melodyLoop, 1200); // Leitmotiv-Chance kurz nach Start
}

export function stop() {
  if (!running) return;
  running = false;
  if (padTimer) { clearTimeout(padTimer); padTimer = null; }
  if (melodyTimer) { clearTimeout(melodyTimer); melodyTimer = null; }
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8); // sanft ausblenden
  }
  const stopAt = ctx ? ctx.currentTime + 0.9 : 0;
  droneVoices.forEach(v => { try { v.stop(stopAt); } catch {} });
  droneVoices = [];
}

// App geht in den Hintergrund: AudioContext KOMPLETT schließen (nicht nur
// suspendieren). ctx.close() gibt die Audio-Hardware vollständig frei, sodass das
// OS nichts mehr abrupt unterbrechen/glitchen kann (der schrille "Arcade"-Ton
// kam genau von so einer System-Unterbrechung). Vorher hart stummschalten, damit
// das Schließen selbst nicht knackt. `running` bleibt erhalten -> updateMusic()
// baut beim Zurückkehren einen frischen Kontext auf.
export function suspendForBackground() {
  if (padTimer) { clearTimeout(padTimer); padTimer = null; }
  if (melodyTimer) { clearTimeout(melodyTimer); melodyTimer = null; }
  if (!ctx) return;
  // 1) Stummschalten ...
  try { if (master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.value = 0; } } catch {}
  // 2) ... und den Ausgang SOFORT hart von der Destination trennen. Ab hier kann
  //    kein Sample mehr zur Audio-Hardware, egal was das OS beim Suspend/Close
  //    noch tut (der kurze schrille Ton kam von genau so einer System-
  //    Unterbrechung, die nachgepufferte Samples wiedergab).
  try { if (analyser) analyser.disconnect(); } catch {}
  try { if (master) master.disconnect(); } catch {}
  // 3) Noch laufende Oszillatoren (Drone) sofort stoppen -> nichts klingt nach.
  try { droneVoices.forEach(v => { try { v.stop(); } catch {} }); } catch {}
  const dead = ctx;
  ctx = null; master = null; reverb = null; analyser = null; sfxBus = null; sfxReverb = null; droneVoices = [];
  running = false; // Graph ist weg -> play() baut alles neu auf
  try { dead.close(); } catch {}
}

// Aktueller RMS-Pegel am Master (0..~1) — für Tests/Verifikation.
export function level() {
  if (!analyser) return 0;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}
