const THEMES = {
  auto: {
    label: 'Авто',
    isAuto: true,
  },
  light: {
    label: 'Светлая',
    bg: '#f2f2f7',
    card: 'rgba(255,255,255,0.72)',
    text: '#000000',
    text2: '#8e8e93',
    accent: '#007aff',
    border: 'rgba(60,60,67,0.16)',
    navBg: 'rgba(242,242,247,0.82)',
    tabBg: 'rgba(249,249,249,0.94)',
    glass: 'rgba(255,255,255,0.55)',
    shadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 28px rgba(0,0,0,0.07)',
  },
  dark: {
    label: 'Тёмная',
    bg: '#000000',
    card: 'rgba(28,28,30,0.72)',
    text: '#ffffff',
    text2: '#98989f',
    accent: '#0a84ff',
    border: 'rgba(84,84,88,0.55)',
    navBg: 'rgba(22,22,22,0.82)',
    tabBg: 'rgba(22,22,22,0.94)',
    glass: 'rgba(255,255,255,0.10)',
    shadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 30px rgba(0,0,0,0.55)',
  },
}

export const ACCENTS = {
  blue: '#007aff',
  green: '#34c759',
  red: '#ff3b30',
  orange: '#ff9500',
  purple: '#af52de',
  pink: '#ff2d55',
  teal: '#30b0c7',
  indigo: '#5856d6',
}

export function accentValue(accent) {
  if (!accent) return ACCENTS.blue
  if (accent[0] === '#') return accent
  return ACCENTS[accent] || ACCENTS.blue
}

export function savedAccent() {
  return accentValue(safeGet('together_accent'))
}

export function savedTheme() {
  const t = safeGet('together_theme')
  return THEMES[t] ? t : 'auto'
}

export function applyTheme(themeName, accentName) {
  const theme = THEMES[themeName] || THEMES.auto
  const accent = accentValue(accentName)
  const dark = theme.isAuto
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : themeName === 'dark'

  let t
  if (theme.isAuto) {
    t = dark ? THEMES.dark : THEMES.light
  } else {
    t = theme
  }
  const root = document.documentElement
  root.style.setProperty('--bg', t.bg)
  root.style.setProperty('--card', t.card)
  root.style.setProperty('--text', t.text)
  root.style.setProperty('--text2', t.text2)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--border', t.border)
  root.style.setProperty('--nav-bg', t.navBg)
  root.style.setProperty('--tab-bg', t.tabBg)
  root.style.setProperty('--glass', t.glass)
  root.style.setProperty('--shadow', t.shadow)
  root.style.setProperty('--is-dark', dark ? '1' : '0')
  root.style.colorScheme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? t.bg : '#f2f2f7')
}

export function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export { THEMES }
