import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  SKIN_ID, SKIN_UNLOCK_VERSION, SKIN_CODE_NORM, SKIN_STYLES, FOUNDER_ID,
  cmpVersion, qualifiesForV1Skin, normalizeSkinCode, skinCodeMatches,
  skinVars, skinClasses, skinSpeedToDuration,
} = await import('../../js/skins.js');

describe('skins.skinSpeedToDuration (higher speed = shorter duration)', () => {
  test('a higher speed value yields a SHORTER animation duration (faster)', () => {
    const slow = skinSpeedToDuration(2);
    const fast = skinSpeedToDuration(12);
    assert.ok(fast < slow, 'more speed must mean a shorter period');
  });
  test('speed 6 keeps the historical 2s/turn default', () => {
    assert.equal(skinSpeedToDuration(6), 2);
  });
  test('speed 0 means no rotation (0s)', () => {
    assert.equal(skinSpeedToDuration(0), 0);
  });
  test('skinVars uses the inverted duration, not the raw slider value', () => {
    assert.equal(skinVars({ skinSpeed: 12 })['--skin-speed'], '1s');   // fastest
    assert.equal(skinVars({ skinSpeed: 6 })['--skin-speed'], '2s');    // default
    assert.equal(skinVars({ skinSpeed: 0 })['--skin-speed'], '0s');    // off
  });
});

describe('skins.founder marker', () => {
  test('FOUNDER_ID is a distinct inventory id from the skin', () => {
    assert.equal(FOUNDER_ID, 'founder1_0');
    assert.notEqual(FOUNDER_ID, SKIN_ID);
  });
  test('only players who lived the <1.0 -> 1.0 jump qualify for the founder marker', () => {
    assert.equal(qualifiesForV1Skin('0.166', '1.0'), true);  // upgrader ⇒ founder
    assert.equal(qualifiesForV1Skin(null, '1.0'), false);    // fresh install ⇒ not a founder
  });
});

describe('skins.cmpVersion', () => {
  test('compares numerically segment by segment', () => {
    assert.ok(cmpVersion('1.0', '0.166') > 0);
    assert.ok(cmpVersion('0.166', '1.0') < 0);
    assert.equal(cmpVersion('1.0', '1.0'), 0);
    assert.ok(cmpVersion('1.2', '1.10') < 0); // 2 < 10 segment-wise
  });
});

describe('skins.qualifiesForV1Skin', () => {
  test('existing player upgrading from <1.0 to >=1.0 qualifies', () => {
    assert.equal(qualifiesForV1Skin('0.166', '1.0'), true);
    assert.equal(qualifiesForV1Skin('0.5', '1.0'), true);
  });
  test('fresh install (no seen version) does NOT auto-unlock', () => {
    assert.equal(qualifiesForV1Skin(null, '1.0'), false);
    assert.equal(qualifiesForV1Skin('', '1.0'), false);
  });
  test('already on 1.x does not re-qualify', () => {
    assert.equal(qualifiesForV1Skin('1.0', '1.1'), false);
    assert.equal(qualifiesForV1Skin('1.0', '1.0'), false);
  });
  test('pre-1.0 build never qualifies', () => {
    assert.equal(qualifiesForV1Skin('0.10', '0.166'), false);
  });
});

describe('skins.code', () => {
  test('normalize lowercases and strips whitespace', () => {
    assert.equal(normalizeSkinCode('  Supporter SeitTag1 '), 'supporterseittag1');
  });
  test('matches case-insensitively, whitespace-insensitively', () => {
    assert.equal(skinCodeMatches('SupporterSeitTag1'), true);
    assert.equal(skinCodeMatches('supporterseittag1'), true);
    assert.equal(skinCodeMatches(' SUPPORTER SEIT TAG 1 '), true);
    assert.equal(skinCodeMatches('wrong'), false);
    assert.equal(skinCodeMatches(''), false);
  });
  test('the normalized constant matches the documented code', () => {
    assert.equal(SKIN_CODE_NORM, 'supporterseittag1');
    assert.equal(SKIN_ID, 'dynamicColor');
    assert.equal(SKIN_UNLOCK_VERSION, '1.0');
  });
});

describe('skins.skinVars', () => {
  test('vars carry speed/glow/thickness with units; speed 0 = 0s (no spin)', () => {
    const v = skinVars({ skinStyle: 'gradient', skinSpeed: 0, skinGlow: 6, skinThickness: 2.5 });
    assert.equal(v['--skin-speed'], '0s');
    assert.equal(v['--skin-glow'], '6px');
    assert.equal(v['--skin-thickness'], '2.5px');
  });
  test('editor colors are only emitted when explicitly set (else CSS fallback applies)', () => {
    const empty = skinVars({ skinColor1: '', skinColor2: '', skinColor3: '' });
    assert.equal('--skin-c1' in empty, false);
    const set = skinVars({ skinColor1: '#abcdef', skinColor3: '#112233' });
    assert.equal(set['--skin-c1'], '#abcdef');
    assert.equal('--skin-c2' in set, false);
    assert.equal(set['--skin-c3'], '#112233');
  });
});

describe('skins.skinClasses', () => {
  test('reflect applyTo / speed / direction / style', () => {
    const c = skinClasses({ skinApplyTo: 'kept', skinSpeed: 0, skinDirection: 'cw', skinStyle: 'solid' }, true);
    assert.equal(c['skin-dynamic'], true);
    assert.equal(c['skin-kept'], true);
    assert.equal(c['skin-removed'], false);
    assert.equal(c['skin-spin'], false); // speed 0
    assert.equal(c['skin-style-solid'], true);
    const c2 = skinClasses({ skinApplyTo: 'both', skinSpeed: 3, skinDirection: 'ccw', skinStyle: 'rainbow' }, true);
    assert.equal(c2['skin-kept'], true);
    assert.equal(c2['skin-removed'], true);
    assert.equal(c2['skin-spin'], true);
    assert.equal(c2['skin-ccw'], true);
    assert.equal(c2['skin-style-rainbow'], true);
  });
  test('unknown style falls back to gradient; inactive ⇒ skin-dynamic false', () => {
    assert.equal(skinClasses({ skinApplyTo: 'both', skinStyle: 'bogus' }, false)['skin-style-gradient'], true);
    assert.equal(skinClasses({ skinApplyTo: 'both' }, false)['skin-dynamic'], false);
  });
  test('SKIN_STYLES lists the three supported styles', () => {
    assert.deepEqual(SKIN_STYLES, ['solid', 'gradient', 'rainbow']);
  });
});
