import { useState } from 'react'
import { useStore } from '../store.jsx'

export function AddTaskModal({ onClose }) {
  const { actions } = useStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [datetime, setDatetime] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    if (!title.trim()) return setError('Дайте плану название')
    if (datetime && isNaN(new Date(datetime).getTime())) return setError('Неверная дата')
    setBusy(true)
    try {
      await actions.createTask({
        title: title.trim(),
        description: description.trim(),
        scheduled_at: datetime ? new Date(datetime).getTime() : null,
      })
      actions.toast('План создан!', 'success')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <h2>Новый план</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>Что делаем</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: ужин в кафе" autoFocus />
          </label>
          <label className="field">
            <span>Комментарий</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Что-нибудь ещё" />
          </label>

          <label className="field">
            <span>Когда (не обязательно)</span>
            <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
            <small className="field-hint">Оставьте пустым — план без времени</small>
          </label>

          {error && <div className="error-banner">{error}</div>}

          <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить план'}
          </button>
        </div>
      </div>
    </div>
  )
}
