/* Eco Wise service worker: lets the game open and play with no internet after the first visit.
   Change VERSION whenever you want every device to drop its old saved copy. */
const VERSION = 'eco-wise-v1';
const CORE = ['./', 'index.html', 'questions.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const c = await caches.open(VERSION);
  try {
    const r = await fetch(req);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const home = await c.match('index.html'); if (home) return home; }
    throw err;
  }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return;            // scores always go to the server, never cached
    e.respondWith(networkFirst(req));                        // page and questions: newest when online, saved copy when offline
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));                // fonts
  }
});
