// achievements.js — Definitionen + reine Auswertungsfunktion für Achievements/
// Badges. evaluate() bekommt nach jeder abgeschlossenen Partie einen
// Kontext-Snapshot und liefert die NEU freigeschalteten ids (Vergleich gegen
// die bereits freigeschalteten ids) — keine eigene Persistenz hier, das
// übernimmt storage.js (KEYS.ACHIEVEMENTS).
export const ACHIEVEMENTS = [
  { id: 'firstWin', icon: 'medal', check: (ctx) => ctx.outcome === 'won' },
  { id: 'tenWins', icon: 'ribbon', check: (ctx) => ctx.totalWon >= 10 },
  { id: 'fiftyWins', icon: 'crown', check: (ctx) => ctx.totalWon >= 50 },
  { id: 'hundredWins', icon: 'trophy', check: (ctx) => ctx.totalWon >= 100 },
  { id: 'perfectWin', icon: 'sparkles', check: (ctx) => ctx.outcome === 'won' && ctx.perfect },
  { id: 'perfectTen', icon: 'gem', check: (ctx) => ctx.outcome === 'won' && ctx.perfectWins >= 10 },
  { id: 'cleanSolve', icon: 'broom', check: (ctx) => ctx.outcome === 'won' && ctx.mistakes === 0 },
  { id: 'selfMade', icon: 'brain', check: (ctx) => ctx.outcome === 'won' && ctx.hintsUsedGame === 0 },
  { id: 'hardestWin', icon: 'skull', check: (ctx) => ctx.outcome === 'won' && ctx.difficulty === 'mashallah' },
  { id: 'allDifficulties', icon: 'rainbow', check: (ctx) => ctx.outcome === 'won' && ctx.wonAllDifficulties },
  { id: 'speedrun', icon: 'bolt', check: (ctx) => ctx.outcome === 'won' && ctx.timeMs != null && ctx.timeMs < 60000 },
  { id: 'streak5', icon: 'flame', check: (ctx) => ctx.currentStreak >= 5 },
  { id: 'streak10', icon: 'flame', check: (ctx) => ctx.currentStreak >= 10 },
  { id: 'streak20', icon: 'flame', check: (ctx) => ctx.currentStreak >= 20 },
  { id: 'dailyWeek', icon: 'calendar', check: (ctx) => ctx.streak >= 7 },
  { id: 'dailyMonth', icon: 'calendar', check: (ctx) => ctx.streak >= 30 },
  { id: 'streakLegend', icon: 'star', check: (ctx) => ctx.streak >= 100 },
  { id: 'coopFirstWin', icon: 'users', check: (ctx) => ctx.outcome === 'won' && ctx.coop },
  { id: 'coopTenWins', icon: 'users', check: (ctx) => ctx.outcome === 'won' && ctx.coop && ctx.coopWon >= 10 },
  { id: 'raceFirstWin', icon: 'flag', check: (ctx) => ctx.outcome === 'won' && ctx.isRace },
  { id: 'raceTenWins', icon: 'versus', check: (ctx) => ctx.outcome === 'won' && ctx.isRace && ctx.raceWon1v1 >= 10 },
  { id: 'teamFirstWin', icon: 'shield', check: (ctx) => ctx.outcome === 'won' && ctx.isTeam },
  { id: 'teamTenWins', icon: 'swords', check: (ctx) => ctx.outcome === 'won' && ctx.isTeam && ctx.raceWon2v2 >= 10 },
  { id: 'nightOwl', icon: 'moon', check: (ctx) => ctx.outcome === 'won' && ctx.hour >= 0 && ctx.hour < 5 },
  { id: 'earlyBird', icon: 'sun', check: (ctx) => ctx.outcome === 'won' && ctx.hour >= 5 && ctx.hour < 7 },
  { id: 'marathoner', icon: 'runner', check: (ctx) => ctx.totalPlayed >= 100 },
  { id: 'veteran', icon: 'trophy', check: (ctx) => ctx.totalPlayed >= 500 },
  { id: 'historyFull', icon: 'clock', check: (ctx) => ctx.historyLength >= 20 },
  // Höchste Schwierigkeit (R.I.P. 14×14) — die frühere „hardestWin" deckt nur
  // Mashallah (11×11) ab; der echte Gipfel bekommt ein eigenes Abzeichen.
  { id: 'ripWin', icon: 'grave', check: (ctx) => ctx.outcome === 'won' && ctx.difficulty === 'rip' },
  // „Große Zahlen"-Modus (Zellwerte 10–19).
  { id: 'bigFirstWin', icon: 'digits', check: (ctx) => ctx.outcome === 'won' && ctx.bigNumbers },
  { id: 'bigPerfect', icon: 'digits', check: (ctx) => ctx.outcome === 'won' && ctx.bigNumbers && ctx.perfect },
  { id: 'bigRip', icon: 'digits', check: (ctx) => ctx.outcome === 'won' && ctx.bigNumbers && ctx.difficulty === 'rip' },
];

export function evaluate(ctx, unlockedIds) {
  const unlocked = new Set(unlockedIds);
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    if (a.check(ctx)) newly.push(a.id);
  }
  return newly;
}
