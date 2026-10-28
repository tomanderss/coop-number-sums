import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { wheelItemStyle, rubberBand, snapTarget } = await import('../../js/gamewheel.js');

// Die Spielauswahl als rotierende Scheibe: reine Geometrie je Logo.
describe('gamewheel', () => {
  test('die Mitte steht groß, voll sichtbar und vorn', () => {
    const s = wheelItemStyle(0, 120);
    assert.match(s.transform, /translate3d\(0\.0px, 0, -?0\.0px\) rotateY\(-?0\.0deg\) scale\(1\.000\)/);
    assert.equal(s.opacity, '1.000');
    assert.equal(s.zIndex, '100');
  });

  test('Nachbarn sind kleiner, blasser, nach hinten gekippt und spiegelbildlich', () => {
    const l = wheelItemStyle(-1, 100), r = wheelItemStyle(1, 100);
    assert.match(l.transform, /translate3d\(-100\.0px/);
    assert.match(r.transform, /translate3d\(100\.0px/);
    assert.match(l.transform, /rotateY\(30\.0deg\)/);
    assert.match(r.transform, /rotateY\(-30\.0deg\)/);
    assert.ok(Number(l.opacity) < 1 && l.opacity === r.opacity);
    assert.ok(Number(r.zIndex) < 100);
  });

  test('eng gefächert: auch das übernächste und drittnächste Logo bleiben sichtbar', () => {
    const one = wheelItemStyle(1, 100), two = wheelItemStyle(2, 100), three = wheelItemStyle(3, 100);
    const x = (s) => Number(/translate3d\((-?[\d.]+)px/.exec(s.transform)[1]);
    assert.ok(x(two) - x(one) < x(one), 'weitere Logos rücken enger zusammen');
    assert.ok(Number(two.opacity) > 0.5);
    assert.ok(Number(three.opacity) > 0.3);
    assert.ok(Number(three.zIndex) < Number(two.zIndex));
  });

  test('weit entfernte Logos verschwinden, statt endlos zu schrumpfen', () => {
    const s = wheelItemStyle(4, 100);
    assert.equal(s.opacity, '0.000');
    assert.match(s.transform, /scale\(0\.420\)/);
  });

  test('Gummiband: innerhalb unverändert, außerhalb gedämpft', () => {
    assert.equal(rubberBand(0.4, 1), 0.4);
    assert.ok(rubberBand(-1, 1) > -1 && rubberBand(-1, 1) < 0);
    assert.ok(rubberBand(2, 1) < 2 && rubberBand(2, 1) > 1);
  });

  test('Einrasten: nächstes Logo, ein zügiger Wisch reicht für einen Schritt', () => {
    assert.equal(snapTarget(0.3, 0, 2), 0);
    assert.equal(snapTarget(0.6, 0, 2), 1);
    assert.equal(snapTarget(0.25, 0.004, 2), 1);     // schnell nach links gewischt
    assert.equal(snapTarget(0.75, -0.004, 2), 0);
    assert.equal(snapTarget(1.4, 0.01, 2), 1);       // nie über das Ende hinaus
    assert.equal(snapTarget(-0.4, -0.01, 2), 0);
  });
});
