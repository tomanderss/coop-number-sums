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
// Web Audio läuft auch auf iOS-PWA (nach einer Nutzergeste, Stumm-Schalter aus)
// — play() wird daher aus einem Tap-Pfad (Spielstart) heraus aufgerufen.

let ctx = null, master = null, reverb = null, analyser = null;
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

// Melodie: spielt mal das feste Leitmotiv (Wiedererkennung), mal eine zufällige
// Füllung aus der Pentatonik (Variation).
function melodyLoop() {
  if (!running || document.hidden) return; // im Hintergrund nichts planen (sonst Noten-Schwall)
  const now = ctx.currentTime;
  if (Math.random() < 0.4) {
    // Leitmotiv – immer dieselben Töne, gleichmäßig phrasiert.
    MOTIF.forEach((semi, i) => bell(semi, now + 0.1 + i * 0.42, rand(2.2, 3.2), rand(0.14, 0.2)));
    melodyTimer = setTimeout(melodyLoop, rand(7000, 10000));
  } else {
    // Zufällige Füllung: 1–3 Töne, ruhig.
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) bell(pick(FILL), now + 0.1 + i * rand(0.3, 0.7), rand(2.5, 4), rand(0.12, 0.17));
    melodyTimer = setTimeout(melodyLoop, rand(3500, 6500));
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
  master.connect(makeup); makeup.connect(shaper); shaper.connect(analyser); analyser.connect(ctx.destination);
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
    ctx = null; master = null; reverb = null; analyser = null; droneVoices = []; running = false;
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
  ctx = null; master = null; reverb = null; analyser = null; droneVoices = [];
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
