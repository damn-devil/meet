// Подписка на Web Push (пуш-уведомления), которые приходят даже когда
// вкладка/приложение закрыты. Работает только там, где есть service worker
// и VITE_VAPID_PUBLIC_KEY (публичный VAPID-ключ проекта).
import { api } from '../api.js'

const KEY = 'together_push'

export function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!import.meta.env.VITE_VAPID_PUBLIC_KEY
  )
}

function isEnabled() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg?.pushManager?.getSubscription() || null
}

export async function getPushStatus() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false, enabled: false }
  const sub = await currentSubscription()
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!sub,
    enabled: isEnabled() && !!sub,
  }
}

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function subscribeAndSave(reg) {
  const existing = await reg.pushManager.getSubscription()
  const sub = existing || (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  }))
  const json = sub.toJSON()
  await api.savePushSubscription(json.endpoint, {
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
  })
}

// Включить уведомления: спросить разрешение, подписаться и сохранить в БД.
// Подписка/сохранение обёрнуты в таймаут: если пуш-сервис не отвечает,
// возвращаем ошибку вместо бесконечного спиннера на кнопке.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, error: 'Браузер не поддерживает push-уведомления' }
  if (Notification.permission === 'denied') return { ok: false, error: 'Разрешение на уведомления заблокировано' }

  let reg = await navigator.serviceWorker.getRegistration()
  if (!reg) {
    reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: 'Вы не разрешили уведомления' }
  }

  try {
    await withTimeout(subscribeAndSave(reg), 30000, 'Пуш-сервис не ответил вовремя — попробуйте ещё раз')
  } catch (err) {
    const stale = await reg.pushManager.getSubscription().catch(() => null)
    if (stale) await stale.unsubscribe().catch(() => {})
    return { ok: false, error: err?.message || 'Не удалось включить уведомления' }
  }
  try {
    localStorage.setItem(KEY, '1')
  } catch {}
  return { ok: true }
}

// Выключить уведомления: отписаться от пушей и удалить подписку из БД.
export async function disablePush() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
  const sub = await currentSubscription()
  if (!sub) return { ok: true }
  try {
    await api.removePushSubscription(sub.endpoint)
  } catch {}
  await sub.unsubscribe()
  return { ok: true }
}
