import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { icon, hasIcon, ICON_NAMES } from '../../js/icons.js';

describe('icons', () => {
  test('every named icon renders a well-formed <svg> on a 24-grid', () => {
    assert.ok(ICON_NAMES.length >= 40, 'expected a substantial icon set');
    for (const n of ICON_NAMES) {
      assert.ok(hasIcon(n), `hasIcon('${n}') should be true`);
      const svg = icon(n);
      assert.match(svg, /^<svg /, `${n} must start with <svg`);
      assert.match(svg, /viewBox="0 0 24 24"/, `${n} must use the 24 grid`);
      assert.match(svg, /<\/svg>$/, `${n} must close its <svg>`);
      assert.ok(svg.includes(`ico-${n}`), `${n} must carry its ico-<name> class`);
    }
  });

  test('unknown / empty / foreign names render nothing (no raw string injection)', () => {
    assert.equal(hasIcon(''), false);
    assert.equal(hasIcon(null), false);
    assert.equal(hasIcon(undefined), false);
    assert.equal(hasIcon('definitely-not-an-icon'), false);
    assert.equal(icon('definitely-not-an-icon'), '');
    assert.equal(icon('<script>alert(1)</script>'), '');
  });

  test('opts: size sets width/height, title switches to labelled role', () => {
    assert.match(icon('close', { size: 20 }), /width="20" height="20"/);
    assert.match(icon('close', { title: 'Schließen' }), /role="img" aria-label="Schließen"/);
    assert.match(icon('close'), /aria-hidden="true"/);
  });

  test('stroke icons paint via currentColor; filled icons bring their own fills', () => {
    // close = Strich-Icon
    assert.match(icon('close'), /stroke="currentColor"/);
    // coin = gefüllt (bringt eigene Farbe, kein globales stroke=currentColor am <svg>)
    assert.ok(!/^<svg[^>]*stroke="currentColor"/.test(icon('coin')));
    assert.ok(icon('coin').includes('fill="#'));
  });

  test('core UI glyphs exist (the ones the chrome wires up)', () => {
    for (const n of ['close', 'gear', 'coin', 'flame', 'user', 'save', 'sound',
                     'palette', 'theme', 'controller', 'cart', 'users', 'coffee', 'heart']) {
      assert.ok(hasIcon(n), `missing core icon "${n}"`);
    }
  });
});
