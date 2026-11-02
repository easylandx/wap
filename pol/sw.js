// PolaPro service worker: offline-capable app shell
const CACHE = 'polapro-v2';
const SHELL = ['/app/pol/', '/app/pol/index.html', '/app/pol/manifest.webmanifest',
  '/app/pol/icons/icon-192.png', '/app/pol/icons/icon-512.png', '/app/pol/icons/icon-maskable-512.png',
  '/app/pol/icons/apple-touch-icon.png', '/app/pol/icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('polapro-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page navigations: network first, fall back to the cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/app/pol/index.html', copy));
        return res;
      }).catch(() => caches.match('/app/pol/index.html'))
    );
    return;
  }

  // Same-origin files and Google Fonts: cache first, update in the background
  const ok = (url.origin === location.origin && url.pathname.startsWith('/app/pol/')) ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
