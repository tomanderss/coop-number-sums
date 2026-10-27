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

// Coop Number Sums und Coop Math Cross haengen am SELBEN Firebase-Projekt —
// und ein Projekt hat genau EINEN Regelsatz. Math Cross legt alle Daten unter
// den Wurzelknoten `mc/` (js/firebase.js, DB_ROOT). Fehlt dieser Teilbaum in den
// publizierten Regeln, faellt er auf das `.write: false` der Wurzel zurueck und
// Math Cross kann nichts mehr schreiben: keine Coop-Raeume, kein Sync, keine
// Bestenliste. Genau das waere passiert, wenn diese Datei ohne `mc/` publiziert
// worden waere — sie galt bis dahin faelschlich als „in beiden Repos identisch".
//
// Der `mc/`-Teilbaum ist deshalb KEINE eigene Pflege, sondern die Wurzel-Regeln
// gespiegelt; nur die Admin-Pruefung zeigt auf `mc/users`. Driftet er ab (wie
// beim Umstellen der Bestenliste auf die Spiel-Ebene passiert: die Wurzel bekam
// `$game`, `mc/` nicht — und die Math-Cross-Bestenliste wurde abgewiesen),
// schlaegt dieser Test fehl.
describe('database.rules.json: Teilbaum mc/ (Coop Math Cross)', () => {
  const spiegel = (v) => {
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, spiegel(x)]));
    if (typeof v === 'string') return v.replaceAll("root.child('users')", "root.child('mc').child('users')");
    return v;
  };

  test('der Teilbaum existiert', () => {
    assert.ok(rules.rules.mc, 'ohne mc/ verliert Math Cross nach dem Publizieren alle Schreibrechte');
  });

  test('er spiegelt die Wurzel-Regeln exakt', () => {
    const erwartet = Object.fromEntries(
      Object.entries(rules.rules).filter(([k]) => !k.startsWith('.') && k !== 'mc').map(([k, v]) => [k, spiegel(v)]),
    );
    assert.deepEqual(rules.rules.mc, erwartet);
  });

  test('die Admin-Pruefung in mc/ schaut in mc/users, nicht in die Wurzel', () => {
    // Sonst wuerde ein Number-Sums-Admin automatisch auch Math-Cross-Admin.
    const text = JSON.stringify(rules.rules.mc);
    assert.ok(!text.includes("root.child('users')"), 'mc/ darf die Rolle nicht aus der Wurzel lesen');
    assert.ok(text.includes("root.child('mc').child('users')"));
  });
});
