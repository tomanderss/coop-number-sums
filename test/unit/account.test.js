import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #map = new Map();
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  setItem(key, value) { this.#map.set(key, String(value)); }
  removeItem(key) { this.#map.delete(key); }
  clear() { this.#map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const {
  normalizeUsername, isValidUsername, isValidEmail, passwordIssue, usernameKey, errKey,
  isSignedIn, lastSyncAt, decideSync, isDivergent, friendActivityRank, sortFriends, sortLeaderboard,
  presenceOnline, PRESENCE_STALE_MS, mergeSnapshots, mergeStreak, walletBalanceDiffers,
} = await import('../../js/account.js');

describe('account.isDivergent (echter Offline-vs-Cloud-Konflikt)', () => {
  test('Erstkontakt (syncedRev null) → nie Konflikt', () => {
    assert.equal(isDivergent({ localRev: 5, cloudRev: 9, syncedRev: null }), false);
  });
  test('nur lokal geändert → kein Konflikt', () => {
    assert.equal(isDivergent({ localRev: 8, cloudRev: 5, syncedRev: 5 }), false);
  });
  test('nur Cloud geändert → kein Konflikt', () => {
    assert.equal(isDivergent({ localRev: 5, cloudRev: 8, syncedRev: 5 }), false);
  });
  test('beide seit Basislinie geändert → Konflikt', () => {
    assert.equal(isDivergent({ localRev: 8, cloudRev: 9, syncedRev: 5 }), true);
  });
  test('nichts geändert → kein Konflikt', () => {
    assert.equal(isDivergent({ localRev: 5, cloudRev: 5, syncedRev: 5 }), false);
  });
});

describe('account.sortLeaderboard', () => {
  test('fastest time first; invalid/missing times sink to the end', () => {
    const entries = [
      { uid: 'a', username: 'ann', timeMs: 5000 },
      { uid: 'b', username: 'bob', timeMs: 2000 },
      { uid: 'c', username: 'cyl', timeMs: 0 },        // ungültig
      { uid: 'd', username: 'dan' },                    // fehlt
      { uid: 'e', username: 'eve', timeMs: 3500 },
    ];
    assert.deepEqual(sortLeaderboard(entries).map(e => e.uid), ['b', 'e', 'a', 'c', 'd']);
  });
  test('ties break alphabetically by username; input not mutated', () => {
    const entries = [{ uid: 'x', username: 'zoe', timeMs: 1000 }, { uid: 'y', username: 'amy', timeMs: 1000 }];
    const copy = [...entries];
    assert.deepEqual(sortLeaderboard(entries).map(e => e.username), ['amy', 'zoe']);
    assert.deepEqual(entries, copy);
  });
});

describe('account.presenceOnline (Geister-Status läuft ab)', () => {
  const now = 30 * 60 * 1000;
  test('online mit frischem lastActive → online', () => {
    assert.equal(presenceOnline({ online: true, lastActive: now - 1000 }, now), true);
  });
  test('online:true, aber lastActive älter als TTL → offline (hängen gebliebener Knoten)', () => {
    assert.equal(presenceOnline({ online: true, lastActive: now - PRESENCE_STALE_MS - 1 }, now), false);
    assert.equal(presenceOnline({ online: true, lastActive: now - PRESENCE_STALE_MS }, now), false);
  });
  test('knapp unter der TTL → noch online', () => {
    assert.equal(presenceOnline({ online: true, lastActive: now - PRESENCE_STALE_MS + 1 }, now), true);
  });
  test('ohne (gültigen) lastActive nie online — „ewig online" ist der Fehlerfall', () => {
    assert.equal(presenceOnline({ online: true }, now), false);
    assert.equal(presenceOnline({ online: true, lastActive: 0 }, now), false);
    assert.equal(presenceOnline({ online: true, lastActive: 'kaputt' }, now), false);
  });
  test('Serveruhr leicht voraus (lastActive > now) → online', () => {
    assert.equal(presenceOnline({ online: true, lastActive: now + 3000 }, now), true);
  });
  test('offline bleibt offline, auch mit frischem lastActive', () => {
    assert.equal(presenceOnline({ online: false, lastActive: now }, now), false);
    assert.equal(presenceOnline(null, now), false);
  });
});

describe('account.friendActivityRank', () => {
  const now = 30 * 60 * 1000;
  const fresh = now - 1000;
  test('in-game > online > offline/none', () => {
    assert.equal(friendActivityRank({ online: true, lastActive: fresh, game: { pct: 40 } }, now), 2);
    assert.equal(friendActivityRank({ online: true, lastActive: fresh, game: null }, now), 1);
    assert.equal(friendActivityRank({ online: false, lastActive: fresh }, now), 0);
    assert.equal(friendActivityRank(null, now), 0);
    // Offline mit veralteter game-Info zählt NICHT als „im Spiel".
    assert.equal(friendActivityRank({ online: false, lastActive: fresh, game: { pct: 40 } }, now), 0);
  });
  test('abgelaufene Präsenz rangiert wie offline — auch „im Spiel"-Geister', () => {
    const stale = now - PRESENCE_STALE_MS - 1;
    assert.equal(friendActivityRank({ online: true, lastActive: stale }, now), 0);
    assert.equal(friendActivityRank({ online: true, lastActive: stale, game: { pct: 40 } }, now), 0);
  });
});

describe('account.sortFriends', () => {
  const now = 30 * 60 * 1000;
  test('sorts by activity desc, then username asc', () => {
    const friends = [
      { uid: 'a', username: 'zoe' },
      { uid: 'b', username: 'bob' },
      { uid: 'c', username: 'ann' },
    ];
    const presence = {
      a: { online: false, lastActive: now - 1000 },                    // offline
      b: { online: true, lastActive: now - 1000, game: { pct: 10 } },  // in-game
      c: { online: true, lastActive: now - 1000, game: null },         // online
    };
    assert.deepEqual(sortFriends(friends, presence, now).map(f => f.uid), ['b', 'c', 'a']);
  });
  test('abgelaufener Geist sortiert wie offline (alphabetisch hinten)', () => {
    const friends = [{ uid: 'g', username: 'zoe-geist' }, { uid: 'c', username: 'ann' }];
    const presence = {
      g: { online: true, lastActive: now - PRESENCE_STALE_MS - 1, game: { pct: 50 } },  // Geist
      c: { online: true, lastActive: now - 1000, game: null },                          // echt online
    };
    assert.deepEqual(sortFriends(friends, presence, now).map(f => f.uid), ['c', 'g']);
  });
  test('stable alphabetical among equal activity', () => {
    const friends = [{ uid: 'x', username: 'carla' }, { uid: 'y', username: 'anna' }];
    assert.deepEqual(sortFriends(friends, {}).map(f => f.username), ['anna', 'carla']);
  });
  test('does not mutate input', () => {
    const friends = [{ uid: 'x', username: 'b' }, { uid: 'y', username: 'a' }];
    const copy = [...friends];
    sortFriends(friends, {});
    assert.deepEqual(friends, copy);
  });
});

describe('account.decideSync (online always wins on divergence)', () => {
  test('empty cloud → upload local (first ever backup)', () => {
    assert.equal(decideSync({ cloudExists: false, localRev: 5, cloudRev: 0, syncedRev: null, hasLocalData: true }), 'uploadLocal');
    // even with no local data, an empty cloud just gets whatever local is
    assert.equal(decideSync({ cloudExists: false, localRev: 0, cloudRev: 0, syncedRev: null, hasLocalData: false }), 'uploadLocal');
  });
  test('first contact + local has data + differing revs → take cloud (online always wins)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 4, syncedRev: null, hasLocalData: true }), 'takeCloud');
  });
  test('first contact + no local data → take cloud silently', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 0, cloudRev: 4, syncedRev: null, hasLocalData: false }), 'takeCloud');
  });
  test('first contact but identical revisions → in sync (no false prompt on re-login)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 7, cloudRev: 7, syncedRev: null, hasLocalData: true }), 'inSync');
  });
  test('with a baseline: only local changed → upload; only cloud changed → take cloud', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 4, syncedRev: 4, hasLocalData: true }), 'uploadLocal');
    assert.equal(decideSync({ cloudExists: true, localRev: 4, cloudRev: 9, syncedRev: 4, hasLocalData: true }), 'takeCloud');
  });
  test('with a baseline: both changed → take cloud (online always wins, no prompt)', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 9, cloudRev: 8, syncedRev: 4, hasLocalData: true }), 'takeCloud');
  });
  test('with a baseline: nothing changed → in sync', () => {
    assert.equal(decideSync({ cloudExists: true, localRev: 4, cloudRev: 4, syncedRev: 4, hasLocalData: true }), 'inSync');
  });

  test('no reload loop: after takeCloud, baseline matches cloudRev → in sync', () => {
    // Regression (Reload-Schleife): applyCloud MUSS syncedRev == (snap.rev || 0)
    // setzen. Tat es das nicht (syncedRev blieb auf einem durch den Import frisch
    // hochgezählten, von cloudRev abweichenden Wert), sah der nächste reconcile
    // cloudChanged → 'takeCloud' → safeReload → Endlos-Reload. Konsistente
    // Basislinie = derselbe Wert wie cloudRev → 'inSync', kein weiterer Reload.
    assert.equal(decideSync({ cloudExists: true, localRev: 0, cloudRev: 0, syncedRev: 0, hasLocalData: true }), 'inSync');
    // Die alte Fehlsituation (Basislinie != cloudRev) hätte endlos 'takeCloud' geliefert:
    assert.equal(decideSync({ cloudExists: true, localRev: 7, cloudRev: 0, syncedRev: 7, hasLocalData: true }), 'takeCloud');
  });
});
const { saveProfile, saveLastSync } = await import('../../js/storage.js');

