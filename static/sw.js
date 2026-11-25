/*
 * CaveBettor service worker.
 *
 * Three rules, because the workspace is data-heavy and the user may be on a
 * metered Nigerian mobile connection:
 *
 *   1. Never cache anything private. `/api/*` and `/auth/*` are always live —
 *      a cached session response would leak one account into another.
 *   2. Navigations are network-first with a short timeout, so an online user
 *      always gets fresh numbers, and an offline user gets the last page they
 *      saw (or the offline notice) instead of the browser's dinosaur.
 *   3. Static assets are cache-first. SvelteKit hashes immutable bundles, so a
 *      URL only ever points at one byte-identical file.
 */

const VERSION = 'cb-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

/** The offline shell. All of these are cheap, public and stable. */
const SHELL = [
  '/',
  '/pricing',
  '/offline',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

/** Never touch these — they carry a session or live data. */
const PRIVATE = ['/api/', '/auth/'];

/**
 * Only public pages are stored. A workspace page carries the signed-in user's
 * name and desk, so caching it would leak one account into the next on a
 * shared phone. Those pages ask the network and fall back to the offline
 * notice instead.
 */
const PUBLIC_PAGES = ['/', '/pricing', '/offline'];

/** Paths whose response must not be reused across visits. */
const NEVER_CACHE = ['/build-info.json', '/api/health'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failing shell entry must not abort the whole install.
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (response.ok) await cache.put(url, response);
          } catch {
            /* offline during install: the next visit will fill the gap */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
});

function isPrivate(url) {
  return PRIVATE.some((prefix) => url.pathname.startsWith(prefix));
}

function isNeverCache(url) {
  return NEVER_CACHE.includes(url.pathname);
}

function cacheable(response) {
  // Only same-origin, successful, non-partial, cookie-free responses.
  return response && response.ok && response.status === 200 && response.type !== 'opaque' && !response.headers.get('set-cookie');
}

async function networkFirstNavigation(request, store) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    // `no-cache` forces revalidation, so a navigation never resolves from the
    // browser's own HTTP cache while offline — that is how a workspace page
    // used to sneak back in and hide the offline notice.
    const response = await withTimeout(fetch(request, { cache: 'no-cache' }), 4500);
    if (store && cacheable(response)) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    if (store) {
      const cached = (await cache.match(request)) || (await caches.match(request));
      if (cached) return cached;
    }
    // Any workspace route falls back to the offline notice, never to a stale
    // page belonging to a different section (or a different user).
    const shell = await caches.open(SHELL_CACHE);
    return (await shell.match('/offline')) || (await shell.match('/')) || Response.error();
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone()).catch(() => {});
  return response;
}

/** Serve from cache immediately, refresh in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivate(url) || isNeverCache(url)) return;
  // Range requests (media, PDFs) must not be stored.
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    const store = PUBLIC_PAGES.includes(url.pathname) || PUBLIC_PAGES.includes(url.pathname.replace(/\/$/, ''));
    event.respondWith(networkFirstNavigation(request, store));
    return;
  }

  if (url.pathname.startsWith('/_app/immutable/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/') || url.pathname.startsWith('/banners/') || url.pathname.startsWith('/screenshots/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  const destination = request.destination;
  if (destination === 'style' || destination === 'script' || destination === 'font' || destination === 'image') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** Push is wired but no campaign is sent yet; the handler keeps the app installable-ready. */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CaveBettor', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'CaveBettor', {
      body: payload.body || 'New model activity',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      data: { url: payload.url || '/dashboard' },
      tag: payload.tag || 'cavebettor'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
