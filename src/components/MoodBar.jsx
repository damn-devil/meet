import { useMemo } from 'react'
import { useStore } from '../store.jsx'

const MOODS = ['Смерть', 'Грусть', 'Обычное', 'Улыбка', 'Отличное']

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function useMood() {
  const { state } = useStore()
  return useMemo(() => {
    const tasks = state.tasks || []
    const completed = tasks.filter((t) => t.status === 'completed')
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
    for (let i = 0; i < 1000; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      if (daySet.has(dayKey(d))) streak++
      else break
    }

    let sum = 0
    let n = 0
    tasks.forEach((t) => (t.ratings || []).forEach((r) => { sum += r.score; n++ }))
    const avg = n ? sum / n : 0

    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    const last30Done = tasks.filter(
      (t) => t.status === 'completed' && t.scheduled_at && new Date(t.scheduled_at) >= cutoff,
    ).length

    const score = Math.round(
      Math.min(100,
        (avg / 5) * 100 +
        (Math.min(streak, 21) / 21) * 90 +
        (Math.min(total, 40) / 40) * 80 +
        (Math.min(last30Done, 14) / 20) * 70) / 3.4,
    )

    let level = 0
    if (score >= 48) level = 1
    if (score >= 60) level = 2
    if (score >= 76) level = 3
    if (score >= 90) level = 4

    return { score, level }
  }, [state.tasks])
}

export function MoodMini() {
  const m = useMood()
  return (
    <div className="mood-mini" title={MOODS[m.level]} role="img" aria-label={`Настроение пары: ${MOODS[m.level]}`}>
      <div className="mood-mini-face"><FaceSVG level={m.level} size={30} /></div>
      <div className="mood-mini-scale">
        {MOODS.map((_, i) => (
          <span key={i} className={`mood-mini-seg${i <= m.level ? ' on' : ''}`} />
        ))}
      </div>
    </div>
  )
}

function FaceSVG({ level, size = 30 }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 4.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  const eyes = [
    <g key="e0">
      <path d="M19 16L29 27M29 16 19 27" style={stroke} />
      <path d="M35 16 45 27M45 16 35 27" style={stroke} />
    </g>,
    <g key="e1">
      <path d="M20 30h8" style={stroke} />
      <path d="M36 30h8" style={stroke} />
    </g>,
    <g key="e2">
      <path d="M20 24h8" style={stroke} />
      <path d="M36 24h8" style={stroke} />
    </g>,
    <g key="e3">
      <path d="M19 20q5-6 10 0" style={stroke} />
      <path d="M35 20q5-6 10 0" style={stroke} />
    </g>,
    <g key="e4">
      <path d="M17 20q7-9 14 0" style={stroke} />
      <path d="M33 20q7-9 14 0" style={stroke} />
    </g>,
  ]
  const mouth = [
    <path key="m0" d="M22 48h20" style={stroke} />,
    <path key="m1" d="M22 46q10-8 20 0" style={stroke} />,
    <path key="m2" d="M27 45h10" style={stroke} />,
    <path key="m3" d="M24 42q8 8 16 0" style={stroke} />,
    <path key="m4" d="M20 42q12 14 24 0q-5 6-24 0Z" style={{ fill: 'currentColor', stroke: 'currentColor', strokeWidth: 4, strokeLinejoin: 'round' }} />,
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="7" y="6" width="50" height="52" rx="12" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 4 }} />
      {eyes[level]}
      {mouth[level]}
    </svg>
  )
}