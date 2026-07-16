// missions.js — reine Logik für die WOCHEN-MISSIONEN (Aufträge).
//
// Missionen sind rotierende Wochen-Ziele (ähnlich Achievements, aber mit
// FORTSCHRITT + einlösbarer Münz-Belohnung, die sich JEDE Woche neu setzt). Aus
// einem festen Pool werden je Woche deterministisch einige ausgewählt; der
// Fortschritt zählt Ereignisse (abgeschlossene Partien) und setzt sich beim
// Wochenwechsel zurück. Wer alle Wochen-Missionen schafft, bekommt zusätzlich ein
// Abzeichen (Achievement, in app.js).
//
// Hier NUR reine, DOM-/zustandsfreie Logik (unit-getestet). Persistenz in
// storage.js (cns_missions), Wiring/Screen in app.js.

// Eine Woche = 7 Tage. weekKey = fortlaufender Wochenindex (Montag-verankert:
// 1970-01-01 war ein Donnerstag → +4 Tage verschiebt den Wochenstart auf Montag).
export function currentWeekKey(now = Date.now()) {
  return Math.floor((Math.floor(now / 86400000) + 4) / 7);
}

// Mission-Pool. inc(ctx) liefert den Fortschritts-Zuwachs für EINE abgeschlossene
// Partie (ctx-Felder s. app.js recordMissionEvent). target = Ziel, reward = Münzen
// beim Einlösen, icon = gezeichnetes Icon (hasIcon-geprüft).
export const MISSION_POOL = [
  { id: 'winAny5',  icon: 'medal',    target: 5, reward: 300, inc: c => c.won ? 1 : 0 },
  { id: 'perfect3', icon: 'sparkles', target: 3, reward: 350, inc: c => c.won && c.perfect ? 1 : 0 },
  { id: 'coopWin3', icon: 'users',    target: 3, reward: 350, inc: c => c.won && c.coop ? 1 : 0 },
  { id: 'raceWin2', icon: 'versus',   target: 2, reward: 350, inc: c => c.won && c.race ? 1 : 0 },
  { id: 'hardWin1', icon: 'skull',    target: 1, reward: 300, inc: c => c.won && (c.diffIndex || 0) >= 3 ? 1 : 0 },
  { id: 'bigWin2',  icon: 'digits',   target: 2, reward: 300, inc: c => c.won && c.bigNumbers ? 1 : 0 },
  { id: 'play8',    icon: 'runner',   target: 8, reward: 250, inc: c => c.played ? 1 : 0 },
  { id: 'ripWin1',  icon: 'grave',    target: 1, reward: 500, inc: c => c.won && c.difficulty === 'rip' ? 1 : 0 },
  { id: 'endless3', icon: 'meteor',   target: 1, reward: 350, inc: c => (c.endlessScore || 0) >= 3 ? 1 : 0 },
  { id: 'streak3',  icon: 'flame',    target: 1, reward: 250, inc: c => (c.streak || 0) >= 3 ? 1 : 0 },
];
const BY_ID = Object.fromEntries(MISSION_POOL.map(m => [m.id, m]));
export function missionById(id) { return BY_ID[id] || null; }

// Deterministische Auswahl von `count` Missionen für eine Woche (stabil pro
// weekKey, keine Wiederholung; einfache Hash-Sortierung).
function hash(n) { const x = Math.sin(n) * 10000; return x - Math.floor(x); }
export function weeklyMissions(weekKey, count = 4, pool = MISSION_POOL) {
  const scored = pool.map((m, i) => ({ m, h: hash(weekKey * 1009 + i * 31 + 7) }));
  scored.sort((a, b) => a.h - b.h || a.m.id.localeCompare(b.m.id));
  return scored.slice(0, Math.min(count, pool.length)).map(s => s.m);
}

// Missions-Speicherstand für die AKTUELLE Woche liefern: passt der gespeicherte
// weekKey nicht, wird frisch begonnen (Fortschritt/Eingelöst zurückgesetzt). Rein.
export function missionStateFor(stored, weekKey) {
  if (stored && stored.weekKey === weekKey && stored.progress && stored.claimed) {
    return { weekKey, progress: { ...stored.progress }, claimed: { ...stored.claimed } };
  }
  return { weekKey, progress: {}, claimed: {} };
}

// Fortschritt (auf target gedeckelt) / Zustand einer Mission.
export function missionValue(m, progress) { return Math.min(m.target, (progress && progress[m.id]) || 0); }
export function isMissionComplete(m, progress) { return ((progress && progress[m.id]) || 0) >= m.target; }
export function isMissionClaimed(m, claimed) { return !!(claimed && claimed[m.id]); }
export function isMissionClaimable(m, progress, claimed) { return isMissionComplete(m, progress) && !isMissionClaimed(m, claimed); }
export function allMissionsComplete(missions, progress) {
  return missions.length > 0 && missions.every(m => isMissionComplete(m, progress));
}
export function claimableCount(missions, progress, claimed) {
  return missions.filter(m => isMissionClaimable(m, progress, claimed)).length;
}

// Einen Fortschritts-Zuwachs aus einer abgeschlossenen Partie anwenden (rein):
// neuer progress mit gedeckelten Zählern; nur betroffene Missionen ändern sich.
export function applyMissionEvent(missions, progress, ctx) {
  const out = { ...(progress || {}) };
  for (const m of missions) {
    const add = m.inc(ctx) || 0;
    if (add > 0) out[m.id] = Math.min(m.target, (out[m.id] || 0) + add);
  }
  return out;
}
