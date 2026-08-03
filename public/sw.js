const CACHE = 'together-v1'
const SCOPE = (self.registration && self.registration.scope) || self.location.origin + '/'

function scopeUrl(path) {
  return new URL(path, SCOPE).href
}

const CORE = [
  scopeUrl('.'),
  scopeUrl('manifest.json'),
  scopeUrl('icons/icon-192.png'),
  scopeUrl('icons/icon-512.png'),
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // навигация: сначала сеть, чтобы всегда получать свежий HTML
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone))
          return res
        })
        .catch(() => caches.match(scopeUrl('.')))
    )
    return
  }

  // остальное: из кэша, в фоне обновляем
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
