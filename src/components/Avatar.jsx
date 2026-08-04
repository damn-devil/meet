import { Emoji, avatarName } from './Emoji.jsx'

export function Avatar({ url, emoji, size = 'couple', alt = '' }) {
  if (url) {
    return <img className={`avatar-img ${size}`} src={url} alt={alt} loading="lazy" />
  }
  return <span className={`avatar-emoji ${size}`}><Emoji name={avatarName(emoji)} size="1em" /></span>
}
