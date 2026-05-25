const CACHE_NAME = "fps-roster-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260526-fps-roster-1",
  "./app.js?v=20260526-fps-roster-1",
  "./manifest.webmanifest",
  "./icon.svg",
  "../shared-store.js?v=20260523-events-1",
  "../ship-specs.js?v=20260524-ship-specs-1"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
