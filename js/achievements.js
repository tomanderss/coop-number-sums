// achievements.js — Definitionen + reine Auswertungsfunktion für Achievements/
// Badges. evaluate() bekommt nach jeder abgeschlossenen Partie einen
// Kontext-Snapshot und liefert die NEU freigeschalteten ids (Vergleich gegen
// die bereits freigeschalteten ids) — keine eigene Persistenz hier, das
// übernimmt storage.js (KEYS.ACHIEVEMENTS).
export const ACHIEVEMENTS = [
  { id: 'firstWin', icon: '🥇', check: (ctx) => ctx.outcome === 'won' },
  { id: 'tenWins', icon: '🎖️', check: (ctx) => ctx.totalWon >= 10 },
  { id: 'fiftyWins', icon: '🏅', check: (ctx) => ctx.totalWon >= 50 },
  { id: 'perfectWin', icon: '✨', check: (ctx) => ctx.outcome === 'won' && ctx.perfect },
  { id: 'hardestWin', icon: '💀', check: (ctx) => ctx.outcome === 'won' && ctx.difficulty === 'mashallah' },
  { id: 'allDifficulties', icon: '🌈', check: (ctx) => ctx.outcome === 'won' && ctx.wonAllDifficulties },
  { id: 'streak5', icon: '🔥', check: (ctx) => ctx.currentStreak >= 5 },
  { id: 'streak10', icon: '🔥', check: (ctx) => ctx.currentStreak >= 10 },
  { id: 'dailyWeek', icon: '📅', check: (ctx) => ctx.dailyStreak >= 7 },
  { id: 'dailyMonth', icon: '📆', check: (ctx) => ctx.dailyStreak >= 30 },
  { id: 'bossFirstWin', icon: '👹', check: (ctx) => ctx.bossWin },
  { id: 'bossStreak3', icon: '👑', check: (ctx) => ctx.bossStreak >= 3 },
  { id: 'coopFirstWin', icon: '👥', check: (ctx) => ctx.outcome === 'won' && ctx.coop },
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
