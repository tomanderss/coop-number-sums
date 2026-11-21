// Tests für js/wineffects.js — Katalog-Integrität + Besitz-/Auflösungslogik.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WIN_EFFECTS, CONFETTI_ID, TIER_PRICES,
  effectById, effectPrice, winEffectInvKey, ownsEffect, resolveActiveEffect,
} from '../../js/wineffects.js';
import { hasIcon } from '../../js/icons.js';
import { readFileSync } from 'node:fs';

describe('wineffects.catalog', () => {
  test('contains confetti plus the purchasable effects (27 classic + Mythic/Divine)', () => {
    assert.equal(WIN_EFFECTS.length, 48);
    assert.equal(WIN_EFFECTS.filter((e) => e.tier >= 5).length, 20);
    assert.equal(WIN_EFFECTS.filter((e) => e.tier === 0).length, 1);
    assert.equal(WIN_EFFECTS.filter((e) => e.tier === 4).length, 5);
    assert.equal(WIN_EFFECTS[0].id, CONFETTI_ID);
  });

  test('ids are unique and every entry has an icon and a valid tier', () => {
    const ids = new Set();
    for (const e of WIN_EFFECTS) {
      assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
      ids.add(e.id);
      assert.ok(e.icon && e.icon.length > 0, `missing icon for ${e.id}`);
      assert.ok(hasIcon(e.icon), `icon '${e.icon}' for ${e.id} must be a drawn custom glyph (no emoji)`);
      assert.ok(e.tier in TIER_PRICES, `invalid tier for ${e.id}`);
    }
  });

  test('price tiers are 0/400/600/900/1500 + Mythic 2500 / Divine 4000', () => {
    assert.deepEqual(TIER_PRICES, { 0: 0, 1: 400, 2: 600, 3: 900, 4: 1500, 5: 2500, 6: 4000 });
    assert.equal(effectPrice('aurora'), 2500);
    assert.equal(effectPrice('supernova'), 4000);
    assert.equal(effectPrice('confetti'), 0);
    assert.equal(effectPrice('stars'), 400);
    assert.equal(effectPrice('fireworks'), 600);
    assert.equal(effectPrice('blackhole'), 900);
    assert.equal(effectPrice('meteor'), 1500);
    assert.equal(effectPrice('synthgrid'), 1500);
    assert.equal(effectPrice('nonexistent'), 0);
  });

  test('every locale has a shop.effect name for every effect', async () => {
    const { default: de } = await import('../../js/i18n/de.js');
    for (const lang of ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pt-BR', 'ru', 'tr']) {
      const { default: m } = await import(`../../js/i18n/${lang}.js`);
      for (const e of WIN_EFFECTS) assert.ok(m.shop.effect[e.id], `missing ${lang} name for ${e.id}`);
    }
  });
});

describe('wineffects.ownership', () => {
  test('confetti is always owned, even with an empty inventory', () => {
    assert.equal(ownsEffect(null, CONFETTI_ID), true);
    assert.equal(ownsEffect({}, CONFETTI_ID), true);
  });

  test('purchasable effects require the namespaced inventory entry', () => {
    assert.equal(ownsEffect({}, 'stars'), false);
    assert.equal(ownsEffect({ [winEffectInvKey('stars')]: { acquiredAt: 1 } }, 'stars'), true);
    // Ein NICHT-namespaced Eintrag zählt nicht (Kollisionen mit anderen Item-Arten).
    assert.equal(ownsEffect({ stars: { acquiredAt: 1 } }, 'stars'), false);
  });

  test('winEffectInvKey namespaces with winfx_ prefix', () => {
    assert.equal(winEffectInvKey('dragon'), 'winfx_dragon');
  });
});

describe('wineffects.resolveActiveEffect', () => {
  const inv = { [winEffectInvKey('dragon')]: { acquiredAt: 1 } };

  test('returns the chosen effect when known and owned', () => {
    assert.equal(resolveActiveEffect('dragon', inv), 'dragon');
  });

  test('falls back to confetti when the chosen effect is not owned', () => {
    assert.equal(resolveActiveEffect('blackhole', inv), CONFETTI_ID);
  });

  test('falls back to confetti for unknown ids and empty settings', () => {
    assert.equal(resolveActiveEffect('doesNotExist', inv), CONFETTI_ID);
    assert.equal(resolveActiveEffect(null, inv), CONFETTI_ID);
    assert.equal(resolveActiveEffect(undefined, null), CONFETTI_ID);
  });

  test('effectById resolves entries and returns null for unknown ids', () => {
    assert.equal(effectById('unicorn').tier, 3);
    assert.equal(effectById('nope'), null);
  });
});

describe('wineffects.css', () => {
  // Ein doppelter @keyframes-Name überschreibt still den früheren — so hatten
  // neue Animationen schon einmal Galaxie, Kirschblüten, Rakete und Disco zerlegt.
  test('every @keyframes name in styles.css is unique', () => {
    const css = readFileSync(new URL('../../css/styles.css', import.meta.url), 'utf8');
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(dup, []);
  });
  test('every purchasable effect has its own overlay styles', () => {
    const css = readFileSync(new URL('../../css/styles.css', import.meta.url), 'utf8');
    for (const e of WIN_EFFECTS) assert.ok(css.includes('.fx-' + e.id), e.id);
  });
});
