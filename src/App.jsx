import { StoreProvider, useStore, useThemeInit } from './store.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'
import { TasksScreen } from './screens/TasksScreen.jsx'
import { ProfileScreen } from './screens/ProfileScreen.jsx'
import { CalendarScreen } from './screens/CalendarScreen.jsx'
import { StatsScreen } from './screens/StatsScreen.jsx'
import { TaskDetailScreen } from './screens/TaskDetailScreen.jsx'
import { Toast } from './components/Toast.jsx'
import { Icon } from './components/Icon.jsx'
import { Avatar } from './components/Avatar.jsx'
import { useEffect, useRef, useState } from 'react'
import { Emoji } from './components/Emoji.jsx'
import { Loader } from './components/Loader.jsx'
import './index.css'

/* «Перекрас» как смена обоев у Google Pixel: круг расходится из центра
   в новом цвете темы при её смене (не перемонтирует экран). */
function RepaintRipple() {
  const { state } = useStore()
  const first = useRef(true)
  const [play, setPlay] = useState(0)
  const key = state.rippleKey
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setPlay(key)
  }, [key])
  if (!play) return null
  return <div key={play} className="repaint-ripple" style={{ background: 'var(--brutal-paper)' }} aria-hidden="true" />
}

function useCompletionNotifications() {
  const { state, actions } = useStore()
  const seen = useRef({})
  const seenAgreements = useRef({})
  const seenRatings = useRef({})
  const seenCheckins = useRef({})
  const booted = useRef(false)
  const meId = state.user?.id
  const partnerName = state.couple?.members?.find((m) => m.id !== meId)?.name || 'Партнёр'

  useEffect(() => {
    const current = {}
    const agreements = {}
    const ratings = {}
    const checkins = {}
    const isFirst = !booted.current

    state.tasks.forEach((t) => {
      current[t.id] = t.status
      const prev = seen.current[t.id]

      if (!isFirst && prev && prev !== t.status) {
        if (t.status === 'completed') {
          actions.toast(`✅ Событие «${t.title}» выполнено!`, 'success')
        } else if (t.status === 'missed') {
          actions.toast(`⏰ Событие «${t.title}» пропущено`, 'info')
        } else if (t.status === 'cancelled') {
          actions.toast(`🗑 Событие «${t.title}» отменено`, 'info')
        }
      }

      if (!isFirst && !prev && t.created_by !== meId) {
        actions.toast(`📅 Новое событие: «${t.title}»`, 'info')
      }

      t.ratings?.forEach((r) => {
        ratings[r.id] = true
        if (!isFirst && r.user_id !== meId && !seenRatings.current[r.id]) {
          actions.toast(`⭐ Партнёр оценил «${t.title}»`, 'info')
        }
      })

      t.checkins?.forEach((k) => {
        checkins[k.id] = true
        if (!isFirst && k.user_id !== meId && !seenCheckins.current[k.id]) {
          actions.toast(`📍 ${partnerName} на месте: «${t.title}»`, 'info')
        }
      })

      t.agreements?.forEach((a) => {
        agreements[`${t.id}:${a.id}`] = a.status
        if (!isFirst && a.requested_by !== meId) {
          const prevA = seenAgreements.current[`${t.id}:${a.id}`]
          if (a.status === 'pending' && !prevA) {
            const what = a.type === 'delete' ? 'удалить событие' : 'перенести событие'
            actions.toast(`💬 ${a.requester_name} предлагает ${what}: «${t.title}»`, 'info')
          } else if (prevA === 'pending' && a.status === 'approved') {
            const what = a.type === 'delete' ? 'удалено' : 'перенесено'
            actions.toast(`✅ Событие «${t.title}» ${what}`, 'success')
          } else if (prevA === 'pending' && a.status === 'rejected') {
            actions.toast(`❌ Запрос по «${t.title}» отклонён`, 'info')
          }
        }
      })
    })

    seen.current = current
    seenAgreements.current = agreements
    seenRatings.current = ratings
    seenCheckins.current = checkins
    booted.current = true
  }, [state.tasks, actions, meId, partnerName])
}

