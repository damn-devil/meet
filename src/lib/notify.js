export async function notifyPermission() {
  try {
    if (!('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    return await Notification.requestPermission()
  } catch {
    return 'default'
  }
}

export async function notify(title, body, tag) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.ready
    if (!reg || typeof reg.showNotification !== 'function') return
    reg.showNotification(title || '«Вместе»', {
      body: body || '',
      tag: tag || `together-${Date.now()}`,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    })
  } catch {}
}
