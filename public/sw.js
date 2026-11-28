// CerdasExam CBT Service Worker — Essential App Assets & Offline Student Exam Cache
const APP_CACHE = 'cerdasexam-app-shell-v1';
const RUNTIME_CACHE = 'cerdasexam-runtime-v1';
const EXAM_DATA_CACHE = 'cerdasexam-exam-data-v1';
const EXAM_SNAPSHOT_URL = '/__offline_exam_cache__/active-exam.json';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/assets/aistudio/LOGO_SMANSA_3D_d5e941c9.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([APP_CACHE, RUNTIME_CACHE, EXAM_DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CACHE_EXAM_DATA' && data.payload) {
    event.waitUntil(
      caches.open(EXAM_DATA_CACHE).then((cache) => {
        const body = JSON.stringify({
          cachedAt: new Date().toISOString(),
          payload: data.payload,
        });
        return cache.put(
          new Request(EXAM_SNAPSHOT_URL),
          new Response(body, {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-CerdasExam-Offline-Cache': '1',
            },
          })
        );
      })
    );
    return;
  }

  if (data.type === 'CLEAR_EXAM_DATA') {
    event.waitUntil(
      caches.open(EXAM_DATA_CACHE).then((cache) => cache.delete(EXAM_SNAPSHOT_URL))
    );
  }
});

function isCacheableFontOrStatic(url) {
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    return true;
  }
  if (url.origin !== self.location.origin) {
    return false;
  }
  if (url.pathname.startsWith('/api/')) {
    return false;
  }
  return true;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Skip non-HTTP schemes and live Firebase/Firestore traffic
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Serve cached offline student exam snapshot directly if requested
  if (url.origin === self.location.origin && url.pathname === EXAM_SNAPSHOT_URL) {
    event.respondWith(
      caches.open(EXAM_DATA_CACHE).then((cache) =>
        cache.match(req).then(
          (cached) =>
            cached ||
            new Response(JSON.stringify({ cachedAt: null, payload: null }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
        )
      )
    );
    return;
  }

  // Graceful offline JSON degradation for server /api/* GET endpoints
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            JSON.stringify({
              ok: false,
              offline: true,
              error: 'Mode offline aktif — menggunakan data lokal tersimpan.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            }
          )
      )
    );
    return;
  }

  // Navigation requests (HTML): Network-first with cached app-shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(APP_CACHE).then((cache) => {
              cache.put('/index.html', copy).catch(() => {});
            });
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(APP_CACHE);
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            new Response('Mode Offline — Silakan buka kembali aplikasi.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        })
    );
    return;
  }

  // Essential app assets (JS, CSS, images, fonts): Stale-While-Revalidate
  if (isCacheableFontOrStatic(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }
        const netRes = await networkPromise;
        if (netRes) return netRes;
        const appCached = await caches.match(req);
        if (appCached) return appCached;
        return new Response('', { status: 504, statusText: 'Offline' });
      })
    );
  }
});
