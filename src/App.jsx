import { StoreProvider, useStore, useThemeInit } from './store.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'
import { TasksScreen } from './screens/TasksScreen.jsx'
import { MapScreen } from './screens/MapScreen.jsx'
import { ProfileScreen } from './screens/ProfileScreen.jsx'
import { TaskDetailScreen } from './screens/TaskDetailScreen.jsx'
import { Toast } from './components/Toast.jsx'
import { CatMascot } from './components/CatMascot.jsx'
import { Icon } from './components/Icon.jsx'
import { useEffect, useRef } from 'react'
import './index.css'

function useCompletionNotifications() {
  const { state, actions } = useStore()
  const seen = useRef({})
  const seenAgreements = useRef({})
  useEffect(() => {
    const current = {}
    const agreements = {}
    state.tasks.forEach((t) => {
      current[t.id] = t.status
      const prev = seen.current[t.id]
      if (prev && prev !== 'completed' && t.status === 'completed') {
        actions.toast(`✅ Задача «${t.title}» выполнена!`, 'success')
        try {
          if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker?.ready) {
            navigator.serviceWorker.ready.then((reg) => reg.showNotification(t.title, { body: 'Вы встретились!', tag: `task-${t.id}` }))
          }
        } catch {}
      }
      t.agreements?.forEach((a) => {
        agreements[`${t.id}:${a.id}`] = a.status
        if (a.status === 'pending' && a.requested_by !== state.user?.id) {
          const prevA = seenAgreements.current[`${t.id}:${a.id}`]
          if (!prevA) {
            const what = a.type === 'delete' ? 'удалить план' : 'перенести план'
            actions.toast(`💬 ${a.requester_name} предлагает ${what}: «${t.title}»`, 'info')
          }
        }
      })
    })
    seen.current = current
    seenAgreements.current = agreements
  }, [state.tasks, actions, state.user])
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
  } else if (state.view === 'profile') {
    screen = <ProfileScreen />
  } else {
    screen = <TasksScreen />
  }

  return (
    <div className={`app${bg ? ' has-bg' : ''}`} style={bg ? { '--bg-img': `url("${bg}")` } : undefined}>
      {screen}
      <CatMascot />
      <TabBar />
      <Toast />
    </div>
  )
}

function TabBar() {
  const { state, actions } = useStore()
  const tabs = [
    { id: 'tasks', icon: 'calendar', label: 'Планы' },
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
