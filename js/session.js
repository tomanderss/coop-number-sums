// js/session.js — Reine Logik für die geräteübergreifende Konsistenz des
// AKTIVEN Spielstands (Multi-Device). Kein Firebase-Import hier: alle
// Firebase-/Zustands-Nebenwirkungen liegen in account.js/app.js, damit diese
// Entscheidungslogik unit-testbar bleibt (Konvention wie decideSync/prestige).
//
// Modell (angemeldete Accounts): der aktive Solo-Spielstand lebt zusätzlich als
// EINE autoritative Session in der Cloud (/users/{uid}/session):
//   { gameId, rev, status, deviceId, updatedAt, appBuild, schema, payload }
// - gameId    : Identität der Partie (stabil über Geräte, neu je Partie)
// - rev       : monoton steigende Revision; jede sinnvolle Änderung erhöht sie
// - status    : 'playing' | 'paused' | 'done' | 'none'
// - deviceId  : Gerät, das zuletzt geschrieben hat (Besitzer)
// - updatedAt : serverTime des letzten Schreibens (Tiebreak bei echter Divergenz)
// - schema    : Versions-Tag des Session-Formats (Vorwärtskompatibilität)
//
// Schreiben passiert per Compare-and-Set (RTDB-Transaktion) NUR wenn die eigene
// bekannte Basis-rev == Cloud-rev — so kann ein veraltetes Gerät den neueren
// Stand NIE überschreiben. Beim Sichtbarwerden/Live-Event ruft app.js
// decideSessionSync() und handelt die zurückgegebene action ab.

export const SESSION_SCHEMA = 1;
export const SESSION_STATUS = { PLAYING: 'playing', PAUSED: 'paused', DONE: 'done', NONE: 'none' };

// Ist eine Session „aktiv" (laufende/pausierte Partie, die man fortsetzen kann)?
export function isActiveStatus(status) {
  return status === SESSION_STATUS.PLAYING || status === SESSION_STATUS.PAUSED;
}

// Kern-Entscheidung: Was soll das lokale Gerät mit seiner (evtl. offenen) Partie
// tun, wenn es die Cloud-Session sieht? Rein funktional, keine Nebenwirkungen.
//
// local:  { gameId, rev, status, updatedAt } | null   (lokaler Aktivstand; null = nichts offen)
// cloud:  { gameId, rev, status, updatedAt, deviceId, schema } | null (Cloud-Session; null = keine)
// selfDevice: string  — eigene deviceId
// knownSchema: number — höchstes Schema, das DIESES Gerät versteht (= SESSION_SCHEMA im Build)
//
// Rückgabe: { action, reason, backupLocal? }
//   action:
//     'inSync'          — nichts zu tun
//     'uploadLocal'     — lokalen Stand hochladen (Erst-Upload oder lokal neuer)
//     'takeCloud'       — Cloud-payload lokal übernehmen und HIER fortsetzen (selbe/keine lokale Partie)
//     'takeCloudReadonly' — Cloud-payload übernehmen, aber Nur-Lese (anderes Gerät ist Besitzer) + „Hier weiterspielen"
//     'defunct'         — lokal offene Partie ist überholt/beendet → aufräumen, ins Menü, Resume auffrischen
//     'reloadRequired'  — Cloud-Session nutzt neueres Schema → payload NICHT interpretieren, App neu laden
//   backupLocal: true  — vor dem Verwerfen den lokalen Stand als Backup sichern (echte Divergenz)
export function decideSessionSync({ local, cloud, selfDevice, knownSchema = SESSION_SCHEMA }) {
  // 1) Keine Cloud-Session vorhanden.
  if (!cloud) {
    if (local) return { action: 'uploadLocal', reason: 'cloud-empty' };
    return { action: 'inSync', reason: 'both-empty' };
  }
  // 2) Cloud-Session stammt aus einer NEUEREN App-Version (unbekanntes Schema):
  //    ihren payload nicht interpretieren; auf die neue Version neu laden.
  if (Number(cloud.schema) > Number(knownSchema)) {
    return { action: 'reloadRequired', reason: 'schema-ahead' };
  }
  // 3) Kein lokales offenes Spiel.
  if (!local) {
    if (isActiveStatus(cloud.status)) {
      // Cloud hat eine aktive Partie → hier zum Fortsetzen anbieten. Besitzt sie
      // ein anderes Gerät, bleibt sie Nur-Lese bis „Hier weiterspielen".
      return cloud.deviceId && cloud.deviceId !== selfDevice
        ? { action: 'takeCloudReadonly', reason: 'cloud-active-other' }
        : { action: 'takeCloud', reason: 'cloud-active-self' };
    }
    return { action: 'inSync', reason: 'cloud-inactive-no-local' };
  }
  // 4) Beide vorhanden.
  const sameGame = local.gameId && cloud.gameId && local.gameId === cloud.gameId;
  const cloudRev = Number(cloud.rev) || 0;
  const localRev = Number(local.rev) || 0;
  if (sameGame) {
    if (cloudRev > localRev) {
      // Dieselbe Partie ist woanders weitergelaufen/beendet.
      if (!isActiveStatus(cloud.status)) return { action: 'defunct', reason: 'same-game-done-elsewhere' };
      return cloud.deviceId && cloud.deviceId !== selfDevice
        ? { action: 'takeCloudReadonly', reason: 'same-game-advanced-other' }
        : { action: 'takeCloud', reason: 'same-game-advanced-self' };
    }
    if (cloudRev < localRev) return { action: 'uploadLocal', reason: 'same-game-local-ahead' };
    return { action: 'inSync', reason: 'same-game-equal' };
  }
  // 5) Verschiedene gameId (echte Divergenz oder Spielwechsel): jüngerer
  //    updatedAt (serverTime) gewinnt; der Verlierer wird als Backup gesichert,
  //    nie still gelöscht (Prinzip „lokal nie kommentarlos überschreiben").
  const cloudTs = Number(cloud.updatedAt) || 0;
  const localTs = Number(local.updatedAt) || 0;
  if (cloudTs > localTs) {
    // Das aktuelle Spiel des Accounts ist ein anderes → lokal offenes ist überholt.
    return { action: 'defunct', reason: 'other-game-cloud-newer', backupLocal: true };
  }
  // Lokales Spiel ist das jüngere → hochladen (überschreibt via Compare-and-Set,
  // weil unsere rev-Basis stimmt); der Cloud-Stand war älter.
  return { action: 'uploadLocal', reason: 'other-game-local-newer', backupLocal: true };
}

// Belohnungs-Idempotenz: Ein Spiel (gameId) darf über alle Geräte hinweg NUR
// EINMAL Coins/Statistik gutschreiben — sonst zählt derselbe Sieg doppelt, wenn
// er auf zwei Geräten „beendet" wird. completed = Menge bereits abgerechneter
// gameIds (aus der Cloud/lokal). Gibt true zurück, wenn JETZT abgerechnet werden
// darf (und die gameId neu ist).
export function shouldGrantReward(gameId, completedIds) {
  if (!gameId) return true; // ohne Identität (Alt-/Anon-Spiele) wie bisher abrechnen
  const set = completedIds instanceof Set ? completedIds : new Set(completedIds || []);
  return !set.has(gameId);
}

// Nächste Revision beim lokalen Ändern. Immer Cloud-rev + 1 (bzw. lokal, falls
// höher), damit die Revision strikt monoton über Geräte hinweg wächst.
export function nextRev(localRev, cloudRev) {
  return Math.max(Number(localRev) || 0, Number(cloudRev) || 0) + 1;
}
