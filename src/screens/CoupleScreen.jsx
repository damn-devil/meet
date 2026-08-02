import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { Icon } from '../components/Icon.jsx'
import { telegramUrl, imessageUrl, hasAnyContact } from '../lib/contacts.js'

export function CoupleScreen() {
  const { state, actions } = useStore()
  const me = state.user
  const partner = state.couple?.members?.find((m) => m.id !== me?.id)
  const inCouple = !!state.couple

  const incoming = state.requests.filter((r) => r.to_id === me?.id && r.status === 'pending')
  const outgoing = state.requests.filter((r) => r.from_id === me?.id && r.status === 'pending')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState(null)
  const [confirmBreak, setConfirmBreak] = useState(false)
  const [breaking, setBreaking] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [state.messages])

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

  const breakUp = async () => {
    setBreaking(true)
    try {
      await actions.breakUpCouple()
      setConfirmBreak(false)
      actions.toast('Пара разорвана', 'success')
    } catch (e) {
      actions.toast(e.message, 'error')
    } finally {
      setBreaking(false)
    }
  }

  const sendMessage = async () => {
    if (!msgText.trim() || sendingMsg) return
    setSendingMsg(true)
    try {
      await actions.sendMessage(msgText)
      setMsgText('')
    } catch (e) {
      actions.toast(e.message, 'error')
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="screen couple-screen">
      <header className="screen-header">
        <h1>Пара</h1>
        <p className="screen-sub">Статус пары, чат и приглашения</p>
      </header>

      {inCouple ? (
        <>
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
                <span className="couple-name">{partner?.name || '—'}</span>
              </div>
            </div>
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

          <div className="settings-card glass chat-card">
            <h3 className="card-title">Чат</h3>
            <div className="chat-list" ref={chatRef}>
              {state.messages.length === 0 && (
                <p className="chat-empty">Напишите что-нибудь партнёру 😊</p>
              )}
              {state.messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.user_id === me?.id ? 'mine' : ''}`}>
                  <div className="chat-msg-head">
                    <span className="chat-msg-avatar">
                      <Avatar url={m.avatar_url} emoji={m.avatar || '🙂'} size="comment" alt={m.name} />
                    </span>
                    <span className="chat-msg-name">{m.user_id === me?.id ? 'Вы' : m.name}</span>
                    <span className="chat-msg-time">
                      {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="chat-msg-text">{m.text}</div>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Сообщение..."
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={sendingMsg || !msgText.trim()}>➤</button>
            </div>
          </div>

          <div className="danger-zone">
            <button className="btn btn-danger-soft btn-block" onClick={() => setConfirmBreak(true)}>
              Разорвать пару
            </button>
            {confirmBreak && (
              <div className="danger-confirm glass">
                <p>Разорвать пару? Планы и общие данные будут удалены у обоих.</p>
                <div className="danger-actions">
                  <button className="btn btn-soft" onClick={() => setConfirmBreak(false)}>Отмена</button>
                  <button className="btn btn-danger" onClick={breakUp} disabled={breaking}>
                    {breaking ? 'Разрываем…' : 'Да, разорвать'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="settings-card glass">
            <h3 className="card-title">Вы пока не в паре</h3>
            <div className="settings-panel">
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
            </div>
          </div>
        </>
      )}
    </div>
  )
}
