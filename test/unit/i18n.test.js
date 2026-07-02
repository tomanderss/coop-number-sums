import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, SUPPORTED_LOCALES } from '../../js/i18n/index.js';

// Per product decision: machine-translated content (es/fr/pt-BR/it/ja/ko/tr/ru)
// is accepted as-is and not reviewed for translation quality here. These tests
// only verify structural completeness -- every locale must expose the exact
// same dot-path keys as the German source, with non-empty string values, so
// switching locale never shows a raw key or crashes.

function collectKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') keys.push(...collectKeys(v, path));
    else keys.push(path);
  }
  return keys;
}

// admin.dict.* ist BEWUSST nur in de.js gepflegt: das Klartext-Wörterbuch des
// Admin-Daten-Editors (Feld-Labels/-Beschreibungen/Optionsnamen) sind reine
// Admin-Texte; t() fällt für fehlende Schlüssel designgemäß auf Deutsch zurück.
// Es von der Paritätsprüfung auszunehmen ist die dokumentierte Ausnahme —
// alle NUTZER-sichtbaren Texte müssen weiterhin in allen Sprachen existieren.
const DE_KEYS = collectKeys(MESSAGES.de).filter(k => !k.startsWith('admin.dict.')).sort();

describe('i18n.SUPPORTED_LOCALES', () => {
  test('every supported locale id has a matching MESSAGES entry', () => {
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(MESSAGES[locale.id], `missing MESSAGES['${locale.id}']`);
    }
  });

  test('every locale has a non-empty display label', () => {
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(typeof locale.label === 'string' && locale.label.length > 0);
    }
  });
});

describe('i18n.MESSAGES key parity', () => {
  test('de.js has a non-trivial number of keys', () => {
    assert.ok(DE_KEYS.length > 50);
  });

  for (const locale of SUPPORTED_LOCALES) {
    if (locale.id === 'de') continue;
    test(`${locale.id}.js has exactly the same keys as de.js`, () => {
      const keys = collectKeys(MESSAGES[locale.id]).sort();
      const missing = DE_KEYS.filter(k => !keys.includes(k));
      const extra = keys.filter(k => !DE_KEYS.includes(k));
      assert.deepEqual(missing, [], `${locale.id} is missing keys: ${missing.join(', ')}`);
      assert.deepEqual(extra, [], `${locale.id} has unexpected extra keys: ${extra.join(', ')}`);
    });

    test(`${locale.id}.js has only non-empty string values`, () => {
      for (const key of DE_KEYS) {
        const value = key.split('.').reduce((o, k) => o?.[k], MESSAGES[locale.id]);
        assert.equal(typeof value, 'string', `${locale.id}.${key} is not a string`);
        assert.ok(value.length > 0, `${locale.id}.${key} is empty`);
      }
    });
  }
});
