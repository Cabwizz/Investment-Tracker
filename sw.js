const CACHE = 'inv-tracker-cache-v5';
const ASSETS = ['./','./index.html','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE?null:caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(net => {
      if(e.request.method==='GET'){ const copy = net.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); }
      return net;
    }).catch(()=>{ if(e.request.mode==='navigate') return caches.match('./index.html'); }))
  );
});
