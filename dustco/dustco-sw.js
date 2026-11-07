/* Dustco PWA service worker — scope limited to this folder (/wap/dustco/) */
const CACHE = "dustco-v1";
const CORE = [
  "./",
  "./index.html",
  "./dustco.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("dustco-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                      // never touch WhatsApp, social, etc.
  if (!url.pathname.startsWith(new URL("./", self.location).pathname)) return; // stay inside this folder

  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isPage) {
    // network-first so catalog/HTML updates show up quickly; fall back to cache offline
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html") || caches.match("./")))
    );
    return;
  }

  // other assets: cache-first, refresh in background
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
