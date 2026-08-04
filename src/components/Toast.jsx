import { useStore } from '../store.jsx'
import { EmojiText } from './Emoji.jsx'

export function Toast() {
  const { state } = useStore()
  const t = state.toast
  if (!t) return null
  return (
    <div className={`toast ${t.type}`}>
      <EmojiText text={t.msg} />
    </div>
  )
}
