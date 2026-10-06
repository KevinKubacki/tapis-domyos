// Changer VERSION à chaque livraison : les téléphones installent la nouvelle version et l'appli se recharge seule.
var VERSION = 'tapis-domyos-2026-10-06-4';
var FILES = ['./', 'index.html', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); })
    .then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Copie locale d'abord (ouverture instantanée, même sans réseau). Les polices sont mises en cache au passage.
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var local = url.origin === location.origin, police = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!local && !police) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: local }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; })
        .catch(function () { return local ? c.match('index.html') : Response.error(); });
    });
  }));
});