describe('account.session flags', () => {
  test('isSignedIn reflects the persisted accountId; lastSyncAt its own key', () => {
    globalThis.localStorage.clear();
    assert.equal(isSignedIn(), false);
    assert.equal(lastSyncAt(), 0);
    saveProfile({ accountId: 'uid123' });
    saveLastSync(42);
    assert.equal(isSignedIn(), true);
    assert.equal(lastSyncAt(), 42);
    saveProfile({ accountId: null });
    assert.equal(isSignedIn(), false);
  });
});

describe('account.username', () => {
  test('normalizeUsername trims and lowercases', () => {
    assert.equal(normalizeUsername('  Tom_Anders  '), 'tom_anders');
  });

  test('isValidUsername accepts 3–20 chars of [a-z0-9_.]', () => {
    assert.equal(isValidUsername('tom'), true);
    assert.equal(isValidUsername('Tom.Anders_1'), true); // normalized before test
    assert.equal(isValidUsername('a'.repeat(20)), true);
  });

  test('isValidUsername rejects too short/long and bad chars', () => {
    assert.equal(isValidUsername('ab'), false);
    assert.equal(isValidUsername('a'.repeat(21)), false);
    assert.equal(isValidUsername('has space'), false);
    assert.equal(isValidUsername('emoji😀'), false);
    assert.equal(isValidUsername('a-b'), false); // hyphen not allowed
  });

  test('usernameKey replaces RTDB-illegal key chars', () => {
    assert.equal(usernameKey('a.b'), 'a_b');
    assert.equal(usernameKey('Tom'), 'tom');
  });
});

