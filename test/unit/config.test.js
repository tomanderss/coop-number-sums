import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVES, HINTS, MAX_VAL, DIFFICULTIES, DIFF_BY_ID,
  REGION_COLORS, COOP_COLORS, DEFAULT_SETTINGS, DEFAULT_GAME_OPTIONS,
  regionColorDist, regionChipInk, coinReward, coinMultiplier, coinBaseForIndex, COIN_BASE,
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

  test('regionChipInk yields a readable sum-chip colour for every cage colour', () => {
    // The sum chip is opaque cage colour (lightness clamped 26..60); the ink must
    // contrast it. Assert a WCAG contrast ratio >= 4.5 (AA) between chosen ink and
    // the actual chip background for all 18 colours — guards against white-on-light.
    const hsl2rgb = (h, s, l) => { h/=360; s/=100; l/=100; const k=n=>(n+h*12)%12, a=s*Math.min(l,1-l),
      f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))); return [255*f(0),255*f(8),255*f(4)]; };
    const lum = ([r,g,b]) => { const f=c=>{c/=255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
      return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
    const ratio = (a,b)=>{ const L1=lum(a),L2=lum(b),hi=Math.max(L1,L2),lo=Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
    for (const c of REGION_COLORS) {
      const lc = Math.max(24, Math.min(54, c.l - 14));
      const bg = hsl2rgb(c.h, c.s, lc);
      const inkHex = regionChipInk(c);
      const ink = [parseInt(inkHex.slice(1,3),16), parseInt(inkHex.slice(3,5),16), parseInt(inkHex.slice(5,7),16)];
      const r = ratio(ink, bg);
      assert.ok(r >= 4.5, `chip ink on ${c.name} only ${r.toFixed(1)}:1 (want >=4.5)`);
    }
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
    assert.equal(DEFAULT_SETTINGS.confirmTool, 'pen');
    assert.equal(DEFAULT_SETTINGS.language, null);
    // Entfernte Optionen: Fehler immer sofort, Leben immer an, Timer immer sichtbar.
    assert.equal(DEFAULT_SETTINGS.errorReveal, undefined);
    assert.equal(DEFAULT_SETTINGS.livesEnabled, undefined);
    assert.equal(DEFAULT_SETTINGS.showTimer, undefined);
  });

  test('default difficulty is a valid difficulty id', () => {
    assert.ok(DIFF_BY_ID[DEFAULT_GAME_OPTIONS.difficulty]);
  });
});

describe('config.coinReward', () => {
  test('one base value per difficulty, always whole positive coins', () => {
    assert.equal(COIN_BASE.length, DIFFICULTIES.length);
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const c = coinReward(i);
      assert.ok(Number.isInteger(c) && c > 0, `base ${i} not a positive integer: ${c}`);
    }
  });

  test('reward at least doubles each tier (steeper from Mashallah on)', () => {
    for (let i = 1; i < COIN_BASE.length; i++) {
      assert.ok(COIN_BASE[i] >= COIN_BASE[i - 1] * 2, `tier ${i} not >= 2x previous`);
    }
    // Mashallah (idx 5) onward grows MORE than 2x.
    for (let i = 5; i < COIN_BASE.length; i++) {
      assert.ok(COIN_BASE[i] > COIN_BASE[i - 1] * 2, `tier ${i} should be > 2x previous`);
    }
  });

  test('coop, perfect and bestTime each double; they stack multiplicatively (up to ×8)', () => {
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const base = coinReward(i);
      assert.equal(coinReward(i, { coop: true }), base * 2);
      assert.equal(coinReward(i, { perfect: true }), base * 2);
      assert.equal(coinReward(i, { bestTime: true }), base * 2);
      assert.equal(coinReward(i, { coop: true, perfect: true }), base * 4);
      assert.equal(coinReward(i, { perfect: true, bestTime: true }), base * 4);
      const all = coinReward(i, { coop: true, perfect: true, bestTime: true });
      assert.equal(all, base * 8);
      assert.ok(Number.isInteger(all));
    }
  });

  test('coinMultiplier reflects the active bonuses (no cap)', () => {
    assert.equal(coinMultiplier(), 1);
    assert.equal(coinMultiplier({ coop: true }), 2);
    assert.equal(coinMultiplier({ perfect: true, bestTime: true }), 4);
    assert.equal(coinMultiplier({ coop: true, perfect: true, bestTime: true }), 8);
  });

  test('out-of-range difficulty index yields 0', () => {
    assert.equal(coinReward(-1), 0);
    assert.equal(coinBaseForIndex(-5), 0);
  });
});
