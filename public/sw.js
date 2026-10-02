// Service worker de YONA : rend le site installable et accélère les visites suivantes.
// Volontairement simple : il ne garde en mémoire que les fichiers statiques
// (scripts, styles, images, icônes) et ne touche jamais aux données (connexion, messages, API).
const CACHE = "yona-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/images/") ||
    /^\/(icon-[\w-]+|apple-touch-icon|favicon)\.(png|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !isStaticAsset(url)) return;

  // Fichiers statiques : d'abord la copie locale, sinon le réseau (puis on la garde).
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }),
      ),
    ),
  );
});
