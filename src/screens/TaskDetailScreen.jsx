import { useState } from 'react'
import { useStore } from '../store.jsx'
import { formatDateTime, statusMeta, avgRating, relativeTime } from '../lib/format.js'
import { extractMapUrl } from '../lib/map.js'
import { Avatar } from '../components/Avatar.jsx'
import { MoodMini } from '../components/MoodBar.jsx'
import { Emoji } from '../components/Emoji.jsx'
import { Loader } from '../components/Loader.jsx'

export function TaskDetailScreen({ taskId }) {
  const { state, actions } = useStore()
  const task = state.tasks.find((t) => t.id === taskId)
  const [showReschedule, setShowReschedule] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [ratingModal, setRatingModal] = useState(false)

  const me = state.user
  const partner = state.couple?.members?.find((m) => m.id !== me?.id)

  if (!task) {
    return (
      <div className="screen">
        <div className="empty-state">
          <p>Событие не найдено</p>
          <button className="btn btn-primary" onClick={() => actions.setView('tasks')}>Назад</button>
        </div>
      </div>
    )
  }

  const meta = statusMeta(task.status)
  const mapUrl = extractMapUrl(task.description)
  const descText = task.description
    ? (mapUrl ? task.description.replace(mapUrl, '').replace(/🗺/g, '') : task.description).trim()
    : ''
  const myCheckin = task.checkins.find((c) => c.user_id === me?.id)
  const partnerCheckin = task.checkins.find((c) => c.user_id === partner?.id)
  const pendingAgreement = task.agreements.find((a) => a.status === 'pending')
  const rating = avgRating(task)

  const checkIn = async () => {
    try {
      await actions.checkin(task.id)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const requestAgreement = async (type) => {
    try {
      if (type === 'reschedule') {
        const when = newDate && newTime ? new Date(`${newDate}T${newTime}`).getTime() : null
        if (!when) return actions.toast('Выберите новую дату и время', 'error')
        await actions.requestAgreement(task.id, 'reschedule', when)
        actions.toast('Запрос на перенос отправлен партнёру')
        setShowReschedule(false)
      } else if (type === 'edit') {
        const when = newDate && newTime ? new Date(`${newDate}T${newTime}`).getTime() : null
        if (!editTitle.trim() && !editDesc.trim() && !when)
          return actions.toast('Измените название, описание или время', 'error')
        await actions.requestAgreement(task.id, 'edit', when, editTitle, editDesc)
        actions.toast('Запрос на изменение отправлен партнёру')
        setShowEdit(false)
        setEditTitle('')
        setEditDesc('')
      } else {
        await actions.requestAgreement(task.id, 'delete')
        actions.toast('Запрос на удаление отправлен партнёру')
      }
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const startEdit = () => {
    setEditTitle(task.title)
    setEditDesc(task.description || '')
    setShowEdit((v) => !v)
  }

  const agreementText = (a) => {
    if (a.type === 'delete') return `${a.requester_name} предлагает удалить событие`
    if (a.type === 'reschedule') return `${a.requester_name} предлагает перенести на ${formatDateTime(a.proposed_value)}`
    return `${a.requester_name} предлагает изменить событие`
  }

  const respondAgreement = async (agree) => {
    try {
      await actions.respondAgreement(pendingAgreement.id, agree)
      actions.toast(agree ? 'Согласовано' : 'Запрос отклонён')
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const canAct = ['planned', 'in_progress'].includes(task.status)

  return (
    <div className="screen detail-screen">
      <header className="detail-header">
        <button className="back-btn" onClick={() => actions.setView('tasks')}>‹</button>
        <span className="status-pill" style={{ background: `${meta.color}1a`, color: meta.color }}><Emoji name={meta.icon} size={15} /> {meta.label}</span>
        <div className="detail-header-spacer" />
        <MoodMini />
      </header>

      <div className="detail-scroll">
        <h1 className="detail-title">{task.title}</h1>
        {descText && <p className="detail-desc">{descText}</p>}
        {mapUrl && (
          <a
            className="btn btn-primary btn-block map-open-btn"
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Emoji name="map" size={16} /> Показать на карте
          </a>
        )}

        <div className="detail-grid">
          <div className="info-cell glass">
            <span className="info-label">Когда</span>
            <strong>{task.scheduled_at ? formatDateTime(task.scheduled_at) : '—'}</strong>
            {task.scheduled_at && <span className="info-sub">{relativeTime(task.scheduled_at)}</span>}
          </div>
          <div className="info-cell glass">
            <span className="info-label">Оценка</span>
            <strong>{rating ? <><Emoji name="star" size={14} /> {rating}</> : '—'}</strong>
            <span className="info-sub">{task.ratings.length}/2 оценили</span>
          </div>
        </div>

        {/* Presence */}
        <div className="presence-card glass">
          <div className="presence-title">Кто пришёл</div>
          <div className="presence-row">
            <PresenceItem name={me?.name} avatar={me?.avatar} avatarUrl={me?.avatar_url} arrived={!!myCheckin} self />
            <PresenceItem name={partner?.name} avatar={partner?.avatar} avatarUrl={partner?.avatar_url} arrived={!!partnerCheckin} />
          </div>
          {canAct && !myCheckin && (
            <button className="btn btn-primary btn-block" onClick={checkIn}><Emoji name="check" size={16} /> Я на месте</button>
          )}
          {myCheckin && !partnerCheckin && canAct && (
            <p className="presence-wait">Ожидаем {partner?.name}... Как только оба отметятся — событие закроется само.</p>
          )}
        </div>

        {task.status === 'completed' && (
          <div className="completed-check" aria-label="План состоялся">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </div>
        )}

        {task.status === 'completed' && task.ratings.length < 2 && (
          <button className="btn btn-soft btn-block" onClick={() => setRatingModal(true)}>
            {task.ratings.some((r) => r.user_id === me?.id) ? <><Emoji name="star" size={16} /> Изменить оценку</> : <><Emoji name="star" size={16} /> Оценить встречу</>}
          </button>
        )}

        {/* Agreements */}
        {pendingAgreement && (
          <div className="agreement-card">
            <div className="agreement-text">
              {agreementText(pendingAgreement)}
            </div>
            {pendingAgreement.requested_by !== me?.id && (
              <div className="agreement-actions">
                <button className="btn btn-primary" onClick={() => respondAgreement(true)}>Согласиться</button>
                <button className="btn btn-danger" onClick={() => respondAgreement(false)}>Отказать</button>
              </div>
            )}
            {pendingAgreement.requested_by === me?.id && (
              <div className="agreement-wait">Ожидаем ответа {partner?.name}...</div>
            )}
          </div>
        )}

        {/* Actions */}
        {canAct && !pendingAgreement && (
          <div className="detail-actions">
            <button className="btn btn-soft" onClick={() => setShowReschedule((v) => !v)}><Emoji name="clock" size={16} /> Перенести</button>
            <button className="btn btn-soft" onClick={startEdit}><Emoji name="pencil" size={16} /> Изменить</button>
            <button className="btn btn-danger-soft" onClick={() => requestAgreement('delete')}><Emoji name="trash" size={16} /> Удалить</button>
          </div>
        )}
        {canAct && showReschedule && (
          <div className="reschedule-box glass">
            <div className="when-row">
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Новая дата" />
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="Новое время" />
            </div>
            <button className="btn btn-primary" onClick={() => requestAgreement('reschedule')}>Отправить на согласование</button>
          </div>
        )}
        {canAct && showEdit && (
          <div className="reschedule-box glass">
            <label className="field">
              <span>Название</span>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Название события" />
            </label>
            <label className="field">
              <span>Описание</span>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Детали встречи" />
            </label>
            <div className="when-row">
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Новая дата" />
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="Новое время" />
            </div>
            <button className="btn btn-primary" onClick={() => requestAgreement('edit')}>Отправить на согласование</button>
          </div>
        )}

        {pendingAgreement && pendingAgreement.requested_by === me?.id && (
          <button className="btn btn-danger-soft" onClick={async () => {
            try {
              await actions.cancelAgreement(pendingAgreement.id)
              actions.toast('Запрос отозван')
            } catch (e) { actions.toast(e.message, 'error') }
          }}>Отозвать запрос</button>
        )}
      </div>

      {ratingModal && <RatingModal task={task} onClose={() => setRatingModal(false)} />}
    </div>
  )
}

function PresenceItem({ name, avatar, avatarUrl, arrived, self }) {
  return (
    <div className={`presence-item ${arrived ? 'arrived' : ''}`}>
      <Avatar url={avatarUrl} emoji={avatar} size="presence" alt={name} />
      <div className="presence-info">
        <span>{name}</span>
        <small>{arrived ? <><Emoji name="check" size={12} /> На месте</> : self ? 'Вы ещё не пришли' : 'Ещё не пришёл'}</small>
      </div>
    </div>
  )
}

function RatingModal({ task, onClose }) {
  const { state, actions } = useStore()
  const myRating = task.ratings.find((r) => r.user_id === state.user?.id)
  const [score, setScore] = useState(myRating?.score || 0)
  const [text, setText] = useState(myRating?.comment || '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!score) return
    setBusy(true)
    try {
      await actions.rate(task.id, score, text)
      actions.toast('Спасибо за оценку!', 'success')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h2>Как прошла встреча?</h2>
          <button className="icon-btn" onClick={onClose}><Emoji name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`star ${n <= score ? 'active' : ''}`} onClick={() => setScore(n)}><Emoji name="star" size={20} /></button>
            ))}
          </div>
          <label className="field">
            <span>Впечатление</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Как вам было?" />
          </label>
          <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
            {busy ? <span className="btn-busy"><Loader size={18} /> Сохраняем…</span> : 'Сохранить оценку'}
          </button>
        </div>
      </div>
    </div>
  )
}