describe('account.email', () => {
  test('accepts plausible addresses, rejects malformed', () => {
    assert.equal(isValidEmail('a@b.de'), true);
    assert.equal(isValidEmail('tom-anders@gmx.net'), true);
    assert.equal(isValidEmail('nope'), false);
    assert.equal(isValidEmail('a@b'), false);
    assert.equal(isValidEmail('a b@c.de'), false);
  });
});

describe('account.password', () => {
  test('flags passwords shorter than 6, accepts ≥6', () => {
    assert.equal(passwordIssue('12345'), 'tooShort');
    assert.equal(passwordIssue(''), 'tooShort');
    assert.equal(passwordIssue('123456'), null);
  });
});

describe('account.errKey', () => {
  test('maps known Firebase codes to short i18n suffixes', () => {
    assert.equal(errKey({ code: 'auth/email-already-in-use' }), 'emailInUse');
    assert.equal(errKey({ code: 'auth/wrong-password' }), 'wrongPassword');
    assert.equal(errKey({ code: 'auth/operation-not-allowed' }), 'notEnabled');
    assert.equal(errKey({ code: 'PERMISSION_DENIED', message: 'permission_denied at /users' }), 'permissionDenied');
    assert.equal(errKey({ message: 'PERMISSION_DENIED: Permission denied' }), 'permissionDenied');
    assert.equal(errKey({ code: 'auth/too-many-requests' }), 'tooMany');
    assert.equal(errKey({ code: 'auth/requires-recent-login' }), 'reauth');
    assert.equal(errKey({}), 'generic');
  });
});

