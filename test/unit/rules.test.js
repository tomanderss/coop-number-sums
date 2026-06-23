import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Punkt 18: database.rules.json ist die versionierte Quelle für die
// Firebase-Console-Regeln (siehe README.md). Dieser Test stellt sicher, dass
// die Datei valides JSON bleibt und die von js/coop.js tatsächlich
// genutzten Team-/Race-Pfade (teamEvents/teamProgress/raceProgress) nicht
// mehr unvalidiert/lückenhaft sind.
const __dirname = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(readFileSync(join(__dirname, '../../database.rules.json'), 'utf8'));

describe('database.rules.json', () => {
  const room = rules.rules.rooms.$code;

  test('top level denies all unauthenticated access by default', () => {
    assert.equal(rules.rules['.read'], false);
    assert.equal(rules.rules['.write'], false);
  });

  test('rooms require auth and a 6-digit code', () => {
    assert.equal(room['.read'], 'auth != null');
    assert.match(room['.write'], /auth != null/);
    assert.match(room['.write'], /\$code\.matches/);
  });

  test('players can only be written by their own uid', () => {
    assert.equal(room.players.$uid['.write'], 'auth != null && auth.uid === $uid');
  });

  test('teamEvents validates author/type/ts and restricts the team key to A or B', () => {
    const v = room.teamEvents.$team.$eventId['.validate'];
    assert.match(v, /hasChildren\(\['type','author','ts'\]\)/);
    assert.match(v, /author'\)\.val\(\) === auth\.uid/);
    assert.match(v, /\$team === 'A' \|\| \$team === 'B'/);
  });

  test('teamProgress requires auth and a numeric pct/mistakes shape', () => {
    const t = room.teamProgress.$team;
    assert.equal(t['.write'], 'auth != null');
    assert.match(t['.validate'], /hasChildren\(\['pct','mistakes'\]\)/);
    assert.match(t['.validate'], /isNumber\(\)/);
  });

  test('raceProgress can only be written by its own uid with a numeric pct/mistakes shape', () => {
    const r = room.raceProgress.$uid;
    assert.equal(r['.write'], 'auth != null && auth.uid === $uid');
    assert.match(r['.validate'], /hasChildren\(\['pct','mistakes'\]\)/);
  });
});
