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
        .catch(() => cached || (req.mode === 'navigate' ? caches.match(scopeUrl('.')) : undefined))
      return cached || network
    })
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus()
          if (typeof client.navigate === 'function') client.navigate(scopeUrl('.'))
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(scopeUrl('.'))
    })
  )
})

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {}
  const title = data.title || '«Вместе»'
  const options = {
    body: data.body || '',
    tag: data.tag || `push-${Date.now()}`,
    icon: scopeUrl('icons/icon-192.png'),
    badge: scopeUrl('icons/icon-192.png'),
  }
  e.waitUntil(self.registration.showNotification(title, options))
})