describe('account.walletBalanceDiffers (einziges Dialog-Kriterium)', () => {
  test('gleiche/fehlende Salden → kein Dialog', () => {
    assert.equal(walletBalanceDiffers({ wallet: { balance: 100 } }, { wallet: { balance: 100 } }), false);
    assert.equal(walletBalanceDiffers({}, { wallet: { balance: 0 } }), false);
    assert.equal(walletBalanceDiffers(null, null), false);
  });
  test('abweichende Salden → Dialog', () => {
    assert.equal(walletBalanceDiffers({ wallet: { balance: 100 } }, { wallet: { balance: 250 } }), true);
    assert.equal(walletBalanceDiffers({}, { wallet: { balance: 50 } }), true);
  });
});

describe('account.mergeSnapshots (verlustfreier Merge bei Divergenz)', () => {
  const local = {
    ts: 2000, rev: 20,
    settings: { musicSolo: false },
    stats: { played: 12, won: 10, byDifficulty: { mittel: { won: 5, bestTimeMs: 90000 } } },
    daily: { currentStreak: 3, bestStreak: 7, totalCompleted: 30, lastCompletedDate: '2026-07-08', lossNoticeShown: true },
    history: [{ ts: 5, difficulty: 'mittel', outcome: 'won' }],
    achievements: { firstWin: 1 },
    race: { '1v1': { racesWon: 4 } },
    inventory: { winfx_meteor: { acquiredAt: 1, source: 'buy' } },
    wallet: { balance: 500, updatedAt: 9 },
    completedGames: ['g1', 'g2'],
    profile: { displayName: 'Tom' },
  };
  const cloud = {
    ts: 1000, rev: 10,
    settings: { musicSolo: true },
    stats: { played: 11, won: 9, byDifficulty: { mittel: { won: 4, bestTimeMs: 80000 }, schwer: { won: 1 } } },
    daily: { currentStreak: 5, bestStreak: 6, totalCompleted: 29, lastCompletedDate: '2026-07-07', lossNoticeShown: false },
    history: [{ ts: 3, difficulty: 'leicht', outcome: 'won' }, { ts: 5, difficulty: 'mittel', outcome: 'won' }],
    achievements: { tenWins: 2 },
    race: { '1v1': { racesWon: 3 }, '2v2': { racesWon: 2 } },
    inventory: { palette_neon: { acquiredAt: 2, source: 'buy' } },
    wallet: { balance: 500, updatedAt: 4 },
    completedGames: ['g2', 'g3'],
    profile: { displayName: 'Tom2' },
  };
  const m = mergeSnapshots(local, cloud);

  test('Zähler = Maximum, Bestzeit = Bestwert, fremde Schwierigkeiten bleiben', () => {
    assert.equal(m.stats.played, 12);
    assert.equal(m.stats.won, 10);
    assert.equal(m.stats.byDifficulty.mittel.won, 5);
    assert.equal(m.stats.byDifficulty.mittel.bestTimeMs, 80000);  // bessere (kleinere) Zeit gewinnt
    assert.equal(m.stats.byDifficulty.schwer.won, 1);             // nur in der Cloud → bleibt
  });
  test('Geldverlauf: Union nach id — Herkunft beider Seiten bleibt erhalten', () => {
    const m2 = mergeSnapshots(
      { ts: 2, walletLog: [{ id: 'a', ts: 10, amount: 100, reason: 'win' }] },
      { ts: 1, walletLog: [{ id: 'b', ts: 20, amount: 200, reason: 'win' }, { id: 'a', ts: 10, amount: 100, reason: 'win' }] },
    );
    assert.deepEqual(m2.walletLog.map(e => e.id), ['b', 'a']);
  });
  test('Union für Inventar/Erfolge/abgerechnete Partien — nichts geht verloren', () => {
    assert.ok(m.inventory.winfx_meteor && m.inventory.palette_neon);
    assert.ok(m.achievements.firstWin && m.achievements.tenWins);
    assert.deepEqual([...m.completedGames].sort(), ['g1', 'g2', 'g3']);
  });
  test('Streak: Zähler folgt der Seite mit dem späteren Spieldatum, Flags von der jüngeren Seite', () => {
    // Lokal hat das SPÄTERE Datum (07-08) → SEIN Zähler (3) gilt. Das frühere
    // max(3,5)=5 fabrizierte einen Zustand, der nie existierte (5 am 07-08),
    // und ließ veraltete/vergiftete Cloud-Zähler jeden echten Stand überschreiben.
    assert.equal(m.daily.currentStreak, 3);
    assert.equal(m.daily.bestStreak, 7);           // Lebenszeit-Rekord bleibt Maximum
    assert.equal(m.daily.totalCompleted, 30);
    assert.equal(m.daily.lastCompletedDate, '2026-07-08');
    assert.equal(m.daily.lossNoticeShown, true);   // lokal ist jünger (ts 2000)
  });
  test('Race-Bilanz gemergt (max je Modus, fehlende Modi bleiben)', () => {
    assert.equal(m.race['1v1'].racesWon, 4);
    assert.equal(m.race['2v2'].racesWon, 2);
  });
  test('Kleinigkeiten (Settings/Profil/Wallet) folgen der jüngeren Seite', () => {
    assert.equal(m.settings.musicSolo, false);
    assert.equal(m.profile.displayName, 'Tom');
    assert.deepEqual(m.wallet, { balance: 500, updatedAt: 9 });
  });
  test('Verlauf: Union ohne Duplikate, jüngste zuerst', () => {
    assert.equal(m.history.length, 2);             // ts-5-Eintrag dedupliziert
    assert.equal(m.history[0].ts, 5);
  });
  test('leere/fehlende Seiten sind harmlos', () => {
    const only = mergeSnapshots(local, {});
    assert.equal(only.stats.won, 10);
    assert.deepEqual(mergeSnapshots({}, {}).completedGames, []);
  });
});

