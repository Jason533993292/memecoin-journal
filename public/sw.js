const CACHE_NAME = "memecoin-journal-static-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.json", "/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/__/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || ["style", "script", "font", "image"].includes(request.destination);
  if (!isStatic) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    // Clone synchronously, before the browser begins consuming the response.
    // Delaying clone() until caches.open() resolved caused "body already used".
    if (response.ok && response.type === "basic") {
      const cacheCopy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, cacheCopy));
    }
    return response;
  })));
});
