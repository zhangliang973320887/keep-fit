// Keep Fit service worker — minimal hand-rolled cache strategy.
// Bump CACHE_VERSION to force clients to drop old caches on the next visit.
const CACHE_VERSION = "keepfit-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Pre-cached on install. Just the entry pages so the app shell is reachable offline.
const PRECACHE_URLS = ["/", "/exercises", "/workouts", "/history"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Use { cache: 'reload' } so we don't cache a stale HTML during install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: "reload" })
            .then((r) => (r.ok ? cache.put(url, r) : null))
            .catch(() => null),
        ),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Strategy router
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip Next.js dev/HMR endpoints and the manifest itself
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Static asset CDNs (jsdelivr) — stale-while-revalidate, long-lived
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Same-origin
  if (url.origin === self.location.origin) {
    // Hashed Next assets are immutable — cache forever
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(request));
      return;
    }
    // HTML / app pages — network first, fall back to cache
    if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
      event.respondWith(networkFirst(request));
      return;
    }
    // Other same-origin static (icons, manifest, etc) — stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Other origins — let the network handle it (no caching)
});

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    // Last resort: return the cached home page
    const home = await cache.match("/");
    if (home) return home;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetchPromise;
}
