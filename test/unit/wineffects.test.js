// Tests für js/wineffects.js — Katalog-Integrität + Besitz-/Auflösungslogik.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WIN_EFFECTS, CONFETTI_ID, TIER_PRICES,
  effectById, effectPrice, winEffectInvKey, ownsEffect, resolveActiveEffect,
} from '../../js/wineffects.js';

describe('wineffects.catalog', () => {
  test('contains confetti plus the 22 purchasable effects', () => {
    assert.equal(WIN_EFFECTS.length, 23);
    assert.equal(WIN_EFFECTS.filter((e) => e.tier === 0).length, 1);
    assert.equal(WIN_EFFECTS[0].id, CONFETTI_ID);
  });

  test('ids are unique and every entry has an icon and a valid tier', () => {
    const ids = new Set();
    for (const e of WIN_EFFECTS) {
      assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
      ids.add(e.id);
      assert.ok(e.icon && e.icon.length > 0, `missing icon for ${e.id}`);
      assert.ok(e.tier in TIER_PRICES, `invalid tier for ${e.id}`);
    }
  });

  test('price tiers are 0/400/600/900 as approved', () => {
    assert.deepEqual(TIER_PRICES, { 0: 0, 1: 400, 2: 600, 3: 900 });
    assert.equal(effectPrice('confetti'), 0);
    assert.equal(effectPrice('stars'), 400);
    assert.equal(effectPrice('fireworks'), 600);
    assert.equal(effectPrice('blackhole'), 900);
    assert.equal(effectPrice('nonexistent'), 0);
  });

  test('every locale has a shop.effect name for every effect', async () => {
    const { default: de } = await import('../../js/i18n/de.js');
    for (const e of WIN_EFFECTS) assert.ok(de.shop.effect[e.id], `missing de name for ${e.id}`);
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
