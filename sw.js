// Bump a versão a cada release para invalidar caches antigos.
const CACHE = 'slo-circuito-offshore-v20';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/icon-32.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  'shared/pwa.css',
  'shared/pwa.js'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' evita precache de versões velhas vindas do cache HTTP
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('slo-circuito-offshore-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: responde do cache na hora (app instantâneo) e
// atualiza o cache em segundo plano — a versão nova chega na abertura
// seguinte.
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async function () {
    var cached = await caches.match(request, { ignoreSearch: true });
    var refresh = fetch(request).then(function (fresh) {
      if (fresh && fresh.ok) {
        caches.open(CACHE).then(function (cache) { cache.put(request, fresh.clone()); });
      }
      return fresh;
    }).catch(function () { return null; });
    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    var fresh = await refresh;
    if (fresh) return fresh;
    if (request.mode === 'navigate') {
      var offline = await caches.match('./index.html', { ignoreSearch: true });
      if (offline) return offline;
    }
    return Response.error();
  })());
});
