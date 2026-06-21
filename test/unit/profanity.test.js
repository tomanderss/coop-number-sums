import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasProfanity } from '../../js/profanity.js';

describe('profanity.hasProfanity', () => {
  test('rejects known English and German words', () => {
    assert.equal(hasProfanity('fuck'), true);
    assert.equal(hasProfanity('Arschloch'), true);
  });

  test('catches simple leetspeak/whitespace obfuscation', () => {
    assert.equal(hasProfanity('sh1t'), true);
    assert.equal(hasProfanity('s h i t'), true);
  });

  test('normalizes German ß before matching', () => {
    assert.equal(hasProfanity('Scheiße123'), true);
  });

  test('does not flag normal names', () => {
    assert.equal(hasProfanity('Tom'), false);
    assert.equal(hasProfanity('Player1'), false);
    assert.equal(hasProfanity(''), false);
    assert.equal(hasProfanity('résumé'), false);
  });
});
