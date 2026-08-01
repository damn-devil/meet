export function catHappiness(stats) {
  const base = 50
  const value = base + (stats.completed || 0) * 6 - (stats.missed || 0) * 12
  return Math.max(0, Math.min(100, value))
}

export function catMood(stats) {
  const h = catHappiness(stats)
  if (h < 20) return 'angry'
  if (h < 40) return 'sad'
  if (h >= 80) return 'happy'
  return 'neutral'
}

export const CAT_EMOJI = {
  angry: '😾',
  sad: '😿',
  happy: '😸',
  neutral: '🐱',
}

export const CAT_FOOD_EMOJI = ['🍖', '🐟', '🥛', '💖', '✨']
