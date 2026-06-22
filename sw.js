/* ============================================================
   Watch Party — service worker
   Caches the app shell so it works offline / installs as a PWA.
   Network-first for the HTML (so updates land quickly),
   cache-first for static assets.
   ============================================================ */
var CACHE = "watch-party-v4";
var SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./subtitles.js",
  "./peerjs.min.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll is atomic-ish; ignore individual failures so a missing
      // icon doesn't break the whole install.
      return Promise.all(SHELL.map(function (url) {
        return c.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Never cache the TURN/Xirsys call or peer signalling — always go to network.
  if (url.origin !== self.location.origin) return;

  // HTML navigations + the document itself are NETWORK-FIRST so code edits
  // (like the new fs-chat button) are picked up immediately instead of being
  // masked by a stale cached shell. Static assets stay cache-first.
  var isHTML = req.mode === "navigate" ||
               url.pathname === "/" ||
               url.pathname.endsWith("/index.html") ||
               url.pathname.endsWith(".html");

  if (isHTML) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, clone).catch(function () {}); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (c) { return c || Response.error(); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        // cache a fresh copy of same-origin GETs
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, clone).catch(function () {}); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
