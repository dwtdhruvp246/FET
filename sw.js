const CACHE_NAME = "mushavo-budget-v15";
const APP_SHELL = [
  "./",
  "./index.html",
  "./signup.html",
  "./offline.html",
  "./styles.css?v=22",
  "./app.js?v=26",
  "./config.js?v=20",
  "./manifest.webmanifest",
  "./assets/ledger-mark.svg",
  "./assets/pwa-icon.svg",
  "./assets/pwa-icon-192.png",
  "./assets/pwa-icon-512.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch (_error) {
      payload = { body: "You have a new Mushavo Budget reminder." };
    }

    const appName = "Mushavo Budget";
    const title = typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim().slice(0, 120)
      : appName;
    const body = typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim().slice(0, 240)
      : "You have a new reminder in Mushavo Budget.";
    const tag = typeof payload.tag === "string" && payload.tag.trim()
      ? payload.tag.trim().slice(0, 160)
      : `mushavo-${Date.now()}`;
    const requestedUrl = typeof payload.url === "string" ? payload.url : "./index.html#family/dashboard";
    const targetUrl = new URL(requestedUrl, self.registration.scope);
    if (targetUrl.origin !== self.location.origin) targetUrl.href = new URL("./index.html#family/dashboard", self.registration.scope).href;

    await self.registration.showNotification(title, {
      body,
      icon: "./assets/pwa-icon-192.png",
      badge: "./assets/pwa-icon-192.png",
      tag,
      renotify: false,
      data: {
        appName,
        url: targetUrl.href,
        notificationId: typeof payload.notificationId === "string" ? payload.notificationId : null,
        itemType: typeof payload.itemType === "string" ? payload.itemType : "dashboard",
        itemId: typeof payload.itemId === "string" ? payload.itemId : null
      }
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const fallback = new URL("./index.html#family/dashboard", self.registration.scope).href;
    let targetUrl = fallback;
    try {
      const candidate = new URL(event.notification.data?.url || fallback, self.registration.scope);
      if (candidate.origin === self.location.origin) targetUrl = candidate.href;
    } catch (_error) {
      targetUrl = fallback;
    }

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ("navigate" in client) await client.navigate(targetUrl);
      return client.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
