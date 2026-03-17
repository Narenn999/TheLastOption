const CACHE_NAME = 'last-option-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install the service worker and pre-cache core files
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate new SW immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Opened cache, caching core files...');
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages
  );
});

// Fetch: Network-first for HTML, Cache-first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and cross-origin requests (e.g. unsplash images, flaticon)
  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Network-first strategy for HTML pages (always get fresh content)
  if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails (offline)
          return caches.match(event.request).then(cached => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Cache-first strategy for other assets (CSS, JS, etc.)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});
