import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { wheelItemStyle, snapTarget, wheelSlots, nearestSlot, mod } = await import('../../js/gamewheel.js');

// Die Spielauswahl als rotierende Scheibe: reine Geometrie je Logo.
describe('gamewheel', () => {
  test('die Mitte steht groß, voll sichtbar und vorn', () => {
    const s = wheelItemStyle(0, 120);
    assert.match(s.transform, /translate3d\(0\.0px, 0, -?0\.0px\) rotateY\(-?0\.0deg\) scale\(1\.150\)/);
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

  test('auch das viertnächste Logo ist noch zu sehen (fünf Einträge mit Mix)', () => {
    const four = wheelItemStyle(4, 100), three = wheelItemStyle(3, 100);
    const x = (s) => Number(/translate3d\((-?[\d.]+)px/.exec(s.transform)[1]);
    assert.ok(Number(four.opacity) > 0.3);
    assert.ok(x(four) > x(three) && x(four) < 2.5 * 100, 'eng genug, um noch im Bild zu liegen');
  });

  test('weit entfernte Logos verschwinden, statt endlos zu schrumpfen', () => {
    const s = wheelItemStyle(5, 100);
    assert.equal(s.opacity, '0.000');
    assert.match(s.transform, /scale\(0\.420\)/);
  });

  test('Ring: rechts nach dem letzten Eintrag kommt wieder der erste', () => {
    const sl = wheelSlots(5, 6);                       // Mitte auf dem letzten von 6
    const at = (o) => sl.find((x) => Math.abs(x.o - o) < 1e-9);
    assert.equal(at(0).idx, 5);
    assert.equal(at(1).idx, 0);                         // rechts daneben: der erste
    assert.equal(at(-1).idx, 4);
    // Jeder Eintrag hat genau EIN Haupt-Exemplar (das nächstgelegene).
    const prim = sl.filter((x) => x.primary).map((x) => x.idx).sort();
    assert.deepEqual(prim, [0, 1, 2, 3, 4, 5]);
    assert.equal(mod(-1, 6), 5);
  });

  test('Ring: der kürzeste Weg zu einem Eintrag', () => {
    assert.equal(nearestSlot(5, 0, 6), 6);              // vom letzten zum ersten: ein Schritt nach rechts
    assert.equal(nearestSlot(0, 5, 6), -1);             // vom ersten zum letzten: einer nach links
    assert.equal(nearestSlot(13, 2, 6), 14);
    assert.equal(snapTarget(5.6, 0), 6);                // ohne Anzahl: keine Enden
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
