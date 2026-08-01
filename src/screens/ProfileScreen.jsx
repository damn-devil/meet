import { useState } from 'react'
import { useStore } from '../store.jsx'
import { THEMES, ACCENTS, accentValue } from '../lib/theme.js'
import { applyTheme, safeGet, safeSet, savedAccent } from '../lib/theme.js'
import { telegramUrl, imessageUrl, hasAnyContact } from '../lib/contacts.js'
import { Icon } from '../components/Icon.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { CropAvatar } from '../components/CropAvatar.jsx'

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
  const partner = state.couple?.members?.find((m) => m.id !== me?.id)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me?.name || '')
  const [bio, setBio] = useState(me?.bio || '')
  const [avatar, setAvatar] = useState(me?.avatar || '🙂')
  const [avatarUrl, setAvatarUrl] = useState(me?.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [telegram, setTelegram] = useState(me?.telegram || '')
  const [imessage, setImessage] = useState(me?.imessage || '')

  const avatars = ['🐶', '🐼', '🦊', '🐸', '🐰', '🦁', '🐯', '🐹', '🐨']

  const saveProfile = async () => {
    try {
      await actions.updateMe({ name, bio, avatar, avatar_url: avatarUrl, telegram, imessage })
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
      await actions.updateMe({ name, bio, avatar, avatar_url: url, telegram, imessage })
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
      </header>

      {/* Profile card */}
      <div className="profile-card glass">
        <Avatar url={me?.avatar_url} emoji={me?.avatar} size="big" alt={me?.name} />
        <h2>{me?.name}</h2>
        <p className="profile-bio">{me?.bio || 'Пока ничего о себе'}</p>
        {editing ? (
          <div className="profile-edit">
            <div className="avatar-photo-wrap">
              <Avatar url={avatarUrl} emoji={avatar} size="big" alt={name} />
              <label className="avatar-upload-btn">
                {uploading ? 'Загрузка…' : '📷 Загрузить фото'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
              </label>
            </div>
            <div className="avatar-picker">
              {avatars.map((a) => (
                <button key={a} className={`avatar-opt ${avatar === a && !avatarUrl ? 'active' : ''}`} onClick={() => setAvatar(a)}>{a}</button>
              ))}
            </div>
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
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
          <button className="btn btn-soft" onClick={() => setEditing(true)}>✏️ Редактировать</button>
        )}
      </div>

      {/* Couple card */}
      {state.couple && (
        <div className="couple-card glass">
          <h3 className="card-title">Ваша пара</h3>
          <div className="couple-row">
            <div className="couple-member">
              <Avatar url={me?.avatar_url} emoji={me?.avatar} size="couple" alt={me?.name} />
              <span className="couple-name">{me?.name} <em>вы</em></span>
            </div>
            <div className="couple-heart">❤</div>
            <div className="couple-member">
              <Avatar url={partner?.avatar_url} emoji={partner?.avatar || '❓'} size="couple" alt={partner?.name} />
              <span className="couple-name">{partner?.name || 'Ждём второго'}</span>
            </div>
          </div>
          {!partner && (
            <p className="bg-hint">Партнёр присоединится, когда вы отправите ему запрос в настройках.</p>
          )}
          {partner && (
            <div className="contact-actions">
              {telegramUrl(partner.telegram) && (
                <a className="contact-btn tg" href={telegramUrl(partner.telegram)} target="_blank" rel="noopener noreferrer">
                  <Icon name="send" strokeWidth={2} /> Telegram
                </a>
              )}
              {imessageUrl(partner.imessage) && (
                <a className="contact-btn im" href={imessageUrl(partner.imessage)}>
                  <Icon name="imessage" strokeWidth={2} /> iMessage
                </a>
              )}
              {!hasAnyContact(partner) && (
                <span className="contact-empty">Партнёр пока не указал контакты</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="settings-card glass">
        <h3 className="card-title">Статистика</h3>
        <div className="stats-grid">
          <div className="stat-card glass">
            <span className="stat-num">{state.stats.completed}</span>
            <span className="stat-label">Встреч</span>
          </div>
          <div className="stat-card glass">
            <span className="stat-num">{state.stats.missed}</span>
            <span className="stat-label">Пропущено</span>
          </div>
          <div className="stat-card glass">
            <span className="stat-num">{state.stats.avgRating ? `★ ${state.stats.avgRating}` : '—'}</span>
            <span className="stat-label">Оценка</span>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="settings-card glass">
        <h3 className="card-title">Настройки</h3>
        <SettingsPanel />
        <button className="btn btn-danger-soft btn-block" onClick={async () => { await actions.logout(); location.reload() }}>
          Выйти
        </button>
      </div>

      {cropSrc && <CropAvatar src={cropSrc} onCancel={() => setCropSrc(null)} onSave={saveCroppedAvatar} />}
    </div>
  )
}

function SettingsPanel() {
  const { state, actions } = useStore()
  const me = state.user
  const couple = state.couple

  const [radius, setRadius] = useState(couple?.radius_m || 150)
  const [windowMin, setWindowMin] = useState(couple?.window_min || 30)
  const [graceMin, setGraceMin] = useState(couple?.grace_min || 15)
  const [saved, setSaved] = useState(false)
  const [autoCheck, setAutoCheck] = useState(safeGet('together_autocheck', 'on') === 'on')
  const [notifStatus, setNotifStatus] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState(null)

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await actions.searchUsers(searchQuery.trim())
      setSearchResults(results || [])
    } catch (e) {
      actions.toast(e.message, 'error')
    } finally {
      setSearching(false)
    }
  }

  const sendRequest = async (toId) => {
    setSendingTo(toId)
    try {
      await actions.sendRequest(toId)
      setSearchResults([])
      setSearchQuery('')
    } catch (e) {
      actions.toast(e.message, 'error')
    } finally {
      setSendingTo(null)
    }
  }

  const respond = async (id, approve) => {
    try {
      await actions.respondRequest(id, approve)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const cancelReq = async (id) => {
    try {
      await actions.cancelRequest(id)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const incoming = state.requests.filter((r) => r.to_id === me?.id && r.status === 'pending')
  const outgoing = state.requests.filter((r) => r.from_id === me?.id && r.status === 'pending')

  const requestNotif = async () => {
    try {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm)
      actions.toast(perm === 'granted' ? 'Уведомления включены' : 'Уведомления не разрешены', perm === 'granted' ? 'success' : 'error')
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  const changeTheme = (theme) => {
    actions.updateMe({ theme })
    applyTheme(theme, savedAccent())
  }

  const changeAccent = (accent) => {
    const hex = accentValue(accent)
    applyTheme(me?.theme || 'auto', hex)
    safeSet('together_accent', hex)
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

  const saveSettings = async () => {
    try {
      await actions.updateCouple({ radius_m: radius, window_min: windowMin, grace_min: graceMin })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      actions.toast('Настройки пары сохранены', 'success')
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  return (
    <div className="settings-panel">
      <div className="setting-group">
        <span className="setting-label">Пара</span>

        {state.couple ? (
          <p className="bg-hint">Вы в паре. Планы, фон и настройки общие — их видит партнёр.</p>
        ) : (
          <>
            {incoming.length > 0 && (
              <div className="request-incoming">
                {incoming.map((r) => (
                  <div key={r.id} className="request-item glass">
                    <Avatar url={r.from.avatar_url} emoji={r.from.avatar || '🙂'} size="comment" alt={r.from.name} />
                    <div className="request-text">
                      <strong>{r.from.name}</strong> хочет быть с вами в паре
                    </div>
                    <div className="request-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => respond(r.id, true)}>Согласиться</button>
                      <button className="btn btn-danger-soft btn-sm" onClick={() => respond(r.id, false)}>Отказать</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="bg-hint">Найдите партнёра по имени или никнейму и отправьте запрос:</p>
            <div className="search-row">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                placeholder="Имя или никнейм"
                autoCorrect="off"
              />
              <button className="btn btn-soft" onClick={searchUsers} disabled={searching}>
                {searching ? '…' : '🔍'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((u) => (
                  <div key={u.id} className="search-item user-search-item">
                    <Avatar url={u.avatar_url} emoji={u.avatar || '🙂'} size="comment" alt={u.name} />
                    <span className="search-item-name">{u.name}</span>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={sendingTo === u.id}
                      onClick={() => sendRequest(u.id)}
                    >
                      {sendingTo === u.id ? 'Отправляем…' : 'Пригласить'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {outgoing.length > 0 && (
              <div className="request-outgoing">
                {outgoing.map((r) => (
                  <div key={r.id} className="request-item glass">
                    <Avatar url={r.to.avatar_url} emoji={r.to.avatar || '🙂'} size="comment" alt={r.to.name} />
                    <div className="request-text">
                      Запрос отправлен: <strong>{r.to.name}</strong>
                    </div>
                    <button className="btn btn-soft btn-sm" onClick={() => cancelReq(r.id)}>Отменить</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="setting-group">
        <span className="setting-label">Тема</span>
        <div className="setting-options">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              className={`theme-dot ${me?.theme === key ? 'active' : ''}`}
              style={!t.isAuto ? { background: t.bg, color: t.text, border: `1px solid ${t.border}` } : undefined}
              onClick={() => changeTheme(key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Акцентный цвет</span>
        <div className="setting-options">
          {Object.entries(ACCENTS).map(([key, color]) => (
            <button
              key={key}
              className={`accent-dot ${savedAccent() === color ? 'active' : ''}`}
              style={{ background: color }}
              onClick={() => changeAccent(key)}
              aria-label={key}
            />
          ))}
        </div>
        <label className="setting-custom">
          <span>Свой цвет</span>
          <input
            type="color"
            value={savedAccent()}
            onChange={(e) => changeAccent(e.target.value)}
            aria-label="Свой цвет акцента"
          />
        </label>
      </div>

      <div className="setting-group">
        <span className="setting-label">Фон из фото</span>
        <p className="bg-hint">Своё фото в качестве фона приложения — его увидит и ваш партнёр.</p>
        <div className="bg-actions">
          <label className="btn btn-soft">
            {state.bg ? '📷 Сменить фото' : '📷 Загрузить фото'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadBg} />
          </label>
          {state.bg && (
            <button className="btn btn-danger-soft" onClick={clearBg}>Сбросить фон</button>
          )}
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-row-info">
          <span className="setting-row-title">Уведомления</span>
          <span className="setting-row-sub">
            {notifStatus === 'granted'
              ? 'Вы будете узнавать о встречах и ответах партнёра'
              : notifStatus === 'unsupported'
                ? 'Этот браузер не поддерживает уведомления'
                : 'Разрешите push-уведомления'}
          </span>
        </div>
        <input
          type="checkbox"
          className="toggle"
          role="switch"
          aria-label="Уведомления"
          checked={notifStatus === 'granted'}
          disabled={notifStatus === 'unsupported' || notifStatus === 'granted'}
          onChange={requestNotif}
        />
      </div>

      <div className="setting-row">
        <div className="setting-row-info">
          <span className="setting-row-title">Автопроверка прихода</span>
          <span className="setting-row-sub">Само отметит вас, когда вы окажетесь рядом с местом</span>
        </div>
        <input
          type="checkbox"
          className="toggle"
          role="switch"
          aria-label="Автопроверка прихода"
          checked={autoCheck}
          onChange={(e) => {
            const v = e.target.checked
            setAutoCheck(v)
            safeSet('together_autocheck', v ? 'on' : 'off')
            actions.toast(v ? 'Автопроверка включена' : 'Автопроверка выключена')
          }}
        />
      </div>

      <div className="setting-group">
        <span className="setting-label">Радиус встречи: <b>{radius} м</b></span>
        <input type="range" min="50" max="2000" step="50" value={radius} onChange={(e) => setRadius(+e.target.value)} />
        <small>Насколько близко к точке должны быть вы, чтобы засчитать приход</small>
      </div>

      <div className="setting-group">
        <span className="setting-label">Окно прибытия: ±<b>{windowMin} мин</b></span>
        <input type="range" min="5" max="120" step="5" value={windowMin} onChange={(e) => setWindowMin(+e.target.value)} />
        <small>В какое окно до/после времени встречи можно прийти</small>
      </div>

      <div className="setting-group">
        <span className="setting-label">Запас на опоздание: <b>{graceMin} мин</b></span>
        <input type="range" min="0" max="120" step="5" value={graceMin} onChange={(e) => setGraceMin(+e.target.value)} />
        <small>На сколько можно опоздать после окна, чтобы план не стал «пропущен»</small>
      </div>

      <button className="btn btn-primary btn-block" onClick={saveSettings}>
        {saved ? '✓ Сохранено' : 'Сохранить настройки пары'}
      </button>
    </div>
  )
}
