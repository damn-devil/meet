import { supabase, supabaseReady } from './lib/supabase.js'

export async function getToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function hasSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

// Ссылка из письма «восстановление пароля» открывает приложение с сессией
// типа PASSWORD_RECOVERY. Ловим этот момент, чтобы показать форму нового пароля,
// а не пускать в приложение как обычно.
let recoveryFlag = false
if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoveryFlag = true
  })
}

export function isRecoverySession() {
  return recoveryFlag
}

export function clearRecoverySession() {
  recoveryFlag = false
}

export function setToken() {}

export async function clearToken() {
  if (supabase) await supabase.auth.signOut()
}

async function rpc(fn, params) {
  const client = supabaseReady()
  const { data, error } = await client.rpc(fn, params)
  if (error) {
    const err = new Error(error.message || 'Ошибка запроса')
    err.code = error.code
    throw err
  }
  return data
}

function authError(err) {
  if (!err) return 'Не удалось войти'
  const msg = err.message || String(err)
  if (/invalid login credentials/i.test(msg)) return 'Неверный email или пароль'
  if (/already registered|user already|exists/i.test(msg)) return 'Такой email уже зарегистрирован'
  if (/password/i.test(msg) && /6|characters|min/i.test(msg)) return 'Пароль должен быть не короче 6 символов'
  return msg
}

export const api = {
  register: async ({ name, email, password }) => {
    const client = supabaseReady()
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw new Error(authError(error))
    if (!data.session) {
      throw new Error('Мы отправили письмо на почту — подтвердите адрес и войдите')
    }
    await rpc('create_profile', { p_name: name })
    return api.me()
  },
  login: async ({ email, password }) => {
    const client = supabaseReady()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(authError(error))
    return api.me()
  },
  logout: async () => {
    await clearToken()
  },
  resetPassword: async (email) => {
    const client = supabaseReady()
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw new Error(error.message || 'Не удалось отправить ссылку')
  },
  updatePassword: async (password) => {
    const client = supabaseReady()
    const { error } = await client.auth.updateUser({ password })
    if (error) throw new Error(error.message || 'Не удалось сменить пароль')
  },
  me: async () => {
    let data = await rpc('get_me')
    if (data && !data.user) {
      // Сессия есть, но профиль ещё не создан (первый вход через OAuth)
      // — автоматически создаём его, имя берём из метаданных провайдера.
      const client = supabaseReady()
      const { data: s } = await client.auth.getSession()
      const u = s?.session?.user
      const meta = u?.user_metadata || {}
      const email = u?.email || ''
      const name =
        meta?.name || meta?.full_name || meta?.user_name ||
        (email ? email.split('@')[0] : 'Пользователь')
      await rpc('create_profile', { p_name: name })
      data = await rpc('get_me')
    }
    return data
  },
  updateMe: async (body) => {
    await rpc('update_profile', {
      p_name: body.name,
      p_avatar: body.avatar,
      p_avatar_url: body.avatar_url,
      p_bio: body.bio,
      p_theme: body.theme,
      p_accent: body.accent,
      p_autocheck: body.autocheck,
      p_telegram: body.telegram,
      p_imessage: body.imessage,
      p_username: body.username ?? null,
      p_phone: body.phone ?? null,
    })
    return api.me()
  },
  checkUsername: (username) => rpc('check_username', { p_username: username }),
  deleteAccount: () => rpc('delete_account'),
  deleteAvatarFiles: async () => {
    try {
      const client = supabaseReady()
      const { data: session } = await client.auth.getSession()
      const uid = session?.session?.user?.id
      if (!uid) return
      const { data: files } = await client.storage.from('avatars').list(uid, { limit: 100 })
      const paths = (files || []).filter((f) => f.name).map((f) => `${uid}/${f.name}`)
      if (paths.length) await client.storage.from('avatars').remove(paths)
    } catch {}
  },
  uploadAvatar: async (file, ext) => {
    const client = supabaseReady()
    const { data: session } = await client.auth.getSession()
    const uid = session?.session?.user?.id || 'anon'
    const mime = (file?.type || '').toLowerCase()
    const actualExt = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/jpeg' ? 'jpg' : ext || 'jpg'
    const path = `${uid}/${Date.now()}.${actualExt}`
    const { error } = await client.storage.from('avatars').upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file?.type || undefined,
    })
    if (error) throw new Error(error.message || 'Не удалось загрузить фото')
    const { data: pub } = client.storage.from('avatars').getPublicUrl(path)
    return pub?.publicUrl || null
  },
  tasks: () => rpc('get_tasks'),
  createTask: (body) =>
    rpc('create_task', {
      p_title: body.title,
      p_description: body.description || '',
      p_scheduled_at: body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null,
    }),
  checkin: (id) => rpc('check_in', { p_task_id: id }),
  requestAgreement: (id, type, scheduled_at, title, description) =>
    rpc('request_agreement', {
      p_task_id: id,
      p_type: type,
      p_proposed_value: scheduled_at ? new Date(scheduled_at).toISOString() : null,
      p_proposed_title: title || null,
      p_proposed_description: description || null,
    }),
  respondAgreement: (id, approve) =>
    rpc('respond_agreement', { p_agreement_id: id, p_approve: approve }),
  cancelAgreement: (id) => rpc('cancel_agreement', { p_agreement_id: id }),
  rate: (id, score, comment) =>
    rpc('rate_task', { p_task_id: id, p_score: score, p_comment: comment || '' }),
  updateCouple: (body) =>
    rpc('update_couple_settings', {
      p_bg: body.bg,
    }),
  searchUsers: (query) => rpc('search_users', { p_query: query || null }),
  myRequests: () => rpc('get_my_requests'),
  sendCoupleRequest: (toId) => rpc('send_couple_request', { p_to_id: toId }),
  respondCoupleRequest: (id, approve) => rpc('respond_couple_request', { p_request_id: id, p_approve: approve }),
  cancelCoupleRequest: (id) => rpc('cancel_couple_request', { p_request_id: id }),
  breakUpCouple: () => rpc('break_up_couple'),
  stats: () => rpc('get_stats'),
  freeDays: () => rpc('get_free_days'),
  setFreeDay: (day, free) => rpc('set_free_day', { p_day: day, p_free: free }),
  adminUsers: () => rpc('admin_get_users'),
  adminActivity: (userId) => rpc('admin_get_activity', { p_user_id: userId }),
  adminDeleteUser: (userId) => rpc('admin_delete_user', { p_user_id: userId }),
  adminLogs: (limit) => rpc('admin_get_logs', { p_limit: limit || 100 }),
}

