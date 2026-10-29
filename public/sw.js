const CACHE_NAME = 'tripsplit-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// 1. Install event: pre-cache critical app shell and static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-caching encountered an issue:', err);
      })
  );
});

// 2. Activate event: purge outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch event: Network-first for navigations; Cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Never intercept or cache requests when running on localhost / development
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }

  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests originating from same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Bypass dynamic API data endpoints to allow Dexie/IndexedDB offline queue to handle failures
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For HTML navigations (page loads/reloads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline and request fails, try matching the exact URL from cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // Fallback to cached dashboard shell
          const fallbackDashboard = await caches.match('/dashboard');
          if (fallbackDashboard) return fallbackDashboard;

          const fallbackRoot = await caches.match('/');
          if (fallbackRoot) return fallbackRoot;

          return new Response('Offline: TripSplit app shell unavailable.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // For Next.js static bundles and public media assets: Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|css|js|json)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
