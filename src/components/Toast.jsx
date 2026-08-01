import { useStore } from '../store.jsx'

export function Toast() {
  const { state } = useStore()
  const t = state.toast
  if (!t) return null
  return (
    <div className={`toast ${t.type}`}>
      {t.msg}
    </div>
  )
}
