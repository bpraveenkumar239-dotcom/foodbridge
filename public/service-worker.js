// FoodBridge Service Worker — v2.0.0
// Bump CACHE_VERSION on every deploy → all devices auto-update silently
const CACHE_VERSION = 'foodbridge-v2.0.0';
const STATIC_CACHE  = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

const PRECACHE = [
  '/', '/login', '/css/style.css', '/js/app.js',
  '/manifest.json', '/images/icon-192.png', '/images/icon-512.png',
];

// INSTALL: cache assets, then skipWaiting → activate immediately (no user action needed)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(err => console.warn('[SW] Precache partial fail:', err))
      .then(() => self.skipWaiting())   // ← activates immediately
  );
});

// ACTIVATE: delete ALL old caches, claim all open tabs
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // ← take control of open pages now
  );
});

// FETCH: network-first for HTML pages, cache-first for assets
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (e.request.mode === 'navigate') {
    // Always fetch fresh HTML, cache as fallback
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(DYNAMIC_CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/login')))
    );
  } else {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => {
        if (r && r.status === 200) caches.open(DYNAMIC_CACHE).then(cache => cache.put(e.request, r.clone()));
        return r;
      }))
    );
  }
});

// Message handler (for manual skip-waiting from UI)
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
