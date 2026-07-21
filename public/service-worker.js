const CACHE_NAME = 'financy-static-v2';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/maskable.svg',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // A missing optional icon must not abort the complete worker installation.
    await Promise.allSettled(PRECACHE_URLS.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });

      if (response.ok) {
        await cache.put(url, response);
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter((key) => key.startsWith('financy-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== 'GET'
    || url.origin !== self.location.origin
    || !(url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/icons/'))
  ) {
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const fetchAndCache = async () => {
      const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    };

    if (cached) {
      event.waitUntil(fetchAndCache().catch(() => undefined));

      return cached;
    }

    return fetchAndCache();
  })());
});
