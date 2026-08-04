import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Loader } from '../components/Loader.jsx'

function GoogleLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.85-.08-1.67-.22-2.46H12v4.66h6.44a5.8 5.8 0 0 1-2.52 3.8v3.16h4.06c2.39-2.2 3.52-5.44 3.52-9.16Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.06 7.86-2.88l-4.06-3.16c-1.13.75-2.56 1.2-3.8 1.2-2.92 0-5.4-1.97-6.28-4.62H1.6v3.28A11.98 11.98 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.72 14.54a7.1 7.1 0 0 1 0-4.54V6.72H1.6a12 12 0 0 0 0 10.56l4.12-2.74Z" />
      <path fill="#EA4335" d="M12 4.72c1.58 0 3 .54 4.12 1.61l3.1-3.1A12 12 0 0 0 1.6 6.72l4.12 2.74c1.48-3.16 3.96-4.74 6.88-4.74Z" />
    </svg>
  )
}

function AppleLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 12.6c0-2.1 1.7-3.1 1.8-3.2-1-.05-1.9-.6-2.3-1.5-.9-1-.6-2.1-.2-2.6-.7.3-1.4.6-2.1.8-.7.2-1.4.2-2.1 0-.8-1-2-1.6-3.3-1.6C6.3 5.5 4.5 7.8 4.5 12c0 4.2 3 7.5 6.7 7.5.7 0 1.4-.1 2.1-.2.4-.2.7-.3 1-.2.1-.1 1.2-1.5 1.2-1.5.1 0 1.5 1 1.5 1 1.8 2.5 2.5 2.5 2.5 2.5.1 0 .1-.1.1-.2-.8-.2-1-.7-1-1.5-.3-2.2 1-3.9 1-4.5 0 .1-.1.1-.1.1-.8-.3-1.3-.7-1.5-1.1-2.9-3.6A4.5 4.5 0 0 0 16.6 12.3Z" transform="translate(1 1)" />
    </svg>
  )
}

export function AuthScreen() {
  const { actions } = useStore()
  const [mode, setMode] = useState('login') // login | register
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await actions.login(email.trim(), password)
      else await actions.register('Пользователь', email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startOAuth = async (provider) => {
    setError(null)
    setBusy(true)
    try {
      await actions.signInWithProvider(provider)
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
        <h1 className="auth-title">Universe of Plans</h1>

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
            <span>Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete="current-password" required />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <span className="btn-busy"><Loader size={18} /> Подождите…</span> : (mode === 'login' ? 'Войти' : 'Начать')}
          </button>
        </form>

        <div className="auth-divider"><span>или</span></div>

        <div className="auth-social">
          <button type="button" className="btn btn-soft btn-block" onClick={() => startOAuth('google')} disabled={busy}>
            <GoogleLogo size={18} /> Продолжить с Google
          </button>
          <button type="button" className="btn btn-soft btn-block" onClick={() => startOAuth('apple')} disabled={busy}>
            <AppleLogo size={18} /> Продолжить с Apple
          </button>
        </div>
      </div>
    </div>
  )
}
