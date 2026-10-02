/*
 * Service worker de YONA (application installable).
 * - Pages : toujours le réseau d'abord (contenu à jour, connexion fiable) ; la dernière
 *   version connue sert seulement quand il n'y a pas de connexion.
 * - Fichiers fixes du site (scripts, styles, logo, icônes, base des pays) : mis en
 *   cache pour que l'application s'ouvre vite.
 * - Rien d'autre n'est touché : Supabase, Google, paiements et API passent directement.
 */
const VERSION = "yona-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/geo/") ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  if (isStaticAsset(url)) {
    // Fichiers à nom unique (/assets/) : le cache suffit. Autres fichiers (logo, images,
    // pays) : réponse immédiate depuis le cache, puis mise à jour en arrière-plan.
    const immutable = url.pathname.startsWith("/assets/");
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached && immutable) return cached;
          const network = fetch(request)
            .then((response) => {
              if (response.ok && response.type === "basic") cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          if (cached) {
            event.waitUntil(network);
            return cached;
          }
          return network;
        }),
      ),
    );
  }
});
