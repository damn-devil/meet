export function extractMapUrl(text) {
  if (!text) return null
  const m = text.match(/(https?:\/\/[^\s]+)/i)
  const url = m ? m[1] : null
  if (!url) return null
  if (/yandex|maps\.google|2gis/i.test(url)) return url
  return null
}

export function hasMapUrl(text) {
  return !!extractMapUrl(text)
}