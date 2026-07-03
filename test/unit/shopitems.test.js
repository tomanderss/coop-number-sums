// Tests für js/shopitems.js — Katalog-Integrität + Besitz-/Auflösungs-/Paletten-Logik.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOP_TIER_PRICES, SHOP_CATS, SHOP_CATALOG,
  shopItemById, catItems, shopItemPrice, shopInvKey, ownsShopItem, resolveEquipped, applyPaletteFx,
} from '../../js/shopitems.js';
import { REGION_COLORS } from '../../js/config.js';

describe('shopitems.catalog', () => {
  test('ids are unique, categories known, tiers priced', () => {
    const ids = new Set();
    for (const it of SHOP_CATALOG) {
      assert.ok(!ids.has(it.id), `duplicate id ${it.id}`);
      ids.add(it.id);
      assert.ok(SHOP_CATS[it.cat], `unknown cat for ${it.id}`);
      assert.ok(SHOP_TIER_PRICES[it.tier] > 0, `unpriced tier for ${it.id}`);
      assert.ok(it.icon, `missing icon for ${it.id}`);
    }
  });

  test('theme category has 8 themes with complete data (base/top/sw)', () => {
    const themes = catItems('theme');
    assert.equal(themes.length, 8);
    for (const th of themes) {
      assert.ok(['dark', 'light'].includes(th.data.base), th.id);
      assert.match(th.data.top, /^#[0-9a-f]{6}$/i, th.id);
      assert.equal(th.data.sw.length, 4, th.id);
    }
  });

  test('palette category has 8 purchasable palettes with fx params', () => {
    const pals = catItems('palette');
    assert.equal(pals.length, 8);
    for (const p of pals) assert.ok(p.fx && typeof p.fx === 'object', p.id);
  });

  test('price helpers resolve by id and item', () => {
    assert.equal(shopItemPrice('pastell'), 400);
    assert.equal(shopItemPrice('neon'), 600);
    assert.equal(shopItemPrice('karneval'), 900);
    assert.equal(shopItemPrice(shopItemById('cyber')), 900);
    assert.equal(shopItemPrice('nope'), 0);
  });

  test('inventory keys are category-prefixed', () => {
    assert.equal(shopInvKey(shopItemById('neon')), 'palette_neon');
  });

  test('every locale has a name for every catalog item', async () => {
    const { default: de } = await import('../../js/i18n/de.js');
    for (const it of SHOP_CATALOG) assert.ok(de.shop.it[it.id], `missing de name for ${it.id}`);
  });
});

describe('shopitems.ownership', () => {
  const inv = { palette_neon: { acquiredAt: 1 } };

  test('ownsShopItem requires the prefixed inventory entry', () => {
    assert.equal(ownsShopItem(inv, shopItemById('neon')), true);
    assert.equal(ownsShopItem(inv, shopItemById('cyber')), false);
    assert.equal(ownsShopItem({ neon: { acquiredAt: 1 } }, shopItemById('neon')), false);
  });

  test('resolveEquipped falls back to the free default', () => {
    assert.equal(resolveEquipped('palette', 'neon', inv), 'neon');
    assert.equal(resolveEquipped('palette', 'cyber', inv), 'classic');   // nicht im Besitz
    assert.equal(resolveEquipped('palette', 'unknown', inv), 'classic'); // unbekannt
    assert.equal(resolveEquipped('palette', null, null), 'classic');
    assert.equal(resolveEquipped('nopecat', 'x', inv), null);
  });
});

describe('shopitems.applyPaletteFx', () => {
  test('is identity-ish without fx and never mutates the input', () => {
    const c = { h: 120, s: 80, l: 50 };
    const r = applyPaletteFx(c, null);
    assert.deepEqual(r, { h: 120, s: 80, l: 50 });
    assert.notEqual(r, c);
  });

  test('rotates hue modulo 360 (also negative)', () => {
    assert.equal(applyPaletteFx({ h: 350, s: 50, l: 50 }, { hue: 45 }).h, 35);
    assert.equal(applyPaletteFx({ h: 10, s: 50, l: 50 }, { hue: -25 }).h, 345);
  });

  test('clamps saturation and lightness to readable ranges', () => {
    assert.equal(applyPaletteFx({ h: 0, s: 90, l: 80 }, { sat: 2, light: 40 }).s, 100);
    assert.equal(applyPaletteFx({ h: 0, s: 90, l: 80 }, { sat: 2, light: 40 }).l, 86);
    assert.equal(applyPaletteFx({ h: 0, s: 10, l: 20 }, { sat: 0.1, light: -40 }).s, 12);
    assert.equal(applyPaletteFx({ h: 0, s: 10, l: 20 }, { sat: 0.1, light: -40 }).l, 14);
  });

  test('pure hue rotation preserves pairwise hue distances of the region palette', () => {
    for (const it of SHOP_CATALOG.filter((i) => i.cat === 'palette')) {
      const a = applyPaletteFx(REGION_COLORS[0], { hue: it.fx.hue });
      const b = applyPaletteFx(REGION_COLORS[5], { hue: it.fx.hue });
      const orig = ((REGION_COLORS[0].h - REGION_COLORS[5].h) % 360 + 360) % 360;
      const now = ((a.h - b.h) % 360 + 360) % 360;
      assert.equal(now, orig, it.id);
    }
  });
});
