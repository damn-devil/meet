import { useState } from 'react'
import { useStore } from '../store.jsx'

export function AuthScreen() {
  const { actions } = useStore()
  const [mode, setMode] = useState('login') // login | register
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await actions.login(email.trim(), password)
      else await actions.register(name.trim(), email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="auth-card glass">
        <h1 className="auth-title">…</h1>

        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Вход</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Регистрация</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Имя</span>
            {mode === 'register' ? (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как вас зовут?" autoComplete="username" />
            ) : (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Не обязательно" autoComplete="username" />
            )}
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete="current-password" required />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Начать'}
          </button>
        </form>
      </div>
    </div>
  )
}
