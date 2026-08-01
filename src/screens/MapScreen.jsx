import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { createMap } from '../lib/map.js'
import { statusMeta } from '../lib/format.js'

export function MapScreen() {
  const { state, actions } = useStore()
  const [map, setMap] = useState(null)
  const [mode, setMode] = useState(null)
  const [info, setInfo] = useState(null)
  const mapEl = useRef(null)
  const markersRef = useRef([])
  const myMarkerRef = useRef(null)

  useEffect(() => {
    let map
    let cancelled = false
    ;(async () => {
      try {
        const pos = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000 })
        })
        if (cancelled) return
        map = await createMap(mapEl.current, {
          center: pos ? [pos.coords.latitude, pos.coords.longitude] : undefined,
          zoom: 13,
        })
      } catch {
        map = await createMap(mapEl.current, {})
      }
      if (cancelled) return
      setMap(map)
      setMode(map.mode)
    })()
    return () => {
      cancelled = true
      map?.destroy?.()
    }
  }, [])

  // update markers when tasks change
  useEffect(() => {
    if (!map) return
    markersRef.current.forEach((m) => map.removeMarker(m))
    markersRef.current = []
    state.tasks.forEach((t) => {
      if (t.lat === undefined || t.lng === undefined) return
      const meta = statusMeta(t.status)
      const marker = map.addMarker(t.lat, t.lng, {
        title: t.title,
        color: meta.color,
        onClick: () => setInfo(t),
      })
      markersRef.current.push(marker)
    })
  }, [map, state.tasks])

  // show my location
  useEffect(() => {
    if (!map) return
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (myMarkerRef.current) map.removeMarker(myMarkerRef.current)
        myMarkerRef.current = map.addMyMarker(pos.coords.latitude, pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [map])

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => map?.setCenter(pos.coords.latitude, pos.coords.longitude, 15),
      () => actions.toast('Нет доступа к геолокации', 'error')
    )
  }

  return (
    <div className="map-screen">
      <div className="map-full" ref={mapEl} />
      <div className="map-topbar">
        <h1>Карта</h1>
        <span className="map-mode-badge">{mode === 'yandex' ? 'Яндекс Карты' : 'OpenStreetMap'}</span>
      </div>
      <button className="locate-btn" onClick={locateMe} aria-label="Моё местоположение">📍</button>

      {info && (
        <div className="map-info-card glass" onClick={() => actions.openTask(info.id)}>
          <div className="map-info-top">
            <h3>{info.title}</h3>
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setInfo(null) }}>✕</button>
          </div>
          {info.place_name && <p className="map-info-place">📍 {info.place_name}</p>}
          {info.scheduled_at && <p className="map-info-time">🕐 {new Date(info.scheduled_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
          <span className="map-info-status" style={{ color: statusMeta(info.status).color }}>{statusMeta(info.status).icon} {statusMeta(info.status).label}</span>
        </div>
      )}

      <div className="map-legend glass">
        {['planned', 'in_progress', 'completed', 'missed', 'cancelled'].map((s) => (
          <span key={s} style={{ color: statusMeta(s).color }}>
            {statusMeta(s).icon} {statusMeta(s).label}
          </span>
        ))}
      </div>
    </div>
  )
}
