// Imagier parlant (version web) : fonctionne sans réseau une fois ouvert une première fois.
// - La page : réseau d'abord (pour recevoir les mises à jour), sinon la copie gardée.
// - Le reste (code, polices, sons, icônes) : noms avec empreinte, donc copie gardée d'abord.
const CACHE = "imagier-v1"
const SHELL = ["/", "/manifest.webmanifest", "/favicon.ico", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"]

self.addEventListener("install", (event) => {
  // Un fichier qui n'arrive pas (réseau instable) ne bloque pas l'installation : il sera gardé plus tard
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put("/", copy))
          return response
        })
        .catch(() => caches.match("/")),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ??
      fetch(request).then((response) => {
        // Les sons arrivent parfois par morceaux (206) : on ne garde que les réponses complètes
        if (response.ok && response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      }),
    ),
  )
})
