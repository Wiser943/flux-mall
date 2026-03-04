// ============================================================
// FLUX MALL - Service Worker
// Caches files for offline use and faster loading
// ============================================================

const CACHE_NAME = 'flux-mall-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/img/logo.png',
  '/account/account.html',
  '/account/account.css',
  '/account/script.js',
  '/cpanel/admin.html',
  '/cpanel/style.css',
  '/cpanel/script.js',
];

// ─── INSTALL ──────────────────────────────────────────────
// Cache all static assets when SW is first installed
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch((err) => {
      console.log('[SW] Cache install failed:', err);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────
// Clean up old caches when SW updates
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────
// Network first for API calls, Cache first for static files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API requests - never cache these
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For static files: try cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache - fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Cache the new file for next time
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});