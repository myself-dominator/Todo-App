// ============================================================
// Service Worker — 1.3.3.6
// Strategy: Cache-first, fallback to network
// ============================================================

const CACHE_NAME = '1.3.3.6';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',

    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] App shell cached successfully');
            })
            .catch((err) => {
                console.error('[SW] Pre-cache failed:', err);
            })
    );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // Take control of all open clients without a page reload
                return self.clients.claim();
            })
            .catch((err) => {
                console.error('[SW] Activate cleanup failed:', err);
            })
    );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    // Only handle GET requests; skip cross-origin requests (e.g. CDN scripts)
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Stale-While-Revalidate: Update cache in background
                    event.waitUntil(
                        fetch(event.request).then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                        }).catch((err) => console.warn('[SW] Background update failed', err))
                    );
                    return cachedResponse; // Cache hit — serve immediately
                }

                // Cache miss — fetch from network and cache the response
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Only cache valid responses
                        if (
                            !networkResponse ||
                            networkResponse.status !== 200 ||
                            networkResponse.type === 'error'
                        ) {
                            return networkResponse;
                        }

                        // Clone because the response body can only be consumed once
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch((err) => {
                                console.warn('[SW] Failed to cache new resource:', err);
                            });

                        return networkResponse;
                    })
                    .catch((err) => {
                        console.error('[SW] Network request failed:', err);
                        // Optional: return an offline fallback here if needed
                    });
            })
    );
});
// ── Message ──────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        self.registration.showNotification(title, options);
    }
});

// ── Notification Click ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
