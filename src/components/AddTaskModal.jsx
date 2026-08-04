import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Emoji } from './Emoji.jsx'

export function AddTaskModal({ onClose }) {
  const { actions } = useStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    if (!title.trim()) return setError('Дайте событию название')
    const when = date && time ? new Date(`${date}T${time}`).getTime() : null
    if (when && isNaN(when)) return setError('Неверная дата')
    const link = mapUrl.trim()
    const extraDesc = link
      ? description.trim()
        ? `\n🗺 ${link}`
        : `🗺 ${link}`
      : ''
    setBusy(true)
    try {
      await actions.createTask({
        title: title.trim(),
        description: description.trim() + extraDesc,
        scheduled_at: when,
      })
      actions.toast('Событие создано!', 'success')
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
          <h2>Новое событие</h2>
          <button className="icon-btn" onClick={onClose}><Emoji name="close" size={18} /></button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>Чем займёмся</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: ужин в кафе" autoFocus />
          </label>
          <label className="field">
            <span>Комментарий</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Что-нибудь ещё" />
          </label>
          <label className="field">
            <span>Ссылка на Яндекс Карты (не обязательно)</span>
            <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://yandex.ru/maps/?rtext=..." inputMode="url" />
            <small className="field-hint">Вставьте ссылку на точку — потом откроется кнопка «Показать на карте»</small>
          </label>

          <div className="field">
            <span>Когда (не обязательно)</span>
            <div className="when-row">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
            </div>
            <small className="field-hint">Оставьте пустым — событие без времени</small>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy ? 'Сохраняем...' : 'Сохранить событие'}
          </button>
        </div>
      </div>
    </div>
  )
}
