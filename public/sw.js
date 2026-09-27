const CACHE_NAME = 'nivarp-v2';

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear old cache versions automatically on deploy
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network first: always try to fetch fresh code from Vercel first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});