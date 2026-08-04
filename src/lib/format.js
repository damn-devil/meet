export function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function relativeTime(ts) {
  if (!ts) return ''
  const diff = ts - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)
  let s
  if (mins < 1) s = 'менее минуты'
  else if (mins < 60) s = `${mins} мин`
  else if (hours < 24) s = `${hours} ч`
  else s = `${days} дн`
  return diff >= 0 ? `через ${s}` : `${s} назад`
}

export function statusMeta(status) {
  const map = {
    planned: { label: 'Запланировано', color: '#f59e0b', icon: 'hourglass' },
    in_progress: { label: 'Встреча идёт', color: '#38bdf8', icon: 'pin' },
    completed: { label: 'Выполнено', color: '#10b981', icon: 'check' },
    missed: { label: 'Пропущено', color: '#f43f5e', icon: 'cat-sad' },
    cancelled: { label: 'Отменено', color: '#9ca3af', icon: 'prohibited' },
  }
  return map[status] || map.planned
}

export function avgRating(task) {
  if (!task?.ratings?.length) return null
  const sum = task.ratings.reduce((a, r) => a + r.score, 0)
  return Math.round((sum / task.ratings.length) * 10) / 10
}
