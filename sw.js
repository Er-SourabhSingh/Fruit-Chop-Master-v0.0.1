const CACHE_VERSION = "v4";
const APP_SHELL_CACHE = `fruit-chop-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fruit-chop-runtime-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

const APP_SHELL_URLS = APP_SHELL_FILES.map((path) => new URL(path, self.location.href).toString());
const APP_SHELL_PATHS = new Set(APP_SHELL_URLS.map((url) => new URL(url).pathname));

function isCacheableResponse(response) {
  return response && (response.status === 200 || response.type === "opaque");
}

async function cacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  const requests = APP_SHELL_FILES.map((path) => new Request(path, { cache: "reload" }));
  await cache.addAll(requests);
}

async function cleanupOldCaches() {
  const allowedCaches = new Set([APP_SHELL_CACHE, RUNTIME_CACHE]);
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("fruit-chop-") && !allowedCaches.has(key))
      .map((key) => caches.delete(key)),
  );
}

async function putRuntimeCache(request, response) {
  if (!isCacheableResponse(response)) {
    return;
  }
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
}

async function getOfflineIndex() {
  return (
    (await caches.match("./index.html")) ||
    (await caches.match(new URL("./index.html", self.location.href).toString())) ||
    (await caches.match("./"))
  );
}

async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    await putRuntimeCache(request, networkResponse);
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const fallback = await getOfflineIndex();
    return fallback || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const networkResponse = await fetch(request);
  await putRuntimeCache(request, networkResponse);
  return networkResponse;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return caches.match(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldCaches();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  const isCoreFile = APP_SHELL_PATHS.has(requestUrl.pathname);
  if (isCoreFile) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (["script", "style", "image", "font"].includes(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
