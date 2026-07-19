const CACHE = 'coop-number-sums-v1.174';
const ASSETS = [
  './index.html',
  './privacy.html',
  './imprint.html',
  './css/styles.css',
  './js/vue.esm-browser.prod.js',
  './js/config.js',
  './js/solver.js',
  './js/generator.js',
  './js/genworker.js',
  './js/storage.js',
  './js/coop.js',
  './js/firebase.js',
  './js/account.js',
  './js/session.js',
  './js/debuglog.js',
  './js/streak.js',
  './js/achievements.js',
  './js/endless.js',
  './js/missions.js',
  './js/prestige.js',
  './js/skins.js',
  './js/training.js',
  './js/shopitems.js',
  './js/wineffects.js',
  './js/winshapes.js',
  './js/badgeart.js',
  './js/icons.js',
  './js/vendor/firebase/firebase-app.js',
  './js/vendor/firebase/firebase-auth.js',
  './js/vendor/firebase/firebase-database.js',
  './js/buildinfo.js',
  './js/music.js',
  './js/app.js',
  './js/i18n/index.js',
  './js/i18n/de.js',
  './js/i18n/en.js',
  './js/i18n/es.js',
  './js/i18n/fr.js',
  './js/i18n/pt-BR.js',
  './js/i18n/it.js',
  './js/i18n/ja.js',
  './js/i18n/ko.js',
  './js/i18n/tr.js',
  './js/i18n/ru.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
];
// Der App-Shell-Einstieg. JEDE Navigations-Anfrage (Home-Icon-Start, Reload,
// start_url) wird offline aus diesem Cache-Eintrag bedient — unabhängig davon,
// ob die URL './' , './index.html' oder mit Query kam.
const SHELL = './index.html';

// Install: Assets EINZELN cachen (Promise.allSettled) — schlägt eine Datei fehl
// (kurzer Netz-Hänger, 404), bleibt der Rest im Cache, statt dass ein atomares
// addAll() den GESAMTEN Cache leer lässt. Kein skipWaiting: der neue Worker geht
// in "waiting", die App stößt das Update kontrolliert an (kein Reload im Spiel).
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map((a) => cache.add(a)));
  })());
});

// Die Seite stößt das eigentliche Update an, sobald der Nutzer (nach optionalem
// Backup) auf "Aktualisieren" tippt.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});

// Activate: ATOMARER SWAP. Alte Caches werden NUR gelöscht, wenn der neue Cache
// die App-Shell wirklich enthält — sonst würde ein unvollständiges Precache (z.B.
// Update-Abbruch) den Nutzer offline aussperren. Fehlt die Shell, wird sie
// nachgeladen und der alte Cache als Fallback behalten.
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let shell = await cache.match(SHELL);
    if (!shell) { try { await cache.add(SHELL); shell = await cache.match(SHELL); } catch (_) {} }
    if (shell) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

// Cache-first (stale-while-revalidate) für ALLE gleich-origin GET-Anfragen:
// offline sofort & zuverlässig aus dem Cache, online im Hintergrund aktualisiert.
// Bewusst NICHT mehr network-first — das ließ den Offline-/Lie-Fi-Start erst in
// einen Netz-Timeout laufen und hing am exakten Cache-Match des Fallbacks.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((resp) => { if (resp && resp.ok && resp.type === 'basic') cache.put(request, resp.clone()); return resp; })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

// Navigations-Anfragen (App-Start/Reload) IMMER aus der gecachten Shell bedienen
// (cache-first). So startet das Home-Icon im Flugmodus zuverlässig. Frische Shell
// wird im Hintergrund nachgezogen (greift beim nächsten Start).
async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  fetch(request).then((resp) => { if (resp && resp.ok && resp.type === 'basic') cache.put(SHELL, resp.clone()); }).catch(() => {});
  const shell = await cache.match(SHELL);
  if (shell) return shell;
  try { return await fetch(request); } catch (_) {
    return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><body style="background:#0b1020;color:#e8edf7;font-family:system-ui;padding:2rem">Bitte einmal mit Internet starten – danach läuft die App offline.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                     // nur GET cachen
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;      // Fremd-Origin (Firebase) → Browser/SDK
  if (req.mode === 'navigate') { e.respondWith(handleNavigation(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});

// Manueller Update-Neustart: Die App (Klick auf die Version im Hauptmenü)
// schickt SKIP_WAITING an den WARTENDEN neuen Worker, damit der Nutzer die
// bereits installierte neue Version explizit aktivieren kann. Es bleibt dabei:
// KEIN automatisches skipWaiting beim install — ohne Nutzeraktion übernimmt
// die neue Version weiterhin erst beim nächsten Kaltstart (nie mitten im Spiel).
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
