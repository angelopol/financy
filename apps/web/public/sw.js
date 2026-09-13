// Registered only to satisfy PWA installability checks. Financy shows live
// balances, so it intentionally does not cache API responses or app shell
// files — every request still goes to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
