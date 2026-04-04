// FoodBridge Service Worker — Auto-Update PWA
// Version is updated on every deployment (injected by build or changed manually)
const CACHE_VERSION = 'foodbridge-v1.0.0';
const STATIC_CACHE  = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/login',
  '/register',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ── INSTALL: cache static assets ─────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.warn('[SW] Cache addAll partial fail:', err))
  );
  // Don't skipWaiting here — wait for user to approve update
  // self.skipWaiting() is called ONLY when user clicks "Update Now"
});

// ── ACTIVATE: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: serve from cache, fall back to network ─────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, API calls, and POST forms
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation (HTML pages) — network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/login')))
    );
    return;
  }

  // Static assets — cache first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && event.request.url.startsWith('http')) {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ── MESSAGE: handle skipWaiting from UI ───────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting — applying update now');
    self.skipWaiting();
  }
});