describe('account.mergeStreak (Streak-Merge heilt vergiftete Daten)', () => {
  const today = '2026-07-24';
  test('gleiches Datum → Zähler-Maximum (identischer Tag auf zwei Geräten)', () => {
    const m = mergeStreak({ currentStreak: 31, lastCompletedDate: '2026-07-24' }, { currentStreak: 30, lastCompletedDate: '2026-07-24' }, true, today);
    assert.equal(m.currentStreak, 31);
    assert.equal(m.lastCompletedDate, '2026-07-24');
  });
  test('späteres Datum gewinnt den Zähler — auch wenn er KLEINER ist (kein Wiederbeleben veralteter Stände)', () => {
    const m = mergeStreak({ currentStreak: 1, lastCompletedDate: '2026-07-24' }, { currentStreak: 30, lastCompletedDate: '2026-07-20' }, true, today);
    assert.equal(m.currentStreak, 1);
    assert.equal(m.lastCompletedDate, '2026-07-24');
  });
  test('GIFT-SZENARIO: deutsches Datumsformat gewinnt nicht mehr lexikografisch für immer', () => {
    // Vorher: '24.07.2026' > '2026-07-24' (lexikografisch!) → Gift-Datum + alter
    // Zähler überlebten JEDEN Merge, die Serie klemmte dauerhaft beim Admin-Wert.
    const m = mergeStreak(
      { currentStreak: 31, lastCompletedDate: '2026-07-24' },                 // echter Stand von heute
      { currentStreak: 30, lastCompletedDate: '24.07.2026', bestStreak: 30 }, // vergifteter Cloud-Stand
      true, today,
    );
    assert.equal(m.lastCompletedDate, '2026-07-24');   // echtes Datum gewinnt (Gift → gestern geheilt)
    assert.equal(m.currentStreak, 31);                 // echter Zähler gewinnt
    assert.equal(m.bestStreak, 30);                    // Lebenszeit-Rekord bleibt
  });
  test('Zukunfts-Datum wird geheilt und verliert gegen den echten heutigen Stand', () => {
    const m = mergeStreak(
      { currentStreak: 28, lastCompletedDate: '2026-07-24' },
      { currentStreak: 27, lastCompletedDate: '2999-01-01' },
      true, today,
    );
    assert.equal(m.lastCompletedDate, '2026-07-24');
    assert.equal(m.currentStreak, 28);
  });
  test('beidseitig leer bleibt leer', () => {
    const m = mergeStreak({}, {}, true, today);
    assert.equal(m.lastCompletedDate, null);
    assert.equal(m.currentStreak, 0);
  });
});
