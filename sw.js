const CACHE = 'box-lacrosse-offline-v214-substitutes-20261124';
const ASSETS = ['./','./index.html','./app.js','./app.js?v=214','./league-data.js','./print-rosters.html','./report.html','./report.js','./manifest.webmanifest','./icon.svg','./716-lacrosse-logo.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && key.startsWith('box-lacrosse-offline-')).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const exact = await cache.match(event.request);
    if (exact) return exact;
    // Reports use a game ID in the URL; the HTML shell is identical for every game.
    // Keep the original navigation URL so report.js can read its query string.
    const relative = url.pathname.slice(new URL(self.registration.scope).pathname.length);
    if (relative === 'report.html' || relative === 'print-rosters.html') {
      const shell = await cache.match(new URL(relative, self.registration.scope).href);
      if (shell) return shell;
    }
    return fetch(event.request);
  })());
});
