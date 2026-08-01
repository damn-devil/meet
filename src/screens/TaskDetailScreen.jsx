import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { createMap } from '../lib/map.js'
import { haversine } from '../lib/geo.js'
import { safeGet } from '../lib/theme.js'
import { formatDateTime, statusMeta, avgRating, relativeTime } from '../lib/format.js'
import { Avatar } from '../components/Avatar.jsx'

export function TaskDetailScreen({ taskId }) {
  const { state, actions } = useStore()
  const task = state.tasks.find((t) => t.id === taskId)
  const [comment, setComment] = useState('')
  const [locating, setLocating] = useState(false)
  const [locResult, setLocResult] = useState(null)
  const [showReschedule, setShowReschedule] = useState(false)
  const [newTime, setNewTime] = useState('')
  const [ratingModal, setRatingModal] = useState(false)
  const mapEl = useRef(null)

  const me = state.user
  const partner = state.couple?.members?.find((m) => m.id !== me?.id)

  useEffect(() => {
    if (!task || !mapEl.current) return
    let map
    ;(async () => {
      map = await createMap(mapEl.current, {
        center: [task.lat, task.lng],
        zoom: 15,
        markerColor: '#6366f1',
      })
      if (task.lat !== undefined && task.lng !== undefined) {
        map.addMarker(task.lat, task.lng, { title: task.place_name || task.title })
      }
    })()
    return () => map?.destroy?.()
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Automatic arrival detection: when both are near the place within the time
  // window, check in automatically and mark the task completed.
  useEffect(() => {
    if (!task || !['planned', 'in_progress'].includes(task.status)) return
    if (safeGet('together_autocheck', 'on') !== 'on') return
    if (task.checkins.some((c) => c.user_id === me?.id)) return
    if (!navigator.geolocation || !task.lat) return

    let watcher = null
    let stopped = false
    const tryCheckin = (lat, lng, accuracy) => {
      actions.checkin(task.id, lat, lng, accuracy)
        .then(() => { if (!stopped) { navigator.geolocation.clearWatch(watcher); stopped = true } })
        .catch(() => {})
    }
    watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const d = haversine(task.lat, task.lng, latitude, longitude)
        const radius = state.couple?.radius_m || 150
        if (d <= radius * 1.3) {
          tryCheckin(latitude, longitude, pos.coords.accuracy || 0)
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    )
    return () => { stopped = true; navigator.geolocation.clearWatch(watcher) }
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <div className="screen">
        <div className="empty-state">
          <p>Задача не найдена</p>
          <button className="btn btn-primary" onClick={() => actions.setView('tasks')}>Назад</button>
        </div>
      </div>
    )
  }

  const meta = statusMeta(task.status)
  const myCheckin = task.checkins.find((c) => c.user_id === me?.id)
  const partnerCheckin = task.checkins.find((c) => c.user_id === partner?.id)
  const pendingAgreement = task.agreements.find((a) => a.status === 'pending')
  const rating = avgRating(task)

  const checkIn = () => {
    setLocating(true)
    setLocResult(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await actions.checkin(task.id, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 0)
          setLocResult({ ok: true, message: data.success ? 'Вы встретились! 🎉' : 'Вы отмечены как пришедший' })
        } catch (e) {
          setLocResult({ ok: false, message: e.message })
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        void err
        setLocating(false)
        setLocResult({ ok: false, message: 'Нет доступа к геолокации. Разрешите в настройках Safari.' })
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const requestAgreement = async (type) => {
    try {
      if (type === 'reschedule') {
        if (!newTime) return actions.toast('Выберите новое время', 'error')
        await actions.requestAgreement(task.id, 'reschedule', new Date(newTime).getTime())
        actions.toast('Запрос на перенос отправлен партнёру')
        setShowReschedule(false)
      } else {
        await actions.requestAgreement(task.id, 'delete')
        actions.toast('Запрос на удаление отправлен партнёру')
      }
    } catch (e) {
      actions.toast(e.message, 'error')
    }
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
        <span className="status-pill" style={{ background: `${meta.color}1a`, color: meta.color }}>{meta.icon} {meta.label}</span>
        <div className="detail-header-spacer" />
      </header>

      <div className="detail-scroll">
        <h1 className="detail-title">{task.title}</h1>
        {task.place_name && (
          <div className="detail-place">
            <span className="detail-place-icon">📍</span>
            <div>
              <strong>{task.place_name}</strong>
              {task.address && <span className="detail-address">{task.address}</span>}
            </div>
          </div>
        )}
        {task.description && <p className="detail-desc">{task.description}</p>}

        <div className="detail-grid">
          <div className="info-cell glass">
            <span className="info-label">Когда</span>
            <strong>{task.scheduled_at ? formatDateTime(task.scheduled_at) : '—'}</strong>
            {task.scheduled_at && <span className="info-sub">{relativeTime(task.scheduled_at)}</span>}
          </div>
          <div className="info-cell glass">
            <span className="info-label">Оценка</span>
            <strong>{rating ? `★ ${rating}` : '—'}</strong>
            <span className="info-sub">{task.ratings.length}/2 оценили</span>
          </div>
        </div>

        {task.lat !== undefined && task.lng !== undefined && (
          <button className="btn btn-soft btn-block show-map-btn" onClick={() => actions.focusOnMap(task.id)}>
            🗺 Показать на карте
          </button>
        )}

        {/* Presence */}
        <div className="presence-card glass">
          <div className="presence-title">Кто пришёл</div>
          <div className="presence-row">
            <PresenceItem name={me?.name} avatar={me?.avatar} avatarUrl={me?.avatar_url} arrived={!!myCheckin} self />
            <PresenceItem name={partner?.name} avatar={partner?.avatar} avatarUrl={partner?.avatar_url} arrived={!!partnerCheckin} />
          </div>
          {canAct && !myCheckin && (
            <button className="btn btn-primary btn-block" onClick={checkIn} disabled={locating}>
              {locating ? 'Проверяем геолокацию...' : '📍 Я на месте'}
            </button>
          )}
          {myCheckin && !partnerCheckin && canAct && (
            <p className="presence-wait">Ожидаем {partner?.name}... Как только оба будут на месте — задача закроется сама.</p>
          )}
          {locResult && (
            <div className={`loc-result ${locResult.ok ? 'ok' : 'err'}`}>{locResult.message}</div>
          )}
        </div>

        {task.status === 'completed' && myCheckin && partnerCheckin && (
          <div className="completed-banner">🎉 Вы встретились! {task.place_name || 'Событие'} состоялось</div>
        )}
        {task.status === 'completed' && myCheckin && !partnerCheckin && (
          <div className="completed-banner">✅ Встреча состоялась</div>
        )}

        {task.status === 'completed' && task.ratings.length < 2 && (
          <button className="btn btn-soft btn-block" onClick={() => setRatingModal(true)}>
            {task.ratings.some((r) => r.user_id === me?.id) ? '⭐ Изменить оценку' : '⭐ Оценить встречу'}
          </button>
        )}

        {/* Map */}
        <div className="detail-map" ref={mapEl} />
        <p className="map-hint">{task.place_name || 'Место встречи'}</p>

        {/* Agreements */}
        {pendingAgreement && (
          <div className="agreement-card">
            <div className="agreement-text">
              {pendingAgreement.type === 'delete'
                ? `${pendingAgreement.requester_name} предлагает удалить план`
                : `${pendingAgreement.requester_name} предлагает перенести на ${formatDateTime(pendingAgreement.proposed_value)}`}
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
            <button className="btn btn-soft" onClick={() => setShowReschedule((v) => !v)}>🕐 Перенести</button>
            <button className="btn btn-danger-soft" onClick={() => requestAgreement('delete')}>🗑 Удалить</button>
          </div>
        )}
        {canAct && showReschedule && (
          <div className="reschedule-box glass">
            <input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <button className="btn btn-primary" onClick={() => requestAgreement('reschedule')}>Отправить на согласование</button>
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

        {/* Comments */}
        <div className="comments">
          <h3 className="comments-title">Комментарии ({task.comments.length})</h3>
          <div className="comments-list">
            {task.comments.length === 0 && <p className="comments-empty">Обсудите планы здесь</p>}
            {task.comments.map((c) => (
              <div key={c.id} className={`comment ${c.user_id === me?.id ? 'mine' : ''}`}>
                <div className="comment-head">
                  <span className="comment-avatar"><Avatar url={c.avatar_url} emoji={c.avatar || '🙂'} size="comment" alt={c.name} /></span>
                  <span className="comment-name">{c.name}</span>
                  <span className="comment-time">{new Date(c.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="comment-input">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && comment.trim() && actions.comment(task.id, comment).then(() => setComment(''))}
              placeholder="Написать комментарий..."
            />
            <button
              className="btn btn-primary"
              onClick={() => comment.trim() && actions.comment(task.id, comment).then(() => setComment(''))}
            >➤</button>
          </div>
        </div>
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
        <small>{arrived ? '✅ На месте' : self ? 'Вы ещё не пришли' : 'Ещё в пути'}</small>
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
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`star ${n <= score ? 'active' : ''}`} onClick={() => setScore(n)}>★</button>
            ))}
          </div>
          <label className="field">
            <span>Впечатление</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Как вам было?" />
          </label>
          <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить оценку'}
          </button>
        </div>
      </div>
    </div>
  )
}
