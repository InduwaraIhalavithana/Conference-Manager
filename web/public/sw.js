// ConferenceHub check-in desk: lets an open desk reload and keep scanning when the venue Wi-Fi drops.
// Scans themselves are queued in IndexedDB by the page; this worker only keeps the page and its files available.
const VERSION = "cm-desk-v1";
const DESK = /^\/(en|si|ta)\/dashboard\/conferences\/[^/]+\/check-in\/?$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Built files never change under the same name: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/logo.svg") {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // The desk page: always try the network, fall back to the last copy when offline.
  if (request.mode === "navigate" && DESK.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error())),
    );
  }
});
