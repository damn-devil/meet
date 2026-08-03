import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { Icon } from '../components/Icon.jsx'

const LOCALE = 'ru-RU'

function localDayKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayKey() {
  const d = new Date()
  return localDayKey(d.getFullYear(), d.getMonth(), d.getDate())
}

function monthTitle(year, month) {
  return new Date(year, month, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

export function CalendarScreen() {
  const { state, actions } = useStore()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [busy, setBusy] = useState(false)

  const me = state.user
  const partner = state.couple?.members?.find((m) => m.id !== me?.id)
  const meId = me?.id
  const partnerId = partner?.id

  const daysByUser = useMemo(() => {
    const map = {}
    ;(state.freeDays || []).forEach((r) => {
      const key = r.day
      if (!map[key]) map[key] = new Set()
      map[key].add(r.user_id)
    })
    return map
  }, [state.freeDays])

  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const startWeekday = first.getDay() // 0=Sun..6=Sat, make Mon=0
    const offset = (startWeekday + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDays = new Date(year, month, 0).getDate()
    const arr = []
    for (let i = 0; i < offset; i++) {
      arr.push({ key: localDayKey(new Date(year, month - 1, 0).getFullYear(), (month + 11) % 12, prevDays - offset + i + 1), day: prevDays - offset + i + 1, other: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ key: localDayKey(year, month, d), day: d, other: false })
    }
    while (arr.length % 7 !== 0) {
      const d = arr.length - offset - daysInMonth + 1
      const ny = month === 11 ? year + 1 : year
      const nm = month === 11 ? 0 : month + 1
      arr.push({ key: localDayKey(ny, nm, d), other: true, day: d })
    }
    return arr
  }, [year, month])

  const toggle = async (cell) => {
    if (cell.other || busy) return
    const isMine = daysByUser[cell.key]?.has(meId)
    setBusy(true)
    try {
      await actions.setFreeDay(cell.key, !isMine)
    } catch (e) {
      actions.toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const nav = (delta) => {
    let y = year
    let m = month + delta
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setYear(y)
    setMonth(m)
  }

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Календарь</h1>
          <p className="screen-sub">Отметьте дни, когда вы свободны</p>
        </div>
      </header>

      <div className="calendar-card glass">
        <div className="calendar-head">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="Предыдущий месяц">‹</button>
          <strong className="calendar-title">{monthTitle(year, month)}</strong>
          <button className="icon-btn" onClick={() => nav(1)} aria-label="Следующий месяц">›</button>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map((w) => <span key={w}>{w}</span>)}
        </div>

        <div className="calendar-grid">
          {cells.map((cell) => {
            const who = daysByUser[cell.key]
            const mine = !cell.other && who?.has(meId)
            const theirs = !cell.other && who?.has(partnerId)
            const cls = [
              'day-cell',
              cell.other ? 'is-other' : '',
              mine && theirs ? 'is-both' : mine ? 'is-mine' : theirs ? 'is-theirs' : '',
              cell.key === todayKey() ? 'is-today' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={cell.key}
                className={cls}
                onClick={() => toggle(cell)}
                disabled={cell.other}
                aria-label={cell.key}
              >
                <span className="day-num">{cell.day}</span>
                {(mine || theirs) && <span className="day-dot" />}
              </button>
            )
          })}
        </div>

        {meId && partnerId && (
          <div className="calendar-legend">
            <span className="legend-item"><i className="dot-mine" /> Вы свободны</span>
            <span className="legend-item"><i className="dot-theirs" /> {partner.name || 'Партнёр'}</span>
            <span className="legend-item"><i className="dot-both" /> Оба</span>
          </div>
        )}
      </div>

      {!state.couple && (
        <div className="empty-state">
          <div className="empty-art"><Icon name="heart" /></div>
          <p>Календарь станет доступен, когда вы найдёте друг друга в паре</p>
          <button className="btn btn-primary" onClick={() => actions.setView('couple')}>Найти пару</button>
        </div>
      )}
    </div>
  )
}