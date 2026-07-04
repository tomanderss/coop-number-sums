import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { badgeDefsMarkup, badgeMedalMarkup, hasBadgeMedal } from '../../js/badgeart.js';
import { BADGE_ITEMS } from '../../js/shopitems.js';

describe('badgeart medals', () => {
  test('every badge catalog item has a drawable medal motif', () => {
    for (const it of BADGE_ITEMS) {
      assert.ok(hasBadgeMedal(it.id), `missing motif for badge "${it.id}"`);
      const svg = badgeMedalMarkup(it.id);
      assert.match(svg, /^<svg[\s>]/, `${it.id} should render an <svg>`);
      assert.match(svg, /<\/svg>$/, `${it.id} should close its <svg>`);
    }
  });

  test('unknown / empty / foreign ids render nothing (no injection of RTDB strings)', () => {
    assert.equal(hasBadgeMedal(''), false);
    assert.equal(hasBadgeMedal(null), false);
    assert.equal(hasBadgeMedal(undefined), false);
    assert.equal(hasBadgeMedal('not-a-badge'), false);
    assert.equal(badgeMedalMarkup(''), '');
    assert.equal(badgeMedalMarkup('not-a-badge'), '');
    // ein <script>-artiger Fremdstring darf niemals als Medaille durchkommen
    assert.equal(badgeMedalMarkup('<script>alert(1)</script>'), '');
  });

  test('ribbon variant is taller and carries the neck-band, plain variant is square', () => {
    const plain = badgeMedalMarkup('stern', { ribbon: false, size: 72 });
    const ribbon = badgeMedalMarkup('stern', { ribbon: true, size: 72 });
    assert.match(plain, /viewBox="0 0 72 72"/);
    assert.match(ribbon, /viewBox="0 0 72 96"/);
    // Band nur in der Ribbon-Variante
    assert.ok(!plain.includes('M18 4'));
    assert.ok(ribbon.includes('M18 4'));
  });

  test('tier escalation: the SAME symbol gets richer framing per explicit tier', () => {
    // Jedes Symbol gibt es jetzt in allen Stufen — die Stufe kommt aus opts.tier.
    const bronze = badgeMedalMarkup('drache', { tier: 1 });
    assert.ok(!bronze.includes('bm-laurel'));
    assert.ok(!bronze.includes('bm-halo'));
    const silver = badgeMedalMarkup('drache', { tier: 2 });
    assert.ok(!silver.includes('bm-laurel'));
    // Gold (Stufe 3): Lorbeerkranz
    const gold = badgeMedalMarkup('drache', { tier: 3 });
    assert.ok(gold.includes('bm-laurel'));
    // Legendär (Stufe 4): Strahlenkranz + Smaragd-Feld + irisierende Kante
    const legend = badgeMedalMarkup('drache', { tier: 4 });
    assert.ok(legend.includes('bm-halo'));
    assert.ok(legend.includes('bm-field-em'));
    assert.ok(legend.includes('bm-irid'));
    // Default ohne tier = Stufe 1 (Bronze)
    assert.ok(!badgeMedalMarkup('drache').includes('bm-laurel'));
  });

  test('shared defs markup is a single hidden <svg> with the referenced gradients/symbols', () => {
    const defs = badgeDefsMarkup();
    assert.match(defs, /^<svg /);
    assert.ok(defs.includes('id="bm-emb"'));       // Prägungs-Filter
    assert.ok(defs.includes('id="bm-halo"'));       // Strahlenkranz-Symbol
    assert.ok(defs.includes('id="bm-laurel"'));     // Lorbeer-Symbol
    assert.ok(defs.includes('id="bm-irid"'));       // irisierender Verlauf
    assert.ok(defs.includes('id="bm-field-em"'));   // Smaragd-Feld
    // alle vier Rang-Rahmen vorhanden
    for (const rim of ['bm-rim-bronze', 'bm-rim-silver', 'bm-rim-gold', 'bm-rim-obs']) {
      assert.ok(defs.includes(`id="${rim}"`), `defs missing ${rim}`);
    }
  });
});
