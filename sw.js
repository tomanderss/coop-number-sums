const CACHE = 'coop-number-sums-v1.87';
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
  './js/debuglog.js',
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

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  // Bewusst KEIN self.skipWaiting() hier: bei einem Update soll der neue Worker in
  // den "waiting"-Zustand gehen und die alte Version weiterlaufen lassen, bis der
  // Nutzer aktiv aktualisiert (siehe Update-Banner in app.js). Erst-Installationen
  // haben keinen aktiven Vorgänger und aktivieren dadurch ohnehin sofort.
});

// Die Seite stößt das eigentliche Update an, sobald der Nutzer (nach optionalem
// Backup) auf "Aktualisieren" tippt.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Icons ändern sich praktisch nie und werden bei jedem Bildschirmwechsel neu
// gemountet (v-if im Home-Screen) — Cache-first vermeidet den dadurch sonst
// merkbaren Netzwerk-Roundtrip pro Navigation.
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/icons/')) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
    return;
  }

  // Network-first mit Cache-Fallback (frische Inhalte, offline lauffähig)
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
