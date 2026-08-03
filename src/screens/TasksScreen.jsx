import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { formatDateTime, relativeTime, statusMeta, avgRating } from '../lib/format.js'
import { hasMapUrl } from '../lib/map.js'
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
    { id: 'upcoming', label: 'Предстоящие', count: counts.upcoming },
    { id: 'done', label: 'Выполненные', count: counts.done },
    { id: 'missed', label: 'Пропущенные', count: counts.missed },
  ]

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>События</h1>
          <p className="screen-sub">{state.couple?.members?.map((m) => m.name).join(' и ')}</p>
        </div>
        {state.couple && (
          <button className="btn btn-primary btn-round" onClick={() => setShowAdd(true)} aria-label="Добавить событие">+</button>
        )}
      </header>
      <div className="chip-row">
        {filters.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label} <span className="chip-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="task-list">
        {!state.couple && (
          <div className="empty-state">
            <div className="empty-art">💛</div>
            <p>Вы пока не в паре</p>
            <span>Найдите партнёра по имени в разделе «Пара» и отправьте запрос</span>
            <button className="btn btn-primary" onClick={() => actions.setView('couple')}>Найти пару</button>
          </div>
        )}
        {state.couple && tasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-art">✨</div>
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
  const pendingAgreement = task.agreements?.find((a) => a.status === 'pending')
  return (
    <div className={`task-card glass ${isLate ? 'late' : ''}`} onClick={onClick}>
      <div className="task-card-top">
        <span className="task-icon">📝</span>
        <div className="task-card-body">
          <h3>
            {task.title}
            {hasMapUrl(task.description) && <span className="task-map-badge" title="Есть точка на карте">🗺</span>}
          </h3>
          {task.scheduled_at && <p className="task-place">{formatDateTime(task.scheduled_at)}</p>}
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
          {partnerCheckins > 0 && <span>📍 {partnerCheckins}/2</span>}
          {rating && <span className="task-rating">★ {rating}</span>}
        </span>
      </div>
      {pendingAgreement && <CardAgreement task={task} agreement={pendingAgreement} onClick={onClick} />}
    </div>
  )
}

function CardAgreement({ task, agreement, onClick }) {
  const { state, actions } = useStore()
  const me = state.user
  const isMine = agreement.requested_by === me?.id

  const act = async (agree) => {
    try {
      await actions.respondAgreement(agreement.id, agree)
      actions.toast(agree ? 'Согласовано' : 'Запрос отклонён')
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const kindText =
    agreement.type === 'delete'
      ? 'удалить'
      : agreement.type === 'reschedule'
        ? `перенести на ${formatDateTime(agreement.proposed_value)}`
        : 'изменить'

  return (
    <div className="card-agreement" onClick={(e) => e.stopPropagation()}>
      <div className="card-agreement-text">
        {isMine ? `Вы предложили ${kindText} — ждём ответа` : `${agreement.requester_name || 'Партнёр'} хочет ${kindText}`}
      </div>
      {!isMine && (
        <div className="card-agreement-actions">
          <button className="btn btn-sm btn-primary" onClick={() => act(true)}>Разрешить</button>
          <button className="btn btn-sm btn-danger-soft" onClick={() => act(false)}>Запретить</button>
        </div>
      )}
    </div>
  )
}
