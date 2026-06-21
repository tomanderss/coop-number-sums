// boss.js — wöchentliches "Boss-Rätsel": Sudden-Death-Spezialformat mit genau
// einem Versuch pro ISO-Kalenderwoche. Rotiert deterministisch (Kalenderwoche
// → Seed + Schwierigkeit) durch die drei schwersten Stufen aus config.js, damit
// alle Spieler weltweit in derselben Woche exakt dasselbe Rätsel bekommen
// (gleicher Seed an generatePuzzle(), siehe js/generator.js) — analog zu
// js/daily.js, aber mit Wochen- statt Tagesgranularität und höherer
// Schwierigkeit. hashStr() ist bewusst dupliziert statt aus daily.js
// importiert, passend zum bestehenden Stil kleiner, unabhängiger Module.
import { DIFFICULTIES } from './config.js';

const BOSS_DIFFICULTIES = DIFFICULTIES.slice(-3).map(d => d.id); // schwer, extrem, mashallah

// ISO-8601-Kalenderwoche (Montag-Start), in lokaler Zeit wie bei daily.js
// (nicht UTC) — der Donnerstag der jeweiligen Woche bestimmt das Wochenjahr.
export function isoWeekStr(d = new Date()) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayIdx = (date.getDay() + 6) % 7; // Montag=0 .. Sonntag=6
  date.setDate(date.getDate() - dayIdx + 3); // Donnerstag dieser Woche
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayIdx = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayIdx + 3);
  const weekNum = 1 + Math.round((date - firstThursday) / (7 * 86400000));
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function getBossChallenge(weekStr = isoWeekStr()) {
  return {
    weekStr,
    seed: hashStr(`boss-seed-${weekStr}`),
    difficulty: BOSS_DIFFICULTIES[hashStr(`boss-diff-${weekStr}`) % BOSS_DIFFICULTIES.length],
  };
}
