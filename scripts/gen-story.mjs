// scripts/gen-story.mjs — die festen Story-Level erzeugen (s. js/story.js).
//
//   node scripts/gen-story.mjs <spiel|mix|all> [--workers=4] [--force]
//
// Schreibt data/story/<schlüssel>/<paket>.json (je STORY_CHUNK Level). Die Level
// sind für ALLE Nutzer identisch und dürfen sich NIE ändern — vorhandene
// Pakete werden deshalb nicht überschrieben (nur mit --force, z.B. vor der
// ersten Veröffentlichung). Level n entsteht deterministisch aus
// hash("story:v1:<schlüssel>:<stufe>:<i>"). Jedes Rätsel kommt aus dem normalen
// Generator des Spiels und ist damit vom Logik-Löser vollständig OHNE Raten
// gelöst. Innerhalb einer Stufe werden die Level nach storyScore sortiert.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STORY_LEVELS, STORY_CHUNK, STORY_BANDS, MIX_KEY, storyBandRange, storyChunkPath,
  storyScore, cleanPuzzle, mixStoryGames,
} from '../js/story.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function seedFor(text) {
  let h = 0x811c9dc5;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

if (!isMainThread) {
  const { GAMES } = await import('../js/games/index.js');
  parentPort.on('message', ({ id, game, difficulty, seed }) => {
    const t0 = Date.now();
    try {
      const g = GAMES.find((x) => x.id === game);
      const p = cleanPuzzle(g.generatePuzzle({ difficulty, seed }));
      parentPort.postMessage({ id, puzzle: p, score: storyScore(game, p), ms: Date.now() - t0 });
    } catch (e) {
      parentPort.postMessage({ id, error: String(e && e.message || e) });
    }
  });
} else {
  const arg = process.argv[2];
  const workers = +(process.argv.find((a) => a.startsWith('--workers=')) || '--workers=4').split('=')[1];
  const force = process.argv.includes('--force');
  const { GAMES, GAME_IDS } = await import('../js/games/index.js');
  const keys = arg === 'all' ? [...GAME_IDS, MIX_KEY] : [arg];
  if (!arg) { console.error('node scripts/gen-story.mjs <spiel|mix|all> [--workers=4] [--force]'); process.exit(1); }

  const run = (jobs) => new Promise((resolve) => {
    const results = new Map();
    let next = 0, active = 0;
    const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => new Worker(fileURLToPath(import.meta.url)));
    const t0 = Date.now();
    const feed = (w) => { if (next < jobs.length) { active++; w.postMessage(jobs[next++]); } };
    for (const w of pool) {
      w.on('message', (m) => {
        active--;
        if (m.error) { console.error(`\n${m.id}: ${m.error}`); process.exit(1); }
        results.set(m.id, m);
        if (results.size % 50 === 0) console.log(`  ${results.size}/${jobs.length}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        if (next < jobs.length) feed(w);
        else if (active === 0) { pool.forEach((x) => x.terminate()); resolve(results); }
      });
      feed(w);
    }
  });

  for (const key of keys) {
    const dir = join(ROOT, 'data/story', key);
    if (!force && existsSync(join(ROOT, storyChunkPath(key, 0)))) { console.log(`${key}: vorhanden — übersprungen (unveränderlich; --force nur vor der Veröffentlichung)`); continue; }
    mkdirSync(dir, { recursive: true });
    console.log(`${key}: erzeuge ${STORY_LEVELS} Level …`);
    const levels = new Array(STORY_LEVELS + 1);
    if (key === MIX_KEY) {
      const order = mixStoryGames(GAME_IDS);
      const jobs = [];
      for (let L = 1; L <= STORY_LEVELS; L++) {
        const game = order[L - 1];
        const ladder = GAMES.find((x) => x.id === game).DIFFICULTIES.map((d) => d.id);
        const bi = STORY_BANDS.findIndex((to) => L <= to);
        const difficulty = ladder[Math.min(bi, ladder.length - 1)];
        jobs.push({ id: `L${L}`, game, difficulty, seed: seedFor(`story:v1:mix:${L}`), L });
      }
      const res = await run(jobs);
      for (const j of jobs) levels[j.L] = { level: j.L, game: j.game, difficulty: j.difficulty, puzzle: res.get(j.id).puzzle };
    } else {
      const g = GAMES.find((x) => x.id === key);
      if (!g) { console.error(`unbekanntes Spiel ${key}`); continue; }
      const ladder = g.DIFFICULTIES.map((d) => d.id);
      const jobs = [];
      STORY_BANDS.forEach((_, bi) => {
        const { from, to } = storyBandRange(bi);
        const difficulty = ladder[Math.min(bi, ladder.length - 1)];
        for (let i = 0; i <= to - from; i++) jobs.push({ id: `${bi}:${i}`, game: key, difficulty, seed: seedFor(`story:v1:${key}:${difficulty}:${i}`), bi });
      });
      const res = await run(jobs);
      STORY_BANDS.forEach((_, bi) => {
        const { from } = storyBandRange(bi);
        const band = jobs.filter((j) => j.bi === bi).map((j) => ({ j, r: res.get(j.id) }));
        // Stabil nach Härte sortieren (bei Gleichstand die Erzeugungsreihenfolge).
        band.sort((a, b) => a.r.score - b.r.score || a.j.seed - b.j.seed);
        band.forEach(({ j, r }, i) => { levels[from + i] = { level: from + i, game: key, difficulty: j.difficulty, puzzle: r.puzzle }; });
      });
    }
    for (let c = 0; c * STORY_CHUNK < STORY_LEVELS; c++) {
      const from = c * STORY_CHUNK + 1, to = Math.min(STORY_LEVELS, from + STORY_CHUNK - 1);
      const file = join(ROOT, storyChunkPath(key, c));
      writeFileSync(file, JSON.stringify({ v: 1, key, from, to, levels: levels.slice(from, to + 1) }) + '\n');
    }
    console.log(`${key}: fertig`);
  }
}
