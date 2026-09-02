const CACHE_NAME = "mushavo-budget-v36";
const APP_SHELL = [
  "./",
  "./index.html",
  "./signup.html",
  "./offline.html",
  "./styles.css?v=38",
  "./app.js?v=44",
  "./config.js?v=24",
  "./manifest.webmanifest",
  "./assets/mushavo-budget-logo.png",
  "./assets/pwa-icon-192.png",
  "./assets/pwa-icon-512.png",
  "./assets/apple-touch-icon.png"
];

const NETWORK_FIRST_FILES = new Set([
  "index.html",
  "signup.html",
  "config.js",
  "app.js",
  "styles.css",
  "manifest.webmanifest"
]);

async function cacheFreshResponse(request, cacheMode = "no-cache") {
  const response = await fetch(request, { cache: cacheMode });
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallback, cacheMode = "no-cache") {
  try {
    return await cacheFreshResponse(request, cacheMode);
  } catch (_error) {
    return (await caches.match(request)) ||
      (fallback ? await caches.match(fallback) : null) ||
      Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("mushavo-budget-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();

    // Reload tabs controlled by an older worker so they immediately receive
    // the corrected configuration and asset paths without a hard refresh.
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.allSettled(windows.map((client) => client.navigate(client.url)));
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "./offline.html"));
    return;
  }

  const fileName = requestUrl.pathname.split("/").pop();
  if (NETWORK_FIRST_FILES.has(fileName)) {
    event.respondWith(networkFirst(event.request, null, fileName === "config.js" ? "no-store" : "no-cache"));
    return;
  }

  const refresh = cacheFreshResponse(event.request).catch(() => null);
  event.waitUntil(refresh);
  event.respondWith(
    caches.match(event.request).then(async (cached) => cached || (await refresh) || Response.error())
  );
});
