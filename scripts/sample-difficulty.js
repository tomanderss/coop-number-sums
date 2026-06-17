// sample-difficulty.js — Stichproben-Statistik zur Schwierigkeits-Generierung.
// Erzeugt pro Schwierigkeit N Rätsel mit festen Seeds und misst Versuchszahl,
// Tier-3-Nutzung (Hypothese/Raten) und Notnagel-Häufigkeit. Dient zum Vorher/
// Nachher-Vergleich beim Anpassen von maxCageSize/maxTier3Steps/genBudget.
//
// Aufruf: node scripts/sample-difficulty.js [N] [--diff <id>]

import { generatePuzzle } from '../js/generator.js';
import { DIFFICULTIES } from '../js/config.js';

const args = process.argv.slice(2);
const diffFilterIdx = args.indexOf('--diff');
const diffFilter = diffFilterIdx !== -1 ? args[diffFilterIdx + 1] : null;
const N = parseInt(args.find(a => /^\d+$/.test(a)) || '200', 10);

const diffs = diffFilter ? DIFFICULTIES.filter(d => d.id === diffFilter) : DIFFICULTIES;

for (const diff of diffs) {
  const stats = {
    count: 0, anyT3: 0, totalT3Steps: 0, totalAttempts: 0,
    maxAttempts: 0, fallback: 0, totalTimeMs: 0,
  };
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const puzzle = generatePuzzle({ difficulty: diff.id, seed: 1000 + i });
    stats.totalTimeMs += Date.now() - t0;
    stats.count++;
    stats.totalAttempts += puzzle.attempts || 0;
    stats.maxAttempts = Math.max(stats.maxAttempts, puzzle.attempts || 0);
    if (puzzle.difficulty !== diff.id) stats.fallback++;
    if (puzzle.tiers && puzzle.tiers.t3 > 0) { stats.anyT3++; stats.totalT3Steps += puzzle.tiers.t3; }
  }
  console.log(diff.id, {
    n: stats.count,
    avgAttempts: (stats.totalAttempts / stats.count).toFixed(1),
    maxAttempts: stats.maxAttempts,
    pctAnyT3: ((stats.anyT3 / stats.count) * 100).toFixed(1) + '%',
    avgT3StepsWhenUsed: stats.anyT3 ? (stats.totalT3Steps / stats.anyT3).toFixed(2) : 'n/a',
    fallbackRate: ((stats.fallback / stats.count) * 100).toFixed(1) + '%',
    avgMsPerPuzzle: (stats.totalTimeMs / stats.count).toFixed(1),
  });
}
