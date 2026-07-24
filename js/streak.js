// streak.js — Hilfsfunktionen für die tägliche Spiel-Streak (jedes abgeschlossene
// Solo-/Coop-/Race-/Endlos-Spiel an einem Kalendertag zählt, siehe storage.js).
export function todayDateStr(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Strikt gültiges Streak-Datum? (exakt YYYY-MM-DD und real parsebar)
export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}

// Datum um N Tage verschieben (Mittag als Anker → DST-sicher).
export function shiftDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayDateStr(d);
}

// Heilt ein VERGIFTETES „zuletzt gespielt"-Datum (Selbstheilung der Streak-Kette):
// Der Admin-Daten-Editor erlaubt freie Eingaben — ein einmal falsch formatiertes
// (z.B. deutsches „24.07.2026") oder in der Zukunft liegendes Datum ließ
// loadStreak() die Serie bei JEDEM Start als gerissen werten, recordStreakResult
// startete täglich neu bei 1, und der Cloud-Merge stellte per max() den alten
// Zähler samt Gift-Datum wieder her — die Streak klemmte für immer („verlängert
// sich nicht mehr, ich muss sie manuell setzen"). Regel: ungültig ODER in der
// Zukunft → auf GESTERN klemmen (Serie bleibt am Leben, das heutige Spiel zählt
// sofort wieder +1); leer bleibt leer; gültige Vergangenheit bleibt unverändert.
export function sanitizeLastCompleted(dateStr, today = todayDateStr()) {
  if (!dateStr) return null;
  if (!isValidDateStr(dateStr) || dateStr > today) return shiftDateStr(today, -1);
  return dateStr;
}
