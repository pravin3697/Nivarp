// Minimal offline service worker for PWA installation criteria
const CACHE_NAME = 'nivarp-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle dynamic requests, fallback gracefully
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});