export function telegramUrl(value) {
  if (!value) return null
  let s = String(value).trim().replace(/^@/, '')
  if (!s) return null
  const m = s.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{5,})/i)
  if (m) s = m[1]
  s = s.replace(/[/?#].*$/, '')
  if (!/^[A-Za-z0-9_]{5,}$/.test(s)) return null
  return `https://t.me/${s}`
}

export function imessageUrl(value) {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  if (s.includes('@')) return `imessage:${s}`
  const digits = s.replace(/[^\d+]/g, '')
  return digits ? `sms:${digits}` : null
}

export function hasAnyContact(member) {
  return Boolean(member && (telegramUrl(member.telegram) || imessageUrl(member.imessage)))
}
