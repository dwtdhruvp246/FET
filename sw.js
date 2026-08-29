const CACHE_NAME = "mushavo-budget-v17-no-web-push";
const APP_SHELL = [
  "./",
  "./index.html",
  "./signup.html",
  "./offline.html",
  "./styles.css?v=21",
  "./app.js?v=25",
  "./manifest.webmanifest",
  "./assets/ledger-mark.svg",
  "./assets/pwa-icon.svg",
  "./assets/pwa-icon-192.png",
  "./assets/pwa-icon-512.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache each file independently so a missing optional asset cannot block
    // this rollback worker from replacing the previous Web Push worker.
    await Promise.all(APP_SHELL.map(async (assetUrl) => {
      try {
        const request = new Request(assetUrl, { cache: "reload" });
        const response = await fetch(request);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(request, response);
      } catch (error) {
        console.warn("[Mushavo SW] Precache skipped", assetUrl, error?.message || "request failed");
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));

    // This rollback keeps the PWA but permanently removes its Web Push device
    // subscription. In-app reminders continue to work through app.js.
    try {
      const subscription = await self.registration.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
    } catch (error) {
      console.warn("[Mushavo SW] Existing Web Push subscription could not be removed", error?.name || "unsubscribe failed");
    }

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Never cache runtime configuration or the service worker. This prevents an
  // old Supabase key or an old worker from surviving in newly opened tabs.
  if (requestUrl.pathname.endsWith("/config.js") || requestUrl.pathname.endsWith("/sw.js")) {
    event.respondWith(fetch(new Request(event.request, { cache: "no-store" })));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(async () =>
          (await caches.match(event.request)) ||
          (await caches.match("./index.html")) ||
          caches.match("./offline.html")
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
