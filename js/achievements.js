// achievements.js — Definitionen + reine Auswertungsfunktion für Achievements/
// Badges. evaluate() bekommt nach jeder abgeschlossenen Partie einen
// Kontext-Snapshot und liefert die NEU freigeschalteten ids (Vergleich gegen
// die bereits freigeschalteten ids) — keine eigene Persistenz hier, das
// übernimmt storage.js (KEYS.ACHIEVEMENTS).
export const ACHIEVEMENTS = [
  { id: 'firstWin', icon: '🥇', check: (ctx) => ctx.outcome === 'won' },
  { id: 'tenWins', icon: '🎖️', check: (ctx) => ctx.totalWon >= 10 },
  { id: 'fiftyWins', icon: '🏅', check: (ctx) => ctx.totalWon >= 50 },
  { id: 'hundredWins', icon: '💯', check: (ctx) => ctx.totalWon >= 100 },
  { id: 'perfectWin', icon: '✨', check: (ctx) => ctx.outcome === 'won' && ctx.perfect },
  { id: 'perfectTen', icon: '💎', check: (ctx) => ctx.outcome === 'won' && ctx.perfectWins >= 10 },
  { id: 'cleanSolve', icon: '🧹', check: (ctx) => ctx.outcome === 'won' && ctx.mistakes === 0 },
  { id: 'selfMade', icon: '🧠', check: (ctx) => ctx.outcome === 'won' && ctx.hintsUsedGame === 0 },
  { id: 'hardestWin', icon: '💀', check: (ctx) => ctx.outcome === 'won' && ctx.difficulty === 'mashallah' },
  { id: 'allDifficulties', icon: '🌈', check: (ctx) => ctx.outcome === 'won' && ctx.wonAllDifficulties },
  { id: 'speedrun', icon: '⚡', check: (ctx) => ctx.outcome === 'won' && ctx.timeMs != null && ctx.timeMs < 60000 },
  { id: 'streak5', icon: '🔥', check: (ctx) => ctx.currentStreak >= 5 },
  { id: 'streak10', icon: '🔥', check: (ctx) => ctx.currentStreak >= 10 },
  { id: 'streak20', icon: '🔥', check: (ctx) => ctx.currentStreak >= 20 },
  { id: 'dailyWeek', icon: '📅', check: (ctx) => ctx.streak >= 7 },
  { id: 'dailyMonth', icon: '📆', check: (ctx) => ctx.streak >= 30 },
  { id: 'streakLegend', icon: '🌟', check: (ctx) => ctx.streak >= 100 },
  { id: 'coopFirstWin', icon: '👥', check: (ctx) => ctx.outcome === 'won' && ctx.coop },
  { id: 'coopTenWins', icon: '🤝', check: (ctx) => ctx.outcome === 'won' && ctx.coop && ctx.coopWon >= 10 },
  { id: 'raceFirstWin', icon: '🏁', check: (ctx) => ctx.outcome === 'won' && ctx.isRace },
  { id: 'raceTenWins', icon: '🏎️', check: (ctx) => ctx.outcome === 'won' && ctx.isRace && ctx.raceWon1v1 >= 10 },
  { id: 'teamFirstWin', icon: '🛡️', check: (ctx) => ctx.outcome === 'won' && ctx.isTeam },
  { id: 'teamTenWins', icon: '⚔️', check: (ctx) => ctx.outcome === 'won' && ctx.isTeam && ctx.raceWon2v2 >= 10 },
  { id: 'nightOwl', icon: '🦉', check: (ctx) => ctx.outcome === 'won' && ctx.hour >= 0 && ctx.hour < 5 },
  { id: 'earlyBird', icon: '🐦', check: (ctx) => ctx.outcome === 'won' && ctx.hour >= 5 && ctx.hour < 7 },
  { id: 'marathoner', icon: '🏃', check: (ctx) => ctx.totalPlayed >= 100 },
  { id: 'veteran', icon: '🏆', check: (ctx) => ctx.totalPlayed >= 500 },
  { id: 'historyFull', icon: '🕘', check: (ctx) => ctx.historyLength >= 20 },
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
