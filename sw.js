/* Offline copy for the home-screen app.
   Network first: online you always get the latest page; the cache is only the fallback
   when the network is gone or too slow. Only this site's own files are cached — calls to
   api.github.com (sync) always go straight to the network. Bump CACHE to drop old copies. */
var CACHE = 'pto-v2';
var CORE = ['./', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var nav = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var cached = cache.match(nav ? './' : req, { ignoreSearch: true });
    // The page itself is revalidated with the server every time ('no-cache'), so a new
    // version shows up at once instead of after the browser's own 10-minute cache.
    var net = fetch(nav ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req).then(function (res) {
      if (res.ok && res.type === 'basic') cache.put(nav ? './' : req, res.clone());
      return res;
    });
    net.catch(function () { /* handled below; this keeps a late failure from being reported as unhandled */ });
    // a slow network falls back to the cached copy after 4 s (when there is one)
    var slow = new Promise(function (resolve) { setTimeout(function () { cached.then(function (c) { if (c) resolve(c); }); }, 4000); });
    return Promise.race([net, slow]).catch(function () {
      return cached.then(function (c) { return c || Response.error(); });
    });
  }));
});