let channel = null
let requestsChannel = null
let freeDaysChannel = null

async function fetchTask(id) {
  try {
    return await rpc('get_task', { p_task_id: id })
  } catch {
    return null
  }
}

export function subscribeTasks(coupleId, onEvent) {
  if (!supabase) return null
  unsubscribeTasks()
  channel = supabase
    .channel(`tasks:${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `couple_id=eq.${coupleId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          onEvent('task:delete', { id: payload.old.id })
          return
        }
        const task = await fetchTask(payload.new.id)
        if (task) onEvent('task:update', task)
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` },
      async () => {
        const data = await rpc('get_me').catch(() => null)
        if (data?.couple) onEvent('couple:update', data.couple)
      }
    )
    .subscribe()
  return channel
}

export function unsubscribeTasks() {
  if (channel) supabase?.removeChannel(channel)
  channel = null
}

// Запросы на пару: слушаем, чтобы мгновенно показать уведомление
export function subscribeRequests(onEvent) {
  if (!supabase) return null
  if (requestsChannel) return requestsChannel
  requestsChannel = supabase
    .channel('couple-requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_requests' },
      (payload) => onEvent(payload)
    )
    .subscribe()
  return requestsChannel
}

export function unsubscribeRequests() {
  if (requestsChannel) supabase?.removeChannel(requestsChannel)
  requestsChannel = null
}

export function subscribeFreeDays(coupleId, onEvent) {
  if (!supabase) return null
  unsubscribeFreeDays()
  freeDaysChannel = supabase
    .channel(`free-days:${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'free_days', filter: `couple_id=eq.${coupleId}` },
      () => onEvent()
    )
    .subscribe()
  return freeDaysChannel
}

export function unsubscribeFreeDays() {
  if (freeDaysChannel) supabase?.removeChannel(freeDaysChannel)
  freeDaysChannel = null
}
