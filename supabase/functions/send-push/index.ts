// Отправка пуш-уведомления партнёру.
//
// Клиент зовёт эту функцию «в фоне» после действия (создано событие, отметка
// «на месте», оценка, запрос на перенос и т.п.). Функция берёт из БД самое
// свежее ещё не отправленное уведомление получателя и отправляет его по всем
// его подпискам браузера (Web Push). Уведомления создаёт сама БД (таблица
// notifications), а каждое из них отправляется ровно один раз (флаг pushed_at).
//
// Переменные окружения функции:
//   VAPID_PUBLIC_KEY   — публичный ключ VAPID (base64url)
//   VAPID_PRIVATE_KEY  — приватный ключ VAPID (base64url)
//   VAPID_SUBJECT      — mailto: контакт (необязательно, по умолчанию задан ниже)
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY подставляются платформой сами.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.111.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:plans@example.com'

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let vapidError = ''
try {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
} catch (e) {
  vapidError = String(e?.message || e)
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// Отправка одним подпискам. Удаляем подписку только если она реально протухла
// (404/410 — endpoint больше не существует), а не при любой ошибке: например,
// при несовпадении VAPID-ключей пуш-сервис отвечает 401, и подписка жива.
// Ошибки возвращаем наружу — по ним видно, что именно сломалось.
async function sendToSubs(subs, payload, options) {
  let pushed = 0
  const errors = []
  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys || {} },
          payload,
          options
        )
        pushed++
      } catch (e) {
        const code = e?.statusCode || 0
        if (code === 404 || code === 410) {
          try {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          } catch {}
        } else {
          errors.push(String(e?.message || e).slice(0, 400))
        }
      }
    })
  )
  return { pushed, errors }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405)

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Нет авторизации' }, 401)
    if (!vapidPublic || !vapidPrivate) return json({ error: 'VAPID не настроен' }, 500)
    if (vapidError) return json({ error: `VAPID: ${vapidError}` }, 500)

    const { data: me, error: authError } = await admin.auth.getUser(token)
    if (authError || !me?.user) return json({ error: 'Сессия недействительна' }, 401)

    let body = {}
    try {
      body = await req.json()
    } catch {}
    const type = String(body.type || '')
    const taskId = body.task_id ? String(body.task_id) : null
    const toUserId = body.to_user_id ? String(body.to_user_id) : null

    // Тестовый пуш: шлём сами себе, без таблицы уведомлений. Используется
    // кнопкой «Тест пуша», чтобы проверить всю цепочку на одном устройстве.
    if (type === 'test') {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('couple_id')
        .eq('id', me.user.id)
        .maybeSingle()
      const { data: mySubs, error: subsError } = await admin
        .from('push_subscriptions')
        .select('endpoint')
        .eq('user_id', me.user.id)
      const debug = {
        url: supabaseUrl,
        userId: me.user.id,
        coupleId: profile?.couple_id || null,
        subsCount: mySubs?.length || 0,
        subsError: subsError?.message || null,
        profileError: profileError?.message || null,
      }
      if (!mySubs?.length) return json({ ok: true, pushed: 0, errors: ['Нет подписок в БД'], debug })
      const { pushed, errors } = await sendToSubs(
        mySubs,
        JSON.stringify({ title: 'Universe of Plans', body: 'Тест: пуш работает!', url: '.' }),
        { TTL: 300, urgency: 'high' }
      )
      return json({ ok: true, pushed, errors, debug })
    }

    // Получатель: явный user_id (запросы на пару) либо партнёр по паре.
    let recipientId = toUserId
    if (!recipientId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('couple_id')
        .eq('id', me.user.id)
        .maybeSingle()
      if (profile?.couple_id) {
        const { data: members } = await admin
          .from('profiles')
          .select('id')
          .eq('couple_id', profile.couple_id)
        recipientId = members?.find((m) => m.id !== me.user.id)?.id || null
      }
    }
    if (!recipientId) return json({ ok: true, pushed: 0 })

    // Самое свежее ещё не отправленное уведомление получателя (с фильтром
    // по типу/задаче). Отправляем по флагу pushed_at, а не seen_at: «просмотрено»
    // клиент помечает сразу при тосте в реальном времени, и иначе пуш не успевал бы.
    let query = admin
      .from('notifications')
      .select('*')
      .eq('user_id', recipientId)
      .is('pushed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    if (type) query = query.eq('type', type)
    if (taskId) query = query.eq('task_id', taskId)
    const { data: notif } = await query.maybeSingle()
    if (!notif) return json({ ok: true, pushed: 0 })

    // Помечаем отправленным ДО доставки, чтобы повторный вызов не пушил дубль.
    await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', notif.id)

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', recipientId)
    if (!subs?.length) return json({ ok: true, pushed: 0 })

    const payload = JSON.stringify({
      title: 'Universe of Plans',
      body: notif.message,
      url: '.',
      data: { type: notif.type, task_id: notif.task_id, notification_id: notif.id },
    })

    const { pushed, errors } = await sendToSubs(subs, payload, { TTL: 86400, urgency: 'high' })

    return json({ ok: true, pushed, errors })
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500)
  }
})
