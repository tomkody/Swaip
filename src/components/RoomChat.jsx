import { useState, useEffect, useRef, useCallback } from 'react'
import { getUserToken } from '../lib/room'
import { getSavedName, saveName, fetchMessages, sendMessage, subscribeToMessages, messagesUnavailable } from '../lib/chat'
import { track } from '../lib/analytics'
import './RoomChat.css'

// Post-match chat. Shown on the results screen in together mode so people can
// sort out the details (when / where / who's in) without leaving Swaip. Hides
// itself if the messages table isn't set up yet.
export default function RoomChat({ roomId }) {
  const userToken = useRef(getUserToken())
  const [messages, setMessages] = useState([])
  const [name, setName] = useState(getSavedName())
  const [nameInput, setNameInput] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [hidden, setHidden] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    let active = true
    fetchMessages(roomId).then(msgs => {
      if (!active) return
      if (messagesUnavailable) { setHidden(true); return }
      setMessages(msgs)
    })
    const unsub = subscribeToMessages(roomId, (m) => {
      setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
    })
    return () => { active = false; unsub() }
  }, [roomId])

  // Auto-scroll to the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const join = useCallback(() => {
    const n = nameInput.trim().slice(0, 24)
    if (!n) return
    saveName(n)
    setName(n)
  }, [nameInput])

  const send = useCallback(async () => {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setBody('')
    try {
      const saved = await sendMessage(roomId, userToken.current, name, text)
      if (saved) {
        setMessages(prev => prev.find(x => x.id === saved.id) ? prev : [...prev, saved])
        track('chat_message_sent', {})
      } else if (messagesUnavailable) {
        setHidden(true)
      }
    } catch (e) {
      console.error('Failed to send message:', e)
      setBody(text)   // restore so the message isn't lost
    } finally {
      setSending(false)
    }
  }, [body, sending, roomId, name])

  if (hidden || messagesUnavailable) return null

  return (
    <div className="chat">
      <div className="chat-head">
        <p className="chat-title">💬 Chat</p>
        <p className="chat-sub">Sort out the details — when, where, who's in.</p>
      </div>

      <div className="chat-list">
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet — say hi 👋</p>
        ) : (
          messages.map(m => {
            const mine = m.user_token === userToken.current
            return (
              <div key={m.id} className={`chat-msg ${mine ? 'chat-msg--mine' : ''}`}>
                {!mine && <span className="chat-msg-name">{m.name || 'Guest'}</span>}
                <span className="chat-bubble">{m.body}</span>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {name ? (
        <form className="chat-composer" onSubmit={e => { e.preventDefault(); send() }}>
          <input
            className="chat-input"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`Message as ${name}…`}
            maxLength={500}
            aria-label="Chat message"
          />
          <button className="chat-send" type="submit" disabled={!body.trim() || sending} aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      ) : (
        <form className="chat-composer" onSubmit={e => { e.preventDefault(); join() }}>
          <input
            className="chat-input"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Your name to join the chat…"
            maxLength={24}
            aria-label="Your name"
          />
          <button className="chat-send chat-join" type="submit" disabled={!nameInput.trim()}>Join</button>
        </form>
      )}
    </div>
  )
}
