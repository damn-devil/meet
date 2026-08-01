// Map abstraction: uses Yandex Maps JS API if a key is configured (VITE_YANDEX_KEY),
// otherwise falls back to Leaflet + OpenStreetMap tiles so it works out of the box.

const YANDEX_KEY = import.meta.env.VITE_YANDEX_KEY || ''

let leafletPromise = null
function loadLeaflet() {
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => resolve(window.L)
    document.head.appendChild(s)
  })
  return leafletPromise
}

let yandexPromise = null
function loadYandex() {
  if (yandexPromise) return yandexPromise
  yandexPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_KEY}&lang=ru_RU`
    s.onload = () => resolve(window.ymaps)
    s.onerror = () => reject(new Error('Yandex load failed'))
    document.head.appendChild(s)
  })
  return yandexPromise
}

let activeMode = null
export async function getMapMode() {
  if (activeMode) return activeMode
  if (YANDEX_KEY) {
    try {
      await loadYandex()
      activeMode = 'yandex'
    } catch {
      activeMode = 'leaflet'
    }
  } else {
    activeMode = 'leaflet'
  }
  return activeMode
}

const ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <path d="M18 0C8.5 0 1 7.5 1 17c0 12.5 17 27 17 27s17-14.5 17-27C35 7.5 27.5 0 18 0z" fill="#6366f1"/>
  <circle cx="18" cy="17" r="7" fill="#fff"/>
</svg>`

const MY_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
  <circle cx="15" cy="15" r="14" fill="#10b981" stroke="#fff" stroke-width="3"/>
  <circle cx="15" cy="15" r="5" fill="#fff"/>
</svg>`

function leafletMarkerIcon(color = '#6366f1') {
  return window.L.divIcon({
    className: '',
    html: ICON.replace('#6366f1', color),
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -40],
  })
}

export async function createMap(container, { center, zoom = 12, markerColor }) {
  const mode = await getMapMode()
  if (mode === 'yandex') {
    const ymaps = await loadYandex()
    const map = new ymaps.Map(container, {
      center: center || [55.7558, 37.6173],
      zoom,
      controls: ['zoomControl', 'geolocationControl', 'searchControl', 'fullscreenControl'],
    })
    const placemarks = []
    return {
      mode,
      _map: map,
      setCenter(lat, lng, z) {
        map.setCenter([lat, lng], z, { duration: 300 })
      },
      addMarker(lat, lng, { title, color, onClick: mClick } = {}) {
        const pm = new ymaps.Placemark([lat, lng], {
          hintContent: title || '',
          balloonContent: title || '',
        }, {
          iconLayout: 'default#image',
          iconImageHref: `data:image/svg+xml;utf8,${encodeURIComponent(ICON.replace('#6366f1', color || markerColor || '#6366f1'))}`,
          iconImageSize: [36, 44],
          iconImageOffset: [-18, -42],
        })
        if (mClick) pm.events.add('click', mClick)
        map.geoObjects.add(pm)
        placemarks.push(pm)
        return pm
      },
      addMyMarker(lat, lng) {
        const pm = new ymaps.Placemark([lat, lng], {}, {
          iconLayout: 'default#image',
          iconImageHref: `data:image/svg+xml;utf8,${encodeURIComponent(MY_ICON)}`,
          iconImageSize: [30, 30],
          iconImageOffset: [-15, -15],
        })
        map.geoObjects.add(pm)
        placemarks.push(pm)
        return pm
      },
      removeMarker(m) {
        map.geoObjects.remove(m)
      },
      clearMarkers() {
        placemarks.forEach((m) => map.geoObjects.remove(m))
        placemarks.length = 0
      },
      onTap(cb) {
        map.events.add('click', (e) => {
          const coords = e.get('coords')
          cb(coords[0], coords[1])
        })
      },
      getBounds() {
        const b = map.getBounds()
        return { ne: b[1], sw: b[0] }
      },
      destroy() {
        map.destroy()
      },
    }
  }

  const L = await loadLeaflet()
  const map = L.map(container).setView(center || [55.7558, 37.6173], zoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  const placemarks = []
  const my = L.layerGroup().addTo(map)
  return {
    mode,
    _map: map,
    setCenter(lat, lng, z) {
      map.setView([lat, lng], z || map.getZoom())
    },
    addMarker(lat, lng, { title, color, onClick } = {}) {
      const m = L.marker([lat, lng], { icon: leafletMarkerIcon(color || markerColor) }).addTo(map)
      if (title) m.bindPopup(`<b>${title}</b>`)
      if (onClick) m.on('click', onClick)
      placemarks.push(m)
      return m
    },
    addMyMarker(lat, lng) {
      const m = L.marker([lat, lng], { icon: window.L.divIcon({ className: '', html: MY_ICON, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(my)
      placemarks.push(m)
      return m
    },
    removeMarker(m) {
      map.removeLayer(m)
    },
    clearMarkers() {
      placemarks.forEach((m) => map.removeLayer(m))
      placemarks.length = 0
    },
    onTap(cb) {
      map.on('click', (e) => cb(e.latlng.lat, e.latlng.lng))
    },
    getBounds() {
      const b = map.getBounds()
      return { ne: b.getNorthEast(), sw: b.getSouthWest() }
    },
    destroy() {
      map.remove()
    },
  }
}

export async function geocode(query) {
  const mode = await getMapMode()
  if (mode === 'yandex') {
    const ymaps = await loadYandex()
    const res = await ymaps.geocode(query)
    const found = res.geoObjects
    if (!found || found.getLength() === 0) return []
    const out = []
    found.each((obj) => {
      const coords = obj.geometry.getCoordinates()
      out.push({
        name: obj.get(0)?.properties?.get('name') || '',
        address: obj.get(0)?.properties?.get('description') || obj.properties.get('text') || '',
        lat: coords[0],
        lng: coords[1],
        provider: 'yandex',
      })
    })
    return out
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&accept-language=ru`,
    { headers: { 'User-Agent': 'together-app/1.0' } }
  )
  const data = await res.json()
  return data.map((d) => ({
    name: d.name || d.display_name.split(',')[0],
    address: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    provider: 'osm',
  }))
}
