import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Loader } from '../components/Loader.jsx'

export function AuthScreen() {
  const { state, actions } = useStore()
  const recovery = state.recovery
  const [mode, setMode] = useState('login') // login | register | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await actions.login(email.trim(), password)
      } else if (mode === 'register') {
        await actions.register('Пользователь', email.trim(), password)
      } else {
        await actions.resetPassword(email.trim())
        setInfo('Если аккаунт с такой почтой существует, мы отправили письмо со ссылкой для сброса пароля.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveNewPassword = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов')
      return
    }
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    try {
      await actions.updatePassword(password)
      await actions.clearRecovery()
      setPassword('')
      setPassword2('')
      setInfo('Пароль изменён — теперь войдите с новым паролем')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Восстановление пароля: ссылка из письма уже открыла приложение
  if (recovery) {
    return (
      <div className="auth-screen">
        <div className="auth-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div className="auth-card glass">
          <h1 className="auth-title">Новый пароль</h1>
          <form onSubmit={saveNewPassword} className="auth-form">
            <label className="field">
              <span>Новый пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              <span>Повторите пароль</span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Ещё раз"
                autoComplete="new-password"
                required
              />
            </label>
            {error && <div className="error-banner">{error}</div>}
            {info && <div className="success-banner">{info}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <span className="btn-busy"><Loader size={18} /> Сохраняем…</span> : 'Сохранить пароль'}
            </button>
          </form>
        </div>
      </div>
    )
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
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); setInfo(null) }}>Вход</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); setInfo(null) }}>Регистрация</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </label>
          {mode !== 'forgot' && (
            <label className="field">
              <span>Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete="current-password" required />
            </label>
          )}
          {error && <div className="error-banner">{error}</div>}
          {info && <div className="success-banner">{info}</div>}
          {mode === 'forgot' ? (
            <>
              <p className="auth-hint">Укажите почту аккаунта — мы отправим ссылку для восстановления.</p>
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? <span className="btn-busy"><Loader size={18} /> Отправляем…</span> : 'Отправить ссылку'}
              </button>
            </>
          ) : (
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <span className="btn-busy"><Loader size={18} /> Подождите…</span> : (mode === 'login' ? 'Войти' : 'Начать')}
            </button>
          )}
        </form>

        {mode === 'login' && (
          <button
            type="button"
            className="auth-link"
            onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}
          >
            Забыли логин или пароль?
          </button>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            className="auth-link"
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
          >
            Вернуться ко входу
          </button>
        )}
      </div>
    </div>
  )
}
