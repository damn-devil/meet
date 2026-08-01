import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { api, subscribeTasks, unsubscribeTasks, subscribeRequests, unsubscribeRequests, hasSession, clearToken } from './api.js'
import { applyTheme, savedAccent, safeSet } from './lib/theme.js'

const StoreContext = createContext(null)

const initialState = {
  user: null,
  couple: null,
  tasks: [],
  requests: [],
  stats: { completed: 0, missed: 0, cancelled: 0, avgRating: null },
  view: 'tasks',
  selectedTask: null,
  toast: null,
  loading: true,
  bootError: null,
  bg: '',
  mapFocus: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'BOOT':
      return { ...state, user: action.user, couple: action.couple, loading: false, bootError: null, bg: action.couple?.bg || '' }
    case 'BOOT_ERR':
      return { ...state, loading: false, bootError: action.error }
    case 'SET_TASKS':
      return { ...state, tasks: action.tasks }
    case 'UPSERT_TASK': {
      const exists = state.tasks.some((t) => t.id === action.task.id)
      const tasks = exists
        ? state.tasks.map((t) => (t.id === action.task.id ? action.task : t))
        : [action.task, ...state.tasks]
      return { ...state, tasks }
    }
    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }
    case 'SET_COUPLE':
      return { ...state, couple: action.couple, bg: action.couple?.bg || '', user: action.couple?.members?.find((m) => m.id === state.user?.id) || state.user }
    case 'SET_USER':
      return { ...state, user: action.user }
    case 'SET_STATS':
      return { ...state, stats: action.stats }
    case 'SET_BG':
      return { ...state, bg: action.bg }
    case 'SET_REQUESTS':
      return { ...state, requests: action.requests }
    case 'VIEW':
      return { ...state, view: action.view, selectedTask: action.view === 'task' ? action.id : state.selectedTask, mapFocus: action.view === 'map' ? null : state.mapFocus }
    case 'MAP_FOCUS':
      return { ...state, view: 'map', selectedTask: null, mapFocus: action.id }
    case 'OPEN_TASK':
      return { ...state, view: 'task', selectedTask: action.id }
    case 'TOAST':
      return { ...state, toast: action.toast }
    case 'LOGOUT':
      return { ...initialState, loading: false }
    default:
      return state
  }
}

