// streak.js — Hilfsfunktion für die tägliche Spiel-Streak (jedes abgeschlossene
// Solo-/Coop-/Race-Spiel an einem Kalendertag zählt, siehe storage.js).
export function todayDateStr(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
