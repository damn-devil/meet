import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { createMap, geocode, getMapMode } from '../lib/map.js'

export function AddTaskModal({ onClose }) {
  const { actions } = useStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [datetime, setDatetime] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [picked, setPicked] = useState(null)
  const [mode, setMode] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    getMapMode().then(setMode)
  }, [])

  useEffect(() => {
    if (!mapEl.current) return
    let map
    ;(async () => {
      try {
        const pos = await getPosition()
        map = await createMap(mapEl.current, {
          center: pos ? [pos.coords.latitude, pos.coords.longitude] : undefined,
          zoom: 13,
        })
      } catch {
        map = await createMap(mapEl.current, {})
      }
      mapRef.current = map
      map.onTap((lat, lng) => {
        if (markerRef.current) map.removeMarker(markerRef.current)
        markerRef.current = map.addMarker(lat, lng, {})
        setPicked({ lat, lng })
      })
    })()
    return () => map?.destroy?.()
  }, [])

  const getPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        timeout: 8000,
      })
    })

  const search = async () => {
    if (!query.trim()) return
    setError(null)
    try {
      const r = await geocode(query.trim())
      setResults(r)
      if (r[0] && mapRef.current) {
        mapRef.current.setCenter(r[0].lat, r[0].lng, 15)
        if (markerRef.current) mapRef.current.removeMarker(markerRef.current)
        markerRef.current = mapRef.current.addMarker(r[0].lat, r[0].lng, {})
        setPicked({ lat: r[0].lat, lng: r[0].lng, place: r[0] })
      }
    } catch {
      setError('Не удалось найти место')
    }
  }

  const pickResult = (r) => {
    setResults([])
    setQuery(r.name)
    if (mapRef.current) {
      mapRef.current.setCenter(r.lat, r.lng, 16)
      if (markerRef.current) mapRef.current.removeMarker(markerRef.current)
      markerRef.current = mapRef.current.addMarker(r.lat, r.lng, {})
    }
    setPicked({ lat: r.lat, lng: r.lng, place: r })
  }

  const submit = async () => {
    setError(null)
    if (!title.trim()) return setError('Дайте плану название')
    if (!picked) return setError('Отметьте место на карте')
    if (!datetime) return setError('Выберите дату и время')
    const ts = new Date(datetime).getTime()
    if (isNaN(ts)) return setError('Неверная дата')
    setBusy(true)
    try {
      await actions.createTask({
        title: title.trim(),
        description: description.trim(),
        place_name: picked.place?.name || query.trim(),
        address: picked.place?.address || '',
        lat: picked.lat,
        lng: picked.lng,
        scheduled_at: ts,
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: ужин в кафе" />
          </label>
          <label className="field">
            <span>Комментарий</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Что-нибудь ещё" />
          </label>

          <div className="field">
            <span>Найти место</span>
            <div className="search-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Кафе, кино, парк..."
              />
              <button className="btn btn-soft" onClick={search}>🔍</button>
            </div>
            {results.length > 0 && (
              <div className="search-results">
                {results.map((r, i) => (
                  <button key={i} className="search-item" onClick={() => pickResult(r)}>
                    <span className="search-item-name">{r.name}</span>
                    <span className="search-item-addr">{r.address}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === 'yandex' && <small className="field-hint">Яндекс Карты • ищите заведения по названию</small>}
          </div>

          <div className="map-picker" ref={mapEl} />
          <p className="map-hint">👆 Коснитесь карты, чтобы выбрать точку встречи</p>

          <label className="field">
            <span>Когда</span>
            <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
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
