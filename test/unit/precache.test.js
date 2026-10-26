import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Ein js/-Modul, das nicht in der ASSETS-Liste von sw.js steht, fehlt OFFLINE:
// der Service-Worker legt es beim Precache nie an, und ein Kaltstart ohne Netz
// bricht am fehlenden Import ab. Genau so war `session.js` einmal durchgerutscht
// (in Coop Math Cross war es `board.js`). Die Regel steht in CLAUDE.md — ab hier
// haelt sie ein Test fest, nicht nur die Doku.
//
// Der Test laeuft REKURSIV, weil die Spielmodule in `js/games/<id>/` liegen:
// genau beim Verschieben dorthin waere eine haendisch gepflegte Liste still
// falsch geworden.
const swText = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const assetBlock = swText.slice(swText.indexOf('ASSETS'), swText.indexOf('\n];', swText.indexOf('ASSETS')));

/** Alle .js-Dateien unter js/ als App-relative Pfade ('./js/...'). */
function collectModules(relDir = 'js') {
  const out = [];
  for (const entry of readdirSync(new URL(`../../${relDir}/`, import.meta.url), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // js/vendor/ ist separat gelistet (Firebase-Bundles, kein eigenes Modul
      // der App) und wird hier bewusst nicht mitgezaehlt.
      if (relDir === 'js' && entry.name === 'vendor') continue;
      out.push(...collectModules(`${relDir}/${entry.name}`));
    } else if (entry.name.endsWith('.js')) {
      out.push(`./${relDir}/${entry.name}`);
    }
  }
  return out;
}

describe('sw.js Precache-Liste', () => {
  test('jedes js/-Modul steht in der ASSETS-Liste (sonst offline nicht ladbar)', () => {
    const module = collectModules();
    assert.ok(module.length > 20, 'die Modul-Suche muss ueberhaupt etwas finden');
    for (const pfad of module) {
      assert.ok(assetBlock.includes(`'${pfad}'`), `${pfad} fehlt in der ASSETS-Liste von sw.js (offline nicht ladbar)`);
    }
  });

  test('die ASSETS-Liste verweist auf kein verschwundenes js/-Modul', () => {
    // Die Gegenrichtung: ein Pfad, den es nicht mehr gibt, laesst den Precache
    // fuer diese Datei fehlschlagen. Das sperrt dank `Promise.allSettled` zwar
    // niemanden aus, haelt aber eine Luege in der Liste.
    const vorhanden = new Set(collectModules());
    for (const treffer of assetBlock.matchAll(/'(\.\/js\/[^']+\.js)'/g)) {
      const pfad = treffer[1];
      if (pfad.startsWith('./js/vendor/')) continue;
      assert.ok(vorhanden.has(pfad), `${pfad} steht in sw.js, existiert aber nicht mehr`);
    }
  });
});
