import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { formatDateTime, relativeTime, statusMeta, avgRating } from '../lib/format.js'
import { AddTaskModal } from '../components/AddTaskModal.jsx'

export function TasksScreen() {
  const { state, actions } = useStore()
  const [filter, setFilter] = useState('upcoming')
  const [showAdd, setShowAdd] = useState(false)

  const tasks = useMemo(() => {
    const arr = [...state.tasks]
    if (filter === 'upcoming') return arr.filter((t) => ['planned', 'in_progress'].includes(t.status)).sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0))
    if (filter === 'done') return arr.filter((t) => t.status === 'completed').sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
    if (filter === 'missed') return arr.filter((t) => ['missed', 'cancelled'].includes(t.status)).sort((a, b) => (b.scheduled_at || 0) - (a.scheduled_at || 0))
    return arr
  }, [state.tasks, filter])

  const counts = useMemo(() => ({
    upcoming: state.tasks.filter((t) => ['planned', 'in_progress'].includes(t.status)).length,
    done: state.tasks.filter((t) => t.status === 'completed').length,
    missed: state.tasks.filter((t) => ['missed', 'cancelled'].includes(t.status)).length,
  }), [state.tasks])

  const filters = [
    { id: 'upcoming', label: 'Впереди', count: counts.upcoming },
    { id: 'done', label: 'Готово', count: counts.done },
    { id: 'missed', label: 'Прошло', count: counts.missed },
  ]

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Планы</h1>
          <p className="screen-sub">{state.couple?.members?.map((m) => m.name).join(' и ')}</p>
        </div>
        <button className="btn btn-primary btn-round" onClick={() => setShowAdd(true)} aria-label="Добавить план">+</button>
      </header>

      <div className="chip-row">
        {filters.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label} <span className="chip-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="task-list">
        {tasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-art">🗺️</div>
            <p>Пока пусто</p>
            <span>Добавьте первое место, куда сходите вместе</span>
          </div>
        )}
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => actions.openTask(t.id)} />
        ))}
      </div>

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function TaskCard({ task, onClick }) {
  const meta = statusMeta(task.status)
  const rating = avgRating(task)
  const partnerCheckins = task.checkins.length
  const isLate = task.scheduled_at && task.scheduled_at < Date.now() && ['planned', 'in_progress'].includes(task.status)
  return (
    <button className={`task-card glass ${isLate ? 'late' : ''}`} onClick={onClick}>
      <div className="task-card-top">
        <span className="task-icon">{task.place_name ? '📍' : '📝'}</span>
        <div className="task-card-body">
          <h3>{task.title}</h3>
          {task.place_name && <p className="task-place">{task.place_name}</p>}
        </div>
        <span className="status-pill" style={{ background: `${meta.color}1a`, color: meta.color }}>
          {meta.label}
        </span>
      </div>
      <div className="task-card-bottom">
        {task.scheduled_at && (
          <span className="task-time">
            🕐 {formatDateTime(task.scheduled_at)}
            <em>{relativeTime(task.scheduled_at)}</em>
          </span>
        )}
        <span className="task-meta">
          {task.comments.length > 0 && <span>💬 {task.comments.length}</span>}
          {partnerCheckins > 0 && <span>📍 {partnerCheckins}/2</span>}
          {rating && <span className="task-rating">★ {rating}</span>}
        </span>
      </div>
    </button>
  )
}
