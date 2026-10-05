// Changer VERSION à chaque livraison pour que les téléphones se mettent à jour.
var VERSION = 'tapis-domyos-2026-10-06-1';
var FILES = ['./', 'index.html', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); return res;
  }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('index.html'); }); }));
});
