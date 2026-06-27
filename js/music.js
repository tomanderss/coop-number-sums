// music.js — prozedurale Zen-/Ambient-Hintergrundmusik via Web Audio API.
//
// Bewusst KEIN Audio-File: alles wird live synthetisiert (0 KB, endlos, nie
// identisch, keine Lizenz, passt zum prozeduralen Projekt-Ethos wie der
// Icon-Generator). Klangbild: ein leiser Drone (Grundton + Quinte) als Bett,
// darüber vereinzelte Töne aus einer C-Dur-Pentatonik (klingt immer harmonisch)
// mit langer weicher Hüllkurve, durch einen prozedural erzeugten Hall geweitet.
//
// Lazy-geladen von app.js (nur wenn der Nutzer Musik nutzt -> solo lädt sonst
// nichts). API: play(volume) / stop() / setVolume(v) / isPlaying() / level().
// Web Audio läuft auch auf iOS-PWA, aber nur nach einer Nutzergeste und nur,
// wenn der Stumm-Schalter des Geräts aus ist — play() wird daher aus einem
// Tap-Pfad (Spielstart) heraus aufgerufen.

let ctx = null;
let master = null;       // Master-Gain (Lautstärke)
let analyser = null;     // nur für Tests/Debug (level())
let scheduleTimer = null;
let voices = [];         // aktive Drone-Oszillatoren (zum Stoppen)
let running = false;
let curVolume = 0.5;

// C-Dur-Pentatonik (C D E G A) über mehrere Oktaven als Frequenzen.
const SEMI = [0, 2, 4, 7, 9];
const C4 = 261.6255653;
const SCALE = [];
for (let oct = -1; oct <= 2; oct++) {
  for (const s of SEMI) SCALE.push(C4 * Math.pow(2, (oct * 12 + s) / 12));
}

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

// Prozeduraler Hall: kurz abklingendes Rauschen als Impulsantwort für den
// ConvolverNode — gibt den Tönen Raum/Tiefe ohne externes IR-File.
function buildReverb(seconds = 3.2, decay = 2.6) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

// Eine weiche Pad-Stimme: Oszillator -> Hüllkurve (langer Attack/Release) ->
// (trocken + Hall) -> Master. Spielt genau einen Ton und räumt sich selbst auf.
function playTone(freq, when, dur, gainPeak, reverb) {
  const osc = ctx.createOscillator();
  osc.type = Math.random() < 0.5 ? 'sine' : 'triangle';
  osc.frequency.value = freq;
  // leichte Verstimmung für Lebendigkeit
  osc.detune.value = rand(-6, 6);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  const attack = dur * 0.4;
  g.gain.exponentialRampToValueAtTime(gainPeak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  // sanfter Tiefpass, damit nichts schrill wird
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = rand(900, 2200);

  osc.connect(lp).connect(g);
  g.connect(master);            // trockener Anteil
  g.connect(reverb);            // Hall-Anteil
  osc.start(when);
  osc.stop(when + dur + 0.1);
  osc.onended = () => { try { osc.disconnect(); g.disconnect(); lp.disconnect(); } catch {} };
}

// Kontinuierlicher Drone (Grundton + Quinte), sehr leise, mit langsamem LFO auf
// der Lautstärke für minimale Bewegung. Bleibt bis stop() bestehen.
function startDrone(reverb) {
  const root = C4 / 2; // C3
  [root, root * 1.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.06 : 0.035;

    // langsamer Lautstärke-LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(0.03, 0.08);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = i === 0 ? 0.025 : 0.015;
    lfo.connect(lfoGain).connect(g.gain);

    osc.connect(g);
    g.connect(master);
    g.connect(reverb);
    osc.start();
    lfo.start();
    voices.push(osc, lfo);
  });
}

// Lookahead-Scheduler: plant in ruhigem Abstand vereinzelte Töne (gelegentlich
// als kleiner 2-3-Ton-Akkord). Sehr langsames, meditatives Tempo.
function scheduleLoop(reverb) {
  if (!running) return;
  const now = ctx.currentTime;
  const chord = Math.random() < 0.25;
  const n = chord ? 2 + ((Math.random() * 2) | 0) : 1;
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let f = pick(SCALE);
    let guard = 0;
    while (used.has(f) && guard++ < 5) f = pick(SCALE);
    used.add(f);
    playTone(f, now + 0.05 + i * rand(0.04, 0.12), rand(3.5, 7), rand(0.05, 0.12), reverb);
  }
  scheduleTimer = setTimeout(() => scheduleLoop(reverb), rand(2600, 6200));
}

function ensureContext() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = curVolume;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  master.connect(analyser);
  analyser.connect(ctx.destination);
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
  ensureContext();
  try { if (ctx.state === 'suspended') await ctx.resume(); } catch {}
  if (running) { setVolume(curVolume); return; }
  running = true;
  master.gain.value = 0.0001;
  master.gain.linearRampToValueAtTime(curVolume, ctx.currentTime + 1.5); // sanft einblenden
  const reverb = buildReverb();
  reverb.connect(master);
  startDrone(reverb);
  scheduleLoop(reverb);
}

export function stop() {
  if (!running) return;
  running = false;
  if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null; }
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8); // sanft ausblenden
  }
  const stopAt = ctx ? ctx.currentTime + 0.9 : 0;
  voices.forEach(v => { try { v.stop(stopAt); } catch {} });
  voices = [];
}

// Aktueller RMS-Pegel am Master (0..~1) — für Tests/Verifikation, dass wirklich
// Klang erzeugt wird.
export function level() {
  if (!analyser) return 0;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}
