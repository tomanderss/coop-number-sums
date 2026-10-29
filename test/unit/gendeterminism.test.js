import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../../js/games/index.js';

// Wettkampf, Team und Mix-Duell verschicken KEIN Rätsel, sondern nur den Seed —
// jedes Gerät erzeugt selbst. Das geht nur, wenn ein Generator aus demselben
// Seed IMMER dasselbe Rätsel baut, egal wie schnell das Gerät ist. Ein Zeitlimit
// im Generator brach das (in der CI aufgefallen: ein langsamer Rechner bekam ein
// anderes Rätsel). Hier läuft die Uhr absichtlich rasend schnell.
describe('Generatoren sind unabhängig von der Gerätegeschwindigkeit', () => {
  for (const g of GAMES) {
    test(g.id, () => {
      const top = g.DIFFICULTIES[g.DIFFICULTIES.length - 1].id;
      for (const difficulty of [g.DIFFICULTIES[0].id, top]) {
        const strip = (p) => { const { genMs, ...rest } = p; return JSON.stringify(rest); };
        const normal = strip(g.generatePuzzle({ difficulty, seed: 4242 }));
        const realNow = Date.now;
        let fake = realNow();
        Date.now = () => (fake += 60000);   // jede Abfrage: eine Minute später
        let slow;
        try { slow = strip(g.generatePuzzle({ difficulty, seed: 4242 })); } finally { Date.now = realNow; }
        assert.equal(slow, normal, `${g.id}/${difficulty}: langsames Gerät bekäme ein anderes Rätsel`);
      }
    });
  }
});
