import { StoreProvider, useStore, useThemeInit } from './store.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'
import { TasksScreen } from './screens/TasksScreen.jsx'
import { MapScreen } from './screens/MapScreen.jsx'
import { ProfileScreen } from './screens/ProfileScreen.jsx'
import { CoupleScreen } from './screens/CoupleScreen.jsx'
import { TaskDetailScreen } from './screens/TaskDetailScreen.jsx'
import { Toast } from './components/Toast.jsx'
import { Icon } from './components/Icon.jsx'
import { Avatar } from './components/Avatar.jsx'
import { useEffect, useRef } from 'react'
import { notify } from './lib/notify.js'
import './index.css'

function useCompletionNotifications() {
  const { state, actions } = useStore()
  const seen = useRef({})
  const seenAgreements = useRef({})
  const seenComments = useRef({})
  const seenRatings = useRef({})
  const seenCheckins = useRef({})
  const booted = useRef(false)
  const meId = state.user?.id
  const partnerName = state.couple?.members?.find((m) => m.id !== meId)?.name || 'Партнёр'

  useEffect(() => {
    const current = {}
    const agreements = {}
    const comments = {}
    const ratings = {}
    const checkins = {}
    const isFirst = !booted.current

    state.tasks.forEach((t) => {
      current[t.id] = t.status
      const prev = seen.current[t.id]

      if (!isFirst && prev && prev !== t.status) {
        if (t.status === 'completed') {
          actions.toast(`✅ Задача «${t.title}» выполнена!`, 'success')
          notify(t.title, 'Вы встретились!', `task-${t.id}`)
        } else if (t.status === 'missed') {
          actions.toast(`⏰ План «${t.title}» пропущен`, 'info')
          notify(t.title, 'План пропущен — встреча не состоялась', `task-${t.id}`)
        } else if (t.status === 'cancelled') {
          actions.toast(`🗑 План «${t.title}» отменён`, 'info')
          notify(t.title, 'План отменён', `task-${t.id}`)
        }
      }

      if (!isFirst && !prev && t.created_by !== meId) {
        actions.toast(`📅 Новый план: «${t.title}»`, 'info')
        notify('Новый план', t.title, `task-${t.id}`)
      }

      t.comments?.forEach((c) => {
        comments[c.id] = true
        if (!isFirst && c.user_id !== meId && !seenComments.current[c.id]) {
          actions.toast(`💬 ${c.name}: ${c.text}`, 'info')
          notify(c.name, c.text, `comment-${c.id}`)
        }
      })

      t.ratings?.forEach((r) => {
        ratings[r.id] = true
        if (!isFirst && r.user_id !== meId && !seenRatings.current[r.id]) {
          actions.toast(`⭐ Партнёр оценил «${t.title}»`, 'info')
          notify('Новая оценка', `${t.title} — ${r.score} ★`, `rating-${r.id}`)
        }
      })

      t.checkins?.forEach((k) => {
        checkins[k.id] = true
        if (!isFirst && k.user_id !== meId && !seenCheckins.current[k.id]) {
          actions.toast(`📍 ${partnerName} на месте: «${t.title}»`, 'info')
          notify('Кто-то пришёл', `${partnerName} уже на месте — «${t.title}»`, `checkin-${k.id}`)
        }
      })

      t.agreements?.forEach((a) => {
        agreements[`${t.id}:${a.id}`] = a.status
        if (!isFirst && a.requested_by !== meId) {
          const prevA = seenAgreements.current[`${t.id}:${a.id}`]
          if (a.status === 'pending' && !prevA) {
            const what = a.type === 'delete' ? 'удалить план' : 'перенести план'
            actions.toast(`💬 ${a.requester_name} предлагает ${what}: «${t.title}»`, 'info')
            notify(a.requester_name, `предлагает ${what}: «${t.title}»`, `agree-${a.id}`)
          } else if (prevA === 'pending' && a.status === 'approved') {
            const what = a.type === 'delete' ? 'удалён' : 'перенесён'
            actions.toast(`✅ План «${t.title}» ${what}`, 'success')
            notify(t.title, `План ${what}`, `task-${t.id}`)
          } else if (prevA === 'pending' && a.status === 'rejected') {
            actions.toast(`❌ Запрос по «${t.title}» отклонён`, 'info')
            notify(t.title, 'Запрос отклонён', `task-${t.id}`)
          }
        }
      })
    })

    seen.current = current
    seenAgreements.current = agreements
    seenComments.current = comments
    seenRatings.current = ratings
    seenCheckins.current = checkins
    booted.current = true
  }, [state.tasks, actions, meId, partnerName])
}

function AppInner() {
  const { state } = useStore()
  useThemeInit()
  useCompletionNotifications()
  const bg = state.bg

  if (state.loading) {
    return (
      <div className="boot-screen">
        <div className="boot-paw">🐾</div>
        <div className="boot-spinner" />
      </div>
    )
  }

  if (!state.user) return <AuthScreen />
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
  } else if (state.view === 'map') {
    screen = <MapScreen />
  } else if (state.view === 'couple') {
    screen = <CoupleScreen />
  } else if (state.view === 'profile') {
    screen = <ProfileScreen />
  } else {
    screen = <TasksScreen />
  }

  return (
    <div className={`app${bg ? ' has-bg' : ''}`} style={bg ? { '--bg-img': `url("${bg}")` } : undefined}>
      {screen}
      <RequestsBanner />
      <TabBar />
      <Toast />
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
    { id: 'tasks', icon: 'calendar', label: 'Планы' },
    { id: 'couple', icon: 'heart', label: 'Пара' },
    { id: 'map', icon: 'map', label: 'Карта' },
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
