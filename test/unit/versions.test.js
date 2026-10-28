import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cmpVersion, canonicalVersion, majorOf, majorCelebrationFor, MAJORS, RENUMBERED } from '../../js/versions.js';
import { BUILD, CHANGELOG } from '../../js/buildinfo.js';
import { MESSAGES } from '../../js/i18n/index.js';
import { hasIcon } from '../../js/icons.js';
import { GAME_IDS } from '../../js/games/registry.js';

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

describe('versions: Vergleich und Umnummerierung', () => {
  test('cmpVersion vergleicht teilstückweise numerisch', () => {
    assert.ok(cmpVersion('2.0', '1.240') > 0);
    assert.ok(cmpVersion('1.9', '1.10') < 0);
    assert.equal(cmpVersion('2.3', '2.3'), 0);
  });
  test('1.224 bis 1.240 heißen heute 2.0 bis 2.16, alles andere bleibt', () => {
    assert.equal(canonicalVersion('1.224'), '2.0');
    assert.equal(canonicalVersion('1.230'), '2.6');
    assert.equal(canonicalVersion('1.240'), '2.16');
    assert.equal(canonicalVersion('1.223'), '1.223');
    assert.equal(canonicalVersion('0.166'), '0.166');
    assert.equal(canonicalVersion('2.17'), '2.17');
    assert.equal(canonicalVersion(null), null);
  });
  test('Hauptversions-Feier: nur beim Sprung über die Hauptzahl, nie bei Neuinstallation', () => {
    assert.equal(majorCelebrationFor('1.240', '2.17'), 2);   // umnummeriert, aber 2.0 nie als solche gesehen
    assert.equal(majorCelebrationFor('1.100', '2.17'), 2);
    assert.equal(majorCelebrationFor('2.16', '2.17'), null);
    assert.equal(majorCelebrationFor(null, '2.17'), null);
    assert.equal(majorCelebrationFor('', '2.17'), null);
    assert.equal(majorCelebrationFor('0.150', '1.5'), null); // 1.0 hatte eine eigene Feier (Skin), kein MAJORS-Eintrag
  });
});

describe('versions: Verlauf und Hauptversionen stimmen zusammen', () => {
  test('BUILD ist der neueste Verlaufseintrag und steht in .release-counter', () => {
    assert.equal(CHANGELOG[0].version, BUILD);
    const counter = readFileSync(new URL('../../.release-counter', import.meta.url), 'utf8').trim();
    assert.equal(counter, BUILD);
  });
  test('Verlauf: eindeutig, absteigend, umbenannte Einträge tragen ihre alte Nummer', () => {
    const seen = new Set();
    for (let i = 0; i < CHANGELOG.length; i++) {
      const e = CHANGELOG[i];
      assert.ok(!seen.has(e.version), 'doppelt: ' + e.version);
      seen.add(e.version);
      if (i) assert.ok(cmpVersion(CHANGELOG[i - 1].version, e.version) > 0, `${CHANGELOG[i - 1].version} vor ${e.version}`);
      if (e.formerly) assert.equal(canonicalVersion(e.formerly), e.version);
    }
    for (const r of RENUMBERED) {
      for (let mi = r.from; mi <= r.to; mi++) assert.ok(!seen.has(`${r.major}.${mi}`), `alte Nummer ${r.major}.${mi} steht noch im Verlauf`);
      assert.ok(seen.has(`${r.newMajor}.0`), `${r.newMajor}.0 fehlt im Verlauf`);
    }
  });
  test('die laufende Hauptversion hat eine Feier (ab 2)', () => {
    const m = majorOf(BUILD);
    if (m >= 2) assert.ok(MAJORS[m], `MAJORS[${m}] fehlt — bei node build.js --major einen Eintrag samt Texten major.v${m}.* anlegen`);
  });
  test('jede Feier: Texte in allen Sprachen, bekannte Icons und Spiele', () => {
    for (const [m, info] of Object.entries(MAJORS)) {
      for (const g of info.games) assert.ok(GAME_IDS.includes(g), 'unbekanntes Spiel ' + g);
      for (const h of info.highlights) assert.ok(hasIcon(h.icon), 'Icon fehlt: ' + h.icon);
      const keys = ['major.kicker', 'major.title', 'major.cta', `major.v${m}.sub`, ...info.highlights.map((h) => h.key)];
      for (const [loc, msgs] of Object.entries(MESSAGES)) {
        for (const k of keys) assert.equal(typeof get(msgs, k), 'string', `${loc}: ${k}`);
      }
    }
  });
});
