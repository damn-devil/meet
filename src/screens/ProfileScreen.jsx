import { useState } from 'react'
import { useStore } from '../store.jsx'
import { THEMES } from '../lib/theme.js'
import { applyTheme, safeSet, savedAccent, savedTheme } from '../lib/theme.js'
import { Avatar } from '../components/Avatar.jsx'
import { CropAvatar } from '../components/CropAvatar.jsx'
import { CoupleSection } from './CoupleScreen.jsx'
import { MoodMini } from '../components/MoodBar.jsx'
import { Emoji, avatarName } from '../components/Emoji.jsx'

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function ProfileScreen() {
  const { state, actions } = useStore()
  const me = state.user

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me?.name || '')
  const [bio, setBio] = useState(me?.bio || '')
  const [avatar, setAvatar] = useState(me?.avatar || '🙂')
  const [avatarUrl, setAvatarUrl] = useState(me?.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [telegram, setTelegram] = useState(me?.telegram || '')
  const [imessage, setImessage] = useState(me?.imessage || '')
  const [username, setUsername] = useState(me?.username || '')
  const [usernameState, setUsernameState] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const avatars = ['🐶', '🐼', '🦊', '🐸', '🐰', '🦁', '🐯', '🐹', '🐨']

  const usernamePattern = /^@[a-z0-9_.]{1,24}$/i

  const checkUsername = async (value) => {
    const v = (value || '').trim()
    if (!v) {
      setUsernameState(null)
      return
    }
    if (!usernamePattern.test(v)) {
      setUsernameState('bad')
      return
    }
    try {
      const res = await actions.checkUsername(v)
      setUsernameState(res?.available ? 'free' : 'taken')
    } catch {
      setUsernameState(null)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await actions.deleteAccount()
      location.reload()
    } catch (e) {
      actions.toast(e.message, 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const saveProfile = async () => {
    const u = username.trim()
    if (u && !usernamePattern.test(u)) {
      actions.toast('Юзернейм: начните с @, только латиница, цифры, _ и .', 'error')
      return
    }
    if (u && u.toLowerCase() !== (me?.username || '').toLowerCase() && !usernameState) {
      try {
        const res = await actions.checkUsername(u)
        if (!res?.available) {
          actions.toast('Этот юзернейм уже занят', 'error')
          return
        }
      } catch {
        /* продолжим; сервер тоже проверит */
      }
    }
    try {
      await actions.updateMe({ name, bio, avatar, avatar_url: avatarUrl, telegram, imessage, username: u || null })
      setEditing(false)
      actions.toast('Профиль сохранён', 'success')
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const pickAvatar = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const saveCroppedAvatar = async (dataUrl) => {
    setUploading(true)
    try {
      const blob = dataUrlToBlob(dataUrl)
      const url = await actions.uploadAvatar(blob, 'jpg')
      setAvatarUrl(url)
      await actions.updateMe({ name, bio, avatar, avatar_url: url, telegram, imessage, username: username.trim() || null })
      actions.toast('Фото профиля обновлено', 'success')
    } catch (err) {
      actions.toast(err.message, 'error')
    } finally {
      setUploading(false)
      setCropSrc(null)
    }
  }

  return (
    <div className="screen profile-screen">
      <header className="screen-header">
        <h1>Профиль</h1>
        <p className="screen-sub">Настройки и пара</p>
        <MoodMini />
      </header>

      {/* Profile */}
      <div className="profile-head">
        <Avatar url={me?.avatar_url} emoji={me?.avatar} size="big" alt={me?.name} />
        <h2>{me?.name}</h2>
        {me?.username && <p className="profile-username">{me.username}</p>}
        <p className="profile-bio">{me?.bio || 'Пока ничего о себе'}</p>
        {editing ? (
          <div className="profile-edit">
            <div className="avatar-photo-wrap">
              <Avatar url={avatarUrl} emoji={avatar} size="big" alt={name} />
              <label className="avatar-upload-btn">
                {uploading ? 'Загрузка…' : <><Emoji name="camera" size={16} /> Загрузить фото</>}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
              </label>
            </div>
            <div className="avatar-picker">
              {avatars.map((a) => (
                <button key={a} className={`avatar-opt ${avatar === a && !avatarUrl ? 'active' : ''}`} onClick={() => setAvatar(a)}><Emoji name={avatarName(a)} size={22} /></button>
              ))}
            </div>
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Юзернейм</span>
              <input
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameState(null) }}
                onBlur={() => checkUsername(username)}
                placeholder="@логин"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </label>
            {usernameState && (
              <p className={`username-state ${usernameState}`}>
                {usernameState === 'bad' && 'Начните с @ и используйте только латиницу, цифры, _ и .'}
                {usernameState === 'free' && 'Юзернейм свободен'}
                {usernameState === 'taken' && 'Этот юзернейм уже занят'}
              </p>
            )}
            <label className="field">
              <span>О себе</span>
              <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Расскажите о себе" />
            </label>
            <label className="field">
              <span>Telegram</span>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username или t.me/username" autoCapitalize="none" autoCorrect="off" />
            </label>
            <label className="field">
              <span>iMessage</span>
              <input value={imessage} onChange={(e) => setImessage(e.target.value)} placeholder="+7 999 123-45-67 или email" autoCapitalize="none" autoCorrect="off" />
            </label>
            <div className="profile-edit-actions">
              <button className="btn btn-primary" onClick={saveProfile}>Сохранить</button>
              <button className="btn btn-soft" onClick={() => setEditing(false)}>Отмена</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-soft" onClick={() => setEditing(true)}><Emoji name="pencil" size={16} /> Редактировать</button>
        )}
      </div>

      {/* Пара */}
      <h3 className="card-title">Пара</h3>
      <CoupleSection />

      {/* Settings */}
      <h3 className="card-title">Настройки</h3>
      <div className="settings-panel">
        <button className="btn btn-soft btn-block" onClick={() => setShowSettings(true)}>
          <Emoji name="gear" size={16} /> Основные настройки
        </button>
        <button className="btn btn-danger-soft btn-block" onClick={async () => { await actions.logout(); location.reload() }}>
          Выйти
        </button>
      </div>

      <div className="danger-zone">
        <button className="btn btn-danger-soft btn-block" onClick={() => setConfirmDelete(true)}>
          Удалить аккаунт
        </button>
        {confirmDelete && (
          <div className="danger-confirm glass">
            <p>Удалить аккаунт и все данные без возможности восстановить?</p>
            <div className="danger-actions">
              <button className="btn btn-soft" onClick={() => setConfirmDelete(false)}>Отмена</button>
              <button className="btn btn-danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? 'Удаляем…' : 'Да, удалить'}
              </button>
            </div>
          </div>
        )}
      </div>

      {cropSrc && <CropAvatar src={cropSrc} onCancel={() => setCropSrc(null)} onSave={saveCroppedAvatar} />}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal modal-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-head">
              <h2>Основные настройки</h2>
              <button className="icon-btn" onClick={() => setShowSettings(false)}><Emoji name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <SettingsPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPanel() {
  const { state, actions } = useStore()

  const changeTheme = (theme) => {
    safeSet('together_theme', theme)
    const dark = applyTheme(theme, savedAccent())
    actions.setDark(dark)
  }

  const uploadBg = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, 1800 / img.width)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          actions.setBg(canvas.toDataURL('image/jpeg', 0.82)).catch(() => actions.toast('Не удалось сохранить фон', 'error'))
          actions.toast('Фон обновлён', 'success')
        } catch {
          actions.toast('Не удалось обработать фото', 'error')
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const clearBg = () => {
    actions.setBg('').catch(() => actions.toast('Не удалось сбросить фон', 'error'))
    actions.toast('Фон сброшен')
  }

  const [showAdmin, setShowAdmin] = useState(false)

  return (
    <div className="settings-panel">
      <div className="setting-group">
        <span className="setting-label">Тема</span>
        <div className="setting-options">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              className={`theme-dot ${savedTheme() === key ? 'active' : ''}`}
              style={!t.isAuto ? { background: t.bg, color: t.text, border: `1px solid ${t.hairline}` } : undefined}
              onClick={() => changeTheme(key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Фон из фото</span>
        <p className="bg-hint">Своё фото в качестве фона приложения — его увидит и ваш партнёр.</p>
        <div className="bg-actions">
          <label className="btn btn-soft">
            {state.bg ? <><Emoji name="camera" size={16} /> Сменить фото</> : <><Emoji name="camera" size={16} /> Загрузить фото</>}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadBg} />
          </label>
          {state.bg && (
            <button className="btn btn-danger-soft" onClick={clearBg}>Сбросить фон</button>
          )}
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Сервис</span>
        <button className="btn btn-soft btn-block" onClick={() => setShowAdmin(true)}>
          <Emoji name="gear" size={16} /> Админ-панель
        </button>
      </div>

      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
    </div>
  )
}

function AdminModal({ onClose }) {
  const { actions } = useStore()

  const [password, setPassword] = useState('')
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const load = async (pw) => {
    setBusy(true)
    setError('')
    try {
      setUsers(await actions.adminUsers(pw))
    } catch (e) {
      setUsers(null)
      setError(e.message || 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  const openActivity = async (id) => {
    setBusy(true)
    setError('')
    try {
      setActivity(await actions.adminActivity(password, id))
    } catch (e) {
      setError(e.message || 'Не удалось загрузить активность')
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (id) => {
    setBusy(true)
    setError('')
    try {
      await actions.adminDeleteUser(password, id)
      setConfirmId(null)
      await load(password)
      actions.toast('Пользователь удалён', 'success')
    } catch (e) {
      setError(e.message || 'Не удалось удалить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Админ-панель</h2>
          <button className="icon-btn" onClick={onClose}><Emoji name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          {!users ? (
            <>
              <p className="admin-hint">Введите пароль администратора, чтобы увидеть список пользователей.</p>
              <label className="field">
                <span>Пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load(password)}
                  autoFocus
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <div className="profile-edit-actions">
                <button className="btn btn-primary" disabled={busy || !password} onClick={() => load(password)}>
                  {busy ? 'Проверяем…' : 'Войти'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="admin-top">
                <span className="admin-count">Пользователей: {users.length}</span>
                <button className="btn btn-soft" disabled={busy} onClick={() => load(password)}>
                  Обновить
                </button>
              </div>
              {error && <p className="form-error">{error}</p>}
              {users.length === 0 && <p className="admin-hint">Пользователей пока нет</p>}
              <div className="admin-list">
                {users.map((u) => (
                  <div key={u.id} className="admin-row">
                    <div className="admin-row-main">
                      <span className="admin-name">{u.name || '—'}</span>
                      <span className="admin-email">{u.email}</span>
                      {u.username && <span className="admin-email">{u.username}</span>}
                    </div>
                    <div className="admin-row-actions">
                      <button className="btn btn-soft" disabled={busy} onClick={() => openActivity(u.id)}>
                        Активность
                      </button>
                      {confirmId === u.id ? (
                        <span className="admin-confirm">
                          Точно?
                          <button className="btn btn-danger" disabled={busy} onClick={() => removeUser(u.id)}>Да</button>
                          <button className="btn btn-soft" onClick={() => setConfirmId(null)}>Нет</button>
                        </span>
                      ) : (
                        <button className="btn btn-danger-soft" disabled={busy} onClick={() => setConfirmId(u.id)}>
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {activity && <AdminActivity data={activity} onClose={() => setActivity(null)} />}
        </div>
      </div>
    </div>
  )
}

function AdminActivity({ data, onClose }) {
  const a = data
  const rows = [
    ['Почта', a.user?.email],
    ['Имя', a.profile?.name],
    ['Юзернейм', a.profile?.username || '—'],
    ['Зарегистрирован', a.user?.created_at ? new Date(a.user.created_at).toLocaleString('ru-RU') : '—'],
    ['Вход подтверждён', a.user?.confirmed_at ? new Date(a.user.confirmed_at).toLocaleString('ru-RU') : '—'],
    ['Последний вход', a.user?.last_sign_in_at ? new Date(a.user.last_sign_in_at).toLocaleString('ru-RU') : '—'],
    ['В паре', a.couple_id ? 'да' : 'нет'],
    ['Создал событий', a.tasks_created],
    ['Отметок «пришёл»', a.checkins],
    ['Оценок', a.ratings],
    ['Запросов в пару', a.requests],
    ['Завершённых встреч', a.events_completed],
  ]
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Активность</h2>
          <button className="icon-btn" onClick={onClose}><Emoji name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="admin-activity">
            {rows.map(([k, v]) => (
              <div key={k} className="admin-activity-row">
                <span>{k}</span>
                <b>{v ?? '—'}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