let toastTimer = null
function showToast(dispatch, msg, type = 'info') {
  clearTimeout(toastTimer)
  dispatch({ type: 'TOAST', toast: { msg, type } })
  toastTimer = setTimeout(() => dispatch({ type: 'TOAST', toast: null }), 3500)
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const coupleIdRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const connect = (coupleId) => {
    if (!coupleId) return
    if (coupleIdRef.current === coupleId && coupleIdRef.current !== null) return
    coupleIdRef.current = coupleId
    subscribeTasks(coupleId, (event, payload) => {
      if (event === 'task:update') {
        dispatch({ type: 'UPSERT_TASK', task: payload })
        refreshStats()
      }
      if (event === 'task:delete') dispatch({ type: 'REMOVE_TASK', id: payload.id })
      if (event === 'couple:update') {
        dispatch({ type: 'SET_COUPLE', couple: payload })
        const me = payload.members.find((m) => m.id === stateRef.current.user?.id)
        if (me) applyTheme(me.theme, me.accent || savedAccent())
      }
    })
  }

  const syncLocalPrefs = (user) => {
    if (!user) return
    safeSet('together_accent', user.accent || '')
    safeSet('together_autocheck', user.autocheck ? 'on' : 'off')
  }

  const refreshStats = async () => {
    try {
      const stats = await api.stats()
      dispatch({ type: 'SET_STATS', stats })
    } catch {}
  }

  const loadAll = async (coupleId) => {
    const [tasks, stats] = await Promise.all([api.tasks(), api.stats()])
    dispatch({ type: 'SET_TASKS', tasks })
    dispatch({ type: 'SET_STATS', stats })
    connect(coupleId)
  }

  const loadRequests = async () => {
    try {
      const requests = await api.myRequests()
      dispatch({ type: 'SET_REQUESTS', requests })
      return requests
    } catch {
      return []
    }
  }

  const refreshAfterCouple = async () => {
    const data = await api.me().catch(() => null)
    if (!data) return
    const wasInCouple = !!stateRef.current.couple
    dispatch({ type: 'BOOT', user: data.user, couple: data.couple })
    await loadRequests()
    await loadAll(data.couple?.id)
    if (!wasInCouple && data.couple) showToast(dispatch, 'Вы в паре! Можно планировать встречи', 'success')
  }

  const connectRequests = () => {
    if (!stateRef.current.user?.id) return
    subscribeRequests((payload) => {
      const me = stateRef.current.user?.id
      if (!me) return
      const row = payload.new || {}
      if (payload.eventType === 'INSERT' && row.to_id === me && row.status === 'pending') {
        loadRequests()
        showToast(dispatch, 'Вам отправили запрос на пару — посмотрите в Профиле', 'info')
      } else if (row.status === 'accepted') {
        refreshAfterCouple()
      } else {
        loadRequests()
      }
    })
  }

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      if (!(await hasSession())) {
        if (cancelled) return
        dispatch({ type: 'BOOT', user: null, couple: null })
        return
      }
      try {
        const data = await api.me()
        if (cancelled) return
        syncLocalPrefs(data.user)
        dispatch({ type: 'BOOT', user: data.user, couple: data.couple })
        await loadAll(data.couple?.id)
        await loadRequests()
        connectRequests()
      } catch (e) {
        if (cancelled) return
        if (e.code === 'PGRST301' || /jwt|token|auth/i.test(e.message || '')) {
          await clearToken()
          dispatch({ type: 'BOOT', user: null, couple: null })
        } else {
          dispatch({ type: 'BOOT_ERR', error: e.message })
        }
      }
    }
    boot()
    return () => {
      cancelled = true
      unsubscribeTasks()
      unsubscribeRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = {
    login: async (email, password) => {
      const data = await api.login({ email, password })
      syncLocalPrefs(data.user)
      dispatch({ type: 'BOOT', user: data.user, couple: data.couple })
      await loadAll(data.couple?.id)
      await loadRequests()
      connectRequests()
      return data
    },
    register: async (name, email, password) => {
      const data = await api.register({ name, email, password })
      syncLocalPrefs(data.user)
      dispatch({ type: 'BOOT', user: data.user, couple: data.couple })
      await loadAll(data.couple?.id)
      await loadRequests()
      connectRequests()
      return data
    },
    logout: async () => {
      try {
        await api.logout()
      } catch {}
      unsubscribeTasks()
      unsubscribeRequests()
      coupleIdRef.current = null
      dispatch({ type: 'LOGOUT' })
    },
    deleteAccount: async () => {
      await api.deleteAvatarFiles()
      await api.deleteAccount()
      try {
        await api.logout()
      } catch {}
      unsubscribeTasks()
      unsubscribeRequests()
      coupleIdRef.current = null
      dispatch({ type: 'LOGOUT' })
    },
    refresh: async () => {
      await loadAll(stateRef.current.couple?.id)
    },
    setView: (view) => dispatch({ type: 'VIEW', view }),
    openTask: (id) => dispatch({ type: 'OPEN_TASK', id }),
    focusOnMap: (id) => dispatch({ type: 'MAP_FOCUS', id }),
    updateMe: async (body) => {
      const data = await api.updateMe(body)
      syncLocalPrefs(data.user)
      dispatch({ type: 'SET_USER', user: data.user })
      dispatch({ type: 'SET_COUPLE', couple: data.couple })
      const me = data.couple?.members?.find((m) => m.id === data.user?.id)
      if (me) applyTheme(me.theme, me.accent || savedAccent())
      return data
    },
    uploadAvatar: (file, ext) => api.uploadAvatar(file, ext),
    updateCouple: async (body) => {
      const couple = await api.updateCouple(body)
      dispatch({ type: 'SET_COUPLE', couple })
      return couple
    },
    searchUsers: (query) => api.searchUsers(query),
    sendRequest: async (toId) => {
      const req = await api.sendCoupleRequest(toId)
      await loadRequests()
      showToast(dispatch, 'Запрос отправлен — ждём ответа', 'success')
      return req
    },
    respondRequest: async (id, approve) => {
      const res = await api.respondCoupleRequest(id, approve)
      if (approve && res?.couple) {
        dispatch({ type: 'SET_COUPLE', couple: res.couple })
        await loadRequests()
        await loadAll(res.couple.id)
        showToast(dispatch, 'Вы в паре! Можно планировать встречи', 'success')
      } else {
        await loadRequests()
      }
      return res
    },
    cancelRequest: async (id) => {
      await api.cancelCoupleRequest(id)
      await loadRequests()
      return null
    },
    createTask: async (body) => {
      const task = await api.createTask(body)
      dispatch({ type: 'UPSERT_TASK', task })
      return task
    },
    comment: async (id, text) => {
      const task = await api.comment(id, text)
      dispatch({ type: 'UPSERT_TASK', task })
    },
    checkin: async (id, lat, lng, accuracy) => {
      const data = await api.checkin(id, lat, lng, accuracy)
      dispatch({ type: 'UPSERT_TASK', task: data.task })
      if (data.success) showToast(dispatch, 'Вы встретились! Задача выполнена', 'success')
      return data
    },
    requestAgreement: async (id, type, scheduled_at) => {
      const data = await api.requestAgreement(id, type, scheduled_at)
      dispatch({ type: 'UPSERT_TASK', task: data.task })
      return data
    },
    respondAgreement: async (id, approve) => {
      const data = await api.respondAgreement(id, approve)
      dispatch({ type: 'UPSERT_TASK', task: data.task })
      return data
    },
    cancelAgreement: async (id) => {
      const data = await api.cancelAgreement(id)
      dispatch({ type: 'UPSERT_TASK', task: data.task })
      return data
    },
    rate: async (id, score, comment) => {
      const task = await api.rate(id, score, comment)
      dispatch({ type: 'UPSERT_TASK', task })
    },
    toast: (msg, type) => showToast(dispatch, msg, type),
    setBg: async (url) => {
      if (state.couple) {
        try {
          await api.updateCouple({ bg: url })
        } catch {
          showToast(dispatch, 'Фон сохранён только у вас — синхронизация не удалась', 'error')
        }
      }
      dispatch({ type: 'SET_BG', bg: url })
    },
  }

  return <StoreContext.Provider value={{ state, dispatch, actions }}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

export function useThemeInit() {
  const { state } = useStore()
  useEffect(() => {
    const theme = state.user?.theme || 'auto'
    applyTheme(theme, state.user?.accent || savedAccent())
  }, [state.user])
}
