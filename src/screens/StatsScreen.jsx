import { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { Icon } from '../components/Icon.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { MoodMini } from '../components/MoodBar.jsx'

const LOCALE = 'ru-RU'
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthName(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

function isCompleted(t) {
  return t.status === 'completed'
}

export function StatsScreen() {
  const { state, actions } = useStore()
  const me = state.user
  const partner = state.couple?.members?.find((m) => m.id !== me?.id)
  const meId = me?.id
  const partnerId = partner?.id

  const s = useMemo(() => {
    const tasks = state.tasks || []
    const completed = tasks.filter(isCompleted)

    const total = completed.length

    const daySet = new Set()
    completed.forEach((t) => {
      if (t.scheduled_at) {
        const d = new Date(t.scheduled_at)
        if (!Number.isNaN(d.getTime())) daySet.add(dayKey(d))
      }
    })
    let streak = 0
    const now = new Date()
    for (let i = 0; i < 10000; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      if (daySet.has(dayKey(d))) streak++
      else break
    }

    let sum = 0
    let n = 0
    tasks.forEach((t) => (t.ratings || []).forEach((r) => { sum += r.score; n++ }))
    const avg = n ? Math.round((sum / n) * 10) / 10 : null

    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    const last30 = tasks.filter((t) => t.scheduled_at && new Date(t.scheduled_at) >= cutoff)
    const last30Done = last30.filter(isCompleted).length
    const last30Missed = last30.filter((t) => t.status === 'missed').length

    const deleted = tasks.filter((t) => t.status === 'cancelled').length

    const monthAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    const stale = tasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') return false
      if (!t.scheduled_at) return false
      const d = new Date(t.scheduled_at)
      if (Number.isNaN(d.getTime())) return false
      return d < monthAgo
    }).length

    const edited = tasks.reduce((a, t) => a + (t.edit_count || 0), 0)

    const dow = [0, 0, 0, 0, 0, 0, 0]
    completed.forEach((t) => {
      if (t.scheduled_at) {
        const d = new Date(t.scheduled_at)
        if (!Number.isNaN(d.getTime())) dow[(d.getDay() + 6) % 7]++
      }
    })
    const maxDow = Math.max(...dow, 1)

    const months = {}
    completed.forEach((t) => {
      if (t.scheduled_at) {
        const d = new Date(t.scheduled_at)
        if (!Number.isNaN(d.getTime())) {
          const k = monthKey(d)
          months[k] = (months[k] || 0) + 1
        }
      }
    })
    let bestMonthKey = null
    let bestMonthCount = 0
    Object.entries(months).forEach(([k, v]) => {
      if (v > bestMonthCount) { bestMonthCount = v; bestMonthKey = k }
    })

    const authoredByMe = tasks.filter((t) => t.created_by === meId).length
    const authoredByPartner = tasks.filter((t) => t.created_by === partnerId).length

    let meLate = 0
    let partnerLate = 0
    completed.forEach((t) => {
      const meC = (t.checkins || []).find((c) => c.user_id === meId)
      const paC = (t.checkins || []).find((c) => c.user_id === partnerId)
      if (meC?.arrived_at && paC?.arrived_at) {
        const a = new Date(meC.arrived_at)
        const b = new Date(paC.arrived_at)
        if (a > b) meLate++
        else if (b > a) partnerLate++
      }
    })

    return {
      total, streak, avg,
      last30Done, last30Missed,
      deleted, stale, edited,
      dow, maxDow,
      bestMonthKey, bestMonthCount,
      authoredByMe, authoredByPartner,
      meLate, partnerLate,
    }
  }, [state.tasks, meId, partnerId])

  const meName = me?.name || 'Вы'
  const partnerName = partner?.name || 'Партнёр'

  if (!state.couple) {
    return (
      <div className="screen">
        <header className="screen-header">
          <div>
            <h1>Статистика</h1>
            <p className="screen-sub">Цифры вашей пары</p>
          </div>
          <MoodMini />
        </header>
        <div className="empty-state">
          <div className="empty-art"><Icon name="chart" /></div>
          <p>Статистика появится, когда вы найдёте друг друга в паре</p>
          <button className="btn btn-primary" onClick={() => actions.setView('profile')}>Найти пару</button>
        </div>
      </div>
    )
  }

  const bestMonthLabel = s.bestMonthKey ? monthName(s.bestMonthKey) : null

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Статистика</h1>
          <p className="screen-sub">{meName} и {partnerName}</p>
        </div>
        <MoodMini />
      </header>

      <div className="stats-cards">
        <div className="stats-card">
          <div className="stats-num">{s.total}</div>
          <div className="stats-label">Встреч всего</div>
        </div>
        <div className="stats-card">
          <div className="stats-num">{s.streak}</div>
          <div className="stats-label">Серия · дней</div>
        </div>
        <div className="stats-card">
          <div className="stats-num">{s.avg != null ? s.avg : '—'}</div>
          <div className="stats-label">Средняя оценка</div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-title">Детали · 30 дней</h2>
        <div className="mini-metrics">
          <div className="mini-metric"><span className="mini-num ok">{s.last30Done}</span><span className="mini-label">состоялось</span></div>
          <div className="mini-metric"><span className="mini-num no">{s.last30Missed}</span><span className="mini-label">пропущено</span></div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-title">Жизненный цикл событий</h2>
        <div className="mini-metrics three">
          <div className="mini-metric"><span className="mini-num">{s.deleted}</span><span className="mini-label">удалено</span></div>
          <div className="mini-metric"><span className="mini-num no">{s.stale}</span><span className="mini-label">не выполн. более мес.</span></div>
          <div className="mini-metric"><span className="mini-num">{s.edited}</span><span className="mini-label">изменено</span></div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-title">Встречные дни недели</h2>
        <div className="chart">
          {s.dow.map((count, i) => {
            const hot = count === s.maxDow && count > 0
            return (
              <div className="chart-col" key={WEEKDAYS[i]}>
                <span className="chart-count">{count || ''}</span>
                <div className="chart-bar-wrap">
                  <div className={`chart-bar${hot ? ' hot' : ''}`} style={{ height: `${(count / s.maxDow) * 100}%` }} />
                </div>
                <span className="chart-label">{WEEKDAYS[i]}</span>
              </div>
            )
          })}
        </div>
        {s.maxDow > 0 && (
          <p className="chart-hint">Самый «встречный» день — {WEEKDAYS[s.dow.indexOf(s.maxDow)]}</p>
        )}
      </div>

      <div className="section-card">
        <h2 className="section-title">Лучший месяц</h2>
        {bestMonthLabel ? (
          <p className="best-month">{bestMonthLabel} <span className="best-num">· {s.bestMonthCount} встреч</span></p>
        ) : (
          <p className="chart-hint">Пока нет выполненных встреч</p>
        )}
      </div>

      <div className="section-card">
        <h2 className="section-title">Кто чаще предлагает</h2>
        <div className="pk-row">
          <Avatar url={me?.avatar_url} emoji={me?.avatar || '🙂'} size="comment" alt={meName} />
          <span className="pk-name">{meName}</span>
          <div className="pk-track"><div className="pk-fill mine" style={{ width: pct(s.authoredByMe, s.authoredByMe + s.authoredByPartner) }} /></div>
          <span className="pk-count">{s.authoredByMe}</span>
        </div>
        <div className="pk-row">
          <Avatar url={partner?.avatar_url} emoji={partner?.avatar || '🙂'} size="comment" alt={partnerName} />
          <span className="pk-name">{partnerName}</span>
          <div className="pk-track"><div className="pk-fill theirs" style={{ width: pct(s.authoredByPartner, s.authoredByMe + s.authoredByPartner) }} /></div>
          <span className="pk-count">{s.authoredByPartner}</span>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-title">Кто чаще опаздывает</h2>
        <div className="pk-row">
          <Avatar url={me?.avatar_url} emoji={me?.avatar || '🙂'} size="comment" alt={meName} />
          <span className="pk-name">{meName}</span>
          <div className="pk-track"><div className="pk-fill mine" style={{ width: pct(s.meLate, s.meLate + s.partnerLate) }} /></div>
          <span className="pk-count">{s.meLate}</span>
        </div>
        <div className="pk-row">
          <Avatar url={partner?.avatar_url} emoji={partner?.avatar || '🙂'} size="comment" alt={partnerName} />
          <span className="pk-name">{partnerName}</span>
          <div className="pk-track"><div className="pk-fill theirs" style={{ width: pct(s.partnerLate, s.meLate + s.partnerLate) }} /></div>
          <span className="pk-count">{s.partnerLate}</span>
        </div>
        {s.meLate === 0 && s.partnerLate === 0 && (
          <p className="chart-hint">По встречам ещё нет данных о приходе</p>
        )}
      </div>
    </div>
  )
}

function pct(a, total) {
  if (!total) return '0%'
  return `${Math.round((a / total) * 100)}%`
}