import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVES, HINTS, MAX_VAL, DIFFICULTIES, DIFF_BY_ID,
  REGION_COLORS, COOP_COLORS, DEFAULT_SETTINGS, DEFAULT_GAME_OPTIONS,
  regionColorDist,
} from '../../js/config.js';

describe('config constants', () => {
  test('basic invariants', () => {
    assert.equal(LIVES, 3);
    assert.equal(HINTS, Infinity);
    assert.equal(MAX_VAL, 9);
  });
});

describe('config.DIFFICULTIES', () => {
  test('has unique, non-empty ids', () => {
    const ids = DIFFICULTIES.map(d => d.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => typeof id === 'string' && id.length > 0));
  });

  test('dimensions grow monotonically with difficulty order', () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const prev = DIFFICULTIES[i - 1], cur = DIFFICULTIES[i];
      assert.ok(cur.dim.r >= prev.dim.r);
      assert.ok(cur.dim.c >= prev.dim.c);
    }
  });

  test('keepRatio is a valid fraction', () => {
    for (const d of DIFFICULTIES) {
      assert.ok(d.keepRatio > 0 && d.keepRatio < 1);
    }
  });

  test('DIFF_BY_ID indexes every difficulty by its id', () => {
    for (const d of DIFFICULTIES) {
      assert.equal(DIFF_BY_ID[d.id], d);
    }
  });
});

describe('config.REGION_COLORS', () => {
  test('has unique names and valid HSL components', () => {
    const names = REGION_COLORS.map(c => c.name);
    assert.equal(new Set(names).size, names.length);
    for (const c of REGION_COLORS) {
      assert.ok(c.h >= 0 && c.h < 360);
      assert.ok(c.s >= 0 && c.s <= 100);
      assert.ok(c.l >= 0 && c.l <= 100);
    }
  });

  test('every pair of cage colours is perceptually distinct (no confusable greens etc.)', () => {
    // The whole point of the palette: even non-adjacent cages must never look
    // like "the same colour, slightly off". regionColorDist measures the
    // composited cage colour in the worse of both themes; require a clear gap
    // for ALL pairs so no two entries are confusable regardless of placement.
    let worst = Infinity, pair = '';
    for (let i = 0; i < REGION_COLORS.length; i++) {
      for (let j = i + 1; j < REGION_COLORS.length; j++) {
        const d = regionColorDist(REGION_COLORS[i], REGION_COLORS[j]);
        if (d < worst) { worst = d; pair = `${REGION_COLORS[i].name}/${REGION_COLORS[j].name}`; }
      }
    }
    assert.ok(worst >= 70, `closest cage-colour pair ${pair} only ${worst.toFixed(0)} apart (want >=70)`);
  });
});

describe('config.COOP_COLORS', () => {
  test('has unique ids and valid hex codes', () => {
    const ids = COOP_COLORS.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const c of COOP_COLORS) {
      assert.match(c.hex, /^#[0-9a-f]{6}$/i);
    }
  });

  test('avoids the success/error hues (green and red)', () => {
    // sanity: none of the coop colors should equal the literal good/bad hex tones
    // (defends against accidentally re-adding green/red as an identity color).
    for (const c of COOP_COLORS) {
      assert.notEqual(c.hex.toLowerCase(), '#22c55e');
      assert.notEqual(c.hex.toLowerCase(), '#ef4444');
    }
  });
});

describe('config.DEFAULT_SETTINGS / DEFAULT_GAME_OPTIONS', () => {
  test('has the expected shape and defaults', () => {
    assert.equal(DEFAULT_SETTINGS.darkMode, true);
    assert.equal(DEFAULT_SETTINGS.errorReveal, 'instant');
    assert.equal(DEFAULT_SETTINGS.livesEnabled, true);
    assert.equal(DEFAULT_SETTINGS.language, null);
  });

  test('default difficulty is a valid difficulty id', () => {
    assert.ok(DIFF_BY_ID[DEFAULT_GAME_OPTIONS.difficulty]);
  });
});
