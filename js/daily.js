// daily.js — deterministisches "Tagesrätsel": Datum → Schwierigkeit + Seed.
// Damit sehen alle Spieler weltweit am selben Kalendertag exakt dasselbe
// Rätsel (gleicher Seed an generatePuzzle(), siehe js/generator.js). Die
// Schwierigkeit ist bewusst auf die drei leichtesten Stufen begrenzt — ein
// Tagesrätsel soll ein kurzer, niedrigschwelliger Einstieg sein, kein
// Hardcore-Rätsel.
import { DIFFICULTIES } from './config.js';

const DAILY_DIFFICULTIES = DIFFICULTIES.slice(0, 3).map(d => d.id); // sehrleicht, leicht, mittel

export function todayDateStr(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Simpler, stabiler String-Hash (FNV-1a) — muss nur deterministisch sein,
// keine kryptografischen Anforderungen.
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function getDailyChallenge(dateStr = todayDateStr()) {
  return {
    dateStr,
    seed: hashStr(`seed-${dateStr}`),
    difficulty: DAILY_DIFFICULTIES[hashStr(`diff-${dateStr}`) % DAILY_DIFFICULTIES.length],
  };
}