const TAB_IDX = { tasks: 0, calendar: 1, stats: 2, profile: 3 }

function AppInner() {
  const { state } = useStore()
  useThemeInit()
  useCompletionNotifications()
  const bg = state.bg

  const dirRef = useRef(0)
  let dir = 1
  const idx = TAB_IDX[state.view]
  if (idx !== undefined) {
    dir = idx >= dirRef.current ? 1 : -1
    dirRef.current = idx
  }

  if (state.loading) {
    return (
      <div className="boot-screen">
        <Loader />
      </div>
    )
  }

  if (!state.user) {
    return (
      <div className={`app brutal${state.isDark ? ' is-dark' : ''}`}>
        <AuthScreen />
      </div>
    )
  }
  if (state.bootError) {
    return (
      <div className="boot-screen">
        <div className="error-card">
          <h2>Не удалось подключиться</h2>
          <p>{state.bootError}</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>Повторить</button>
        </div>
      </div>
    )
  }

  let screen
  if (state.view === 'task' && state.selectedTask) {
    screen = <TaskDetailScreen taskId={state.selectedTask} />
  } else if (state.view === 'calendar') {
    screen = <CalendarScreen />
  } else if (state.view === 'couple') {
    screen = <ProfileScreen />
  } else if (state.view === 'stats') {
    screen = <StatsScreen />
  } else if (state.view === 'profile') {
    screen = <ProfileScreen />
  } else {
    screen = <TasksScreen />
  }

  return (
    <div className={`app${bg ? ' has-bg' : ''} brutal${state.isDark ? ' is-dark' : ''}`} style={{ '--dir': dir }}>
      {bg && <div key={bg} className="bg-crossfade" style={{ '--bg-img': `url("${bg}")` }} />}
      <svg className="sr-only" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="toggle-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="screen-view" key={state.refreshKey}>
        {screen}
      </div>
      <RequestsBanner />
      <TabBar />
      <UpdateBanner />
      <Toast />
      <RepaintRipple />
    </div>
  )
}

function UpdateBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onUpdate = () => setShow(true)
    window.addEventListener('together-update-available', onUpdate)
    return () => window.removeEventListener('together-update-available', onUpdate)
  }, [])

  if (!show) return null

  const apply = async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg?.waiting) reg.waiting.postMessage('SKIP_WAITING')
    window.location.reload()
  }

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text"><Emoji name="box" size={18} /> Доступна новая версия</span>
      <button className="btn btn-primary btn-sm" onClick={apply}>Обновить</button>
    </div>
  )
}

function RequestsBanner() {
  const { state, actions } = useStore()
  const incoming = state.requests?.find((r) => r.to_id === state.user?.id && r.status === 'pending')
  if (!incoming) return null
  return (
    <div className="request-banner glass">
      <span className="request-banner-avatar">
        <Avatar url={incoming.from?.avatar_url} emoji={incoming.from?.avatar || '🙂'} size="comment" alt={incoming.from?.name} />
      </span>
      <div className="request-banner-text">
        <strong>{incoming.from?.name}</strong> хочет быть в паре с вами
      </div>
      <div className="request-banner-actions">
        <button className="btn btn-primary btn-sm" onClick={() => actions.respondRequest(incoming.id, true)}>Согласиться</button>
        <button className="btn btn-danger-soft btn-sm" onClick={() => actions.respondRequest(incoming.id, false)}>Отказать</button>
      </div>
    </div>
  )
}

function TabBar() {
  const { state, actions } = useStore()
  const tabs = [
    { id: 'tasks', icon: 'calendar', label: 'События' },
    { id: 'calendar', icon: 'grid', label: 'Календарь' },
    { id: 'stats', icon: 'chart', label: 'Статистика' },
    { id: 'profile', icon: 'person', label: 'Профиль' },
  ]
  const active = state.view === 'task' ? 'tasks' : state.view
  return (
    <nav className="tab-bar" aria-label="Разделы">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab-item ${active === t.id ? 'active' : ''}`}
          onClick={() => actions.setView(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <span className="tab-icon">
            <Icon name={t.icon} />
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
