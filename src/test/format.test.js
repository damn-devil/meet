import { describe, it, expect } from 'vitest'
import { formatDate, formatTime, statusMeta, avgRating, relativeTime } from '../lib/format.js'

describe('format helpers', () => {
  it('formats dates and times', () => {
    const ts = new Date(2025, 0, 15, 14, 30).getTime()
    expect(formatDate(ts)).toContain('января')
    expect(formatTime(ts)).toMatch(/\d{2}:\d{2}/)
  })

  it('status meta for all statuses', () => {
    expect(statusMeta('planned').label).toBe('Запланировано')
    expect(statusMeta('completed').label).toBe('Выполнено')
    expect(statusMeta('missed').label).toBe('Пропущено')
    expect(statusMeta('cancelled').label).toBe('Отменено')
    expect(statusMeta('in_progress').label).toBe('Встреча идёт')
  })

  it('computes average rating', () => {
    expect(avgRating({ ratings: [] })).toBeNull()
    expect(avgRating({ ratings: [{ score: 4 }, { score: 5 }] })).toBe(4.5)
  })

  it('relative time', () => {
    expect(relativeTime(Date.now() + 3600_000)).toContain('через')
    expect(relativeTime(Date.now() - 3600_000)).toContain('назад')
  })
})
